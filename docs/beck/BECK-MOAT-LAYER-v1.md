# BECK Moat Layer v1

The BECK moat is not a UI, prompt, or single data source. It is compounding verified economic memory.

## Loop

evidence -> prediction -> external outcome -> discrepancy -> calibration -> better decision -> next transaction

## Tables

- `moat_evidence_observations`: normalized observations with source family, independence key, provenance and verification status.
- `moat_predictions`: explicit predictions with confidence and linked evidence.
- `moat_outcomes`: observed outcomes linked back to predictions, including discrepancy.
- `moat_calibration`: empirical performance by prediction type and confidence bucket.

## Rules

1. Do not count repeated observations from the same source family as independent confirmation.
2. Confidence is a claim to be calibrated, not a decorative percentage.
3. No prediction becomes training evidence merely because it was generated. It needs an observed, verified outcome.
4. No outcome becomes BusinessTruth merely because it exists in the database. Economic verification remains governed by the existing Truth Oracle/economic evidence gates.
5. The moat layer is internal by default. RLS is enabled and no public policies are created by this migration.
6. Trade Oracle can be the first producer of observations, predictions and outcomes, but the schema is deliberately reusable across BECK/CUBE economic cells.

## First commercial use

For every paid Trade Oracle assessment, capture:

question -> evidence set -> source families -> assessment -> confidence -> customer decision -> actual outcome -> discrepancy -> calibration update.

The objective is not to build a bigger database. The objective is to make every verified transaction increase BECK's future decision quality.
