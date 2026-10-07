# Biggie computer-on checklist

## One-time Discord transport setup

From PowerShell in the DreamLedger checkout:

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\discord\Configure-Discord-Transports.ps1 -SyncGitHub
```

Enter the shared CONTROL_ROOM, ACQUISITION, CRITICAL and DIGEST webhooks in one pass. Leave unused roles blank.

Optional: enter the Discord acquisition channel ID and bot token. The bot transport is the scalable fallback and means new silos do not need individually created webhook URLs.

Never paste webhook URLs or bot tokens into ChatGPT.

## Operating rule

Missing per-silo Discord webhook is not a valid reason to stop CUBE, silo creation, Gauntlet, fulfillment, or economic discovery. Reuse a shared transport or use the bot transport. Only a genuinely missing authorization/credential for the configured transport should reach the Biggie gate.