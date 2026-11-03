#!/usr/bin/env python3
"""Offline tests for the synthetic-only territory assignment builder."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/prepare-demo-territories.py"
SPEC = importlib.util.spec_from_file_location("prepare_demo_territories", SCRIPT)
assert SPEC and SPEC.loader
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


class DemoTerritoryTests(unittest.TestCase):
    def test_four_demo_areas_cover_exactly_the_38_named_provinces(self):
        provinces = set(module.PROVINCE_TO_AREA)
        self.assertEqual(len(module.AREAS), 4)
        self.assertEqual(len(provinces), 38)

    def test_known_province_and_exact_pum_get_synthetic_owner(self):
        plan = module.assignment_plan({"desa_code_pum": "33.12.24.2003", "provinsi": "Jawa Tengah"})
        self.assertEqual(plan["demo_area_id"], "DEMO-AREA-02")
        self.assertEqual(plan["assignment_status"], "DEMO_SYNTHETIC")
        self.assertEqual(plan["review_reasons"], [])
        self.assertEqual(plan["admin_code_pum"], "33.12.24.2003")

    def test_missing_pum_is_review_queue_and_has_no_area_owner(self):
        plan = module.assignment_plan({"desa_code_pum": "", "provinsi": "Jawa Timur"})
        self.assertEqual(plan["demo_area_id"], module.REVIEW_ID)
        self.assertEqual(plan["assignment_status"], "EXCEPTION_NEEDS_REVIEW")
        self.assertIn("PUM_CODE_MISSING", plan["review_reasons"])

    def test_missing_province_is_not_auto_mapped_even_with_pum(self):
        plan = module.assignment_plan({"desa_code_pum": "33.12.24.2003", "provinsi": ""})
        self.assertEqual(plan["demo_area_id"], module.REVIEW_ID)
        self.assertEqual(plan["assignment_status"], "EXCEPTION_NEEDS_REVIEW")
        self.assertIn("UNKNOWN_PROVINCE", plan["review_reasons"])

    def test_pum_and_province_exceptions_can_overlap_without_creating_an_owner(self):
        plan = module.assignment_plan({"desa_code_pum": "", "provinsi": ""})
        self.assertEqual(plan["demo_area_id"], module.REVIEW_ID)
        self.assertEqual(set(plan["review_reasons"]), {"PUM_CODE_MISSING", "UNKNOWN_PROVINCE"})

    def test_unknown_province_is_not_auto_mapped(self):
        plan = module.assignment_plan({"desa_code_pum": "99.99.99.9999", "provinsi": "Provinsi Baru Tidak Dikenal"})
        self.assertEqual(plan["demo_area_id"], module.REVIEW_ID)
        self.assertIn("UNKNOWN_PROVINCE", plan["review_reasons"])

    def test_duplicate_pum_is_not_assigned(self):
        plan = module.assignment_plan(
            {"desa_code_pum": "33.12.24.2003", "provinsi": "Jawa Tengah"},
            duplicate_codes={"33.12.24.2003"},
        )
        self.assertEqual(plan["assignment_status"], "EXCEPTION_NEEDS_REVIEW")
        self.assertIn("PUM_CODE_DUPLICATE", plan["review_reasons"])

    def test_effective_dates_use_half_open_non_overlapping_intervals(self):
        module.validate_assignment_intervals([
            {"assignment_status": "DEMO_SYNTHETIC", "is_synthetic": True, "admin_code_pum": "x", "effective_from": "2026-01-01", "effective_to": "2026-02-01"},
            {"assignment_status": "DEMO_SYNTHETIC", "is_synthetic": True, "admin_code_pum": "x", "effective_from": "2026-02-01", "effective_to": ""},
        ])
        with self.assertRaisesRegex(ValueError, "Overlapping"):
            module.validate_assignment_intervals([
                {"assignment_status": "DEMO_SYNTHETIC", "is_synthetic": True, "admin_code_pum": "x", "effective_from": "2026-01-01", "effective_to": "2026-02-02"},
                {"assignment_status": "DEMO_SYNTHETIC", "is_synthetic": True, "admin_code_pum": "x", "effective_from": "2026-02-01", "effective_to": ""},
            ])

    def test_population_density_summary_uses_linear_quintiles_and_tracks_missing_values(self):
        rows = [{"pop_density_km2": value} for value in [0, 10, 20, 30, 40]]
        rows.append({"pop_density_km2": None})
        summary = module.population_density_summary(rows)
        self.assertEqual(summary["field"], "population_density_km2")
        self.assertEqual(summary["units"], "people/km²")
        self.assertEqual(summary["quantile_percentiles"], [20, 40, 60, 80])
        self.assertEqual(summary["quantile_breaks"], [8.0, 16.0, 24.0, 32.0])
        self.assertEqual(summary["valid_feature_count"], 5)
        self.assertEqual(summary["missing_feature_count"], 1)

    def test_population_density_summary_rejects_all_missing_input(self):
        with self.assertRaisesRegex(ValueError, "no valid population density"):
            module.population_density_summary([{"pop_density_km2": None}])

    def test_every_operational_demo_assignment_must_be_marked_synthetic(self):
        with self.assertRaisesRegex(ValueError, "explicitly synthetic"):
            module.validate_assignment_intervals([
                {"assignment_status": "DEMO_SYNTHETIC", "is_synthetic": False, "admin_code_pum": "x", "effective_from": "2026-01-01", "effective_to": ""},
            ])


if __name__ == "__main__":
    unittest.main()
