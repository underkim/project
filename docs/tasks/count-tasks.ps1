# count-tasks.ps1 — Reports task counts by status from docs/tasks/active/
# Usage: powershell -File docs/tasks/count-tasks.ps1
# Output: counts of unfinished (draft/approved/working) vs implemented vs blocked tasks.
# Agents: run this before creating new tasks to avoid duplicate work.

$activeDir = Join-Path $PSScriptRoot "active"
$unfinishedStatuses = @("draft", "approved", "working")
$counts = @{}

Get-ChildItem -Path $activeDir -Filter "*.md" | ForEach-Object {
    $match = Select-String -Path $_.FullName -Pattern "^status:\s*(\S+)" | Select-Object -First 1
    if ($match) {
        $status = $match.Matches[0].Groups[1].Value
        if (-not $counts.ContainsKey($status)) { $counts[$status] = 0 }
        $counts[$status]++
    }
}

function Get-Count($key) {
    if ($counts.ContainsKey($key)) { return $counts[$key] } else { return 0 }
}

$unfinished = 0
foreach ($s in $unfinishedStatuses) { $unfinished += Get-Count $s }
$implemented = Get-Count "implemented"
$blocked = Get-Count "blocked"
$total = 0
foreach ($v in $counts.Values) { $total += $v }

Write-Host ""
Write-Host "Task Status Summary (docs/tasks/active/)"
Write-Host "========================================="
Write-Host "  Unfinished (draft/approved/working): $unfinished"
foreach ($s in $unfinishedStatuses) {
    $c = Get-Count $s
    if ($c -gt 0) { Write-Host "    ${s}: $c" }
}
Write-Host "  Blocked: $blocked"
Write-Host "  Implemented (pending user review): $implemented"
Write-Host "  Total active files: $total"
Write-Host ""
if ($unfinished -eq 0) {
    Write-Host "No unfinished tasks — nothing to implement."
} else {
    Write-Host "$unfinished task(s) available for implementation."
}
Write-Host ""
