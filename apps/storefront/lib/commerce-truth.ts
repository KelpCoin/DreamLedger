export const TRUTH_VERDICTS = [
  "VERIFIED",
  "UNVERIFIED",
  "CONTRADICTED",
  "STALE",
  "TEST",
  "SIMULATED",
  "INTERNAL",
  "UNMATCHED",
] as const;

export type TruthVerdict = (typeof TRUTH_VERDICTS)[number];

export function countsAsVerifiedExternalOutcome(
  verdict: TruthVerdict,
  hasIndependentBuyer: boolean,
  hasSettledPayment: boolean,
  hasFulfillmentEvidence: boolean,
  hasExternalEffectEvidence: boolean,
): boolean {
  return (
    verdict === "VERIFIED" &&
    hasIndependentBuyer &&
    hasSettledPayment &&
    hasFulfillmentEvidence &&
    hasExternalEffectEvidence
  );
}
