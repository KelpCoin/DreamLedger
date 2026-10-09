# Failure Telemetry Pack — Usage

## Quick start
```bash
python failure_collector.py --trip trip-20261010-failure-telemetry-001 --class quality --notes "output too noisy"
python failure_collector.py --trip trip-20261010-failure-telemetry-001 --class success --notes "accepted after 7 retries"
```

## With file hashes
```bash
python failure_collector.py --trip T1 --class quality --input prompt.txt --output result.png --retry 3
```

## Log location
Default: `failure_telemetry.jsonl` (append-only, one JSON object per line).

## Design rules
- No network calls
- No secrets
- Failure is expected and recorded
- Success is just another class
- Revenue remains NONE until independent external evidence exists
