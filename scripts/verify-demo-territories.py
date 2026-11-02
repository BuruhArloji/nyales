#!/usr/bin/env python3
"""Validate a locally generated NYALES synthetic Area territory bundle."""
from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
import shutil
import subprocess
import sys


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path, help="Folder containing manifest.json and bundle artifacts")
    parser.add_argument("--pmtiles", default=shutil.which("pmtiles") or str(Path.home() / "go/bin/pmtiles"))
    args = parser.parse_args()
    bundle = args.bundle.resolve()
    manifest_path = bundle / "manifest.json"
    if not manifest_path.is_file():
        raise FileNotFoundError(manifest_path)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    require(manifest.get("demo_classification") == "SYNTHETIC_AREA_OWNERSHIP", "Bundle classification must be synthetic")
    require(manifest.get("operational_status") == "DEMO_NOT_OPERATIONAL", "Bundle must remain non-operational")
    require(manifest.get("production_eligible") is False, "Bundle must not be production eligible")
    require(manifest.get("data_activation_authorized") is False, "Bundle must not authorize activation")
    require(manifest.get("d1_written") is False and manifest.get("r2_uploaded") is False, "Bundle must not claim cloud writes")
    require("2022" in manifest["boundary_source"]["label"], "Boundary source must visibly identify BIG 2022")
    require("WorldPop" in manifest["population_source"]["label"], "Population provenance must identify WorldPop")
    require(manifest["boundary_source"]["reuse_rights_status"] == "not_verified_for_public_redistribution", "Do not hide unverified redistribution rights")

    artifacts = manifest.get("artifacts") or {}
    require(artifacts, "Manifest artifact checksums are missing")
    for name, metadata in artifacts.items():
        require(Path(name).name == name, f"Artifact path must be a basename: {name}")
        path = bundle / name
        require(path.is_file(), f"Manifest artifact is missing: {name}")
        require(path.stat().st_size == metadata["size_bytes"], f"Artifact size mismatch: {name}")
        require(sha256_file(path) == metadata["sha256"], f"Artifact SHA-256 mismatch: {name}")

    source = manifest["source_validation"]
    assignment_meta = manifest["assignment"]
    assignment_path = bundle / "territory_assignments.csv.gz"
    assignment_rows: list[dict[str, str]] = []
    with gzip.open(assignment_path, "rt", encoding="utf-8-sig", newline="") as stream:
        assignment_rows = list(csv.DictReader(stream))
    require(len(assignment_rows) == source["feature_count"], "Every source feature must have one assignment/review row")
    require(len(assignment_rows) == assignment_meta["assignment_row_count"], "Assignment row count differs from manifest")

    assigned: list[dict[str, str]] = []
    review: list[dict[str, str]] = []
    area_ids = {row["demo_area_id"] for row in manifest["area_summary"]}
    assignment_ids: set[str] = set()
    assigned_codes: set[str] = set()
    issue_counts: Counter[str] = Counter()
    blank_pum_count = 0
    blank_province_count = 0
    intervals: dict[str, list[tuple[date, date | None]]] = defaultdict(list)
    for row in assignment_rows:
        boundary_id = row["boundary_id"]
        require(boundary_id not in assignment_ids, f"Duplicate boundary/assignment ID: {boundary_id}")
        assignment_ids.add(boundary_id)
        if not row["admin_code_pum"]:
            blank_pum_count += 1
        if not row["province_name"]:
            blank_province_count += 1
        if row["assignment_status"] == "DEMO_SYNTHETIC":
            assigned.append(row)
            require(row["is_synthetic"].lower() == "true", "An owner record is not explicitly synthetic")
            require(row["admin_code_pum"], "An assigned feature has no exact PUM code")
            require(row["demo_area_id"] in area_ids, "An assigned feature references an unknown Area")
            require(row["demo_owner_id"].startswith("DEMO-PIC-"), "An owner is not a DEMO placeholder")
            require(row["effective_from"] == assignment_meta["effective_from"] and not row["effective_to"], "Unexpected demo effective interval")
            require(not row["review_reason"], "Assigned feature contains a review exception")
            require(row["admin_code_pum"] not in assigned_codes, f"Duplicate assigned PUM key: {row['admin_code_pum']}")
            assigned_codes.add(row["admin_code_pum"])
            start = date.fromisoformat(row["effective_from"])
            end = date.fromisoformat(row["effective_to"]) if row["effective_to"] else None
            intervals[row["admin_code_pum"]].append((start, end))
        else:
            review.append(row)
            require(row["assignment_status"] == "EXCEPTION_NEEDS_REVIEW", "Unexpected assignment status")
            require(row["is_synthetic"].lower() == "true", "Review row must retain explicit DEMO marker")
            require(row["demo_area_id"] == "DEMO-REVIEW" and not row["demo_owner_id"], "Exception must remain unassigned")
            require(not row["effective_from"] and not row["effective_to"], "Exception must not receive an effective assignment date")
            require(bool(row["review_reason"]), "Exception row needs a review reason")
            for category in row["review_reason"].split(";"):
                issue_counts[category] += 1
    for code, values in intervals.items():
        values.sort(key=lambda pair: pair[0])
        require(len(values) == 1, f"Overlapping/duplicate assignment intervals for {code}")

    require(len(assigned) == assignment_meta["assigned_code_count"], "Assigned-code count differs from manifest")
    require(len(review) == assignment_meta["exception_feature_count"], "Review-feature count differs from manifest")
    require(len(assigned_codes) == len(assigned), "Assigned PUM codes are not unique")
    require(blank_pum_count == source["pum_missing_feature_count"], "Missing PUM count differs from source metadata")
    require(blank_province_count == 1, "Expected one source feature with a missing province name; preserve it in review")
    require(not ({row["source_fid"] for row in review} & {row["source_fid"] for row in assigned}), "A feature cannot be both assigned and review-only")

    exceptions_path = bundle / "exceptions.csv"
    with exceptions_path.open(encoding="utf-8-sig", newline="") as stream:
        exceptions = list(csv.DictReader(stream))
    require(len(exceptions) == assignment_meta["exception_issue_rows"], "Exception issue-row count differs from manifest")
    exception_ids: set[str] = set()
    exception_issue_counts: Counter[str] = Counter()
    for row in exceptions:
        require(row["exception_id"] not in exception_ids, f"Duplicate exception ID: {row['exception_id']}")
        exception_ids.add(row["exception_id"])
        require(row["resolution_status"] == "unresolved", "Demo exception was unexpectedly marked resolved")
        require(row["is_synthetic_assignment"].lower() == "true", "Exception file is missing the DEMO marker")
        exception_issue_counts[row["category"]] += 1
    require(dict(sorted(issue_counts.items())) == dict(sorted(exception_issue_counts.items())), "Assignment reasons do not match review exception register")

    tile = manifest.get("tiles")
    require(tile is not None and tile.get("verified_by_pmtiles_cli") is True, "PMTiles archive has not passed builder verification")
    require(tile.get("maximum_tile_bytes", 0) >= 4_000_000, "PMTiles was built with an unexpectedly small maximum tile budget")
    strategies = json.loads(tile.get("metadata", {}).get("strategies", "[]"))
    require(not any(item.get("dropped_as_needed", 0) for item in strategies), "PMTiles drops source features in one or more zoom levels")
    pmtiles_path = bundle / tile["path"]
    require(pmtiles_path.is_file() and sha256_file(pmtiles_path) == tile["sha256"], "PMTiles file/hash mismatch")
    cli = shutil.which(args.pmtiles) or (args.pmtiles if Path(args.pmtiles).exists() else None)
    require(cli is not None, "PMTiles CLI is required for verification")
    subprocess.run([cli, "verify", str(pmtiles_path)], check=True, stdout=subprocess.DEVNULL)

    readme = (bundle / "README.md").read_text(encoding="utf-8")
    require("DEMO / sintetis" in readme and "BIG 2022" in readme and "WorldPop 2026" in readme, "README provenance/Demo caveats are incomplete")
    report = {
        "status": "validated_local_demo_only",
        "source_feature_count": len(assignment_rows),
        "assigned_synthetic_count": len(assigned),
        "review_feature_count": len(review),
        "review_issue_rows": len(exceptions),
        "missing_pum_features": blank_pum_count,
        "missing_province_features": blank_province_count,
        "assigned_pum_unique": len(assigned_codes) == len(assigned),
        "all_assignments_synthetic": all(row["is_synthetic"].lower() == "true" for row in assignment_rows),
        "all_review_exceptions_unassigned": all(not row["demo_owner_id"] and not row["effective_from"] for row in review),
        "effective_intervals_valid": True,
        "pmtiles_verified": True,
        "checksums_verified": len(artifacts),
        "cloud_writes": False,
        "production_activated": False,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"VALIDATION FAILED: {exc}", file=sys.stderr)
        raise SystemExit(1)
