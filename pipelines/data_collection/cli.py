from __future__ import annotations
import argparse, json
from pathlib import Path
from .pipeline import DataCollectionPipeline, PipelineConfig, Source

def main() -> int:
    parser=argparse.ArgumentParser(description="DreamLedger reusable data collection pipeline")
    parser.add_argument("config",type=Path); parser.add_argument("--output-dir",type=Path,default=Path("data_collection_output"))
    args=parser.parse_args()
    raw=json.loads(args.config.read_text(encoding="utf-8"))
    result=DataCollectionPipeline(PipelineConfig(tuple(Source(**x) for x in raw["sources"]),output_dir=args.output_dir)).collect()
    print(json.dumps(result,indent=2,sort_keys=True))
    return 0 if not result["source_errors"] and not result["validation_errors"] else 2
if __name__=="__main__": raise SystemExit(main())
