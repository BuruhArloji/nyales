"""Create resumable SQL and private reference-layer files; never writes to cloud."""
import argparse
import hashlib
import json
from pathlib import Path

DATASET = "maps-warung-20261028"
REGIONS = {"Jakarta Pusat": "jakpus", "Kota Bekasi": "bekasi-kota", "Kabupaten Bekasi": "bekasi-kab"}


def quote(value):
    if value is None:
        return "NULL"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--clean", required=True)
    p.add_argument("--context", required=True)
    p.add_argument("--out", required=True)
    args = p.parse_args()
    root, out = Path(args.clean), Path(args.out)
    ctx = json.loads(Path(args.context).read_text())
    if ctx.get("environment") != "staging" or ctx.get("organization_name") != "NYALES Pilot":
        raise ValueError("REVIEWED_STAGING_CONTEXT_REQUIRED")
    org, operator = ctx["organization_id"], ctx["operator_id"]
    masters = json.loads((root / "customer-master-ready.json").read_text(encoding="utf-8"))
    refs = json.loads((root / "reference-layer-ready.json").read_text(encoding="utf-8"))
    all_points = json.loads((root / "all-clean.json").read_text(encoding="utf-8"))
    summary = json.loads((root / "SUMMARY.json").read_text(encoding="utf-8"))
    if len(masters) != summary["customer_master_ready"] or len(refs) != summary["reference_map_ready"] or len(all_points) != summary["unique_google_place_ids"]:
        raise ValueError("CLEAN_COUNTS_CHANGED")
    out.mkdir(parents=True, exist_ok=False)
    detail_fields = ["external_code", "name", "category", "address", "phone", "phone_valid", "website",
                     "rating", "reviews", "status", "hours", "maps_url", "photo_url", "area_kelurahan",
                     "area_kecamatan", "area_kota", "import_city", "is_closed", "is_target", "needs_review",
                     "administrative_boundary_verified", "coordinate_verified"]
    details = [{k: r[k] for k in detail_fields if r.get(k) not in (None, "", [], {})} for r in all_points]
    layer = {"format": "nyales-reference-points-1", "organization_id": org, "dataset_id": DATASET,
             "points": [{"id": r["external_code"], "name": r["name"], "lat": r["lat"], "lng": r["lng"],
                         "category": r["category"], "city": r["import_city"]} for r in refs],
             "details": details}
    layer_bytes = (json.dumps(layer, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
    (out / "reference-points.json").write_bytes(layer_bytes)
    layer_key = f"{org}/point-directories/{DATASET}/reference-points.json"
    source_hash = hashlib.sha256(json.dumps(summary["source_manifest"], sort_keys=True).encode()).hexdigest()
    def guard():
        return ("INSERT INTO master_mutation_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM organization WHERE id=" +
                quote(org) + " AND name='NYALES Pilot') AND EXISTS(SELECT 1 FROM app_user WHERE id=" +
                quote(operator) + " AND organization_id=" + quote(org) +
                " AND auth_subject IS NOT NULL AND status='active') THEN 1 ELSE 0 END;")
    setup = [guard(),
             "INSERT INTO point_directory_dataset(id,organization_id,name,source_reference,source_sha256,storage_key,storage_sha256,byte_count,reference_count,customer_expected_count,held_count,created_by,created_at) VALUES(" +
             ",".join(map(quote, [DATASET, org, "Titik warung Jakarta Pusat dan Bekasi",
                                   "https://drive.google.com/drive/folders/1ZuMcjf3jcrHDWEuEdKhPBL8NMVtvVKjM",
                                   source_hash, layer_key, hashlib.sha256(layer_bytes).hexdigest(), len(layer_bytes),
                                   len(refs), len(masters), summary["review_points"], operator])) + ",CURRENT_TIMESTAMP);"]
    for city, slug in REGIONS.items():
        branch, area = "maps-branch-" + slug, "maps-area-" + slug
        setup += ["INSERT INTO branch(id,organization_id,name,timezone) VALUES(" +
                  ",".join(map(quote, [branch, org, city + " · direktori", "Asia/Jakarta"])) + ");",
                  "INSERT INTO area(id,organization_id,name,branch_id) VALUES(" +
                  ",".join(map(quote, [area, org, city + " · penempatan awal sumber", branch])) + ");"]
    setup += ["INSERT INTO master_audit(id,organization_id,actor_id,resource_type,resource_id,action,occurred_at,after_json) VALUES(" +
              ",".join(map(quote, [DATASET + ":source", org, operator, "point_directory_dataset", DATASET,
                                   "register_reviewed_source"])) + ",CURRENT_TIMESTAMP," +
              quote(json.dumps({"source_manifest_sha256": source_hash, "classification": "external_directory",
                                "no_firebase_users": True, "no_sales_assignments": True,
                                "no_sales_history": True, "no_contact_consent": True})) + ");",
              "DELETE FROM master_mutation_guard;"]
    (out / "000-setup.sql").write_text("\n".join(setup) + "\n", encoding="utf-8", newline="\n")
    batches = []
    for offset in range(0, len(masters), 200):
        group, ordinal = masters[offset:offset+200], offset // 200 + 1
        lines = [guard()]
        for r in group:
            values = [r["external_code"].lower(), org, "maps-area-" + REGIONS[r["import_city"]], r["external_code"],
                      r["external_code"], r["name"], r["address"], round(r["lat"]*1e7), round(r["lng"]*1e7),
                      "inactive" if r.get("is_closed") else "active", "unverified",
                      "Direktori Maps; lokasi dan wilayah belum diverifikasi. Kelurahan sumber adalah label pencarian.",
                      str(r.get("category", ""))[:80], DATASET, 1]
            lines.append("INSERT INTO customer_outlet(id,organization_id,area_id,external_code,external_code_key,name,address,latitude_e7,longitude_e7,record_status,coordinate_status,location_note,outlet_type,directory_dataset_id,transaction_history_unverified) VALUES(" +
                         ",".join(map(quote, values)) + ");")
        receipt = {"dataset_id": DATASET, "batch": ordinal, "count": len(group),
                   "code_first": group[0]["external_code"], "code_last": group[-1]["external_code"],
                   "source_hash": hashlib.sha256(json.dumps(group, sort_keys=True).encode()).hexdigest()}
        lines += ["INSERT INTO master_audit(id,organization_id,actor_id,resource_type,resource_id,action,occurred_at,after_json) VALUES(" +
                  ",".join(map(quote, [DATASET+f":batch:{ordinal}", org, operator, "point_directory_batch", DATASET,
                                       "import_unassigned_customers"])) + ",CURRENT_TIMESTAMP," + quote(json.dumps(receipt)) + ");",
                  "DELETE FROM master_mutation_guard;"]
        filename, content = f"{ordinal:03d}-customers.sql", "\n".join(lines) + "\n"
        (out / filename).write_text(content, encoding="utf-8", newline="\n")
        batches.append({"file": filename, "count": len(group), "sha256": hashlib.sha256(content.encode()).hexdigest()})
    report = {"environment": "staging", "dataset_id": DATASET, "organization_id": org, "operator_id": operator,
              "reference_key": layer_key, "reference_sha256": hashlib.sha256(layer_bytes).hexdigest(),
              "reference_count": len(refs), "customer_count": len(masters), "held_count": summary["review_points"],
              "source_sha256": source_hash, "batches": batches, "cloud_applied": False}
    (out / "PREPARED.json").write_text(json.dumps(report, indent=2)+"\n", encoding="utf-8")
    print(json.dumps({k:v for k,v in report.items() if k not in {"batches", "operator_id"}}))


if __name__ == "__main__":
    main()
