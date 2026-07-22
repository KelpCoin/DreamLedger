Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
function UtcIso { (Get-Date).ToUniversalTime().ToString('o') }
function UtcStamp { (Get-Date).ToUniversalTime().ToString('yyyyMMdd_HHmmss') }
function Ensure-Dir { param([string]$Path) if ($Path -and !(Test-Path $Path)) { New-Item -ItemType Directory -Path $Path -Force | Out-Null } }
function Write-Ascii { param([string]$Path,[string]$Content) $d=Split-Path $Path; if($d){Ensure-Dir $d}; [IO.File]::WriteAllText($Path,$Content,[Text.Encoding]::ASCII) }
function Read-JsonFile { param([string]$Path) if(!(Test-Path $Path)){return $null}; $r=Get-Content $Path -Raw -UTF8; if(!$r){return $null}; return ($r|ConvertFrom-Json) }
function Write-JsonFile { param([string]$Path,$Obj) Write-Ascii $Path ($Obj|ConvertTo-Json -Depth 40) }
function Append-Jsonl { param([string]$Path,$Obj) $d=Split-Path $Path; if($d){Ensure-Dir $d}; Add-Content $Path ($Obj|ConvertTo-Json -Depth 40 -Compress) -UTF8 }
function Write-ModuleLog { param([string]$Module,[string]$Msg) $p="C:\BrownEyeCortexData\FoundationalEngines\logs\$Module.log"; $d=Split-Path $p; Ensure-Dir $d; Add-Content $p "$(UtcIso) $Msg" }
function Write-Heartbeat { param([string]$Module,[string]$Status,[string]$Detail) $p="C:\BrownEyeCortexData\FoundationalEngines\heartbeats\$Module.json"; Ensure-Dir (Split-Path $p); Write-JsonFile $p @{module=$Module;utc=UtcIso;status=$Status;detail=$Detail} }
function Get-RootMap { return @{install_root='C:\BrownEyeCortex';data_root='C:\BrownEyeCortexData';artifact_root='C:\BrownEyeCortex\_artifacts';module_data_root='C:\BrownEyeCortexData\FoundationalEngines'} }
function Send-DiscordWebhook { param([string]$Url,[string]$Content) if(!$Url){return}; $b=@{content=$Content}|ConvertTo-Json -Compress; Invoke-RestMethod $Url -Method Post -Body $b -ContentType 'application/json' -TimeoutSec 30|Out-Null }
function Get-SecretValue { param([string]$Name) return [Environment]::GetEnvironmentVariable($Name,'User') }
