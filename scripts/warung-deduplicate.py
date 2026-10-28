"""Review supplied CSV/JSON point exports without changing source or cloud data."""
import argparse
import ast
import collections
import csv
import hashlib
import itertools
import json
import math
import re
import unicodedata
from decimal import Decimal
from pathlib import Path

PAIRS = [
    ("jakarta-pusat-master.csv", "jakarta-pusat-master.json"),
    ("bekasi-master-final.csv", "bekasi-master.json"),
    ("kab-bekasi-master-final.csv", "kab-bekasi-master.json"),
]
CITIES = {"Jakarta Pusat", "Kota Bekasi", "Kabupaten Bekasi"}


def clean_text(value):
    value = unicodedata.normalize("NFKC", str(value or ""))
    return " ".join("".join(c for c in value if unicodedata.category(c) not in {"Co", "Cc"} or c.isspace()).split())


def norm(value):
    return re.sub(r"[^\w]+", " ", clean_text(value).casefold()).strip()


def canonical(key, value):
    if value is None:
        return ""
    if key in {"lat", "lng", "rating"}:
        return str(Decimal(str(value).replace(",", ".")).normalize()) if value != "" else ""
    if key.startswith("is_") or key in {"phone_valid", "needs_review"}:
        return str(int(value))
    if key in {"source_keywords", "source_areas"}:
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except ValueError:
                value = ast.literal_eval(value)
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def address_city(address):
    a = clean_text(address).casefold()
    if re.search(r"\bkab(?:upaten|\.)?\s*(?:bekasi|bks)\b", a):
        return "Kabupaten Bekasi"
    if re.search(r"\bkota\s*(?:bekasi|bks)\b", a):
        return "Kota Bekasi"
    if re.search(r"jakarta\s*pusat", a):
        return "Jakarta Pusat"
    # A search area does not prove the administrative location of a returned POI.
    if re.search(r"jakarta\s*(utara|timur|barat|selatan)|kabupaten\s*(bogor|karawang)|kota\s*(depok|bogor|tangerang)", a):
        return "Outside supplied regions"
    return None


def distance(a, b):
    la, lo, lb, ln = map(math.radians, [a["lat"], a["lng"], b["lat"], b["lng"]])
    x = math.sin((lb-la)/2)**2 + math.cos(la)*math.cos(lb)*math.sin((ln-lo)/2)**2
    return 6371008.8 * 2 * math.atan2(math.sqrt(x), math.sqrt(max(0, 1-x)))


def read_pairs(root):
    rows, manifests = [], []
    for csv_name, json_name in PAIRS:
        cp, jp = root / csv_name, root / json_name
        with cp.open(encoding="utf-8-sig", newline="") as f:
            csv_rows = list(csv.DictReader(f))
        raw = json.loads(jp.read_text(encoding="utf-8-sig"))
        json_rows = raw["results"]
        if len(csv_rows) != len(json_rows):
            raise ValueError("CSV_JSON_ROW_COUNT_MISMATCH: " + csv_name)
        by_id = {r["place_id"]: r for r in json_rows}
        if len(by_id) != len(json_rows):
            raise ValueError("JSON_DUPLICATE_ID_REQUIRES_REVIEW: " + json_name)
        for index, c in enumerate(csv_rows, 1):
            j = by_id.get(c["place_id"])
            if j is None:
                raise ValueError(f"CSV_JSON_ID_MISMATCH: {csv_name}:{index}")
            if any(canonical(k, c.get(k)) != canonical(k, j.get(k)) for k in set(c) | set(j)):
                raise ValueError(f"CSV_JSON_RECORD_MISMATCH: {csv_name}:{index}")
            record = dict(j)
            record["_source_file"], record["_source_record"] = csv_name, index
            rows.append(record)
        for p in [cp, jp]:
            raw_bytes = p.read_bytes()
            manifests.append({"file": p.name, "bytes": len(raw_bytes), "sha256": hashlib.sha256(raw_bytes).hexdigest()})
    return rows, manifests


def deduplicate(rows):
    groups = collections.defaultdict(list)
    for row in rows:
        key = clean_text(row.get("place_id"))
        if not key:
            # No identity is invented from a generic store name or shared coordinates.
            key = f"missing:{row['_source_file']}:{row['_source_record']}"
        groups[key].append(row)
    clean, ledger = [], []
    for place_id, group in groups.items():
        def quality(r):
            return (sum(bool(r.get(k)) for k in ["name", "address", "phone", "website", "lat", "lng"]),
                    len(str(r.get("address", ""))), str(r["_source_file"]))
        selected = max(group, key=quality)
        item = {k: v for k, v in selected.items() if not k.startswith("_")}
        item["name"], item["address"] = clean_text(item["name"]), clean_text(item["address"])
        item["lat"], item["lng"] = float(item["lat"]), float(item["lng"])
        item["source_records"] = [{"file": r["_source_file"], "record": r["_source_record"],
                                  "source_city": r.get("area_kota")} for r in group]
        item["dedup_group_size"] = len(group)
        item["identity_key"] = place_id
        item["external_code"] = "GMP-" + hashlib.sha256(place_id.encode()).hexdigest()[:24].upper()
        item["review_reasons"] = []
        if place_id.startswith("missing:"):
            item["review_reasons"].append("missing_place_id")
        if not (math.isfinite(item["lat"]) and math.isfinite(item["lng"]) and
                -90 <= item["lat"] <= 90 and -180 <= item["lng"] <= 180):
            item["review_reasons"].append("invalid_coordinates")
        elif not (-6.65 <= item["lat"] <= -5.75 and 106.6 <= item["lng"] <= 107.4):
            item["review_reasons"].append("outside_rough_regional_box")
        if not item["name"] or len(item["name"]) > 160 or not item["address"] or len(item["address"]) > 500:
            item["review_reasons"].append("master_name_address_validation")
        if len({canonical("is_target", r["is_target"]) for r in group}) > 1:
            item["review_reasons"].append("source_target_classification_conflict")
        city = address_city(item["address"])
        if city == "Outside supplied regions":
            item["review_reasons"].append("address_outside_supplied_regions")
        if city is None:
            source_cities = {r.get("area_kota") for r in group}
            if len(source_cities) == 1 and next(iter(source_cities)) in CITIES:
                city = next(iter(source_cities))
                item["city_basis"] = "source_search_label_unverified"
            else:
                item["review_reasons"].append("city_conflict_unresolved")
        else:
            item["city_basis"] = "explicit_address_text_not_polygon_verification"
        item["import_city"] = city
        item["intended_destination"] = "customer_master" if int(item.get("is_target", 0)) == 1 else "reference_map"
        item["administrative_boundary_verified"] = False
        item["source_needs_review"] = bool(item.get("needs_review"))
        item["coordinate_verified"] = False
        # Same Place ID establishes identity, but a displaced location still needs review.
        try:
            if any(distance(item, {**r, "lat": float(r["lat"]), "lng": float(r["lng"])}) > 25 for r in group):
                item["review_reasons"].append("same_identity_coordinate_conflict")
        except (TypeError, ValueError):
            item["review_reasons"].append("same_identity_invalid_coordinates")
        for r in group:
            ledger.append({"identity_key": place_id, "external_code": item["external_code"],
                           "source_file": r["_source_file"], "source_record": r["_source_record"],
                           "action": "retained_canonical" if r is selected else "duplicate_removed_from_clean_copy",
                           "rule": "same_google_place_id", "group_size": len(group)})
        clean.append(item)
    # Distinct provider identities at the same/similar name and close coordinates
    # are candidates only. They are retained in clean output and held from import.
    cells, pairs = collections.defaultdict(list), []
    for index, item in enumerate(clean):
        if "invalid_coordinates" in item["review_reasons"] or "outside_rough_regional_box" in item["review_reasons"]:
            continue
        cell = (math.floor(item["lat"] / .0003), math.floor(item["lng"] / .0003))
        n = norm(item["name"])
        for dx, dy in itertools.product([-1, 0, 1], repeat=2):
            for other_index in cells[(cell[0]+dx, cell[1]+dy)]:
                other = clean[other_index]
                if norm(other["name"]) != n:
                    continue
                meters = distance(item, other)
                if meters <= 25:
                    reason = "different_place_ids_same_normalized_name_within_25m"
                    pairs.append({"external_code_a": other["external_code"], "external_code_b": item["external_code"],
                                  "name_a": other["name"], "name_b": item["name"], "distance_m": round(meters, 2),
                                  "reason": reason, "decision": "retained_in_clean_output_held_from_import"})
                    for record in [item, other]:
                        if reason not in record["review_reasons"]:
                            record["review_reasons"].append(reason)
        cells[cell].append(index)
    for item in clean:
        item["import_ready"] = not item["review_reasons"]
    return clean, ledger, pairs


def csv_write(path, rows, fields=None):
    if fields is None:
        fields = list(rows[0]) if rows else []
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for r in rows:
            writer.writerow({k: json.dumps(r.get(k), ensure_ascii=False) if isinstance(r.get(k), (list, dict)) else r.get(k, "") for k in fields})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    root, out = Path(args.input), Path(args.out)
    rows, manifest = read_pairs(root)
    clean, ledger, candidates = deduplicate(rows)
    out.mkdir(parents=True, exist_ok=False)
    masters = [r for r in clean if r["import_ready"] and r["intended_destination"] == "customer_master"]
    references = [r for r in clean if r["import_ready"] and r["intended_destination"] == "reference_map"]
    review = [r for r in clean if not r["import_ready"]]
    save = lambda name, data: (out / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    save("all-clean.json", clean)
    save("customer-master-ready.json", masters)
    save("reference-layer-ready.json", references)
    save("review-points.json", review)
    csv_write(out / "all-clean.csv", clean)
    csv_write(out / "duplicates-ledger.csv", ledger)
    csv_write(out / "review-points.csv", review, list(clean[0]))
    csv_write(out / "duplicate-candidates.csv", candidates,
              ["external_code_a", "external_code_b", "name_a", "name_b", "distance_m", "reason", "decision"])
    summary = {"source_csv_rows": len(rows), "json_csv_pairs_equal": True, "unique_google_place_ids": len(clean),
               "duplicate_rows_removed_from_clean_copy": len(rows)-len(clean),
               "duplicate_groups": sum(r["dedup_group_size"] > 1 for r in clean),
               "possible_duplicate_pairs_for_review": len(candidates), "review_points": len(review),
               "review_reasons": dict(collections.Counter(reason for r in review for reason in r["review_reasons"])),
               "customer_master_ready": len(masters), "reference_map_ready": len(references),
               "masters_by_city": dict(collections.Counter(r["import_city"] for r in masters)),
               "reference_by_city": dict(collections.Counter(r["import_city"] for r in references)),
               "original_sources_modified": False, "cloud_imported": False, "source_manifest": manifest}
    assert len(masters) + len(references) + len(review) == len(clean)
    assert sum(r["action"] == "duplicate_removed_from_clean_copy" for r in ledger) == len(rows)-len(clean)
    save("SUMMARY.json", summary)
    print(json.dumps({k:v for k,v in summary.items() if k != "source_manifest"}))


if __name__ == "__main__":
    main()
