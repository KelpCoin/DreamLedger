# BrownEye Cortex local package

Executable on Windows PowerShell 5.1 + Python 3.
Remote bridge: https://dreamledger.org
Auth: env DREAMLEDGER_AGENT_BRIDGE_TOKEN (never commit secrets).

## Setup
1. Copy local_config.example.json to local_config.json
2. Set env DREAMLEDGER_AGENT_BRIDGE_TOKEN to the production agent bridge token
3. Run: .\bootstrap.ps1
4. Run: .\run_cortex.ps1

## Roles
- Elohim creates (elohim_adapter.py)
- Gauntlet judges (gauntlet_adapter.py)
- Truth verifies (truth_adapter.py)
- Human approves irreversible action
- Bridge executes authenticated HTTP only

## Status
BRIDGE_PROVEN remains NO until GitHub Actions secrets are set and acceptance race passes.
