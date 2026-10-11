# BECK + LM Studio local wiring

This is a local-only integration. The repository change does not install software on your PC, download a model, modify your live LM Studio settings, or enable external actions.

## What is implemented in this branch

- \`local_cortex_lmstudio_ingest.py\` classifies demand signals with LM Studio and sends candidate results through the existing Gauntlet adapter.
- \`local_quote_resonance_bridge.py\` watches a local intake folder for PDFs whose filenames contain \`quote\`, hashes each file, extracts text with pypdf, requests schema-constrained JSON from LM Studio, validates the result, and records a local artifact.
- Duplicate source hashes are skipped. Invalid inputs or model outputs are recorded in the quarantine directory rather than marked successful.
- The quote bridge writes a heartbeat and uses explicit request timeouts. It does not upload source PDFs, create checkout sessions, publish results, or write to the authoritative revenue ledger.
- \`beck_lmstudio_sdk.py\` provides structured response parsing, honest latency/token telemetry, and a bounded read-only \`.act()\` entry point.
- \`bec_mcp_server.py\` is a read-only MCP server for local runtime status and local signal fixtures.
- \`evals/classify/golden.jsonl\` contains synthetic labeled examples. They are evaluation fixtures, not observed market demand.

## Local quote bridge

Install the local runtime dependencies from the repository root:

\`\`\`powershell
python -m pip install -r .\\runtime\\lm_studio\\requirements.txt
\`\`\`

Ensure LM Studio's OpenAI-compatible server is enabled and a model is loaded. The default endpoint is \`http://127.0.0.1:1234\`. Override it with \`$env:LM_STUDIO_BASE_URL\` if needed; set \`$env:LM_STUDIO_MODEL\` only when you want to pin an exact model ID.

Run one scan:

\`\`\`powershell
python .\\runtime\\lm_studio\\local_quote_resonance_bridge.py --once
\`\`\`

Run the watcher, which sleeps between scans while no matching files are present:

\`\`\`powershell
python .\\runtime\\lm_studio\\local_quote_resonance_bridge.py
\`\`\`

Drop a PDF with \`quote\` in its filename into \`runtime\\lm_studio\\intake\\\`. Validated artifacts are written to \`runtime\\lm_studio\\quote_runs\\\`; rejected inputs/results are recorded in \`runtime\\lm_studio\\quote_quarantine\\\`. The source PDF remains in intake. A scanned/image-only PDF is quarantined because OCR is deliberately not enabled in this first bounded bridge.

Run the bridge tests:

\`\`\`powershell
python -m unittest runtime.lm_studio.test_local_quote_resonance_bridge
\`\`\`

**Activation and proof limitation:** committing these files does not start a Windows process. The bridge is not considered active until it is run on the user's machine and a heartbeat plus a valid artifact are observed. It does not prove demand, payment, or revenue.

## Existing local signal path

To test a single signal after installation:

\`\`\`powershell
python .\\runtime\\lm_studio\\local_cortex_lmstudio_ingest.py --signal-file .\\runtime\\lm_studio\\fixtures\\supplier_quote_signal.json
\`\`\`

To exercise the bounded \`.act()\` loop:

\`\`\`powershell
python .\\runtime\\lm_studio\\local_cortex_lmstudio_ingest.py --cortex-act "Summarize local fixture evidence and explain uncertainty" --act-max-tool-calls 3 --act-max-rounds 4
\`\`\`

The MCP server command in \`mcp.json.example\` assumes Python is on PATH and the repository root exists at the configured \`BEC_ROOT\`. If the repo is elsewhere, change only that path. In LM Studio, enable the setting that permits configured MCP servers, then restart the application.

## ADLC evaluation protocol

1. Generate predictions from the model into a separate JSONL file with each row shaped as \`{"id":"CLS-001","prediction":{...}}\`.
2. Run \`python runtime/lm_studio/evals/evaluate.py --predictions path/to/predictions.jsonl\`.
3. Compare per-field accuracy with the committed baseline and retain mismatch examples. Do not deploy a changed prompt/model if required labels regress below the release threshold.
4. Never convert evaluation accuracy into a demand, customer, payment, or revenue claim.

Token counts are reported only when the SDK exposes them. Monetary inference cost is \`null\` for local inference unless a defensible cost allocation is configured. Missing data is not imputed.
