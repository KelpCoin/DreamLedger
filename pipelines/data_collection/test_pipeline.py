import json, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
from .pipeline import DataCollectionPipeline, PipelineConfig, Source

class PipelineTests(unittest.TestCase):
    def test_normalizes_deduplicates_and_writes_manifest(self):
        with tempfile.TemporaryDirectory() as tmp:
            cfg=PipelineConfig((Source("test","https://example.invalid/data.json",records_path=("items",)),),Path(tmp),retries=0)
            body=json.dumps({"items":[{"id":"1","name":"A"},{"id":"1","name":"A"}]}).encode()
            with patch("pipelines.data_collection.pipeline._fetch",return_value=(body,"application/json")):
                result=DataCollectionPipeline(cfg).collect()
            self.assertEqual(result["records_fetched"],2); self.assertEqual(result["records_unique"],1)
            self.assertEqual(result["source_errors"],[]); self.assertTrue(list(Path(tmp).glob("manifest-*.json")))
    def test_source_failure_is_reported_not_fabricated(self):
        with tempfile.TemporaryDirectory() as tmp:
            cfg=PipelineConfig((Source("broken","https://example.invalid"),),Path(tmp),retries=0)
            with patch("pipelines.data_collection.pipeline._fetch",side_effect=RuntimeError("network")):
                result=DataCollectionPipeline(cfg).collect()
            self.assertEqual(result["records_unique"],0); self.assertEqual(result["source_errors"][0]["error"],"network")
            self.assertFalse(result["revenue_claimed"])
if __name__=="__main__": unittest.main()
