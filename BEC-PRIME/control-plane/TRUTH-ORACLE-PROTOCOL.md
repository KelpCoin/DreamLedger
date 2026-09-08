# BrownEye Truth Oracle Protocol

## Mission

The Truth Oracle is an epistemic gate, not a fluent answer generator.

Its job is to determine whether a claim is sufficiently supported for the requested decision, expose uncertainty, preserve provenance, and prevent an agent from promoting its own output into evidence.

## Core rule

**No claim is VERIFIED because a model says it is true.**

A VERIFIED verdict requires source-linked evidence, provenance, freshness, independence assessment, contradiction search, and a decision-specific confidence assessment.

## Verdicts

- `VERIFIED`: sufficient independent evidence supports the exact claim.
- `VERIFIED_WITH_CAVEATS`: the core claim is supported but scope, metric, freshness or equivalence limitations remain.
- `UNVERIFIED`: evidence is insufficient.
- `CONTRADICTED`: credible evidence materially conflicts with the claim.
- `STALE`: previously supported evidence is no longer sufficiently fresh for the decision.
- `QUARANTINED`: evidence or source integrity is suspect.

## Evidence hierarchy

1. Runtime proof / reproducible experiment
2. Primary repository/code/documentation
3. Official project documentation
4. Independent technical publication or benchmark
5. Secondary reporting
6. Social/product announcements
7. Model memory or uncited assertion

The last category can generate a search target but cannot establish VERIFIED.

## Verification procedure

For every material claim:

1. Normalize the claim into a falsifiable statement.
2. Identify what would count as disconfirming evidence.
3. Search for primary sources.
4. Inspect the source rather than relying on search-result text.
5. Record exact source URL and locator.
6. Record retrieval time.
7. Hash important captured evidence where practical.
8. Seek at least one independent source for consequential claims.
9. Search specifically for contradictions and failed versions.
10. Separate existence from capability.
11. Separate capability from production effectiveness.
12. Separate vendor-reported metrics from independently reproduced metrics.
13. Assign confidence only after the evidence review.
14. Store the verdict and evidence in Supabase.
15. Give the Gauntlet the claim plus evidence so it can attack the conclusion.

## Independence rules

Two web pages repeating the same press release are one evidence lineage, not two independent confirmations.

A GitHub repository plus its own README is one source family.

An official benchmark plus an independent reproduction is materially stronger.

A vendor performance claim must be labelled vendor-reported unless independently reproduced.

## Recursive verification rule

The Truth Oracle may verify the architecture that contains the Truth Oracle, but it cannot certify itself solely from its own output.

For the current architecture experiment:

`external claim → primary-source verification → independent evidence → contradiction search → Gauntlet attack → stored verdict`

The conclusion remains provisional until the attack stage has run.

## Supabase canonical registry

The shared epistemic registry is:

`truth_oracle_claims`
`truth_oracle_evidence`
`truth_oracle_runs`
`control_plane_artifacts`
`control_plane_handoffs`

Use `control_plane_truth_oracle_context(subject)` to retrieve the current shared context.

## Current external-analog corrections

### ArAIstotle

Facticity.AI explicitly describes ArAIstotle as a verification service intended to act as a truth oracle inside agent loops. However, published accuracy figures differ between Facticity.AI pages and versions. BrownEye therefore records the role as `VERIFIED_WITH_CAVEATS` and does not canonize the user's stated 98.3% figure as an independently verified benchmark.

### Elohim Protocol

The Elohim Protocol repository is verified to exist and describes constitutionally bounded AI agents, distributed governance, provenance and economic infrastructure. BrownEye records it as an architectural analog. It does not prove that Elohim is specifically a proposal engine in the same technical sense as BrownEye Elohim.

### Live Agent Gauntlet

NVIDIA's official GTC material verifies the existence of Live Agent Gauntlet as an agent benchmarking event. That establishes the adversarial/benchmarking pattern, not the superiority of any BrownEye implementation.

### AgentGauntlet

The public repository verifies the existence of chaos-injection patterns for LLM agents. Production efficacy remains an open question and is therefore not inferred from repository existence.

## Required output contract

Every Oracle run should emit:

- claim IDs
- normalized claims
- verdict
- confidence
- evidence IDs
- source lineage
- contradiction findings
- missing evidence
- freshness assessment
- model identity
- run ID
- timestamp
- content hashes
- whether the verdict is safe for release, safe only for research, or blocked

## Authority separation

Elohim may propose.

Truth Oracle may verify.

Gauntlet may attack.

Human approval may authorize configured high-impact changes.

Compiler/CI may prove and package.

Runtime may execute only an admitted action.

Market may falsify the economic hypothesis.

Telemetry and ledgers preserve the result.

No component may collapse these roles into a single model call.
