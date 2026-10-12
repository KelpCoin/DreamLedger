#Requires -Version 5.1
[CmdletBinding()]
param(
    [int]$Port = 1234,
    [string]$ProofPath = "",
    [int]$CacheMinutes = 360
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$base = "http://127.0.0.1:$Port"
$DataRoot = if (Test-Path 'D:\') { 'D:\BrownEyeCortex' } else { Join-Path $HOME 'BrownEyeCortex' }
if ([string]::IsNullOrWhiteSpace($ProofPath)) { $ProofPath = Join-Path $DataRoot 'proofs\Runtime\LMSTUDIO-THREE-ROLE-READINESS.json' }
$ProofDir = Split-Path -Parent $ProofPath
$LogDir = Join-Path $DataRoot 'logs'
$LogPath = Join-Path $LogDir 'LMStudio-ThreeRole-Readiness.log'
$null = New-Item -ItemType Directory -Force -Path $ProofDir,$LogDir

function Write-Log([string]$Message) {
    $line = "[$([DateTime]::UtcNow.ToString('o'))] $Message"
    Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
    Write-Host $Message
}
function Write-JsonAtomic([string]$Path,[object]$Value) {
    $tmp = "$Path.tmp"
    $Value | ConvertTo-Json -Depth 16 | Set-Content -LiteralPath $tmp -Encoding UTF8
    Move-Item -LiteralPath $tmp -Destination $Path -Force
}
function Get-LmsPath {
    $cmd = Get-Command lms.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $cmd = Get-Command lms -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $paths = @(
        (Join-Path $env:USERPROFILE '.lmstudio\bin\lms.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\LM Studio\resources\app\.webpack\bin\lms.exe'),
        (Join-Path $env:LOCALAPPDATA 'LM Studio\bin\lms.exe')
    )
    foreach ($candidate in $paths) { if (Test-Path -LiteralPath $candidate) { return $candidate } }
    throw 'LM Studio CLI lms.exe was not found. Open LM Studio once and verify the bundled CLI installation.'
}
function Invoke-Lms([string[]]$Args,[switch]$AllowFailure) {
    $exe = Get-LmsPath
    $lines = @(& $exe @Args 2>&1)
    $code = $LASTEXITCODE
    $output = ($lines | ForEach-Object { [string]$_ }) -join [Environment]::NewLine
    if (-not [string]::IsNullOrWhiteSpace($output)) { Add-Content -LiteralPath $LogPath -Value $output -Encoding UTF8 }
    if ($code -ne 0 -and -not $AllowFailure) { throw ("lms " + ($Args -join ' ') + " failed exit=$code; " + $output) }
    return [pscustomobject]@{ ExitCode=$code; Output=$output }
}
function Get-GpuStats {
    $gpuPath = Get-Command nvidia-smi.exe -ErrorAction SilentlyContinue
    if (-not $gpuPath) { $gpuPath = Get-Command nvidia-smi -ErrorAction SilentlyContinue }
    if (-not $gpuPath -and (Test-Path 'C:\Program Files\NVIDIA Corporation\NVSMI\nvidia-smi.exe')) {
        $gpuPath = [pscustomobject]@{ Source='C:\Program Files\NVIDIA Corporation\NVSMI\nvidia-smi.exe' }
    }
    if (-not $gpuPath) { throw 'nvidia-smi is unavailable; NVIDIA GPU help cannot be independently verified.' }
    $line = (& $gpuPath.Source --query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu --format=csv,noheader,nounits 2>&1 | Select-Object -First 1)
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace([string]$line)) { throw ("nvidia-smi query failed: " + [string]$line) }
    $p = ([string]$line -split ',') | ForEach-Object { $_.Trim() }
    if ($p.Count -lt 5) { throw ("Unexpected nvidia-smi response: " + [string]$line) }
    return [pscustomobject]@{
        name=[string]$p[0]
        memory_total_mb=[int]$p[1]
        memory_used_mb=[int]$p[2]
        memory_free_mb=[int]$p[3]
        utilization_percent=[int]$p[4]
    }
}
function Get-ModelKeys {
    $result = Invoke-Lms @('ls','--llm','--json') -AllowFailure
    if ($result.ExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($result.Output)) {
        $result = Invoke-Lms @('ls','--json') -AllowFailure
    }
    if ($result.ExitCode -ne 0) { throw ("Could not list LM Studio models: " + $result.Output) }
    $jsonText = $result.Output.Trim()
    try { $parsed = $jsonText | ConvertFrom-Json }
    catch {
        $startArray = $jsonText.IndexOf('[')
        $startObject = $jsonText.IndexOf('{')
        if ($startArray -ge 0 -and ($startObject -lt 0 -or $startArray -lt $startObject)) { $start = $startArray } else { $start = $startObject }
        if ($start -lt 0) { throw ("Could not parse lms ls JSON. Output: " + $jsonText) }
        $jsonText = $jsonText.Substring($start)
        $parsed = $jsonText | ConvertFrom-Json
    }
    $items = @($parsed)
    if ($parsed -and $parsed.PSObject.Properties['models']) { $items = @($parsed.models) }
    if ($parsed -and $parsed.PSObject.Properties['data'] -and $items.Count -eq 0) { $items = @($parsed.data) }
    $keys = [System.Collections.Generic.List[string]]::new()
    foreach ($item in $items) {
        if ($null -eq $item) { continue }
        $key = ''
        foreach ($propertyName in @('modelKey','model_key','key','id','path')) {
            $property = $item.PSObject.Properties[$propertyName]
            if ($property -and -not [string]::IsNullOrWhiteSpace([string]$property.Value)) { $key = [string]$property.Value; break }
        }
        if ([string]::IsNullOrWhiteSpace($key) -and $item -is [string]) { $key = [string]$item }
        if (-not [string]::IsNullOrWhiteSpace($key) -and -not $keys.Contains($key)) { $keys.Add($key) }
    }
    return @($keys)
}
function Get-LoadedSnapshot {
    $r = Invoke-Lms @('ps')
    return [string]$r.Output
}
function Get-ApiModelIds {
    $r = Invoke-RestMethod -Uri "$base/v1/models" -Method Get -TimeoutSec 15
    return @($r.data | ForEach-Object { [string]$_.id } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
}
function Find-RoleModel([string]$Role,[string[]]$Keys,[string[]]$Exclude) {
    $patterns = switch ($Role) {
        'lightweight' {
            @(
                '(?i)qwen2[._-]?5.*3b.*instruct(?!.*vl)',
                '(?i)llama.*3[._-]?2.*3b.*instruct',
                '(?i)qwen3.*4b(?!.*coder)(?!.*vl)',
                '(?i)gemma.?3.*4b.*it',
                '(?i)qwen.*1[._-]?5b.*instruct',
                '(?i)phi.?4.*mini',
                '(?i)smollm.*2b',
                '(?i)qwen.*7b.*instruct(?!.*vl)'
            )
        }
        'heavyweight' {
            @(
                '(?i)qwen2[._-]?5.*coder.*14b',
                '(?i)qwen.*14b.*coder',
                '(?i)gpt[-_]?oss.*20b',
                '(?i)deepseek.*(14b|16b|32b)',
                '(?i)qwen2[._-]?5.*14b',
                '(?i)qwen3.*14b',
                '(?i)llama.*(13b|14b)',
                '(?i)mistral.*(12b|14b)'
            )
        }
        'visual' {
            @(
                '(?i)qwen2[._-]?5.*vl.*3b',
                '(?i)qwen3.*vl.*4b',
                '(?i)qwen.*vl.*3b',
                '(?i)gemma.?3.*(4b|12b).*it',
                '(?i)llava',
                '(?i)internvl',
                '(?i)pixtral',
                '(?i)moondream',
                '(?i)minicpm.*v',
                '(?i).*vision.*',
                '(?i)qwen.*vl'
            )
        }
    }
    foreach ($pattern in $patterns) {
        $match = @($Keys | Where-Object { $_ -match $pattern -and $_ -notin $Exclude } | Select-Object -First 1)
        if ($match.Count -gt 0) { return [string]$match[0] }
    }
    return $null
}
function Ensure-RoleModel([string]$Role,[string[]]$Keys,[string[]]$Exclude) {
    $key = Find-RoleModel -Role $Role -Keys $Keys -Exclude $Exclude
    if ($key) { return $key }
    $downloads = switch ($Role) {
        'lightweight' { @('qwen2.5-3b-instruct@q4_k_m','lmstudio-community/Qwen2.5-3B-Instruct-GGUF@q4_k_m') }
        'heavyweight' { @('qwen2.5-coder-14b-instruct@q4_k_m','lmstudio-community/Qwen2.5-Coder-14B-Instruct-GGUF@q4_k_m') }
        'visual' { @('qwen2.5-vl-3b-instruct@q4_k_m','lmstudio-community/Qwen2.5-VL-3B-Instruct-GGUF@q4_k_m') }
    }
    foreach ($modelSpec in $downloads) {
        Write-Log "MODEL_DOWNLOAD_START role=$Role spec=$modelSpec"
        $downloadResult = Invoke-Lms @('get',$modelSpec) -AllowFailure
        if ($downloadResult.ExitCode -ne 0) { Write-Log "MODEL_DOWNLOAD_RETRY role=$Role spec=$modelSpec exit=$($downloadResult.ExitCode)"; continue }
        Start-Sleep -Seconds 2
        $newKeys = Get-ModelKeys
        $key = Find-RoleModel -Role $Role -Keys $newKeys -Exclude $Exclude
        if ($key) {
            Write-Log "MODEL_DOWNLOAD_READY role=$Role model_key=$key"
            return $key
        }
    }
    throw "No suitable downloaded $Role model found and automatic download did not yield one. See $LogPath."
}
function Get-GpuFraction([string]$Role,[int]$TotalMb) {
    if ($TotalMb -ge 14000) {
        switch ($Role) { 'lightweight' { return '0.80' } 'heavyweight' { return '0.50' } default { return '0.65' } }
    }
    if ($TotalMb -ge 10000) {
        switch ($Role) { 'lightweight' { return '0.55' } 'heavyweight' { return '0.35' } default { return '0.45' } }
    }
    if ($TotalMb -ge 8000) {
        switch ($Role) { 'lightweight' { return '0.40' } 'heavyweight' { return '0.20' } default { return '0.30' } }
    }
    switch ($Role) { 'lightweight' { return '0.20' } 'heavyweight' { return '0.10' } default { return '0.15' } }
}
function Load-RoleModel([string]$Role,[string]$ModelKey,[string]$Identifier,[int]$TotalGpuMb) {
    $before = Get-LoadedSnapshot
    if ($before -match [regex]::Escape($Identifier)) {
        Write-Log "MODEL_ALREADY_LOADED role=$Role identifier=$Identifier"
        return [pscustomobject]@{ role=$Role; model_key=$ModelKey; identifier=$Identifier; requested_gpu_offload='existing'; load_status='ALREADY_LOADED' }
    }
    $preferred = [double](Get-GpuFraction -Role $Role -TotalMb $TotalGpuMb)
    $fractions = @($preferred, [math]::Max(0.10,[math]::Round($preferred * 0.70,2)), [math]::Max(0.10,[math]::Round($preferred * 0.40,2))) | Select-Object -Unique
    foreach ($fraction in $fractions) {
        $fractionText = ([double]$fraction).ToString('0.00',[Globalization.CultureInfo]::InvariantCulture)
        try {
            Write-Log "MODEL_LOAD_START role=$Role model_key=$ModelKey identifier=$Identifier gpu_fraction=$fractionText context=2048"
            $null = Invoke-Lms @('load',$ModelKey,'--gpu',$fractionText,'--context-length','2048','--identifier',$Identifier)
            Start-Sleep -Seconds 2
            $snapshot = Get-LoadedSnapshot
            if ($snapshot -match [regex]::Escape($Identifier)) {
                Write-Log "MODEL_LOAD_OK role=$Role identifier=$Identifier gpu_fraction=$fractionText"
                return [pscustomobject]@{ role=$Role; model_key=$ModelKey; identifier=$Identifier; requested_gpu_offload=$fractionText; load_status='LOADED' }
            }
        } catch {
            Write-Log "MODEL_LOAD_RETRY role=$Role gpu_fraction=$fractionText error=$($_.Exception.Message)"
        }
    }
    throw "Could not keep $Role model '$ModelKey' resident as API identifier '$Identifier'. No model was unloaded automatically."
}
function Invoke-InferenceProbe([string]$Role,[string]$Identifier,[string]$ModelKey,[bool]$Vision,[string]$ImageBase64) {
    $token = switch ($Role) { 'lightweight' { 'LIGHTWEIGHT_ROLE_OK' } 'heavyweight' { 'HEAVYWEIGHT_ROLE_OK' } default { 'VISUAL_ROLE_OK' } }
    if ($Vision) {
        $userContent = @(
            @{ type='text'; text='Inspect the attached image itself. It is a flat, solid blue rectangle. Write about 35-50 words describing the image. Then put the dominant colour in uppercase on its own line, and finish with exactly VISUAL_ROLE_OK on the final line.' },
            @{ type='image_url'; image_url=@{ url=("data:image/png;base64," + $ImageBase64) } }
        )
    } else {
        $subject = if ($Role -eq 'lightweight') { 'Explain in about 45-65 words how to triage a task with limited compute and preserve factual uncertainty.' } else { 'Explain in about 45-65 words how to challenge a technical claim, isolate a root cause, and require a proof before changing production.' }
        $userContent = $subject + [Environment]::NewLine + "Finish with exactly $token on its own final line."
    }
    $body = @{
        model=$Identifier
        messages=@(
            @{ role='system'; content='This is an isolated runtime health probe. Follow the output contract exactly. Do not access tools or external systems.' },
            @{ role='user'; content=$userContent }
        )
        temperature=0
        max_tokens=128
        stream=$false
    }
    $bodyJson = $body | ConvertTo-Json -Depth 12 -Compress
    $job = Start-Job -ScriptBlock {
        param($Uri,$Json)
        try {
            $response = Invoke-RestMethod -Uri $Uri -Method Post -ContentType 'application/json' -Body $Json -TimeoutSec 180
            $message = $response.choices[0].message
            $content = [string]$message.content
            if ([string]::IsNullOrWhiteSpace($content)) { $content = [string]$message.reasoning_content }
            [pscustomobject]@{ ok=$true; content=$content; error='' }
        } catch {
            [pscustomobject]@{ ok=$false; content=''; error=$_.Exception.Message }
        }
    } -ArgumentList ("$base/v1/chat/completions"),$bodyJson
    $maxUtil = 0
    $samples = 0
    $deadline = [DateTime]::UtcNow.AddMinutes(3)
    while ($job.State -in @('NotStarted','Running') -and [DateTime]::UtcNow -lt $deadline) {
        try {
            $gpu = Get-GpuStats
            $samples++
            if ($gpu.utilization_percent -gt $maxUtil) { $maxUtil = $gpu.utilization_percent }
        } catch {}
        Start-Sleep -Milliseconds 300
    }
    if ($job.State -in @('NotStarted','Running')) {
        Stop-Job -Job $job -ErrorAction SilentlyContinue
        Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
        throw "Inference timeout for role=$Role identifier=$Identifier"
    }
    $jobItems = @(Receive-Job -Job $job -Wait -AutoRemoveJob)
    $result = $jobItems | Where-Object { $null -ne $_ -and $_.PSObject.Properties['ok'] } | Select-Object -Last 1
    if (-not $result -or -not $result.ok) { throw "Inference API failed for role=$Role model=$ModelKey error=$($result.error)" }
    $content = ([string]$result.content -replace '(?is)<think>.*?</think>','').Trim()
    $hasToken = $content -match ("(?im)^\s*" + [regex]::Escape($token) + "\s*$")
    $visionColor = $true
    if ($Vision) { $visionColor = $content -match '(?im)^\s*BLUE\s*$' }
    if (-not $hasToken -or -not $visionColor) {
        throw "Inference contract failed for role=$Role model=$ModelKey. Token=$hasToken VisionBlue=$visionColor Output=$content"
    }
    return [ordered]@{
        role=$Role
        model_key=$ModelKey
        api_identifier=$Identifier
        inference='PASS'
        probe_token=$token
        vision_color_check=$(if($Vision){'BLUE_DETECTED'}else{'NOT_APPLICABLE'})
        gpu_max_utilization_during_inference_percent=$maxUtil
        gpu_samples=$samples
        gpu_activity_sampled=($maxUtil -gt 0)
        response_excerpt=($content.Substring(0,[Math]::Min(220,$content.Length)))
    }
}
$proof = [ordered]@{
    schema='BEC-LMSTUDIO-THREE-ROLE-READINESS/v2'
    status='FAIL'
    readiness='NOT_READY'
    verified_at_utc=[DateTime]::UtcNow.ToString('o')
    heartbeat_at_utc=[DateTime]::UtcNow.ToString('o')
    server=$base
    required_roles=@('lightweight','heavyweight','visual')
    roles=@()
    verification_reused=$false
    note='PASS requires three distinct resident models, real text inference for lightweight and heavyweight, actual image-payload inference for visual, GPU offload, GPU memory/activity telemetry, and a final loaded-model snapshot.'
}
try {
    $script:LmsPath = Get-LmsPath
    $script:LogPath = $LogPath
    Write-Log "READINESS_START port=$Port proof=$ProofPath"
    try { $null = Invoke-RestMethod -Uri "$base/v1/models" -Method Get -TimeoutSec 5 }
    catch {
        Write-Log "LMSTUDIO_SERVER_START port=$Port"
        $server = Invoke-Lms @('server','start','--port',[string]$Port) -AllowFailure
        $ready = $false
        for ($i=0; $i -lt 45; $i++) {
            Start-Sleep -Seconds 1
            try { $null = Invoke-RestMethod -Uri "$base/v1/models" -Method Get -TimeoutSec 4; $ready=$true; break } catch {}
        }
        if (-not $ready) { throw "LM Studio API did not become ready at $base/v1/models. lms output: $($server.Output)" }
    }
    $gpuBaseline = Get-GpuStats
    $proof.gpu = [ordered]@{ name=$gpuBaseline.name; total_memory_mb=$gpuBaseline.memory_total_mb; baseline_used_mb=$gpuBaseline.memory_used_mb; baseline_free_mb=$gpuBaseline.memory_free_mb; offload_policy='Tiered partial GPU offload; context length 2048; lower offload retries on load failure.' }
    $prior = $null
    if (Test-Path -LiteralPath $ProofPath) {
        try { $prior = Get-Content -LiteralPath $ProofPath -Raw | ConvertFrom-Json } catch {}
    }
    if ($prior -and $prior.status -eq 'PASS' -and $prior.readiness -eq 'THREE_DISTINCT_ROLES_INFERENCE_AND_LOADED_STATE_VERIFIED' -and $prior.verified_at_utc) {
        $ageMinutes = ([DateTime]::UtcNow - [DateTime]::Parse([string]$prior.verified_at_utc).ToUniversalTime()).TotalMinutes
        if ($ageMinutes -ge 0 -and $ageMinutes -le $CacheMinutes -and @($prior.roles).Count -eq 3) {
            $snapshot = Get-LoadedSnapshot
            $apiIds = Get-ApiModelIds
            $allLoaded = $true
            foreach ($oldRole in @($prior.roles)) {
                if ($snapshot -notmatch [regex]::Escape([string]$oldRole.api_identifier) -or $apiIds -notcontains [string]$oldRole.api_identifier) { $allLoaded=$false }
            }
            if ($allLoaded -and $gpuBaseline.memory_total_mb -gt 0 -and $gpuBaseline.memory_used_mb -gt 0) {
                $prior.heartbeat_at_utc = [DateTime]::UtcNow.ToString('o')
                $prior.verification_reused = $true
                $prior.current_loaded_model_snapshot = $snapshot
                $prior.current_api_model_ids = $apiIds
                $prior.current_gpu = $gpuBaseline
                $prior.cache_age_minutes = [math]::Round($ageMinutes,2)
                Write-JsonAtomic -Path $ProofPath -Value $prior
                $proof = $prior
                Write-Log ("HEARTBEAT_CACHE_PASS age_minutes=" + $proof.cache_age_minutes + " resident_roles=3 GPU=" + $gpuBaseline.name + " used_mb=" + $gpuBaseline.memory_used_mb)
            }
        }
    }
    if (-not $proof.verification_reused) {
        $keys = Get-ModelKeys
        $downloadEstimates = @{ lightweight=2.5; heavyweight=9.5; visual=3.5 }
        $selected = @{}
        $selectedKeys = [System.Collections.Generic.List[string]]::new()
        foreach ($role in @('lightweight','heavyweight','visual')) {
            $excludeNow = @($selectedKeys)
            $key = Find-RoleModel -Role $role -Keys $keys -Exclude $excludeNow
            if (-not $key) {
                $requiredGb = 0.0
                foreach ($futureRole in @('lightweight','heavyweight','visual')) {
                    if ($selected.ContainsKey($futureRole)) { continue }
                    $futureKey = Find-RoleModel -Role $futureRole -Keys $keys -Exclude @($selectedKeys)
                    if (-not $futureKey) { $requiredGb += [double]$downloadEstimates[$futureRole] }
                }
                $drives = @(Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Free -gt 0 } | Sort-Object Free -Descending)
                $maxFreeGb = if ($drives.Count -gt 0) { [math]::Round($drives[0].Free / 1GB,1) } else { 0 }
                if ($maxFreeGb -lt ($requiredGb + 4.0)) {
                    throw "Not enough detected local disk headroom for missing model downloads. Best visible drive free=$maxFreeGb GB; estimated remaining model need=$requiredGb GB plus 4 GB reserve. Change the LM Studio model storage location or free disk space first."
                }
                $key = Ensure-RoleModel -Role $role -Keys $keys -Exclude $excludeNow
                $keys = Get-ModelKeys
            }
            if ($key -in @($selectedKeys)) { throw "Model selection collision: $role would reuse already selected model '$key'." }
            $selected[$role] = $key
            $selectedKeys.Add([string]$key)
            Write-Log "ROLE_SELECTED role=$role model_key=$key"
        }
        if (@($selectedKeys | Select-Object -Unique).Count -ne 3) { throw 'Role model identity check failed: three distinct model keys are required.' }
        $loaded = [System.Collections.Generic.List[object]]::new()
        foreach ($role in @('lightweight','heavyweight','visual')) {
            $identifier = switch ($role) { 'lightweight' { 'scout' } 'heavyweight' { 'critic' } default { 'vision' } }
            $loadProof = Load-RoleModel -Role $role -ModelKey ([string]$selected[$role]) -Identifier $identifier -TotalGpuMb $gpuBaseline.memory_total_mb
            $loaded.Add($loadProof)
        }
        $apiIds = Get-ApiModelIds
        foreach ($entry in $loaded) {
            if ($apiIds -notcontains [string]$entry.identifier) {
                throw "Role alias '$($entry.identifier)' is not exposed by the local /v1/models API. Visible IDs: $($apiIds -join ', ')"
            }
        }
        $bluePng = 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAYElEQVR4nO3PQQ0AIBDAsAP/nkEEj4ZkVbCtmTM/2zrgVQNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgPaBVCHAX/y3CvgAAAAAElFTkSuQmCC'
        $roleProofs = [System.Collections.Generic.List[object]]::new()
        foreach ($role in @('lightweight','heavyweight','visual')) {
            $identifier = switch ($role) { 'lightweight' { 'scout' } 'heavyweight' { 'critic' } default { 'vision' } }
            $key = [string]$selected[$role]
            $roleProofs.Add((Invoke-InferenceProbe -Role $role -Identifier $identifier -ModelKey $key -Vision ($role -eq 'visual') -ImageBase64 $bluePng))
        }
        $snapshot = Get-LoadedSnapshot
        $notLoaded = @($roleProofs | Where-Object { $snapshot -notmatch [regex]::Escape([string]$_.api_identifier) })
        if ($notLoaded.Count -gt 0) { throw ("Final lms ps snapshot did not show all three models resident: " + (($notLoaded | ForEach-Object { $_.role + '=' + $_.api_identifier }) -join ', ')) }
        $gpuFinal = Get-GpuStats
        $gpuDelta = $gpuFinal.memory_used_mb - $gpuBaseline.memory_used_mb
        $activeRoleCount = @($roleProofs | Where-Object { $_.gpu_activity_sampled }).Count
        if ($gpuFinal.memory_total_mb -le 0 -or $gpuDelta -lt 256 -or $activeRoleCount -lt 1) {
            throw "GPU assist proof incomplete: GPU memory delta=$gpuDelta MB, inference roles with utilization observed=$activeRoleCount/3. GPU offload was requested, but current telemetry did not prove it was helping. Check NVIDIA drivers and LM Studio GPU backend."
        }
        $proof = [ordered]@{
            schema='BEC-LMSTUDIO-THREE-ROLE-READINESS/v2'
            status='PASS'
            readiness='THREE_DISTINCT_ROLES_INFERENCE_AND_LOADED_STATE_VERIFIED'
            verified_at_utc=[DateTime]::UtcNow.ToString('o')
            heartbeat_at_utc=[DateTime]::UtcNow.ToString('o')
            server=$base
            required_roles=@('lightweight','heavyweight','visual')
            roles=@($roleProofs)
            distinct_model_keys=@($selectedKeys)
            loaded_model_snapshot=$snapshot
            api_model_ids=$apiIds
            gpu=[ordered]@{ name=$gpuFinal.name; total_memory_mb=$gpuFinal.memory_total_mb; baseline_used_mb=$gpuBaseline.memory_used_mb; final_used_mb=$gpuFinal.memory_used_mb; used_memory_delta_mb=$gpuDelta; active_role_utilization_samples=$activeRoleCount; status='PASS_GPU_MEMORY_AND_INFERENCE_ACTIVITY_OBSERVED' }
            verification_reused=$false
            safety='Local-only inference probes. No external API, payment, deployment, database write, or public message was triggered.'
        }
        Write-Log ("THREE_ROLE_READY PASS distinct=3 gpu_delta_mb=$gpuDelta active_roles=$activeRoleCount")
    }
} catch {
    $proof.status='FAIL'
    $proof.readiness='NOT_READY'
    $proof.verified_at_utc=[DateTime]::UtcNow.ToString('o')
    $proof.heartbeat_at_utc=[DateTime]::UtcNow.ToString('o')
    $proof.error=$_.Exception.Message
    Write-Log ("THREE_ROLE_READY FAIL error=" + $_.Exception.Message)
}
Write-JsonAtomic -Path $ProofPath -Value $proof
$proof | ConvertTo-Json -Depth 16 | Write-Output
if ($proof.status -ne 'PASS' -or $proof.readiness -ne 'THREE_DISTINCT_ROLES_INFERENCE_AND_LOADED_STATE_VERIFIED') { exit 2 }
exit 0
