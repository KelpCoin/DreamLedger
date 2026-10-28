[CmdletBinding()]
param([string]$OutputPath='DOOH/GATE1B/cli-contract-proof.json')
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'Invoke-CheckedSandboxCli.ps1')
$script:FakeOutput=''
$script:FakeExit=0
function Invoke-FakeCli { $global:LASTEXITCODE=$script:FakeExit; $script:FakeOutput }
$cases=@(
    @{name='nonzero exit';code=1;body='{"status":"ready"}';accept=$false},
    @{name='invalid JSON';code=0;body='a secret or CLI diagnostic';accept=$false},
    @{name='explicit failure';code=0;body='{"success":false}';accept=$false},
    @{name='error response';code=0;body='{"error":"rejected"}';accept=$false},
    @{name='empty response';code=0;body='{}';accept=$false},
    @{name='valid response remains unverified';code=0;body='{"sandbox_id":"fixture-only"}';accept=$true}
)
$results=@()
foreach($case in $cases) {
    $script:FakeExit=$case.code; $script:FakeOutput=$case.body; $accepted=$false
    try { $value=Invoke-CheckedSandboxCli -Command Invoke-FakeCli -Action create; $accepted=$true } catch {
        if ($_.Exception.Message -notmatch '^SANDBOX_CLI_') { throw }
    }
    if ($accepted -ne $case.accept) { throw ('Unexpected acceptance: '+$case.name) }
    if ($accepted -and $value.provisioning_verified -ne $false) { throw 'CLI success must not assert provisioning.' }
    $results+=@{name=$case.name;passed=$true}
}
$parent=Split-Path -Parent $OutputPath
if($parent){New-Item -ItemType Directory -Force -Path $parent | Out-Null}
@{status='PASS';tests=$results;live_provider_called=$false;revenue_verified=$false} | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 -Path $OutputPath
Write-Output 'PASS: six offline CLI contract cases; no provider calls.'
