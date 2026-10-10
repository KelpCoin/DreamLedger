# BECK + LM Studio local wiring

This is a local-only integration. The repository change does not install software on your PC, download a model, modify your live LM Studio settings, or enable external actions.

## What is implemented in this branch

- `local_cortex_lmstudio_ingest.py` prefers the official `lmstudio` Python SDK for structured demand-signal classification. If the SDK, server, model, or schema response fails, the existing deterministic heuristic fallback is preserved and the failure is recorded.
- `beck_lmstudio_sdk.py` provides structured response parsing, honest latency/token telemetry, and a bounded `.act()` entry point.
- `.act()` exposes only three read-only local tools: search local fixtures, summarize local run artifact counts, and preview lexical hints. Tool calls are serialized, tool-call budget is capped, and the round callback aborts after the configured round limit. It does not provide shell, arbitrary file writes, web search, payment, publishing, or authoritative ledger mutation.
- `bec_mcp_server.py` is a read-only MCP server for local runtime status and local signal fixtures.
- `mcp.json.example` is a template only. It must be reviewed and copied to the LM Studio user configuration directory manually; no existing user configuration is overwritten.
- `evals/classify/golden.jsonl` contains synthetic labeled examples. They are evaluation fixtures, not observed market demand.
- `evals/evaluate.py` computes exact-match accuracy and per-field mismatch counts from saved predictions. It does not contact a model or network.

## Local activation (Windows)

From the DreamLedger repository root, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\runtime\lm_studio\Install-BECK-LMStudio.ps1
```

Then ensure LM Studio is installed and a model is already available. The SDK may load the model named by `LM_STUDIO_MODEL`, or use the current loaded model when that variable is empty. The runtime does not download a model automatically.

To test a single signal after installation:

```powershell
python .\runtime\lm_studio\local_cortex_lmstudio_ingest.py --signal-file .\runtime\lm_studio\fixtures\supplier_quote_signal.json
```

To exercise the bounded `.act()` loop:

```powershell
python .\runtime\lm_studio\local_cortex_lmstudio_ingest.py --cortex-act "Summarize local fixture evidence and explain uncertainty" --act-max-tool-calls 3 --act-max-rounds 4
```

The MCP server command in `mcp.json.example` assumes Python is on PATH and the repository root exists at the configured `BEC_ROOT`. If the repo is elsewhere, change only that path. In LM Studio, enable the setting that permits configured MCP servers, then restart the application.

## ADLC evaluation protocol

1. Generate predictions from the model into a separate JSONL file with each row shaped as `{"id":"CLS-001","prediction":{...}}`.
2. Run `python runtime/lm_studio/evals/evaluate.py --predictions path/to/predictions.jsonl`.
3. Compare per-field accuracy with the committed baseline and retain mismatch examples. Do not deploy a changed prompt/model if required labels regress below the release threshold.
4. Never convert evaluation accuracy into a demand, customer, payment, or revenue claim.

Token counts are reported only when the SDK exposes them. Monetary inference cost is `null` for local inference unless a defensible cost allocation is configured. Missing data is not imputed.
