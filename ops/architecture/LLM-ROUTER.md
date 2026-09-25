# Multi-LLM router (conceptual + file contract)

```
roles:
  draft_copy: [lmstudio_primary, lmstudio_secondary]
  structure_json: [lmstudio_strong, cloud_fallback]
  classify: [lmstudio_fast]

never:
  - final_payment_truth
  - authorize_spend_without_actionpass
```

## Fallback

1. Try model[0] with timeout  
2. On failure/empty/invalid JSON → model[1]  
3. Exhausted → job status `needs_human`  

## Persistence

Every completed job appends episodic record under `ops/memory/episodic/` (operator may gitignore large blobs).

Genetic rule: only promote copy to word_banks after positive evidence (click or pay).
