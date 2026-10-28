import importlib.util

spec = importlib.util.spec_from_file_location("dedup", "scripts/warung-deduplicate.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def row(pid, name="Warung Sari", lat=-6.2, lng=107, city="Kota Bekasi",
        address="Jl. Melati, Kota Bekasi", target=1, source="a.csv"):
    return {"place_id": pid, "name": name, "address": address, "lat": lat, "lng": lng,
            "is_target": target, "category": "Toko kelontong", "needs_review": 0,
            "area_kota": city, "_source_file": source, "_source_record": 1}


rows = [row("1"), row("1", city="Kabupaten Bekasi", source="b.csv"),
        row("2", name="Another warung"), row("3", lat=-6.20001),
        row("4", name="Far", lat=-2), row("5", name="Outside", address="Jakarta Timur"),
        row("6", name="Reference", target=0)]
clean, ledger, pairs = m.deduplicate(rows)
assert len(clean) == 6 and len(ledger) == 7
assert sum(r["action"] == "duplicate_removed_from_clean_copy" for r in ledger) == 1
assert next(x for x in clean if x["place_id"] == "1")["import_city"] == "Kota Bekasi"
assert len(pairs) == 1
assert len([x for x in clean if x["place_id"] in ["1", "3"] and not x["import_ready"]]) == 2
assert next(x for x in clean if x["place_id"] == "2")["import_ready"]
assert not next(x for x in clean if x["place_id"] == "4")["import_ready"]
assert not next(x for x in clean if x["place_id"] == "5")["import_ready"]
assert next(x for x in clean if x["place_id"] == "6")["intended_destination"] == "reference_map"
assert m.address_city("RT.002/RW.003, Kab. Bekasi") == "Kabupaten Bekasi"
assert m.clean_text("\ue0c8\nJalan Sari") == "Jalan Sari"
assert rows[0]["address"] == "Jl. Melati, Kota Bekasi"
assert all(not x["coordinate_verified"] and not x["administrative_boundary_verified"] for x in clean)
