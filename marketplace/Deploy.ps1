# Deploy.ps1
$webhook = $env:RENDER_DEPLOY_HOOK
if ($webhook) { try { Invoke-RestMethod -Method Post -Uri $webhook } catch { Write-Warning "Deploy hook failed" } }
else { Write-Host "No deploy hook set" }
