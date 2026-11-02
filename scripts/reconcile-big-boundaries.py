#!/usr/bin/env python3
"""Compare BIG June 2026 village codes to the user's GeoPackage by exact PUM key.

No name-based, prefix-based, coordinate-based, or fuzzy crosswalk is created.
With no --big-snapshot, the script performs a local GeoPackage preflight only.
Output directories must be new so that review logs are never overwritten.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import json
import re
import sqlite3
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


OLD_FIELDS = [
    "fid", "big_oid", "desa_name", "desa_code_pum", "desa_code_bps",
    "desa_name_big", "kec_code_pum", "kecamatan", "kab_code_pum",
    "kabupaten_kota", "prov_code_pum", "provinsi", "admin_type",
]
CSV_FIELDS = [
    "exception_id", "category", "severity", "source", "source_record_id",
    "admin_code_pum", "desa_name", "resolution_status", "action",
    "old_values_json", "new_values_json",
]


def clean(value: Any) -> str:
    if value is None:
        return ""
    return " ".join(str(value).strip().split())


def code(value: Any) -> str:
    return clean(value)


def normalized_name(value: Any) -> str:
    return unicodedata.normalize("NFC", clean(value)).casefold()


def canonical(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha256(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def field(props: dict[str, Any], *names: str) -> Any:
    lookup = {str(key).casefold(): value for key, value in props.items()}
    for name in names:
        if name.casefold() in lookup:
            return lookup[name.casefold()]
    return None


def old_record(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "source_id": clean(row.get("big_oid") or row.get("fid")),
        "code": code(row.get("desa_code_pum")),
        "bps": code(row.get("desa_code_bps")),
        "name": clean(row.get("desa_name_big") or row.get("desa_name")),
        "district_code": code(row.get("kec_code_pum")),
        "district_name": clean(row.get("kecamatan")),
        "regency_code": code(row.get("kab_code_pum")),
        "regency_name": clean(row.get("kabupaten_kota")),
        "province_code": code(row.get("prov_code_pum")),
        "province_name": clean(row.get("provinsi")),
        "type": {"1": "desa", "2": "kelurahan", "0": "lainnya"}.get(clean(row.get("admin_type")), clean(row.get("admin_type"))),
    }


def big_record(feature: dict[str, Any]) -> dict[str, Any]:
    props = feature.get("properties") or {}
    raw_type = field(props, "TIPADM")
    type_value = {1: "desa", 2: "kelurahan", 999: "lainnya"}.get(raw_type, clean(raw_type))
    return {
        "source_id": clean(field(props, "OBJECTID") or feature.get("id")),
        "code": code(field(props, "KDEPUM")),
        "bps": code(field(props, "KDEBPS")),
        "name": clean(field(props, "WADMKD", "NAMOBJ")),
        "district_code": code(field(props, "KDCPUM")),
        "district_name": clean(field(props, "WADMKC")),
        "regency_code": code(field(props, "KDPKAB")),
        "regency_name": clean(field(props, "WADMKK")),
        "province_code": code(field(props, "KDPPUM")),
        "province_name": clean(field(props, "WADMPR")),
        "type": type_value,
        "boundary_status": clean(field(props, "Status")),
        "geometry_present": bool(feature.get("geometry")),
    }


def values_for_comparison(record: dict[str, Any]) -> dict[str, Any]:
    return {key: record.get(key, "") for key in (
        "name", "district_code", "district_name", "regency_code", "regency_name",
        "province_code", "province_name", "type",
    )}


def values_differ(old: dict[str, Any], new: dict[str, Any]) -> bool:
    a, b = values_for_comparison(old), values_for_comparison(new)
    for key in a:
        if key.endswith("_name") or key == "name":
            if normalized_name(a[key]) != normalized_name(b[key]):
                return True
        elif clean(a[key]) != clean(b[key]):
            return True
    return False


def row_exception(category: str, source: str, record: dict[str, Any] | None,
                  *, old: dict[str, Any] | None = None, new: dict[str, Any] | None = None,
                  severity: str = "review", action: str = "Review against an authoritative crosswalk; do not auto-map") -> dict[str, Any]:
    record = record or {}
    material = "|".join((category, source, clean(record.get("source_id")), clean(record.get("code"))))
    return {
        "exception_id": sha256(material.encode("utf-8"))[:16],
        "category": category,
        "severity": severity,
        "source": source,
        "source_record_id": clean(record.get("source_id")),
        "admin_code_pum": clean(record.get("code")),
        "desa_name": clean(record.get("name")),
        "resolution_status": "unresolved",
        "action": action,
        "old_values_json": json.dumps(old or {}, ensure_ascii=False, sort_keys=True),
        "new_values_json": json.dumps(new or {}, ensure_ascii=False, sort_keys=True),
    }


def reconcile_records(old_records: list[dict[str, Any]], new_records: list[dict[str, Any]] | None) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    old_by_code: dict[str, list[dict[str, Any]]] = defaultdict(list)
    new_by_code: dict[str, list[dict[str, Any]]] = defaultdict(list)
    exceptions: list[dict[str, Any]] = []
    old_bps_missing = 0
    old_pum_missing = 0
    for record in old_records:
        old_bps_missing += not bool(record.get("bps"))
        if not record.get("code"):
            old_pum_missing += 1
            exceptions.append(row_exception("OLD_PUM_MISSING", "GeoPackage 2022", record,
                                            action="Resolve with official PUM code history or keep as an explicit non-village exception"))
        else:
            old_by_code[record["code"]].append(record)
    new_bps_missing = new_pum_missing = new_geometry_missing = 0
    if new_records is not None:
        for record in new_records:
            new_bps_missing += not bool(record.get("bps"))
            new_geometry_missing += not bool(record.get("geometry_present"))
            if not record.get("code"):
                new_pum_missing += 1
                exceptions.append(row_exception("BIG_PUM_MISSING", "BIG June 2026", record,
                                                action="Keep outside village assignment; resolve TIPADM/status and official code before activation"))
            else:
                new_by_code[record["code"]].append(record)
            if not record.get("geometry_present"):
                exceptions.append(row_exception("BIG_GEOMETRY_MISSING", "BIG June 2026", record,
                                                severity="blocker", action="Do not import this feature as an operational boundary"))

    old_dupe_records = 0
    for key, rows in old_by_code.items():
        if len(rows) > 1:
            old_dupe_records += len(rows)
            for record in rows:
                exceptions.append(row_exception("OLD_PUM_DUPLICATE", "GeoPackage 2022", record,
                                                severity="blocker", action="Resolve duplicate canonical key before crosswalk"))
    new_dupe_records = 0
    for key, rows in new_by_code.items():
        if len(rows) > 1:
            new_dupe_records += len(rows)
            for record in rows:
                exceptions.append(row_exception("BIG_PUM_DUPLICATE", "BIG June 2026", record,
                                                severity="blocker", action="Resolve duplicate canonical key before activation"))

    old_unique = {key: rows[0] for key, rows in old_by_code.items() if len(rows) == 1}
    new_unique = {key: rows[0] for key, rows in new_by_code.items() if len(rows) == 1}
    old_keys, new_keys = set(old_unique), set(new_unique)
    if new_records is None:
        old_only, new_only, matched = set(), set(), set()
    else:
        old_only = old_keys - new_keys
        new_only = new_keys - old_keys
        matched = old_keys & new_keys
    attribute_diffs = 0
    for key in sorted(old_only):
        record = old_unique[key]
        exceptions.append(row_exception("OLD_ONLY_PUM", "GeoPackage 2022", record, old=record,
                                        action="Find official successor/split/merge crosswalk; do not match by name"))
    for key in sorted(new_only):
        record = new_unique[key]
        exceptions.append(row_exception("BIG_ONLY_PUM", "BIG June 2026", record, new=record,
                                        action="Confirm whether new code reflects a split, new unit, correction, or non-operational feature"))
    for key in sorted(matched):
        old, new = old_unique[key], new_unique[key]
        if values_differ(old, new):
            attribute_diffs += 1
            exceptions.append(row_exception("ATTRIBUTE_OR_HIERARCHY_CHANGED", "PUM exact match", old,
                                            old=old, new=new,
                                            action="Review name, parent code/name, type, and boundary status; geometry is not compared here"))

    summary = {
        "comparison_method": "exact KDEPUM only; no fuzzy/name/prefix/coordinate crosswalk",
        "comparison_complete": new_records is not None,
        "old_feature_count": len(old_records),
        "old_pum_populated_feature_count": sum(bool(r.get("code")) for r in old_records),
        "old_pum_distinct_code_count": len(old_by_code),
        "old_pum_missing_feature_count": int(old_pum_missing),
        "old_pum_duplicate_code_count": sum(len(rows) > 1 for rows in old_by_code.values()),
        "old_pum_duplicate_feature_count": old_dupe_records,
        "old_bps_missing_feature_count": int(old_bps_missing),
        "new_feature_count": len(new_records) if new_records is not None else None,
        "new_pum_populated_feature_count": sum(bool(r.get("code")) for r in new_records or []),
        "new_pum_distinct_code_count": len(new_by_code) if new_records is not None else None,
        "new_pum_missing_feature_count": int(new_pum_missing) if new_records is not None else None,
        "new_pum_duplicate_code_count": sum(len(rows) > 1 for rows in new_by_code.values()) if new_records is not None else None,
        "new_pum_duplicate_feature_count": int(new_dupe_records) if new_records is not None else None,
        "new_bps_missing_feature_count": int(new_bps_missing) if new_records is not None else None,
        "new_geometry_missing_feature_count": int(new_geometry_missing) if new_records is not None else None,
        "exact_pum_matches": len(matched) if new_records is not None else None,
        "old_only_pum_codes": len(old_only) if new_records is not None else None,
        "new_only_pum_codes": len(new_only) if new_records is not None else None,
        "matched_codes_with_attribute_or_hierarchy_changes": attribute_diffs if new_records is not None else None,
        "exception_rows": len(exceptions),
        "activation_ready": False,
    }
    return summary, exceptions


def load_gpkg(path: Path, layer: str) -> tuple[list[dict[str, Any]], str]:
    if not path.is_file():
        raise FileNotFoundError(path)
    uri = "file:" + str(path.resolve()) + "?mode=ro"
    connection = sqlite3.connect(uri, uri=True)
    try:
        catalog = connection.execute("SELECT table_name FROM gpkg_contents WHERE data_type='features'").fetchall()
        layer_names = {row[0] for row in catalog}
        if layer not in layer_names:
            raise ValueError(f"Layer {layer!r} not found in GeoPackage feature tables")
        if not re.fullmatch(r"[A-Za-z0-9_]+", layer):
            raise ValueError("Unexpected layer name")
        columns = {row[1] for row in connection.execute(f'PRAGMA table_info("{layer}")')}
        required = set(OLD_FIELDS)
        missing = required - columns
        if missing:
            raise ValueError(f"GeoPackage missing required columns: {sorted(missing)}")
        query = f'SELECT {", ".join("\"" + name + "\"" for name in OLD_FIELDS)} FROM "{layer}" ORDER BY fid'
        rows = []
        cursor = connection.execute(query)
        cursor.row_factory = sqlite3.Row
        for row in cursor:
            rows.append(old_record(dict(row)))
        return rows, sha256_file(path)
    finally:
        connection.close()


def load_big_snapshot(folder: Path, *, allow_partial: bool) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    manifest_path = folder / "acquisition.json"
    if not manifest_path.is_file():
        raise ValueError("BIG snapshot lacks acquisition.json")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not allow_partial and (manifest.get("status") != "complete" or not manifest.get("national_complete")):
        raise ValueError("BIG snapshot is not complete; use --allow-partial only for an explicitly partial audit")
    pages = folder / "pages"
    records: list[dict[str, Any]] = []
    for path in sorted(pages.glob("page-*.geojson")):
        collection = json.loads(path.read_text(encoding="utf-8"))
        if collection.get("type") != "FeatureCollection":
            raise ValueError(f"Unexpected page format: {path}")
        for feature in collection.get("features", []):
            records.append(big_record(feature))
    if len(records) != int(manifest.get("acquired_count", -1)):
        raise ValueError("BIG snapshot page count differs from acquisition manifest")
    return records, manifest


def write_outputs(output: Path, summary: dict[str, Any], exceptions: list[dict[str, Any]],
                  *, gpkg: Path, gpkg_sha256: str, big_manifest: dict[str, Any] | None) -> None:
    if output.exists():
        raise ValueError("Output directory already exists; choose a NEW review folder")
    output.mkdir(parents=True)
    summary = {
        "created_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "input_geopackage": str(gpkg.resolve()),
        "input_geopackage_sha256": gpkg_sha256,
        "input_layer": "desa_pop_2026",
        "big_source": big_manifest.get("source") if big_manifest else None,
        "big_acquisition_status": big_manifest.get("status") if big_manifest else None,
        **summary,
        "review_note": "This report does not authorize data redistribution or boundary activation. Resolve each exception with an authoritative crosswalk and written usage terms.",
    }
    (output / "summary.json").write_bytes(canonical(summary) + b"\n")
    with (output / "exceptions.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=CSV_FIELDS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(exceptions)
    (output / "README.txt").write_text(
        "Boundary release exception register\n"
        "- Matching key: exact KDEPUM only.\n"
        "- No name/prefix/coordinate auto-crosswalk is generated.\n"
        "- `exceptions.csv` is a human-review queue; `unresolved` rows are not importable assignments.\n"
        "- Missing BPS codes are summarized by count because the gap is systemic; the source data are not modified.\n"
        "- Geometry topology/overlap and population transfer are not evaluated by this code comparison.\n"
        "- This file does not grant a license or activate a release.\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--gpkg", required=True, type=Path)
    parser.add_argument("--layer", default="desa_pop_2026")
    parser.add_argument("--big-snapshot", type=Path, help="Folder produced by acquire-big-boundaries-national.py")
    parser.add_argument("--allow-partial", action="store_true", help="Allow comparison against a subset; output remains marked incomplete")
    parser.add_argument("--output", required=True, type=Path, help="New folder for summary.json and exceptions.csv")
    args = parser.parse_args()
    old_records, gpkg_hash = load_gpkg(args.gpkg, args.layer)
    new_records: list[dict[str, Any]] | None = None
    big_manifest = None
    if args.big_snapshot:
        new_records, big_manifest = load_big_snapshot(args.big_snapshot, allow_partial=args.allow_partial)
    summary, exceptions = reconcile_records(old_records, new_records)
    if new_records is not None and big_manifest and not big_manifest.get("national_complete"):
        summary["comparison_complete"] = False
    write_outputs(args.output, summary, exceptions, gpkg=args.gpkg,
                  gpkg_sha256=gpkg_hash, big_manifest=big_manifest)
    print(json.dumps({"output": str(args.output.resolve()), **summary}, ensure_ascii=False))


if __name__ == "__main__":
    main()
