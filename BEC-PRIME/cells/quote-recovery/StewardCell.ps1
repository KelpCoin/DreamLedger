param(
    [Parameter(Mandatory)][ValidateSet("status","discover","qualify","prepare-offer","fulfil","qa","proof")][string]$Action,
    [string]$InputPath,
    [string]$OutputDir = "BEC-PRIME/cells/quote-recovery/state",
    [string]$CandidatePath,
    [string]$Sku = "QUOTE-PIPELINE-RECOVERY-001"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$StatePath = Join-Path $OutputDir "CELL_STATE.json"

function Read-State {
    if (-not (Test-Path $StatePath)) {
        return [ordered]@{ sku=$Sku; commercial_state="PRE-MONEY"; payment_status="NOT_PROVEN"; last_action=$null; qa_status=$null; gauntlet_status=$null; updated_at_utc=(Get-Date).ToUniversalTime().ToString("o") }
    }
    Get-Content $StatePath -Raw | ConvertFrom-Json
}
function Ensure-StateProperty($State, [string]$Name, $Value) {
    if (-not $State.PSObject.Properties[$Name]) { $State | Add-Member -NotePropertyName $Name -NotePropertyValue $Value }
    else { $State.$Name = $Value }
}
function Write-State($State) { $State | ConvertTo-Json -Depth 10 | Set-Content $StatePath -Encoding UTF8 }
function Is-Number($Value) { return $Value -is [byte] -or $Value -is [int16] -or $Value -is [int32] -or $Value -is [int64] -or $Value -is [decimal] -or $Value -is [single] -or $Value -is [double] }
function Get-QuoteLeaks($Records) {
    $leaks=@()
    foreach($r in $Records) {
        $responseHours=[double]$r.response_time_hours; $quoteValue=[double]$r.quote_value_nzd; $quoteSent=[bool]$r.quote_sent
        $hasFollowUp=$null -ne $r.follow_up_date -and [string]$r.follow_up_date -ne ""
        $outcome=if($null -eq $r.outcome){""}else{[string]$r.outcome}; $classes=@()
        if($responseHours -ge 24 -and -not $quoteSent){$classes+="SLOW_RESPONSE"}
        if($quoteSent -and $quoteValue -gt 0 -and ($outcome -eq "" -or $outcome -eq "pending" -or $outcome -eq "no_response")){$classes+="STALE_QUOTE"}
        if($quoteSent -and $quoteValue -gt 0 -and -not $hasFollowUp){$classes+="NO_FOLLOWUP"}
        if($outcome -eq "abandoned" -or $outcome -eq "no_response"){$classes+="ABANDONED"}
        if($outcome -eq "lost" -and $quoteValue -gt 0){$classes+="INACTIVE_CUSTOMER"}
        if($classes.Count -eq 0){continue}
        $urgency=0; if($classes -contains "STALE_QUOTE"){$urgency+=5}; if($classes -contains "NO_FOLLOWUP"){$urgency+=4}; if($classes -contains "SLOW_RESPONSE"){$urgency+=3}; if($classes -contains "ABANDONED"){$urgency+=2}; if($classes -contains "INACTIVE_CUSTOMER"){$urgency+=2}
        $valueWeight=if($quoteValue -ge 2000){5}elseif($quoteValue -ge 800){4}elseif($quoteValue -ge 300){3}elseif($quoteValue -gt 0){2}else{1}
        $score=[math]::Round(($urgency*$valueWeight)/10,2)
        $leaks += [pscustomobject]@{record_id=$r.record_id; classes=($classes -join ","); priority_score=$score; priority=if($score -ge 4.5){"HIGH"}elseif($score -ge 2.5){"MEDIUM"}else{"LOW"}; quoted_opportunity_value_nzd=$quoteValue; confidence="LOW"; recommended_action="Review record and prepare follow-up."}
    }
    return $leaks
}

if($Action -eq "status"){ Read-State | ConvertTo-Json -Depth 10; exit 0 }

if($Action -eq "discover"){
    if(-not $CandidatePath){throw "CandidatePath required for discover."}
    $candidates=@(Get-Content $CandidatePath -Raw | ConvertFrom-Json)
    $scored=foreach($c in $candidates){$score=0;$reasons=@();if([bool]$c.quote_form){$score+=2;$reasons+="quote_form"};if([bool]$c.free_quote){$score+=2;$reasons+="free_quote"};if([bool]$c.high_ticket){$score+=2;$reasons+="high_ticket"};if([bool]$c.commercial_work){$score+=2;$reasons+="commercial_work"};if([bool]$c.multiple_services){$score+=1;$reasons+="multiple_services"};if([bool]$c.owner_operated){$score+=1;$reasons+="owner_operated"};[pscustomobject]@{business_name=$c.business_name;location=$c.location;qualification_score=$score;qualification_reasons=$reasons;discovery_timestamp=(Get-Date).ToUniversalTime().ToString("o");source=$c.source}}
    $scored|Sort-Object qualification_score -Descending|ConvertTo-Json -Depth 5|Set-Content (Join-Path $OutputDir "DISCOVERY.json") -Encoding UTF8
    $s=Read-State;Ensure-StateProperty $s "last_action" "discover";Ensure-StateProperty $s "updated_at_utc" (Get-Date).ToUniversalTime().ToString("o");Write-State $s;Write-Host "Discovery complete.";exit 0
}

if($Action -eq "qualify"){
    $p=Join-Path $OutputDir "DISCOVERY.json";if(-not(Test-Path $p)){throw "Run discover first."};$d=@(Get-Content $p -Raw|ConvertFrom-Json);$q=@();$rj=@();foreach($x in $d){if([int]$x.qualification_score -ge 5){$q+=$x}else{$rj+=$x}}
    [ordered]@{generated_at_utc=(Get-Date).ToUniversalTime().ToString("o");qualified_count=$q.Count;rejected_count=$rj.Count;qualified=@($q);rejected=@($rj)}|ConvertTo-Json -Depth 10|Set-Content (Join-Path $OutputDir "QUALIFICATION.json") -Encoding UTF8
    $s=Read-State;Ensure-StateProperty $s "last_action" "qualify";Ensure-StateProperty $s "updated_at_utc" (Get-Date).ToUniversalTime().ToString("o");Write-State $s;Write-Host "Qualification complete.";exit 0
}

if($Action -eq "prepare-offer"){
    $p=Join-Path $OutputDir "QUALIFICATION.json";if(-not(Test-Path $p)){throw "Run qualify first."};$q=Get-Content $p -Raw|ConvertFrom-Json;$offers=foreach($x in @($q.qualified)){[ordered]@{business_name=$x.business_name;offer_state="HUMAN_APPROVAL_REQUIRED";price_pilot_nzd=500.00;price_standard_nzd=950.00;draft_subject="Quick question about your quote pipeline";draft_body="Hi [First Name], I noticed [Company] offers quotes/estimates. I run a small revenue-leak audit that checks whether existing enquiries and quotes are being followed up effectively. Fixed price, no software install. If useful, I can send a sample of what the report contains.";prepared_at_utc=(Get-Date).ToUniversalTime().ToString("o")}}
    $offers|ConvertTo-Json -Depth 10|Set-Content (Join-Path $OutputDir "OFFERS_READY.json") -Encoding UTF8;$s=Read-State;Ensure-StateProperty $s "last_action" "prepare-offer";Ensure-StateProperty $s "updated_at_utc" (Get-Date).ToUniversalTime().ToString("o");Write-State $s;Write-Host "Offer preparation complete. All offers are HUMAN_APPROVAL_REQUIRED.";exit 0
}

if($Action -eq "fulfil"){
    if(-not $InputPath){throw "InputPath required for fulfil."};$input=Get-Content $InputPath -Raw|ConvertFrom-Json;$records=@($input.records);if($records.Count -lt 1 -or $records.Count -gt 50){throw "INVALID_INPUT: record count must be between 1 and 50."}
    $allowed=@("won","lost","pending","no_response","abandoned","duplicate","not_qualified");$valid=@();$errors=@()
    foreach($r in $records){$e=@();if([string]::IsNullOrWhiteSpace($r.record_id)){$e+="record_id required"};if($null -eq $r.response_time_hours -or -not(Is-Number $r.response_time_hours)){$e+="response_time_hours numeric required"}elseif([double]$r.response_time_hours -lt 0){$e+="response_time_hours >= 0"};if($null -eq $r.quote_sent -or $r.quote_sent -isnot [bool]){$e+="quote_sent boolean required"};if($null -eq $r.quote_value_nzd -or -not(Is-Number $r.quote_value_nzd)){$e+="quote_value_nzd numeric required"}elseif([double]$r.quote_value_nzd -lt 0){$e+="quote_value_nzd >= 0"};if($null -ne $r.outcome -and [string]$r.outcome -ne "" -and $allowed -notcontains [string]$r.outcome){$e+="invalid outcome"};if($e.Count -eq 0){$valid+=$r}else{$errors+=[pscustomobject]@{record_id=$r.record_id;errors=($e -join "; ")}}}
    if($errors.Count -gt 0){$errors|ConvertTo-Json -Depth 5|Set-Content (Join-Path $OutputDir "VALIDATION_ERRORS.json") -Encoding UTF8;throw "INVALID_INPUT: $($errors.Count) invalid record(s)."}
    $leaks=Get-QuoteLeaks $valid;$totalQuoted=($valid|Measure-Object -Property quote_value_nzd -Sum).Sum;$report=[ordered]@{schema="bec/revenue-leak-report/v1";sku=$Sku;generated_at_utc=(Get-Date).ToUniversalTime().ToString("o");records_analyzed=$valid.Count;leaks_detected=$leaks.Count;total_quoted_opportunity_nzd=[math]::Round($totalQuoted,2);high_priority_count=@($leaks|Where-Object priority -eq "HIGH").Count;medium_priority_count=@($leaks|Where-Object priority -eq "MEDIUM").Count;low_priority_count=@($leaks|Where-Object priority -eq "LOW").Count;prioritized_opportunities=@($leaks);limitations=@("Quoted value is not recoverable revenue.","No recoverable revenue estimate is made.","Confidence is LOW until empirical recovery data exists.","No customer contact is automated.")}
    $reportPath=Join-Path $OutputDir "QUOTE_RECOVERY_REPORT.json";$report|ConvertTo-Json -Depth 10|Set-Content $reportPath -Encoding UTF8;$qaErrors=@();if(-not(Test-Path $reportPath)){$qaErrors+="report not generated"};if($leaks.Count -eq 0){$qaErrors+="no leaks detected"};$qa=if($qaErrors.Count -eq 0){"PASS"}else{"FAIL"};$gauntlet=if($qa -eq "PASS"){"PRE-MONEY"}else{"QUARANTINE"};$proof=[ordered]@{schema="bec/fulfilment-proof/v1";sku=$Sku;generated_at_utc=(Get-Date).ToUniversalTime().ToString("o");local_execution=$qa;qa_status=$qa;gauntlet_status=$gauntlet;payment_status="NOT_PROVEN";input_record_count=$valid.Count;invalid_record_count=$errors.Count;output_leak_count=$leaks.Count;total_quoted_opportunity_nzd=[math]::Round($totalQuoted,2);operator_minutes=0;machine_duration_ms=0;report_path=$reportPath;artificial_recovery_factor="REMOVED"};$proofPath=Join-Path $OutputDir "FULFILMENT_PROOF.json";$proof|ConvertTo-Json -Depth 5|Set-Content $proofPath -Encoding UTF8
    $s=Read-State;Ensure-StateProperty $s "last_action" "fulfil";Ensure-StateProperty $s "qa_status" $qa;Ensure-StateProperty $s "gauntlet_status" $gauntlet;Ensure-StateProperty $s "payment_status" "NOT_PROVEN";Ensure-StateProperty $s "updated_at_utc" (Get-Date).ToUniversalTime().ToString("o");Write-State $s;Write-Host "QA: $qa";Write-Host "GAUNTLET: $gauntlet";Write-Host "PAYMENT: NOT_PROVEN";Write-Host "REPORT: $reportPath";Write-Host "PROOF: $proofPath";if($gauntlet -eq "QUARANTINE"){exit 1};exit 0
}

if($Action -eq "qa"){$p=Join-Path $OutputDir "FULFILMENT_PROOF.json";if(-not(Test-Path $p)){throw "Fulfil first."};$x=Get-Content $p -Raw|ConvertFrom-Json;Write-Host "QA: $($x.qa_status)";Write-Host "GAUNTLET: $($x.gauntlet_status)";Write-Host "PAYMENT: $($x.payment_status)";exit 0}
if($Action -eq "proof"){$p=Join-Path $OutputDir "FULFILMENT_PROOF.json";if(-not(Test-Path $p)){throw "Fulfil first."};Get-Content $p -Raw;exit 0}
throw "Unsupported action: $Action"
