$script:BANK_FILE = 'C:\BrownEyeCortex\data\word_bank_weights.json'
$script:DECAY_RATE = 0.05; $script:BOOST_RATE = 0.20; $script:FLOOR = 0.05; $script:CEILING = 3.00
$script:SeedBank = @{
    hook = @('Stop.','Real talk:','This fixed it.','Still losing?')
    pain = @('inconsistent','keeps dying','no clear plan','spending too much')
    desire = @('wins consistently','built for your meta','ready tonight','under budget')
    urgency = @('tonight','this weekend','right now','limited run')
    cta = @('Get it ','DM me ','Link below ','Grab it ')
    social_proof = @('100+ built','tested at tables','NZ players love it')
    price_anchor = @('Under NZD $10','Less than a booster pack','NZD $5')
    identity = @('Commander player','EDH grinder','budget builder')
    action = @('upgrade','fix','tune','optimise')
}
function Initialize-WordBank { if (!(Test-Path $script:BANK_FILE)) { $b = @{}; foreach ($cat in $script:SeedBank.Keys) { $b[$cat] = @{}; foreach ($w in $script:SeedBank[$cat]) { $b[$cat][$w] = 1.0 } }; $b | ConvertTo-Json -Depth 10 | Set-Content $script:BANK_FILE } }
function Get-WeightedWord { param($Category,$Count=1) Initialize-WordBank; $bank = Get-Content $script:BANK_FILE -Raw | ConvertFrom-Json; $words = @{}; $bank.$Category.PSObject.Properties | ForEach-Object { $words[$_.Name] = [double]$_.Value }; $total = ($words.Values | Measure-Object -Sum).Sum; if ($total -le 0) { return @($words.Keys | Get-Random -Count $Count) }; $res=@(); 1..$Count | ForEach-Object { $roll = (Get-Random -Minimum 0 -Maximum 10000)/10000*$total; $cum=0.0; $ch=$null; foreach ($w in ($words.Keys | Sort-Object { $words[$_] } -Descending)) { $cum+=$words[$w]; if ($cum -ge $roll) { $ch=$w; break } }; if (-not $ch) { $ch=($words.Keys | Select-Object -Last 1) }; $res+=$ch }; return $res }
Export-ModuleMember -Function Get-WeightedWord,Initialize-WordBank
