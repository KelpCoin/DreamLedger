#requires -version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference="Stop"
$repo=(Resolve-Path $PSScriptRoot\..\..).Path
$public=Join-Path $repo "public"
$proof=Join-Path $repo "proof\figure-eight\seo-preflight.json"
New-Item -ItemType Directory -Force -Path (Split-Path $proof -Parent)|Out-Null

$checks=New-Object System.Collections.Generic.List[object]
function Add([string]$n,[string]$s,[string]$d){$checks.Add([pscustomobject]@{name=$n;status=$s;detail=$d})}

foreach($f in @("agent.json","agent-commerce.json",".well-known\dreamledger.json")){
  $p=Join-Path $public $f
  try{Get-Content $p -Raw|ConvertFrom-Json|Out-Null;Add "json:$f" "PASS" "valid JSON"}catch{Add "json:$f" "FAIL" $_.Exception.Message}
}

$llms=Join-Path $public "llms.txt"
Add "llms.txt" (if(Test-Path $llms){"PASS"}else{"FAIL"}) $llms

$sitemap=Join-Path $public "sitemap.xml"
if(Test-Path $sitemap){
  $xml=Get-Content $sitemap -Raw
  $urls=[regex]::Matches($xml,'<loc>([^<]+)</loc>')|ForEach-Object{$_.Groups[1].Value}
  foreach($u in $urls){
    $uri=[Uri]$u
    if($uri.Host -ne "dreamledger.org"){continue}
    $path=$uri.AbsolutePath
    if($path -eq "/"){$candidate=Join-Path $public "index.html"}
    elseif($path -match '\.html$'){$candidate=Join-Path $public $path.TrimStart('/')}
    elseif($path -match '/$'){$candidate=Join-Path $public ($path.TrimStart('/')+"index.html")}
    else{$candidate=Join-Path $public $path.TrimStart('/')}
    Add ("sitemap:"+$path) (if(Test-Path $candidate){"PASS"}else{"FAIL"}) (if(Test-Path $candidate){$candidate}else{"missing local artifact"})
  }
}else{Add "sitemap.xml" "FAIL" "missing"}

$pass=@($checks|Where-Object status -eq "PASS").Count
$fail=@($checks|Where-Object status -eq "FAIL").Count
[ordered]@{
  schema="dreamledger.figure_eight.seo_preflight.v1"
  generated_at_utc=(Get-Date).ToUniversalTime().ToString("o")
  mode="PREPUBLICATION"
  publication_performed=$false
  humans_and_machines_share_governed_evidence=$true
  checks=$checks
  pass=$pass
  fail=$fail
}|ConvertTo-Json -Depth 20|Set-Content $proof -Encoding ASCII
Write-Host ("SEO PREFLIGHT PASS={0} FAIL={1}" -f $pass,$fail)
Write-Host ("Proof: "+$proof)
if($fail -gt 0){exit 2}
