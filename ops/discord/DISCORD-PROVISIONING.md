# DreamLedger Discord provisioning contract

## Purpose

Discord is a distribution adapter, not economic truth. Future CUBE swarm silos must not require Biggie to hand-create Discord webhooks.

The reusable path is:

CUBE creates silo -> silo declares Discord channel -> GitHub Actions provisioning workflow -> Discord API -> one named webhook per silo/channel -> downstream publication uses the resulting webhook.

## Required authority

The provisioning runner uses a protected `DISCORD_BOT_TOKEN`. The Discord bot must have permission to manage webhooks in the target channel. Discord documents Manage Webhooks as the permission that allows creation, editing, and deletion of channel webhooks.

The bot token is the durable provisioning credential. Individual webhook URLs are runtime secrets and must never be committed to Git, printed to Actions logs, or treated as public configuration.

## Workflow

`.github/workflows/provision-discord-webhooks.yml`

Input:

```json
[
  {"silo_id":"SILO-001","channel_id":"123456789012345678"},
  {"silo_id":"SILO-002","channel_id":"223456789012345678"}
]
```

The workflow is idempotent by deterministic webhook name `DreamLedger-{silo_id}`. It first checks the channel's existing webhooks and only creates one when that silo webhook is absent.

## Scaling rule

A request such as "CUBE swarm generate 500 new silos" must fan out through this provisioning rail. No manual webhook creation per silo.

The workflow itself does not grant public-posting authority. It only provisions the communication adapter. Publication remains governed by the existing authorization/Gauntlet rules.

## Secret boundary

The current first-dollar `DISCORD_WEBHOOK` remains a supported publication credential, but it is no longer the only transport. The acquisition workflow can use either a shared webhook or the reusable bot transport (`DISCORD_BOT_TOKEN` + `DISCORD_ACQUISITION_CHANNEL_ID`).

The scalable provisioning rail requires a separate protected `DISCORD_BOT_TOKEN` secret. GitHub's Actions Secrets API supports encrypted repository secrets, but the currently connected GitHub tool surface does not expose secret-write operations.

Do not put either credential in source control.

## Biggie one-time setup

Run `ops/discord/Configure-Discord-Transports.ps1 -SyncGitHub` once from Windows when the credentials are available. It collects the shared CONTROL_ROOM, ACQUISITION, CRITICAL and DIGEST webhooks in one pass, stores them locally with Windows DPAPI, and can sync them to GitHub Actions through the authenticated GitHub CLI. Do not paste webhook URLs into chat.

After that, new silos should reuse an existing shared webhook or use the bot provisioning rail. Individual silo creation must not stop because a new webhook URL has not been manually created.

## Failure protocol

Any blocker must be repaired/rerouted first. If a blocker remains, report three viable solutions rather than presenting a single dead end.

Three standard routes:

1. GitHub Actions secret/API route: provide the bot token through protected GitHub secret storage.
2. Server-side Discord adapter route: store the bot credential in the existing server-side secret facility and let the adapter provision webhooks.
3. Direct bot transport route: when a silo does not actually require a unique webhook, send through the bot to the target channel and avoid creating unnecessary webhook objects.

## Truth boundary

Webhook creation is infrastructure state, not revenue.

Verified economic truth remains:

REAL DEMAND -> REAL BUYER -> AUTHORIZED ACTION -> EXTERNAL RESULT -> SETTLED PAYMENT -> FULFILLMENT -> DELIVERY/EVIDENCE -> VERIFIED
