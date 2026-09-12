# Freshness Gate Experiment

Status: pending execution.

Pre-registered outcomes:

1. RED -> unchanged verifier -> GREEN: GATE_PROVEN; no toil class confirmed.
2. RED -> human interpretation or verifier edit -> GREEN: CONTRACT_DRIFT confirmed as recurring; consumer-encoded-semantics becomes a toil candidate.
3. No RED, or GREEN requires code changes beyond regeneration: freshness gate defective.

During execution record in real time:
- verifier_failed_self_explanatory
- source_interpretation_required
- verifier_source_edited
- human_intervention
- exact failure timestamp
- exact recovery timestamp

Regeneration of the expected artifact is permitted. Editing the verifier to make regenerated output pass is not regeneration.
