# GPU / headless workers (Windows + LM Studio)

## Pattern

Orchestration and inference are **split**.

1. Job lands in `ops/workers/jobs/inbox/` (JSON)  
2. Headless PowerShell worker on GPU machine polls or is scheduled  
3. Worker POSTs to LM Studio OpenAI-compatible API (`http://localhost:1234/v1/...`)  
4. Result written to `ops/workers/jobs/outbox/`  
5. Orchestrator / Agent Bus consumes outbox  

## Rules

- No unrestricted Stripe secrets in job prompts  
- Money actions only via ActionPass + server actuators  
- Fallback: if LM Studio down, mark job `failed_retry` or route cloud (policy-gated)  

## Example job shape

See `jobs/examples/draft_offer_copy.json`

## Example worker

See `ps1/Invoke-LmStudioJob.ps1` (run on Windows host with LM Studio)
