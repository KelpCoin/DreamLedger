Import-Module (Join-Path $PSScriptRoot "Jsonl.psm1") -Force
$EVIDENCE_LEDGER = "C:\BrownEyeCortex\ledger\evidence_ledger.jsonl"
function Invoke-FadeOnDecision {
    param([hashtable]$DecisionContext)
    Append-Jsonl $EVIDENCE_LEDGER @{
        event_id   = [guid]::NewGuid().ToString()
        event_type = "decision"
        timestamp  = [DateTimeOffset]::UtcNow.ToString("o")
        evidence   = $DecisionContext
    }
}
function Record-FadeOutcome {
    param([string]$DecisionId, [hashtable]$Outcome)
    Append-Jsonl $EVIDENCE_LEDGER @{
        event_id   = [guid]::NewGuid().ToString()
        event_type = "outcome"
        timestamp  = [DateTimeOffset]::UtcNow.ToString("o")
        evidence   = @{ decision_id = $DecisionId; actual_outcome = $Outcome }
    }
}
Export-ModuleMember -Function Invoke-FadeOnDecision, Record-FadeOutcome