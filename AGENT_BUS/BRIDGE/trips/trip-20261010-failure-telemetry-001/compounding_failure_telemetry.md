# Compounding Asset: Failure-Telemetry Schema & Collector Stub

Reusable component for any future figure-eight trip that involves iterative generation or agent retries.

## What it is
- Minimal JSON schema for a single attempt record
- Append-only collector pattern (JSONL or SQLite)
- Failure-class taxonomy starter (timeout, quality reject, policy block, resource, unknown)
- Guidance on how to turn the atlas of failures into a later paid diagnostic product

## Why it compounds
Future trips no longer start from zero. Every failed or blocked run that is properly logged becomes searchable evidence that reduces repeated work and can itself become a sellable knowledge product once external demand appears.

## Path
This file + the schema stub below.

## Schema stub (attempt record)
```json
{
  "attempt_id": "uuid",
  "trip_id": "string",
  "input_hash": "sha256",
  "output_hash": "sha256 or null",
  "failure_class": "timeout|quality|policy|resource|unknown|success",
  "retry_index": 0,
  "notes": "string",
  "timestamp": "ISO-8601"
}
```

## Limitation
Documentation and schema only. No live collector deployed, no external data collected, no revenue.
