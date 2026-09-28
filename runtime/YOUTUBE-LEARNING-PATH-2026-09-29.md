# DreamLedger learning path

Watch these in order. The goal is not to learn distributed-systems theory. The goal is to understand what has been added to DreamLedger and why.

## 1. Dapr Agents: the mental model

Building Durable Multi-Agent AI Workflows with Dapr Agents
https://www.youtube.com/watch?v=VLRg4TKtLBc

Watch: 00:00-12:39 first. Then watch the demo from 12:39-20:11.

What to take away:
- agents can run inside durable workflows
- workflows can survive interruption
- orchestration can fan out and fan in
- tools can be connected through MCP
- the orchestration layer is infrastructure, not economic truth

## 2. Dapr durable workflows

Use the Dapr workflow explanation after the video:
https://dapr.io/workflow/

Focus on fan-out/fan-in, retries, checkpoints and compensation.

## 3. Dapr Agents quickstarts

https://github.com/dapr/dapr-agents/blob/main/quickstarts/README.md

Only study:
- Durable Agent Workflow
- Workflow with Agent Activities
- MCPServer Auto-Discovery

Do not spend time learning the rest yet.

## 4. DreamLedger mapping

The current intended path is:

public demand
-> discovery workers
-> normalize
-> dedupe
-> freshness
-> mass admission
-> capability match
-> traversability
-> human gate
-> external action
-> settlement
-> fulfillment
-> proof
-> verified outcome

Dapr handles durable orchestration around the left and middle portions.
DreamLedger remains authoritative for the right-hand economic truth boundary.

## 5. FleetQ / Agent Fleet

Use it as a visual reference for DAG, MCP, queues and human approval concepts. Do not treat its UI or internal state as DreamLedger economic truth.

https://github.com/escapeboy/agent-fleet-o

## Current rule

Do not watch ten videos. Watch the Microsoft Dapr Agents video, then inspect the three Dapr examples above. Then return to DreamLedger execution.
