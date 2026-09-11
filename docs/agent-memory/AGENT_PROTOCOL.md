# Agent Protocol

## On every session

1. Identify the silo.
2. Read this directory's README and CURRENT_STATE.
3. Read live Supabase memory when access exists.
4. Read relevant control/evidence records before making claims.
5. Prefer existing offers, buyers, jobs, and evidence over new architecture.

## Write-back rule

Every material finding, decision, blocker, completed action, or changed assumption must be written back to Supabase `public.agent_memory` and, when it changes durable doctrine or operating state, to the appropriate GitHub file.

## Memory classes

CANON: durable rules that agents must obey.
STATE: current observed state with an evidence tier.
DECISION: a deliberate choice and why it was made.
HANDOFF: work another agent can continue.
RUNBOOK: repeatable operational procedure.
EVIDENCE: direct observation or proof reference.
LESSON: observed failure or successful pattern.
TASK: executable next action.
CONSTRAINT: boundary or non-negotiable restriction.

## Evidence discipline

Evidence tier must be explicit. Model reasoning is not primary-source evidence. A model may propose a claim, but Truth Oracle or direct runtime observation must verify it before the claim becomes VERIFIED.

## Economic loop

REAL SIGNAL -> BUYER -> OFFER -> APPROVAL -> CHECKOUT -> SETTLEMENT -> FULFILMENT -> PROOF -> LEARNING -> NEXT BUYER

A technical task is economically important only when it advances or unblocks this loop.

## Public action firewall

Prepare first. Human approval before external outreach or public commercial contact. Never store credentials or secrets in memory, GitHub, or evidence notes.

## Agent handoff format

Every handoff should contain:
- current state
- evidence tier
- what was actually observed
- what remains unknown
- exact blocker
- smallest next action
- files/tables affected
- approval requirement
- verification command or query
