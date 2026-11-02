import importlib.util
from pathlib import Path
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "reconcile-big-boundaries.py"
SPEC = importlib.util.spec_from_file_location("reconcile_big_boundaries", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


class BoundaryReconciliationTests(unittest.TestCase):
    def old(self, *, source_id, code, name="Kampung A", district="31.71.01", admin_type=1):
        return MODULE.old_record({
            "fid": source_id,
            "big_oid": source_id,
            "desa_name": name,
            "desa_name_big": name,
            "desa_code_pum": code,
            "desa_code_bps": " ",
            "kec_code_pum": district,
            "kecamatan": "District A",
            "kab_code_pum": "31.71",
            "kabupaten_kota": "City A",
            "prov_code_pum": "31",
            "provinsi": "Province A",
            "admin_type": admin_type,
        })

    def big(self, *, source_id, code, name="Kampung A", district="31.71.01", tipadm=1, geometry=True):
        return MODULE.big_record({
            "id": source_id,
            "properties": {
                "OBJECTID": source_id,
                "KDEPUM": code,
                "KDEBPS": "",
                "WADMKD": name,
                "KDCPUM": district,
                "WADMKC": "District A",
                "KDPKAB": "31.71",
                "WADMKK": "City A",
                "KDPPUM": "31",
                "WADMPR": "Province A",
                "TIPADM": tipadm,
                "Status": "Batas Definitif",
            },
            "geometry": {"type": "Polygon", "coordinates": []} if geometry else None,
        })

    def test_preflight_without_big_snapshot_does_not_call_all_codes_old_only(self):
        summary, exceptions = MODULE.reconcile_records([self.old(source_id="old-1", code="31.71.01.2001")], None)
        self.assertFalse(summary["comparison_complete"])
        self.assertIsNone(summary["old_only_pum_codes"])
        self.assertEqual([row["category"] for row in exceptions], [])

    def test_different_codes_are_not_fuzzy_matched_by_same_name(self):
        old = [self.old(source_id="old-1", code="31.71.01.2001")]
        new = [self.big(source_id=2026, code="31.71.01.2002")]
        summary, exceptions = MODULE.reconcile_records(old, new)
        self.assertEqual(summary["exact_pum_matches"], 0)
        self.assertEqual(summary["old_only_pum_codes"], 1)
        self.assertEqual(summary["new_only_pum_codes"], 1)
        self.assertEqual({row["category"] for row in exceptions}, {"OLD_ONLY_PUM", "BIG_ONLY_PUM"})

    def test_same_code_with_name_or_parent_change_is_reviewed(self):
        old = [self.old(source_id="old-1", code="31.71.01.2001", name="Kampung A")]
        new = [self.big(source_id=2026, code="31.71.01.2001", name="Kampung Baru")]
        summary, exceptions = MODULE.reconcile_records(old, new)
        self.assertEqual(summary["exact_pum_matches"], 1)
        self.assertEqual(summary["matched_codes_with_attribute_or_hierarchy_changes"], 1)
        self.assertIn("ATTRIBUTE_OR_HIERARCHY_CHANGED", {row["category"] for row in exceptions})

    def test_missing_and_duplicate_pum_codes_are_blocking_review_items(self):
        old = [
            self.old(source_id="old-blank", code=" "),
            self.old(source_id="old-1", code="31.71.01.2001"),
            self.old(source_id="old-2", code="31.71.01.2001"),
        ]
        new = [
            self.big(source_id=2026, code="", geometry=False),
            self.big(source_id=2027, code="31.71.01.2001"),
            self.big(source_id=2028, code="31.71.01.2001"),
        ]
        summary, exceptions = MODULE.reconcile_records(old, new)
        categories = {row["category"] for row in exceptions}
        self.assertEqual(summary["old_pum_missing_feature_count"], 1)
        self.assertEqual(summary["old_pum_duplicate_code_count"], 1)
        self.assertEqual(summary["new_pum_missing_feature_count"], 1)
        self.assertEqual(summary["new_geometry_missing_feature_count"], 1)
        self.assertTrue({"OLD_PUM_MISSING", "OLD_PUM_DUPLICATE", "BIG_PUM_MISSING", "BIG_PUM_DUPLICATE", "BIG_GEOMETRY_MISSING"}.issubset(categories))
        self.assertFalse(summary["activation_ready"])


if __name__ == "__main__":
    unittest.main()
