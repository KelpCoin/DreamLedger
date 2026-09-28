from __future__ import annotations
import csv, hashlib, json, time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

@dataclass(frozen=True)
class Source:
    name: str
    url: str
    format: str = "json"
    records_path: tuple[str, ...] = ()
    params: dict[str, str] = field(default_factory=dict)
    headers: dict[str, str] = field(default_factory=dict)
    field_map: dict[str, str] = field(default_factory=dict)

@dataclass(frozen=True)
class PipelineConfig:
    sources: tuple[Source, ...]
    output_dir: Path = Path("data_collection_output")
    timeout_seconds: int = 30
    retries: int = 3
    backoff_seconds: float = 1.0
    user_agent: str = "DreamLedger-DataCollectionPipeline/1.0"

def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()

def stable_hash(row: dict[str, Any]) -> str:
    payload = json.dumps(row, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(payload.encode()).hexdigest()

def _walk(value: Any, path: tuple[str, ...]) -> Any:
    for key in path:
        if not isinstance(value, dict): return []
        value = value.get(key, [])
    return value

def _fetch(source: Source, cfg: PipelineConfig) -> tuple[bytes, str]:
    query = urlencode(source.params)
    url = source.url + ((("&" if "?" in source.url else "?") + query) if query else "")
    headers = {"User-Agent": cfg.user_agent, "Accept": "application/json, text/csv, */*", **source.headers}
    last_error = None
    for attempt in range(cfg.retries + 1):
        try:
            req = Request(url, headers=headers, method="GET")
            with urlopen(req, timeout=cfg.timeout_seconds) as response:
                return response.read(), response.headers.get("content-type", "")
        except (HTTPError, URLError, TimeoutError) as exc:
            last_error = exc
            if attempt < cfg.retries: time.sleep(cfg.backoff_seconds * (2 ** attempt))
    raise RuntimeError(f"source_fetch_failed:{source.name}:{last_error}")

def _parse(source: Source, body: bytes, content_type: str) -> list[dict[str, Any]]:
    if source.format == "csv" or "csv" in content_type.lower():
        return [dict(row) for row in csv.DictReader(body.decode("utf-8-sig").splitlines())]
    payload = json.loads(body.decode("utf-8"))
    records = _walk(payload, source.records_path) if source.records_path else payload
    if not isinstance(records, list): raise ValueError(f"source_records_not_list:{source.name}")
    return [dict(x) for x in records if isinstance(x, dict)]

def _normalize(row: dict[str, Any], source: Source) -> dict[str, Any]:
    out = {target: row.get(src) for src, target in source.field_map.items()} if source.field_map else dict(row)
    out = {str(k).strip(): v for k, v in out.items()}
    out["_source"], out["_source_url"], out["_observed_at"] = source.name, source.url, utc_now()
    out["_record_hash"] = stable_hash({k:v for k,v in out.items() if not k.startswith("_")})
    return out

class DataCollectionPipeline:
    """Extract -> normalize -> deduplicate -> change-detect -> validate -> export."""
    def __init__(self, config: PipelineConfig):
        self.config = config
        self.config.output_dir.mkdir(parents=True, exist_ok=True)

    def collect(self, validator: Callable[[dict[str, Any]], Iterable[str]] | None = None) -> dict[str, Any]:
        run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        raw, errors = [], []
        for source in self.config.sources:
            try:
                body, content_type = _fetch(source, self.config)
                raw.extend(_normalize(row, source) for row in _parse(source, body, content_type))
            except Exception as exc:
                errors.append({"source": source.name, "error": str(exc)})
        unique = {(r["_source"], r["_record_hash"]): r for r in raw}
        records = list(unique.values())
        validation_errors = []
        if validator:
            for row in records:
                problems = list(validator(row))
                if problems: validation_errors.append({"source":row["_source"],"record_hash":row["_record_hash"],"errors":problems})
        changed = self._detect_changes(records)
        self._write_csv(records, self.config.output_dir / f"records-{run_id}.csv")
        self._write_json(records, self.config.output_dir / f"records-{run_id}.json")
        manifest = {
            "schema":"dreamledger/data-collection-run/v1","run_id":run_id,"observed_at":utc_now(),
            "source_count":len(self.config.sources),"records_fetched":len(raw),"records_unique":len(records),
            "records_changed":len(changed),"validation_errors":len(validation_errors),"source_errors":errors,
            "change_detection":changed,"external_action_performed":False,"payment_observed":False,"revenue_claimed":False
        }
        self._write_json(manifest, self.config.output_dir / f"manifest-{run_id}.json")
        return manifest

    def _detect_changes(self, records: list[dict[str, Any]]) -> list[dict[str, str]]:
        state_path = self.config.output_dir / "state.json"
        previous = json.loads(state_path.read_text()) if state_path.exists() else {}
        old_keys = set(previous.get("records", {}))
        current = {f"{r['_source']}::{r['_record_hash']}":r["_record_hash"] for r in records}
        changed = [{"record_key":k,"change":"NEW_OR_CHANGED"} for k in current if k not in old_keys]
        state_path.write_text(json.dumps({"records":current,"updated_at":utc_now()},indent=2,sort_keys=True),encoding="utf-8")
        return changed

    @staticmethod
    def _write_json(value: Any, path: Path) -> None:
        path.write_text(json.dumps(value,indent=2,sort_keys=True,default=str),encoding="utf-8")

    @staticmethod
    def _write_csv(records: list[dict[str, Any]], path: Path) -> None:
        if not records: path.write_text("",encoding="utf-8"); return
        fields=sorted({k for r in records for k in r})
        with path.open("w",newline="",encoding="utf-8") as handle:
            writer=csv.DictWriter(handle,fieldnames=fields,extrasaction="ignore"); writer.writeheader(); writer.writerows(records)
