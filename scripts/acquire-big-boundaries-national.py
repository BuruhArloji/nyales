#!/usr/bin/env python3
"""Acquire an immutable local snapshot of BIG's June 2026 village boundary layer.

Read-only source requests only. The tool writes local response pages and a manifest;
it does not import to NYALES, upload to R2, or activate a release.

Example:
  python3 scripts/acquire-big-boundaries-national.py \
    --output /workspace/big-2026-snapshot --resume

A partial output directory is intentionally retained after failures. Re-run with
--resume after checking the source and the previous acquisition manifest.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import hashlib
import json
import random
import socket
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path
from typing import Any

LAYER_URL = "https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH/BATAS_DESAKEL_AR/MapServer/0"
QUERY_URL = LAYER_URL + "/query"
SOURCE_ITEM = "8254536621ae45af8eb8948a6db324cc"
OUT_FIELDS = ",".join([
    "OBJECTID", "NAMOBJ", "KDEBPS", "KDEPUM", "KDCBPS", "KDCPUM",
    "KDBBPS", "KDPKAB", "KDPBPS", "KDPPUM", "TIPADM", "Status",
    "WADMKD", "WADMKC", "WADMKK", "WADMPR",
])
MAX_RESPONSE_BYTES = 25 * 1024 * 1024
USER_AGENT = "NYALES-boundary-audit/1.0 (read-only; resumable snapshot)"


class ResponseTooLarge(RuntimeError):
    pass


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha256(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_bytes(canonical_bytes(value) + b"\n")
    temporary.replace(path)


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as stream:
        return json.load(stream)


def fetch_json(url: str, params: dict[str, str], *, timeout: int = 60, attempts: int = 5) -> dict[str, Any]:
    request_url = url + "?" + urllib.parse.urlencode(params)
    last_error: Exception | None = None
    for attempt in range(attempts):
        request = urllib.request.Request(request_url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                raw = response.read(MAX_RESPONSE_BYTES + 1)
            if len(raw) > MAX_RESPONSE_BYTES:
                raise ResponseTooLarge(f"Response exceeded {MAX_RESPONSE_BYTES} bytes")
            result = json.loads(raw)
            if not isinstance(result, dict):
                raise ValueError("BIG returned a non-object response")
            if "error" in result:
                raise RuntimeError("BIG query error: " + json.dumps(result["error"], ensure_ascii=False)[:2000])
            return result
        except ResponseTooLarge:
            raise
        except urllib.error.HTTPError as exc:
            last_error = exc
            if exc.code not in (408, 425, 429, 500, 502, 503, 504) or attempt + 1 == attempts:
                raise
        except (urllib.error.URLError, TimeoutError, socket.timeout, json.JSONDecodeError) as exc:
            last_error = exc
            if attempt + 1 == attempts:
                raise
        wait = min(30.0, 1.0 * (2 ** attempt)) + random.random() * 0.25
        time.sleep(wait)
    raise RuntimeError(f"Request failed after retries: {last_error}")


def props_object_id(feature: dict[str, Any]) -> int | str | None:
    props = feature.get("properties") or {}
    for key, value in props.items():
        if key.casefold() == "objectid":
            return value
    return feature.get("id")


def page_filename(ids: list[int | str]) -> str:
    identity = ",".join(str(value) for value in ids).encode("utf-8")
    return "page-" + sha256(identity)[:20] + ".geojson"


def fetch_feature_block(ids: list[int | str], *, timeout: int) -> dict[str, Any]:
    result = fetch_json(QUERY_URL, {
        "objectIds": ",".join(str(value) for value in ids),
        "outFields": OUT_FIELDS,
        "returnGeometry": "true",
        "outSR": "4326",
        "f": "geojson",
    }, timeout=timeout)
    if result.get("type") != "FeatureCollection" or not isinstance(result.get("features"), list):
        raise RuntimeError("Unexpected BIG GeoJSON response")
    if result.get("exceededTransferLimit"):
        raise ResponseTooLarge("BIG reported exceededTransferLimit")
    actual = [props_object_id(feature) for feature in result["features"]]
    if sorted(map(str, actual)) != sorted(map(str, ids)) or len(set(map(str, actual))) != len(ids):
        raise RuntimeError("Partial, duplicate, or unexpected OBJECTID page")
    for feature in result["features"]:
        if not isinstance(feature.get("geometry"), dict):
            # Missing geometry is retained as an exception, not silently dropped.
            continue
        if feature["geometry"].get("type") not in ("Polygon", "MultiPolygon"):
            raise RuntimeError("Unexpected geometry type in source snapshot")
    return result


def valid_saved_page(path: Path, expected_ids: list[int | str]) -> bool:
    try:
        value = read_json(path)
        features = value.get("features", [])
        actual = [props_object_id(feature) for feature in features]
        return (
            value.get("type") == "FeatureCollection"
            and not value.get("exceededTransferLimit")
            and sorted(map(str, actual)) == sorted(map(str, expected_ids))
            and len(set(map(str, actual))) == len(expected_ids)
        )
    except (OSError, ValueError, TypeError):
        return False


def summarize_snapshot(output: Path, expected_ids: list[int | str], layer_metadata: dict[str, Any],
                       *, source_count: int, subset: bool, acquired_at: str,
                       expected_pages: set[str] | None = None) -> dict[str, Any]:
    requested = set(map(str, expected_ids))
    seen: set[str] = set()
    code_counts: Counter[str] = Counter()
    missing_pum = missing_bps = missing_geometry = feature_count = 0
    page_hashes: list[dict[str, Any]] = []
    page_paths = (output / "pages").glob("page-*.geojson")
    for path in sorted(path for path in page_paths if expected_pages is None or path.name in expected_pages):
        raw = path.read_bytes()
        collection = json.loads(raw)
        ids = []
        for feature in collection.get("features", []):
            feature_count += 1
            oid = props_object_id(feature)
            ids.append(str(oid))
            if oid is None:
                raise RuntimeError(f"Missing OBJECTID in {path.name}")
            if str(oid) in seen:
                raise RuntimeError(f"Duplicate OBJECTID across pages: {oid}")
            seen.add(str(oid))
            props = {str(k).casefold(): v for k, v in (feature.get("properties") or {}).items()}
            pum = str(props.get("kdepum") or "").strip()
            bps = str(props.get("kdebps") or "").strip()
            missing_pum += not bool(pum)
            missing_bps += not bool(bps)
            missing_geometry += not bool(feature.get("geometry"))
            if pum:
                code_counts[pum] += 1
        page_hashes.append({"file": path.name, "sha256": sha256(raw), "feature_count": len(ids), "objectids_sha256": sha256(",".join(sorted(ids)).encode())})
    if not seen.issubset(requested):
        raise RuntimeError("Saved pages contain OBJECTIDs outside the requested snapshot")
    complete = not subset and seen == requested and feature_count == source_count
    repeated_pum_excess = sum(count - 1 for count in code_counts.values() if count > 1)
    return {
        "source": LAYER_URL,
        "source_item_id": SOURCE_ITEM,
        "copyright_text": layer_metadata.get("copyrightText") or None,
        "release_claim": "Geodatabase data batas wilayah administrasi nasional edisi Juni 2026",
        "acquired_at": acquired_at,
        "status": "complete" if complete else "partial",
        "national_complete": complete,
        "rights_status": "unverified",
        "usage_note": "Local audit snapshot only; no permission to redistribute or activate is inferred from public query access.",
        "source_count": source_count,
        "requested_count": len(expected_ids),
        "acquired_count": feature_count,
        "unique_objectid_count": len(seen),
        "missing_objectid_count": len(requested - seen),
        "missing_kdepum_count": int(missing_pum),
        "missing_kdebps_count": int(missing_bps),
        "missing_geometry_count": int(missing_geometry),
        "repeated_kdepum_excess_occurrences": int(repeated_pum_excess),
        "page_count": len(page_hashes),
        "pages": page_hashes,
        "full_geometry_retained": True,
        "geometry_simplified": False,
        "imported_to_nyales": False,
        "activated": False,
    }


def acquire(output: Path, *, resume: bool, page_size: int, workers: int, timeout: int,
            max_features: int | None) -> dict[str, Any]:
    if page_size < 1 or page_size > 500:
        raise ValueError("--page-size must be between 1 and 500")
    if workers < 1 or workers > 4:
        raise ValueError("--workers must be between 1 and 4 to keep source load bounded")
    if max_features is not None and max_features < 1:
        raise ValueError("--max-features must be positive")
    if output.exists() and not resume:
        raise ValueError("Output directory already exists; use a NEW path or pass --resume")
    output.mkdir(parents=True, exist_ok=True)
    pages_dir = output / "pages"
    pages_dir.mkdir(exist_ok=True)

    layer_metadata = fetch_json(LAYER_URL, {"f": "json"}, timeout=timeout)
    spatial = layer_metadata.get("extent", {}).get("spatialReference", {})
    if spatial.get("wkid") not in (4326, 102100, 3857) and spatial.get("latestWkid") != 4326:
        raise ValueError(f"Unexpected BIG source CRS: {spatial}")
    field_names = {str(item.get("name", "")).casefold() for item in layer_metadata.get("fields", [])}
    required = {"objectid", "kdepum", "tipadm"}
    if not required.issubset(field_names):
        raise ValueError("Unexpected source schema; required fields are missing")
    count_result = fetch_json(QUERY_URL, {"where": "1=1", "returnCountOnly": "true", "f": "json"}, timeout=timeout)
    source_count = int(count_result["count"])
    ids_result = fetch_json(QUERY_URL, {"where": "1=1", "returnIdsOnly": "true", "f": "json"}, timeout=timeout)
    object_ids = ids_result.get("objectIds")
    if not isinstance(object_ids, list):
        raise ValueError("BIG did not return an OBJECTID list")
    object_ids = sorted(object_ids, key=lambda value: int(value))
    if len(object_ids) != source_count or len(set(map(str, object_ids))) != source_count:
        raise ValueError("Source count and unique OBJECTID enumeration do not agree")

    snapshot_path = output / "snapshot.json"
    if snapshot_path.exists():
        old = read_json(snapshot_path)
        if not resume:
            raise ValueError("snapshot.json already exists; use --resume")
        if old.get("source") != LAYER_URL or old.get("objectids_sha256") != sha256(",".join(map(str, object_ids)).encode()):
            raise ValueError("The live BIG OBJECTID snapshot changed; do not resume against a different release")
        if old.get("page_size") != page_size or old.get("max_features") != max_features:
            raise ValueError("Resume settings changed; use the original page size/scope or a NEW output folder")
    else:
        if resume and any(pages_dir.glob("page-*.geojson")):
            raise ValueError("Orphan pages exist without snapshot.json; inspect instead of overwriting")
        snapshot = {
            "source": LAYER_URL,
            "source_item_id": SOURCE_ITEM,
            "acquired_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
            "source_count": source_count,
            "objectids_sha256": sha256(",".join(map(str, object_ids)).encode()),
            "page_size": page_size,
            "max_features": max_features,
            "workers": workers,
            "rights_status": "unverified",
        }
        write_json(snapshot_path, snapshot)
        (output / "object_ids.json").write_bytes(canonical_bytes(object_ids) + b"\n")
        write_json(output / "source-layer-metadata.json", layer_metadata)

    acquired_at = read_json(snapshot_path)["acquired_at"]
    selected_ids = object_ids[:max_features] if max_features else object_ids
    subset = len(selected_ids) != source_count
    blocks = [selected_ids[start:start + page_size] for start in range(0, len(selected_ids), page_size)]
    work: list[tuple[Path, list[int | str]]] = []
    for block in blocks:
        path = pages_dir / page_filename(block)
        if valid_saved_page(path, block):
            continue
        work.append((path, block))

    first_error: Exception | None = None
    completed = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(fetch_feature_block, block, timeout=timeout): (path, block) for path, block in work}
        for future in concurrent.futures.as_completed(futures):
            path, block = futures[future]
            try:
                collection = future.result()
                write_json(path, collection)
                completed += len(block)
                if completed and completed % max(page_size * 20, 1) == 0:
                    print(f"saved additional {completed} features in this run", flush=True)
            except Exception as exc:  # retain prior pages; no destructive cleanup
                first_error = first_error or exc
                print(f"page failed ({len(block)} OBJECTIDs): {exc}", flush=True)
    membership_stable = False
    try:
        after_count = int(fetch_json(QUERY_URL, {"where": "1=1", "returnCountOnly": "true", "f": "json"}, timeout=timeout)["count"])
        after_ids = fetch_json(QUERY_URL, {"where": "1=1", "returnIdsOnly": "true", "f": "json"}, timeout=timeout).get("objectIds")
        after_ids = sorted(after_ids or [], key=lambda value: int(value))
        membership_stable = after_count == source_count and list(map(str, after_ids)) == list(map(str, object_ids))
        if not membership_stable:
            first_error = first_error or RuntimeError("BIG feature membership changed during acquisition")
    except Exception as exc:
        first_error = first_error or RuntimeError("Could not verify source membership after acquisition: " + str(exc))
    result = summarize_snapshot(output, selected_ids, layer_metadata, source_count=source_count,
                                subset=subset, acquired_at=acquired_at,
                                expected_pages={page_filename(block) for block in blocks})
    result["source_membership_stable"] = membership_stable
    if not membership_stable:
        result["status"] = "partial"
        result["national_complete"] = False
    result["requested_page_size"] = page_size
    result["worker_count"] = workers
    result["last_run_error"] = str(first_error) if first_error else None
    write_json(output / "acquisition.json", result)
    if first_error:
        raise RuntimeError("Acquisition remains partial; pages were retained for --resume") from first_error
    if result["acquired_count"] != len(selected_ids):
        raise RuntimeError("Acquisition remains partial; pages were retained for --resume")
    print(json.dumps({k: result[k] for k in ("status", "national_complete", "source_count", "acquired_count", "missing_kdepum_count", "missing_kdebps_count", "missing_geometry_count", "repeated_kdepum_excess_occurrences", "rights_status", "imported_to_nyales", "activated")}, ensure_ascii=False))
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path, help="New local folder for immutable source pages")
    parser.add_argument("--resume", action="store_true", help="Resume only if the live OBJECTID snapshot is unchanged")
    parser.add_argument("--page-size", type=int, default=50, help="Features per GET (1..500; default 50)")
    parser.add_argument("--workers", type=int, default=2, help="Bounded request concurrency (1..4; default 2)")
    parser.add_argument("--timeout", type=int, default=60)
    parser.add_argument("--max-features", type=int, help="Explicit partial smoke extract; never marks national_complete")
    args = parser.parse_args()
    acquire(args.output, resume=args.resume, page_size=args.page_size, workers=args.workers,
            timeout=args.timeout, max_features=args.max_features)


if __name__ == "__main__":
    main()
