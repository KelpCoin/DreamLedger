# BEC Compiler Control Plane

The repository now has one explicit local compiler entry point:

    BEC-PRIME\bec.cmd

or:

    node BEC-PRIME\bec.js

The compiler delegates to the existing deterministic UniversalCompiler and does not require ChatGPT, Claude, Gemini, Notion, Stripe, or a network connection to compile local artifacts.

## Commands

    bec status
    bec compile
    bec website
    bec game
    bec app
    bec verify

`website`, `game`, and `app` compile the repository's universal specifications. `compile` runs the established full BEC compilation pipeline. `verify` compiles the universal targets and runs the existing production/MCP verification contracts.

## Current verified repository capability

The existing UniversalCompiler supports `website`, `game`, and `app` targets and the game profiles `basic` and `kelplantis-mvp`. The repository contains a compiler proof with a passing Pong HTML5 artifact and a passing homepage artifact.

This control plane intentionally does not claim that the compiler is a general-purpose Shopify replacement. It establishes the independent local build authority first. Commerce, distribution, accounting, telemetry, and deployment remain separate contracts consumed by the compiler pipeline.

## Windows startup

The existing BEC startup orchestra registers an interactive logon task. A repair script is included at:

    BEC-PRIME\scripts\Repair-BECStartup.ps1

It replaces that task with a hidden, non-interactive PowerShell invocation and writes:

    D:\BrownEyeCortex\Runtime\proofs\STARTUP-REPAIR-LATEST.json

This addresses the known BEC startup task without claiming that unrelated Windows tasks are controlled by BEC.
