param($Packet)
$req = @("intent","offer","price","channel")
foreach ($r in $req) { if (-not $Packet.$r) { throw "Invalid DecisionPacket: missing $r" } }
if ([double]$Packet.price -le 0) { throw "Invalid price" }
return $true
