import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "acquire-big-boundaries-national.py"
SPEC = importlib.util.spec_from_file_location("acquire_big_boundaries", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


class BigBoundaryAcquisitionTests(unittest.TestCase):
    def setUp(self):
        self.metadata = {
            "name": "BATAS_DESAKEL_AR",
            "copyrightText": "Badan Informasi Geospasial",
            "extent": {"spatialReference": {"wkid": 4326}},
            "fields": [
                {"name": "OBJECTID"},
                {"name": "KDEPUM"},
                {"name": "TIPADM"},
            ],
        }
        self.features = {
            1: {"type": "Feature", "id": 1, "properties": {"OBJECTID": 1, "KDEPUM": "31.71.01.2001", "TIPADM": 1}, "geometry": {"type": "Polygon", "coordinates": [[[1, 1], [2, 1], [2, 2], [1, 1]]] }},
            2: {"type": "Feature", "id": 2, "properties": {"OBJECTID": 2, "KDEPUM": "31.71.01.2002", "TIPADM": 2}, "geometry": {"type": "MultiPolygon", "coordinates": []}},
        }

    def mock_fetch(self, url, params, **kwargs):
        if url == MODULE.LAYER_URL:
            return self.metadata
        if params.get("returnCountOnly") == "true":
            return {"count": 2}
        if params.get("returnIdsOnly") == "true":
            return {"objectIds": [1, 2]}
        ids = [int(value) for value in params["objectIds"].split(",")]
        return {"type": "FeatureCollection", "features": [self.features[i] for i in ids]}

    def test_complete_snapshot_is_verified_and_never_activated(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "snapshot"
            with patch.object(MODULE, "fetch_json", side_effect=self.mock_fetch):
                result = MODULE.acquire(output, resume=False, page_size=1, workers=1, timeout=3, max_features=None)
            self.assertEqual(result["status"], "complete")
            self.assertTrue(result["national_complete"])
            self.assertTrue(result["source_membership_stable"])
            self.assertEqual(result["acquired_count"], 2)
            self.assertEqual(result["missing_kdepum_count"], 0)
            self.assertEqual(result["rights_status"], "unverified")
            self.assertFalse(result["imported_to_nyales"])
            self.assertFalse(result["activated"])
            self.assertEqual(len(list((output / "pages").glob("page-*.geojson"))), 2)

    def test_explicit_smoke_extract_stays_partial(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "snapshot"
            with patch.object(MODULE, "fetch_json", side_effect=self.mock_fetch):
                result = MODULE.acquire(output, resume=False, page_size=1, workers=1, timeout=3, max_features=1)
            self.assertEqual(result["status"], "partial")
            self.assertFalse(result["national_complete"])
            self.assertEqual(result["acquired_count"], 1)
            self.assertTrue(result["source_membership_stable"])

    def test_resume_does_not_accept_a_different_page_size_or_scope(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "snapshot"
            with patch.object(MODULE, "fetch_json", side_effect=self.mock_fetch):
                MODULE.acquire(output, resume=False, page_size=1, workers=1, timeout=3, max_features=None)
                with self.assertRaisesRegex(ValueError, "Resume settings changed"):
                    MODULE.acquire(output, resume=True, page_size=2, workers=1, timeout=3, max_features=None)


if __name__ == "__main__":
    unittest.main()
