# SUBSTRATE-SOURCE-REGISTER-v1

Status: CONTROLLED SOURCE POLICY
Date: 2026-09-29

Purpose: prevent macro and substrate research from silently becoming economic truth.

## Source classes

AUTHORITATIVE_RUNTIME
Direct observations from the DreamLedger runtime, provider logs, settlement records, execution records, or independent transaction evidence.

REGULATORY_OFFICIAL
Government, regulator, central bank, standards body, or official institutional publication.

COUNTERPARTY_PRIMARY
Information directly published by the relevant provider, platform, insurer, marketplace, or counterparty.

RESEARCH
Academic or institutional research.

ANALYST
Private research, consulting, investment-bank analysis, or market commentary.

SCENARIO
Hypothetical stress case.

FORECAST
Prediction about a future state.

UNVERIFIED
Anything that cannot yet be classified or corroborated.

## Truth boundary

Only AUTHORITATIVE_RUNTIME and appropriate independent transaction evidence may establish current DreamLedger economic truth.

REGULATORY_OFFICIAL, COUNTERPARTY_PRIMARY, RESEARCH, and ANALYST sources may establish substrate observations.

SCENARIO and FORECAST sources may only establish that a scenario should be tested.

No substrate source can establish:

VERIFIED_EXTERNAL_REVENUE
SETTLED_EXTERNAL_PAYMENTS
INDEPENDENT_EXTERNAL_BUYERS
FULFILLMENT_VERIFIED

## Current research normalization

The September 2026 research set contains at least three different evidence types:

1. Bank of England material documents actual institutional concern about agentic AI, correlated behaviour, cyber risk, operational dependency, and the need for simulation and containment. This is an institutional observation, not proof of a specific future market outcome.

2. France's Autorité de la concurrence reports that OpenAI, Google, and Anthropic together represented more than 84% of the global AI-agent sector in May 2026. This is a dated market-structure observation, not a permanent concentration guarantee.

3. JPMorgan Asset Management reports rapidly increasing inference demand, provider outages, and supply constraints. This is analyst research and should inform dependency testing, not be treated as an exact cost forecast for DreamLedger.

4. Google Threat Intelligence Group reports observed adversarial use of agentic workflows, including a cloud compromise followed by an agent-enabled credential-harvesting campaign completed in under six hours. This is a threat-intelligence observation and supports defensive testing.

The source type must travel with the observation.

## Required normalization

Every external substrate observation should be transformed into:

SOURCE_ID
SOURCE_CLASS
PUBLISHED_AT
OBSERVED_PERIOD
JURISDICTION
SUBSTRATE_CLASS
CLAIM
EVIDENCE_STATUS
APPLICABILITY
FRESHNESS
ACTION_TRIGGER

## Prohibited compression

Do not convert:

"AI adoption may increase"

into:

"human demand is disappearing."

Do not convert:

"provider concentration is high"

into:

"the operator will be evicted."

Do not convert:

"agentic payments may grow"

into:

"agents are already buyers."

Do not convert:

"AI costs may rise"

into:

"this opportunity is unprofitable."

The runtime must perform the intermediate test.

## Decision bridge

EXTERNAL_SOURCE
→ SUBSTRATE_OBSERVATION
→ APPLICABILITY_TEST
→ SURVIVAL_TEST
→ ECONOMIC_EFFECT
→ OPERATOR_ACTION

Never:

EXTERNAL_SOURCE
→ ECONOMIC_TRUTH

## Staleness rule

A source does not remain current merely because its claim sounds durable.

Recheck according to the dependency's actual economic sensitivity.

FAST:
provider price, availability, outages, payment rails.

STANDARD:
market structure, platform rules, insurance terms.

SLOW:
tax policy, macro structure, long-horizon research.

## Completion criterion

The substrate layer can explain exactly why a source changed an economic decision without allowing that source to manufacture economic truth.
