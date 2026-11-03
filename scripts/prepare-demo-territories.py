#!/usr/bin/env python3
"""Prepare a clearly synthetic, local-only NYALES territory demonstration.

The user-provided BIG 2022-based GeoPackage is opened read-only. PUM exact codes
are the only assignment key. No production database, Cloudflare bucket, or app
activation is touched by this script.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import gzip
import hashlib
import json
import math
import shutil
import sqlite3
import subprocess
import tempfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable

DEFAULT_GPKG = Path("/workspace/indonesia_desa_pop_2026.gpkg")
DEFAULT_LAYER = "desa_pop_2026"
DEFAULT_VALID_FROM = "2026-11-03"
SOURCE_BOUNDARY_EDITION = "BIG 2022-based (source notes identify the 2022 geodatabase; not BIG June 2026)"
POPULATION_SOURCE = "WorldPop 2026 R2025A constrained 100 m raster; fractional-area estimates, not census counts"
MAXIMUM_TILE_BYTES = 4_000_000

AREAS: dict[str, dict[str, Any]] = {
    "DEMO-AREA-01": {
        "name": "DEMO Area 01 – Sumatra",
        "region": "Sumatra",
        "owner_id": "DEMO-PIC-01",
        "owner_name": "DEMO Owner 01",
        "provinces": [
            "Aceh", "Sumatera Utara", "Sumatera Barat", "Riau", "Kepulauan Riau",
            "Jambi", "Sumatera Selatan", "Bengkulu", "Lampung", "Kepulauan Bangka Belitung",
        ],
        "color": "#2563eb",
    },
    "DEMO-AREA-02": {
        "name": "DEMO Area 02 – Jawa–Bali",
        "region": "Jawa–Bali",
        "owner_id": "DEMO-PIC-02",
        "owner_name": "DEMO Owner 02",
        "provinces": [
            "DKI Jakarta", "Jawa Barat", "Jawa Tengah", "Daerah Istimewa Yogyakarta",
            "Jawa Timur", "Banten", "Bali",
        ],
        "color": "#16a34a",
    },
    "DEMO-AREA-03": {
        "name": "DEMO Area 03 – Kalimantan–Sulawesi",
        "region": "Kalimantan–Sulawesi",
        "owner_id": "DEMO-PIC-03",
        "owner_name": "DEMO Owner 03",
        "provinces": [
            "Kalimantan Barat", "Kalimantan Tengah", "Kalimantan Selatan",
            "Kalimantan Timur", "Kalimantan Utara", "Sulawesi Utara", "Sulawesi Tengah",
            "Sulawesi Selatan", "Sulawesi Tenggara", "Gorontalo", "Sulawesi Barat",
        ],
        "color": "#f59e0b",
    },
    "DEMO-AREA-04": {
        "name": "DEMO Area 04 – Nusa Tenggara–Maluku–Papua",
        "region": "Nusa Tenggara–Maluku–Papua",
        "owner_id": "DEMO-PIC-04",
        "owner_name": "DEMO Owner 04",
        "provinces": [
            "Nusa Tenggara Barat", "Nusa Tenggara Timur", "Maluku", "Maluku Utara",
            "Papua", "Papua Barat", "Papua Barat Daya", "Papua Pegunungan",
            "Papua Selatan", "Papua Tengah",
        ],
        "color": "#a855f7",
    },
}
PROVINCE_TO_AREA = {
    province: area_id
    for area_id, area in AREAS.items()
    for province in area["provinces"]
}
REVIEW_ID = "DEMO-REVIEW"
REVIEW_NAME = "DEMO – Perlu review (bukan area sales)"

ASSIGNMENT_FIELDS = [
    "boundary_id", "source_fid", "big_oid", "admin_code_pum", "desa_name", "admin_type",
    "province_name", "province_code_pum", "kabupaten_kota", "kab_code_pum", "kecamatan",
    "kec_code_pum", "demo_area_id", "demo_area_name", "demo_owner_id", "demo_owner_name",
    "effective_from", "effective_to", "assignment_status", "is_synthetic", "assignment_basis",
    "source_boundary_edition", "population_2026", "population_density_km2", "review_reason",
]
EXCEPTION_FIELDS = [
    "exception_id", "category", "source_fid", "big_oid", "admin_code_pum", "desa_name",
    "province_name", "resolution_status", "action", "is_synthetic_assignment",
]
TILE_PROPERTIES = [
    "source_fid", "big_oid", "admin_code_pum", "desa_name", "admin_type", "province_name",
    "province_code_pum", "kabupaten_kota", "kecamatan", "demo_area_id", "demo_area_name",
    "demo_owner_id", "demo_owner_name", "assignment_status", "is_synthetic",
    "population_2026", "population_density_km2",
]


def clean(value: Any) -> str:
    if value is None:
        return ""
    return " ".join(str(value).strip().split())


def finite_number(value: Any) -> int | float | None:
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number):
        return None
    return int(number) if number.is_integer() else number


def linear_quantile(values: list[float], probability: float) -> float:
    """Compute a linearly interpolated quantile from an already sorted list."""
    if not values:
        raise ValueError("Cannot compute a density quantile without valid values")
    if not 0 <= probability <= 1:
        raise ValueError("Quantile probability must be between 0 and 1")
    position = (len(values) - 1) * probability
    lower = math.floor(position)
    upper = math.ceil(position)
    fraction = position - lower
    value = values[lower] * (1 - fraction) + values[upper] * fraction
    return round(value, 6)


def population_density_summary(records: list[dict[str, Any]]) -> dict[str, Any]:
    """Describe source density and five equal-frequency classes for the demo map."""
    values = [
        float(value)
        for row in records
        if (value := finite_number(row.get("pop_density_km2"))) is not None
    ]
    if not values:
        raise ValueError("Source has no valid population density values")
    values.sort()
    return {
        "field": "population_density_km2",
        "source_field": "pop_density_km2",
        "units": "people/km²",
        "method": "five equal-frequency quantile classes across valid village/kelurahan polygons; linear interpolation",
        "quantile_percentiles": [20, 40, 60, 80],
        "quantile_breaks": [linear_quantile(values, p) for p in (0.2, 0.4, 0.6, 0.8)],
        "valid_feature_count": len(values),
        "missing_feature_count": len(records) - len(values),
        "minimum": round(values[0], 6),
        "maximum": round(values[-1], 6),
        "caveat": "WorldPop 2026 estimated population density per administrative polygon; modeled estimate, not census or observed population.",
    }


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False).encode("utf-8") + b"\n"


def validate_effective_interval(start: str, end: str | None) -> None:
    try:
        start_day = dt.date.fromisoformat(start)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Invalid effective_from date: {start!r}") from exc
    if end:
        try:
            end_day = dt.date.fromisoformat(end)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Invalid effective_to date: {end!r}") from exc
        if end_day <= start_day:
            raise ValueError("effective_to must be after effective_from (half-open interval)")


def assignment_plan(row: dict[str, Any], *, duplicate_codes: set[str] | None = None) -> dict[str, Any]:
    """Return a deterministic synthetic assignment or a review-only exception."""
    duplicate_codes = duplicate_codes or set()
    code = clean(row.get("desa_code_pum"))
    province = clean(row.get("provinsi"))
    reasons: list[str] = []
    if not code:
        reasons.append("PUM_CODE_MISSING")
    elif code in duplicate_codes:
        reasons.append("PUM_CODE_DUPLICATE")
    area_id = PROVINCE_TO_AREA.get(province)
    if not area_id:
        reasons.append("UNKNOWN_PROVINCE")
    return {
        "admin_code_pum": code,
        "province_name": province,
        "demo_area_id": area_id if not reasons else REVIEW_ID,
        "assignment_status": "DEMO_SYNTHETIC" if not reasons else "EXCEPTION_NEEDS_REVIEW",
        "review_reasons": reasons,
    }


def validate_assignment_intervals(rows: Iterable[dict[str, Any]]) -> None:
    """Reject overlapping assignments for one PUM code; intervals are [from,to)."""
    grouped: dict[str, list[tuple[dt.date, dt.date | None]]] = defaultdict(list)
    for row in rows:
        if row.get("assignment_status") != "DEMO_SYNTHETIC":
            continue
        if row.get("is_synthetic") not in (True, "true", "True", 1, "1"):
            raise ValueError("Every demo ownership assignment must be explicitly synthetic")
        code = clean(row.get("admin_code_pum"))
        if not code:
            raise ValueError("A synthetic Area assignment must have an exact PUM code")
        start = dt.date.fromisoformat(clean(row.get("effective_from")))
        end_raw = clean(row.get("effective_to"))
        end = dt.date.fromisoformat(end_raw) if end_raw else None
        if end and end <= start:
            raise ValueError(f"Invalid interval for {code}: end must be after start")
        grouped[code].append((start, end))
    for code, intervals in grouped.items():
        intervals.sort(key=lambda item: item[0])
        previous_end: dt.date | None = None
        first = True
        for start, end in intervals:
            if not first and (previous_end is None or start < previous_end):
                raise ValueError(f"Overlapping effective assignments for PUM code {code}")
            previous_end = end
            first = False


def source_schema(connection: sqlite3.Connection, layer: str) -> tuple[list[str], int]:
    if not layer.replace("_", "").isalnum():
        raise ValueError("Layer name contains unexpected characters")
    names = {row[0] for row in connection.execute("SELECT table_name FROM gpkg_contents WHERE data_type='features'")}
    if layer not in names:
        raise ValueError(f"Feature layer not found: {layer}")
    columns = [row[1] for row in connection.execute(f'PRAGMA table_info("{layer}")')]
    required = {
        "fid", "geom", "big_oid", "desa_name", "desa_code_pum", "desa_code_bps",
        "kec_code_pum", "kecamatan", "kab_code_pum", "kabupaten_kota",
        "prov_code_pum", "provinsi", "admin_type", "pop_2026", "pop_density_km2",
    }
    missing = required - set(columns)
    if missing:
        raise ValueError(f"Missing expected GeoPackage fields: {sorted(missing)}")
    srs = connection.execute(
        "SELECT srs_id, geometry_type_name FROM gpkg_geometry_columns WHERE table_name=?", (layer,)
    ).fetchone()
    if not srs:
        raise ValueError("GeoPackage feature layer has no geometry metadata")
    return columns, int(srs[0])


def load_source_attributes(gpkg: Path, layer: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    uri = f"file:{gpkg.resolve()}?mode=ro"
    connection = sqlite3.connect(uri, uri=True)
    connection.row_factory = sqlite3.Row
    try:
        columns, srs_id = source_schema(connection, layer)
        fields = [
            "fid", "big_oid", "desa_name", "desa_code_pum", "desa_code_bps", "desa_name_big",
            "kec_code_pum", "kecamatan", "kab_code_pum", "kabupaten_kota", "prov_code_pum",
            "provinsi", "admin_type", "pop_2026", "pop_density_km2",
        ]
        query = f'SELECT {", ".join(chr(34) + field + chr(34) for field in fields)} FROM "{layer}" ORDER BY fid'
        records: list[dict[str, Any]] = []
        code_counts: Counter[str] = Counter()
        provinces: Counter[str] = Counter()
        bps_missing = 0
        total_pop = 0.0
        pop_missing = 0
        for raw in connection.execute(query):
            row = dict(raw)
            row["fid"] = int(row["fid"])
            row["desa_code_pum"] = clean(row.get("desa_code_pum"))
            row["provinsi"] = clean(row.get("provinsi"))
            if row["desa_code_pum"]:
                code_counts[row["desa_code_pum"]] += 1
            provinces[row["provinsi"] or "(kosong)"] += 1
            bps_missing += not bool(clean(row.get("desa_code_bps")))
            population = finite_number(row.get("pop_2026"))
            if population is None:
                pop_missing += 1
            else:
                total_pop += population
            records.append(row)
        duplicate_codes = {code for code, count in code_counts.items() if count > 1}
        summary = {
            "feature_count": len(records),
            "srs_id": srs_id,
            "pum_populated_feature_count": sum(bool(row["desa_code_pum"]) for row in records),
            "pum_unique_code_count": len(code_counts),
            "pum_missing_feature_count": sum(not bool(row["desa_code_pum"]) for row in records),
            "pum_duplicate_code_count": len(duplicate_codes),
            "pum_duplicate_feature_count": sum(count for count in code_counts.values() if count > 1),
            "bps_missing_feature_count": bps_missing,
            "population_value_missing_count": pop_missing,
            "population_2026_sum_estimate": round(total_pop, 3),
            "provinces": dict(sorted(provinces.items())),
        }
        return records, {**summary, "duplicate_codes": duplicate_codes}
    finally:
        connection.close()


def geometry_pass(
    gpkg: Path,
    layer: str,
    records: list[dict[str, Any]],
    duplicates: set[str],
    geojsonl_path: Path | None,
    batch_size: int,
) -> tuple[dict[int, list[str]], int, int]:
    try:
        import pyogrio
        from shapely.geometry import mapping
    except ImportError as exc:
        raise RuntimeError("This builder requires pyogrio and shapely in the sandbox Python environment") from exc

    reasons_by_fid: dict[int, list[str]] = {}
    record_by_fid = {int(row["fid"]): row for row in records}
    valid_geometry_count = 0
    exported_count = 0
    stream = geojsonl_path.open("w", encoding="utf-8", newline="\n") if geojsonl_path else None
    try:
        total = len(records)
        for offset in range(0, total, batch_size):
            frame = pyogrio.read_dataframe(
                gpkg,
                layer=layer,
                columns=[],
                skip_features=offset,
                max_features=min(batch_size, total - offset),
                fid_as_index=True,
                use_arrow=False,
            )
            for fid_raw, geom in zip(frame.index.tolist(), frame.geometry.tolist()):
                fid = int(fid_raw)
                row = record_by_fid[fid]
                reasons = assignment_plan(row, duplicate_codes=duplicates)["review_reasons"]
                if geom is None or geom.is_empty:
                    reasons = [*reasons, "GEOMETRY_EMPTY_OR_MISSING"]
                elif not geom.is_valid:
                    reasons = [*reasons, "GEOMETRY_INVALID"]
                else:
                    valid_geometry_count += 1
                reasons_by_fid[fid] = reasons
                if stream is None or geom is None or geom.is_empty or not geom.is_valid:
                    continue
                plan = assignment_plan(row, duplicate_codes=duplicates)
                assigned = not reasons
                area_id = plan["demo_area_id"] if assigned else REVIEW_ID
                area = AREAS.get(area_id)
                props = {
                    "source_fid": fid,
                    "big_oid": finite_number(row.get("big_oid")),
                    "admin_code_pum": clean(row.get("desa_code_pum")) or None,
                    "desa_name": clean(row.get("desa_name_big")) or clean(row.get("desa_name")) or None,
                    "admin_type": {"1": "desa", "2": "kelurahan", "0": "lainnya"}.get(clean(row.get("admin_type")), clean(row.get("admin_type")) or None),
                    "province_name": clean(row.get("provinsi")) or None,
                    "province_code_pum": clean(row.get("prov_code_pum")) or None,
                    "kabupaten_kota": clean(row.get("kabupaten_kota")) or None,
                    "kecamatan": clean(row.get("kecamatan")) or None,
                    "demo_area_id": area_id,
                    "demo_area_name": area["name"] if area else REVIEW_NAME,
                    "demo_owner_id": area["owner_id"] if area else None,
                    "demo_owner_name": area["owner_name"] if area else None,
                    "assignment_status": "DEMO_SYNTHETIC" if assigned else "EXCEPTION_NEEDS_REVIEW",
                    "is_synthetic": True,
                    "population_2026": finite_number(row.get("pop_2026")),
                    "population_density_km2": finite_number(row.get("pop_density_km2")),
                }
                feature = {
                    "type": "Feature",
                    "id": fid,
                    "geometry": mapping(geom),
                    "properties": props,
                }
                stream.write(json.dumps(feature, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n")
                exported_count += 1
            if (offset // batch_size) % 20 == 0:
                print(f"geometry pass: {min(offset + batch_size, total):,}/{total:,} features", flush=True)
    finally:
        if stream:
            stream.close()
    return reasons_by_fid, valid_geometry_count, exported_count


def admin_type_label(value: Any) -> str:
    raw = clean(value)
    return {"1": "desa", "2": "kelurahan", "0": "lainnya"}.get(raw, raw or "tidak diketahui")


def write_areas(output: Path, valid_from: str, area_counts: dict[str, dict[str, Any]]) -> None:
    with (output / "areas.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        fields = [
            "demo_area_id", "demo_area_name", "region", "synthetic_owner_id", "synthetic_owner_name",
            "provinces", "assigned_units", "estimated_population_2026", "effective_from", "effective_to",
            "is_synthetic", "assignment_basis", "operational_status",
        ]
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        for area_id, area in AREAS.items():
            stats = area_counts[area_id]
            writer.writerow({
                "demo_area_id": area_id,
                "demo_area_name": area["name"],
                "region": area["region"],
                "synthetic_owner_id": area["owner_id"],
                "synthetic_owner_name": area["owner_name"],
                "provinces": " | ".join(area["provinces"]),
                "assigned_units": stats["assigned_units"],
                "estimated_population_2026": round(stats["population"], 3),
                "effective_from": valid_from,
                "effective_to": "",
                "is_synthetic": "true",
                "assignment_basis": "province_macroregion; not optimized for outlet coverage, workload, or travel time",
                "operational_status": "DEMO_NOT_OPERATIONAL",
            })


def write_assignments_and_exceptions(
    output: Path,
    records: list[dict[str, Any]],
    duplicates: set[str],
    reasons_by_fid: dict[int, list[str]],
    valid_from: str,
) -> tuple[dict[str, dict[str, Any]], dict[str, Any]]:
    validate_effective_interval(valid_from, None)
    area_counts: dict[str, dict[str, Any]] = {
        area_id: {"assigned_units": 0, "population": 0.0, "province_names": set()}
        for area_id in AREAS
    }
    all_assignments: list[dict[str, Any]] = []
    exception_rows: list[dict[str, Any]] = []
    assignment_status_counts: Counter[str] = Counter()
    issue_counts: Counter[str] = Counter()
    exception_feature_count = 0
    assigned_codes: set[str] = set()
    for row in records:
        fid = int(row["fid"])
        reasons = reasons_by_fid.get(fid, [])
        plan = assignment_plan(row, duplicate_codes=duplicates)
        reasons = list(dict.fromkeys([*plan["review_reasons"], *reasons]))
        code = clean(row.get("desa_code_pum"))
        assigned = not reasons
        area_id = plan["demo_area_id"] if assigned else REVIEW_ID
        area = AREAS.get(area_id)
        population = finite_number(row.get("pop_2026"))
        if assigned:
            if code in assigned_codes:
                raise ValueError(f"Duplicate assignment key found after preflight: {code}")
            assigned_codes.add(code)
            area_counts[area_id]["assigned_units"] += 1
            area_counts[area_id]["province_names"].add(clean(row.get("provinsi")))
            if population is not None:
                area_counts[area_id]["population"] += population
            status = "DEMO_SYNTHETIC"
        else:
            status = "EXCEPTION_NEEDS_REVIEW"
            exception_feature_count += 1
        assignment_status_counts[status] += 1
        reason_text = ";".join(reasons)
        assignment = {
            "boundary_id": f"BIG22-PUM:{code}" if code else f"BIG22-FID:{fid}",
            "source_fid": fid,
            "big_oid": clean(row.get("big_oid")),
            "admin_code_pum": code,
            "desa_name": clean(row.get("desa_name_big")) or clean(row.get("desa_name")),
            "admin_type": admin_type_label(row.get("admin_type")),
            "province_name": clean(row.get("provinsi")),
            "province_code_pum": clean(row.get("prov_code_pum")),
            "kabupaten_kota": clean(row.get("kabupaten_kota")),
            "kab_code_pum": clean(row.get("kab_code_pum")),
            "kecamatan": clean(row.get("kecamatan")),
            "kec_code_pum": clean(row.get("kec_code_pum")),
            "demo_area_id": area_id,
            "demo_area_name": area["name"] if area else REVIEW_NAME,
            "demo_owner_id": area["owner_id"] if area else "",
            "demo_owner_name": area["owner_name"] if area else "",
            "effective_from": valid_from if assigned else "",
            "effective_to": "",
            "assignment_status": status,
            "is_synthetic": "true",
            "assignment_basis": "province_macroregion" if assigned else "",
            "source_boundary_edition": SOURCE_BOUNDARY_EDITION,
            "population_2026": population if population is not None else "",
            "population_density_km2": finite_number(row.get("pop_density_km2")) if row.get("pop_density_km2") is not None else "",
            "review_reason": reason_text,
        }
        all_assignments.append(assignment)
        if reasons:
            for category in reasons:
                issue_counts[category] += 1
                exception_rows.append({
                    "exception_id": f"DEMO-{fid}-{category}",
                    "category": category,
                    "source_fid": fid,
                    "big_oid": clean(row.get("big_oid")),
                    "admin_code_pum": code,
                    "desa_name": clean(row.get("desa_name_big")) or clean(row.get("desa_name")),
                    "province_name": clean(row.get("provinsi")),
                    "resolution_status": "unresolved",
                    "action": "Keep out of synthetic ownership; review source code/geometry before any operational activation",
                    "is_synthetic_assignment": "true",
                })
    validate_assignment_intervals(all_assignments)
    with gzip.open(output / "territory_assignments.csv.gz", "wt", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=ASSIGNMENT_FIELDS)
        writer.writeheader()
        writer.writerows(all_assignments)
    with (output / "exceptions.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=EXCEPTION_FIELDS)
        writer.writeheader()
        writer.writerows(exception_rows)
    write_areas(output, valid_from, area_counts)
    return area_counts, {
        "assignment_status_counts": dict(assignment_status_counts),
        "exception_feature_count": exception_feature_count,
        "exception_issue_rows": len(exception_rows),
        "exception_issue_counts": dict(sorted(issue_counts.items())),
        "assigned_code_count": len(assigned_codes),
        "assignment_row_count": len(all_assignments),
    }


def build_tiles(
    geojsonl: Path,
    output: Path,
    tippecanoe: str,
    pmtiles: str,
    *,
    maxzoom: int,
) -> dict[str, Any]:
    mbtiles = output / "territories-demo.mbtiles"
    pmtiles_file = output / "territories-demo.pmtiles"
    command = [
        tippecanoe,
        f"--output={mbtiles}", "--force", "--layer=desa_pop_2026",
        "--name=NYALES Demo Territory Areas – BIG 2022-based",
        "--description=Synthetic province-grouped Area ownership; not for operations",
        "--attribution=Batas: BIG geodatabase edition 2022. Population estimates: WorldPop 2026 (R2025A; not census). Area/owner assignments are synthetic DEMO data.",
        "--minimum-zoom=0", f"--maximum-zoom={maxzoom}", f"--maximum-tile-bytes={MAXIMUM_TILE_BYTES}",
        "--drop-densest-as-needed", "--detect-shared-borders", "--read-parallel",
        "--no-tile-stats", "--no-progress-indicator",
        *[f"--include={name}" for name in TILE_PROPERTIES],
        str(geojsonl),
    ]
    print("Building local vector tiles with Tippecanoe…", flush=True)
    subprocess.run(command, check=True)
    print("Converting MBTiles to PMTiles…", flush=True)
    subprocess.run([pmtiles, "convert", str(mbtiles), str(pmtiles_file)], check=True)
    subprocess.run([pmtiles, "verify", str(pmtiles_file)], check=True)
    metadata_run = subprocess.run(
        [pmtiles, "show", str(pmtiles_file), "--metadata"],
        check=True, text=True, capture_output=True,
    )
    try:
        pm_metadata = json.loads(metadata_run.stdout)
    except json.JSONDecodeError:
        pm_metadata = {"raw": metadata_run.stdout.strip()}
    strategies = json.loads(pm_metadata.get("strategies", "[]")) if isinstance(pm_metadata.get("strategies"), str) else []
    dropped = {zoom: item.get("dropped_as_needed", 0) for zoom, item in enumerate(strategies) if item.get("dropped_as_needed", 0)}
    if dropped:
        raise RuntimeError(f"Tippecanoe dropped tile features despite {MAXIMUM_TILE_BYTES}-byte limit: {dropped}")
    mbtiles.unlink(missing_ok=True)
    return {
        "path": pmtiles_file.name,
        "size_bytes": pmtiles_file.stat().st_size,
        "sha256": sha256_file(pmtiles_file),
        "maxzoom": maxzoom,
        "maximum_tile_bytes": MAXIMUM_TILE_BYTES,
        "verified_by_pmtiles_cli": True,
        "metadata": pm_metadata,
    }


def write_markdown(output: Path, manifest: dict[str, Any], area_counts: dict[str, dict[str, Any]]) -> None:
    assignment = manifest["assignment"]
    all_count = manifest["source_validation"]["feature_count"]
    assigned = assignment["assigned_code_count"]
    coverage = assigned / all_count * 100 if all_count else 0
    density = manifest["population_density"]
    density_cutoffs = ", ".join(f"{value:,.1f}" for value in density["quantile_breaks"])
    lines = [
        "# NYALES — Paket DEMO Territory Area",
        "",
        "> **DEMO / sintetis — bukan kepemilikan sales nyata dan tidak diaktifkan.**",
        "",
        f"Sumber batas: {SOURCE_BOUNDARY_EDITION}. Jumlah fitur: {all_count:,}. CRS EPSG:{manifest['srs_id']}.",
        f"Estimasi populasi: {POPULATION_SOURCE}. Total yang dijumlahkan dari `pop_2026`: {manifest['population_2026_sum_estimate']:,.0f} (estimasi, bukan sensus).",
        f"Kepadatan `population_density_km2`: orang/km²; lima kelas kuantil P20/P40/P60/P80 pada {density_cutoffs}. Nilainya estimasi WorldPop, bukan data sensus.",
        "",
        "## Ringkasan Area",
        "",
        "Empat owner adalah placeholder (`DEMO-PIC-01` hingga `DEMO-PIC-04`). Pembagian mengikuti kelompok provinsi untuk demonstrasi; ini belum diuji terhadap outlet, kapasitas sales, coverability, waktu, atau jarak.",
        "",
        "| Area demo | Unit berkode PUM | Estimasi penduduk 2026 |",
        "|---|---:|---:|",
    ]
    for area_id, area in AREAS.items():
        stats = area_counts[area_id]
        lines.append(f"| {area['name']} | {stats['assigned_units']:,} | {stats['population']:,.0f} |")
    lines.extend([
        "",
        f"Dari {all_count:,} fitur, {assigned:,} ber-kode unik mendapat assignment demo (mencakup {coverage:.2f}% dari seluruh fitur); {assignment['exception_feature_count']:,} fitur ditahan di antrian review. Baris isu pengecualian: {assignment['exception_issue_rows']:,}.",
        "",
        "## Cara memakai berkas",
        "",
        "- `territories-demo.pmtiles`: vector tiles untuk visualisasi DEMO; membawa atribut Area/owner sintetis, estimasi populasi, dan kepadatan.",
        "- Peta mendukung dua tema: Area DEMO atau kepadatan penduduk per km² dengan lima kelas kuantil yang dicatat di `manifest.json`.",
        "- `territory_assignments.csv.gz`: satu baris per fitur sumber, dengan tanggal efektif untuk assignment DEMO; fitur review tidak diberi owner.",
        "- `areas.csv`: empat Area DEMO, PIC placeholder, provinsi, jumlah unit, dan estimasi populasi.",
        "- `exceptions.csv`: satu baris per isu yang perlu review; semua unresolved.",
        "- `manifest.json`: checksum, jumlah fitur, provenance, status upload, dan guard produksi.",
        "",
        "## Batasan dan guard pengaman",
        "",
        "- GeoPackage sumber hanya dibaca. Ownership semuanya sintetis, `is_synthetic=true`, dan statusnya `DEMO_NOT_OPERATIONAL`.",
        "- Builder tidak menulis D1/R2. Jika paket dipasang pada staging untuk portofolio, paket tetap berlabel DEMO, tidak diberi owner nyata, dan tidak diaktifkan untuk operasi.",
        "- Metadata sumber BIG menyebut edisi geodatabase 2022 serta keterbatasan beberapa pemekaran desa/area yang belum terdefinisi. Kode BPS kosong di seluruh 83.486 fitur, sehingga PUM saja dipakai; 87 fitur tanpa PUM tidak diberi owner.",
        "- Catatan penggunaan/redistribusi batas BIG belum diverifikasi untuk paket publik. Jangan unggah/publikasikan sebelum hak penggunaan dan atribusi dikonfirmasi.",
        "- Sebelum operational rollout, ganti sumber boundary dengan rilis yang disetujui, review seluruh exception, masukkan owner nyata, hitung workload/outlet, dan jalankan review bisnis.",
        "",
    ])
    (output / "README.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--gpkg", type=Path, default=DEFAULT_GPKG)
    parser.add_argument("--layer", default=DEFAULT_LAYER)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--valid-from", default=DEFAULT_VALID_FROM)
    parser.add_argument("--batch-size", type=int, default=500)
    parser.add_argument("--maxzoom", type=int, default=12)
    parser.add_argument("--skip-tiles", action="store_true", help="Only for offline fixture tests; still validates geometry")
    parser.add_argument("--keep-intermediate", action="store_true", help="Keep large GeoJSONL input for diagnostic purposes")
    parser.add_argument("--tippecanoe", default=shutil.which("tippecanoe") or "tippecanoe")
    parser.add_argument("--pmtiles", default=shutil.which("pmtiles") or str(Path.home() / "go/bin/pmtiles"))
    args = parser.parse_args()
    if not args.gpkg.is_file():
        raise FileNotFoundError(args.gpkg)
    if args.output.exists():
        raise ValueError("Output directory must be new; choose a fresh path so review artifacts are never overwritten")
    if args.batch_size < 10 or args.batch_size > 5000:
        raise ValueError("--batch-size must be between 10 and 5000")
    if args.maxzoom < 5 or args.maxzoom > 16:
        raise ValueError("--maxzoom must be between 5 and 16")
    validate_effective_interval(args.valid_from, None)
    args.output.mkdir(parents=True)

    print(f"Reading attributes read-only from {args.gpkg}…", flush=True)
    records, source = load_source_attributes(args.gpkg, args.layer)
    density_metadata = population_density_summary(records)
    if source["srs_id"] != 4326:
        raise ValueError(f"Expected source SRS 4326; got {source['srs_id']}")
    if len(set(PROVINCE_TO_AREA)) != 38:
        raise ValueError("Demo macroregion map must cover exactly the 38 named provinces")
    unknown_named_provinces = sorted(
        name for name in source["provinces"] if name != "(kosong)" and name not in PROVINCE_TO_AREA
    )
    if unknown_named_provinces:
        raise ValueError(f"Province names are not mapped; do not auto-assign them: {unknown_named_provinces}")
    if source["pum_duplicate_code_count"]:
        print(f"Warning: {source['pum_duplicate_code_count']} duplicate PUM keys will be held for review.", flush=True)

    geojsonl = None
    tmp_dir = None
    try:
        if not args.skip_tiles:
            tmp_dir = tempfile.TemporaryDirectory(prefix=".territory-tile-input-", dir=args.output)
            geojsonl = Path(tmp_dir.name) / "territories.geojsonl"
        reasons_by_fid, valid_geometry_count, tile_feature_count = geometry_pass(
            args.gpkg, args.layer, records, source["duplicate_codes"], geojsonl, args.batch_size
        )
        area_counts, assignment_summary = write_assignments_and_exceptions(
            args.output, records, source["duplicate_codes"], reasons_by_fid, args.valid_from
        )
        area_summary = []
        for area_id, area in AREAS.items():
            stats = area_counts[area_id]
            area_summary.append({
                "demo_area_id": area_id,
                "demo_area_name": area["name"],
                "region": area["region"],
                "provinces": area["provinces"],
                "assigned_units": stats["assigned_units"],
                "estimated_population_2026": round(stats["population"], 3),
                "population_is_estimate_not_census": True,
                "synthetic_owner_id": area["owner_id"],
            })
        (args.output / "area-summary.json").write_bytes(canonical_json(area_summary))
        tiles_metadata = None
        if not args.skip_tiles:
            if not shutil.which(args.tippecanoe) and not Path(args.tippecanoe).exists():
                raise FileNotFoundError(f"Tippecanoe executable not found: {args.tippecanoe}")
            if not Path(args.pmtiles).exists() and not shutil.which(args.pmtiles):
                raise FileNotFoundError(f"PMTiles CLI not found: {args.pmtiles}")
            tiles_metadata = build_tiles(geojsonl, args.output, args.tippecanoe, args.pmtiles, maxzoom=args.maxzoom)
        manifest = {
            "created_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
            "demo_classification": "SYNTHETIC_AREA_OWNERSHIP",
            "operational_status": "DEMO_NOT_OPERATIONAL",
            "production_eligible": False,
            "data_activation_authorized": False,
            "d1_written": False,
            "r2_uploaded": False,
            "boundary_source": {
                "label": SOURCE_BOUNDARY_EDITION,
                "record": "https://data.go.id/dataset/dataset/administrasi_ar_desakel2",
                "service": "https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH/Administrasi_AR_KelDesa_10K/MapServer",
                "metadata_caveat": "Source notes identify 2022 geodatabase edition; BIG service text contains older metadata narrative and the 2022 source notes describe split-village/undefined-area/Papua limitations.",
                "reuse_rights_status": "not_verified_for_public_redistribution",
            },
            "population_source": {
                "label": POPULATION_SOURCE,
                "stac_item": "https://stac.worldpop.org/collections/IDN/items/idn_pop_2026_CN_100m_R2025A_v1",
                "recommended_doi": "10.5258/SOTON/WP00839",
                "caveat": "WorldPop source notes label this R2025A product alpha; pop_2026 is a modeled estimate, not a census count.",
            },
            "population_density": density_metadata,
            "input_geopackage": str(args.gpkg.resolve()),
            "input_geopackage_sha256": sha256_file(args.gpkg),
            "input_layer": args.layer,
            "srs_id": source["srs_id"],
            "source_validation": {key: value for key, value in source.items() if key != "duplicate_codes"},
            "geometry_validation": {
                "valid_geometry_count": valid_geometry_count,
                "tile_feature_count": tile_feature_count,
                "invalid_empty_geometry_count": source["feature_count"] - valid_geometry_count,
                "check": "each source geometry read with pyogrio and checked for missing, empty, or invalid geometry",
            },
            "assignment": {
                "basis": "synthetic grouping by province into four macro-areas; no outlet/workload/travel optimization",
                "is_synthetic": True,
                "effective_from": args.valid_from,
                "effective_to": None,
                "interval_convention": "half-open [effective_from, effective_to)",
                "area_count": len(AREAS),
                "owner_ids": [area["owner_id"] for area in AREAS.values()],
                **assignment_summary,
            },
            "area_summary": area_summary,
            "population_2026_sum_estimate": source["population_2026_sum_estimate"],
            "tiles": tiles_metadata,
            "artifacts": {},
            "limitations": [
                "All ownership is a synthetic demo; no actual sales representative or customer is assigned.",
                "The 87 features without PUM are review exceptions and intentionally have no owner or effective assignment date.",
                "All BPS village codes are blank in the source GPKG; PUM is the only exact key used.",
                "The boundary dataset is the user-provided BIG 2022-based snapshot, not the newer BIG June 2026 release.",
                "Population values are WorldPop estimates, not census counts or a sales workload measure.",
                "No cloud upload, D1 write, production/staging import, activation, or deployment was performed.",
                "BIG reuse/redistribution terms are not verified; do not publish the tile package before review.",
            ],
        }
        if geojsonl and not args.keep_intermediate:
            tmp_dir.cleanup()
            tmp_dir = None
        for path in sorted(args.output.iterdir()):
            if path.is_file() and path.name != "manifest.json":
                manifest["artifacts"][path.name] = {"size_bytes": path.stat().st_size, "sha256": sha256_file(path)}
        (args.output / "manifest.json").write_bytes(canonical_json(manifest))
        write_markdown(args.output, manifest, area_counts)
        # README is included in the artifact hash after it is written; rewrite manifest once to include it.
        manifest["artifacts"]["README.md"] = {
            "size_bytes": (args.output / "README.md").stat().st_size,
            "sha256": sha256_file(args.output / "README.md"),
        }
        (args.output / "manifest.json").write_bytes(canonical_json(manifest))
        print(json.dumps({
            "output": str(args.output.resolve()),
            "feature_count": source["feature_count"],
            "pum_unique_code_count": source["pum_unique_code_count"],
            "assigned_count": assignment_summary["assigned_code_count"],
            "review_feature_count": assignment_summary["exception_feature_count"],
            "issue_rows": assignment_summary["exception_issue_rows"],
            "tile": tiles_metadata,
            "d1_written": False,
            "r2_uploaded": False,
            "production_eligible": False,
        }, ensure_ascii=False, indent=2), flush=True)
        return 0
    finally:
        if tmp_dir is not None:
            tmp_dir.cleanup()


if __name__ == "__main__":
    raise SystemExit(main())
