"""Package boundary checks; no software installation, Docker or network required."""
import hashlib,importlib.util,json,tempfile,unittest
from pathlib import Path
source=Path(__file__).resolve().parent.parent/'tools/visit-compute-kit/check-installation.py'
spec=importlib.util.spec_from_file_location('nyales_kit_check',source);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class KitChecks(unittest.TestCase):
    def setUp(self):
        self.temporary=tempfile.TemporaryDirectory(prefix='nyales-kit-check-');self.addCleanup(self.temporary.cleanup);self.root=Path(self.temporary.name)
        self.content=b'authored fixture';(self.root/'fixture.txt').write_bytes(self.content)
        self.manifest={'files':[{'path':'fixture.txt','bytes':len(self.content),'sha256':hashlib.sha256(self.content).hexdigest()}]};self.save()
    def save(self):(self.root/'MANIFEST.json').write_text(json.dumps(self.manifest),encoding='utf-8')
    def test_exact_hash_pass_does_not_claim_authenticity(self):
        r=module.verify_manifest(self.root);self.assertEqual(r['status'],'passed');self.assertFalse(r['authenticity_verified'])
    def test_same_size_corruption_and_missing_file_fail(self):
        (self.root/'fixture.txt').write_bytes(b'x'*len(self.content));self.assertEqual(module.verify_manifest(self.root)['failures'][0]['code'],'FILE_HASH_MISMATCH')
        (self.root/'fixture.txt').unlink();self.assertEqual(module.verify_manifest(self.root)['failures'][0]['code'],'FILE_MISSING')
    def test_traversal_absolute_duplicates_and_nonobjects_fail_closed(self):
        for name in ['../outside','C:/outside','/absolute','sub/../../outside']:
            self.manifest['files'][0]['path']=name;self.save();self.assertEqual(module.verify_manifest(self.root)['status'],'failed')
        self.manifest['files']=[{'path':'fixture.txt','bytes':len(self.content),'sha256':hashlib.sha256(self.content).hexdigest()}]*2;self.save();self.assertEqual(module.verify_manifest(self.root)['status'],'failed')
        self.manifest['files']=[None];self.save();self.assertEqual(module.verify_manifest(self.root)['status'],'failed')
    def test_manifest_size_bound_and_empty_entries_fail(self):
        self.manifest['files']=[];self.save();self.assertEqual(module.verify_manifest(self.root)['status'],'failed')
        (self.root/'MANIFEST.json').write_text(' '*262145);self.assertEqual(module.verify_manifest(self.root)['status'],'failed')
if __name__=='__main__':unittest.main()
