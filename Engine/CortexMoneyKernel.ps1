param([int]$Port=8787,[string]$Root="C:\BrownEyeCortex",[int]$ReconcileIntervalSec=300)
$Ledger="$Root\ledger\event_ledger.jsonl"; $State="$Root\state\stripe_state.json"; $LogDir="$Root\logs\moneykernel"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null; New-Item -ItemType Directory -Force -Path "$Root\state" | Out-Null
$lock="$Root\engine\moneykernel.lock"; if(Test-Path $lock){throw "Already running"}; New-Item -ItemType File -Path $lock -Force | Out-Null
function Log($m){Add-Content "$LogDir\kernel.log" "$(Get-Date -Format o) $m"}
function Write-Event($obj){Add-Content $Ledger ($obj|ConvertTo-Json -Compress -Depth 10)}
$listener=New-Object System.Net.HttpListener; $listener.Prefixes.Add("http://+:$Port/"); $listener.Start()
$secret=(Get-Content "$Root\keys\stripe_webhook_secret.key" -Raw -ErrorAction SilentlyContinue).Trim()
function Verify-Sig($p,$s){if(-not $s){return $false};$t=($s-split','|?{$_-match't=(\d+)'}|%{$matches[1]});$v=($s-split','|?{$_-match'v1=([a-f0-9]+)'}|%{$matches[1]});if(-not$t-or-not$v){return $false};$hmac=New-Object System.Security.Cryptography.HMACSHA256;$hmac.Key=[Text.Encoding]::UTF8.GetBytes($secret);$hash=[BitConverter]::ToString($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes("$t.$p"))).Replace("-","").ToLower();return $v -contains $hash}
$lastReconcile=Get-Date; Log "CortexMoneyKernel ONLINE"
while($true){
    if($listener.Pending()){$ctx=$listener.GetContext();$body=(New-Object IO.StreamReader($ctx.Request.InputStream)).ReadToEnd();if(Verify-Sig $body $ctx.Request.Headers["Stripe-Signature"]){try{$evt=$body|ConvertFrom-Json;if($evt.type -in@("checkout.session.completed","payment_intent.succeeded")){$o=$evt.data.object;$pi=$o.payment_intent??$o.id;$event=@{type="sale_completed";source="stripe_webhook";stripe_pi=$pi;amount=$o.amount_total??$o.amount_received??0;currency=$o.currency;email=$o.customer_details.email;verified=$true;ts=(Get-Date).ToString("o")};Write-Event $event}}catch{}}$ctx.Response.StatusCode=200;$ctx.Response.Close()}
    if((Get-Date)-$lastReconcile -gt (New-TimeSpan -Seconds $ReconcileIntervalSec)){try{$apiKey=(Get-Content "$Root\keys\stripe_secret.key" -Raw).Trim();$headers=@{Authorization="Bearer $apiKey"};$resp=Invoke-RestMethod -Uri "https://api.stripe.com/v1/payment_intents?limit=50" -Headers $headers;foreach($p in $resp.data){if($p.status -ne "succeeded"){continue};$exists=Select-String $Ledger -Pattern $p.id -Quiet;if($exists){continue};Write-Event @{type="sale_completed";source="stripe_reconcile";stripe_pi=$p.id;amount=$p.amount_received/100;currency=$p.currency;email=$p.receipt_email;verified=$true;ts=(Get-Date).ToString("o")}}}catch{Log "Reconcile error: $_"};$lastReconcile=Get-Date}
    Start-Sleep -Milliseconds 200
}
