#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$SupabaseUrl=$env:SUPABASE_URL
$ServiceKey=$env:SUPABASE_SERVICE_ROLE_KEY
if([string]::IsNullOrWhiteSpace($SupabaseUrl)-or[string]::IsNullOrWhiteSpace($ServiceKey)){throw 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required'}
$H=@{'apikey'=$ServiceKey;'Authorization'="Bearer $ServiceKey"}
$rows=Invoke-RestMethod -Method Get -Uri "$SupabaseUrl/rest/v1/marketplace_fulfillments?select=fulfillment_id,order_id,status,evidence_ref,delivery_url,metadata&metadata->>sku=eq.COMMANDER-DECK-DIAGNOSTIC-001&order_id=not.is.null&order=created_at.desc" -Headers $H
$result=@()
foreach($f in @($rows)){
  $art=Invoke-RestMethod -Method Get -Uri "$SupabaseUrl/rest/v1/marketplace_fulfillment_artifacts?select=artifact_id,storage_bucket,storage_path,sha256,mime_type,byte_size,verifier_version,delivery_verified_at&fulfillment_id=eq.$($f.fulfillment_id)" -Headers $H
  $result += [pscustomobject]@{
    fulfillment_id=$f.fulfillment_id
    order_id=$f.order_id
    fulfillment_status=$f.status
    evidence_ref=$f.evidence_ref
    delivery_url=$f.delivery_url
    evidence_state=$f.metadata.evidence_state
    artifact=if($art.Count -gt 0){$art[0]}else{$null}
  }
}
$result | ConvertTo-Json -Depth 12
