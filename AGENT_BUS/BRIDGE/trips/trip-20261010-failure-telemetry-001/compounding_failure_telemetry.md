# Compounding Asset: Failure-Telemetry Schema & Collector (Hardened)

Reusable component for any figure-eight trip that involves iterative generation or agent retries.

## Why it compounds
Every failed or blocked run that is logged becomes searchable evidence. Future trips start with knowledge instead of zero. The same data can later support diagnostics or (only if external demand appears) a paid knowledge product.

## Attempt record schema (canonical)
```json
{
  "attempt_id": "uuid-or-string",
  "trip_id": "string",
  "input_hash": "sha256-hex or null",
  "output_hash": "sha256-hex or null",
  "failure_class": "timeout|quality|policy|resource|unknown|success",
  "retry_index": 0,
  "notes": "string",
  "timestamp": "ISO-8601"
}
```

## Collector
See `failure_collector.py` in this package. Pure Python standard library, append-only JSONL, no network calls, no secrets.

## Limitation
Schema + collector only. No live external data collected. No revenue.
