# DreamLedger Agent Fleet Contract

## Mission

This repository may be worked on by multiple humans, cloud agents, phone agents, local LM Studio workers, and other coding agents. They are one distributed engineering workforce, not separate projects.

The shared objective is to move durable work forward without duplicate work, conflicting edits, lost context, or fake completion.

## Source-of-truth order

1. Git history and the checked-out repository are the authoritative implementation state.
2. GitHub Issues and pull requests are the authoritative task and review state.
3. Existing DreamLedger CUBE/public.jobs and Agent Bridge mechanisms are the executable work-dispatch surface. Do not invent a second queue.
4. Airtable is an operational mirror/control board when available.
5. Notion is the human-readable project/context layer when available.
6. Chat conversations are context, not durable state, unless the result is written into one of the above.

If an agent cannot access Airtable or Notion, continue from GitHub and repository state. Never stall merely because a secondary context source is unavailable.

## Before doing work

1. Pull/read the current target branch.
2. Read this file.
3. Inspect open issues/PRs relevant to the mission.
4. Search recent commits for the target area.
5. Search for existing implementations before creating new files, services, queues, tables, APIs, or abstractions.
6. Declare the exact task scope in the issue/PR or durable work note.
7. Avoid files currently being changed by another worker.

## Work model

Large goals are decomposed into small, independently verifiable jobs.

Each job must have:
- objective
- repository/path scope
- dependency list
- acceptance test
- expected evidence
- status
- worker identity
- parent mission/issue

Prefer 15-90 minute bounded jobs. A large mission can contain hundreds or thousands of these jobs.

Workers should:
- claim one bounded job
- inspect before editing
- implement the smallest useful change
- run relevant validation
- commit atomically
- report commit SHA, tests, result, and remaining work
- release/close the job

A worker that finds a blocker records the blocker and proposes viable next actions. It does not silently wait.

## Parallelism

Parallel work is allowed when file ownership and dependencies do not overlap.

Do not have multiple workers edit the same files simultaneously.

For shared hot files, one worker owns integration while other workers submit isolated changes or proposals.

Use branches/worktrees or equivalent isolated workspaces where available. Never rely on several agents mutating one working directory concurrently.

## Handoffs

Every handoff must leave durable evidence:
- commit SHA, PR, or issue comment
- what changed
- what was tested
- what remains
- exact next job

A worker must be able to stop permanently and another worker must be able to continue from the repository without asking the previous worker what happened.

## Truth and safety

Never mark work complete because code was written.

Completion requires the acceptance test and evidence.

Do not fabricate:
- external buyers
- revenue
- deployment
- API success
- production state
- test success
- user approval

DreamLedger economic truth remains governed by the existing production observation contract and truth labels.

## Reuse rule

Before introducing infrastructure, search the repository and existing KelpCoin repositories for reusable:
- CUBE/public.jobs mechanisms
- Agent Bridge
- runtime/economic modules
- CI workflows
- deployment adapters
- schemas
- existing APIs
- marketplace/game subsystems

Extend existing substrate before creating a parallel system.

## Device roles

### Phone agents
Fast reconnaissance, issue triage, code review, small patches, documentation, tests, and handoffs.

### Wife's phone / Grok
Independent worker using the same repository contract. It can inspect current GitHub state, claim bounded tasks, implement changes, commit, and report evidence. It must not create a private fork of project truth.

### Local LM Studio
High-volume local worker for research, code generation, test generation, refactoring, asset preparation, simulation, and bounded implementation. It must consume the same durable task contract and publish results back to Git/GitHub.

### Cloud agents
Parallel implementation, review, CI repair, repository exploration, and integration.

### Biggie
Human authority for identity, consent, payment, irreversible production actions, product direction, and final acceptance where required. Routine coding should not require Biggie.

## Mission loop

WORLD/REQUEST
→ mission issue
→ decomposition
→ bounded CUBE/public.jobs work
→ worker claims
→ isolated implementation
→ validation
→ commit/PR
→ review/integration
→ evidence
→ next decomposition

Never make the human manually translate a giant goal into every tiny coding task. Agents should perform that decomposition.

## Finhaven and other giant projects

A giant project such as Finhaven is a mission, not a single task.

The first worker on a giant project must:
1. discover the existing implementation and its actual state
2. inventory missing capabilities
3. produce a dependency-aware work breakdown
4. identify parallel-safe workstreams
5. create bounded jobs in the existing task substrate
6. start executing the highest-value unblocked jobs

Do not rebuild an existing game or application from scratch when useful code already exists.

## Definition of done

A mission is never "done" merely because a plan exists.

A job is done when its acceptance test passes and durable evidence exists.

A mission is done only when its mission-level acceptance criteria pass in the real target environment.
