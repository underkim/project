# pre-deploy-check.ps1 — 배포 전 로컬 검증 자동화 (Windows PowerShell 5.1+)
# Usage: powershell -File scripts/pre-deploy-check.ps1
#
# 백엔드 테스트 + alembic head + 프론트 타입체크/lint/build를 순서대로 실행하고
# 각 단계의 성공/실패를 요약한다. 환경변수 '값'은 절대 출력하지 않는다.
#
# 종료코드: 모든 단계 통과 시 0, 하나라도 실패 시 1.

$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
$results = @()

function Invoke-Step($name, $scriptblock) {
    Write-Host ""
    Write-Host "▶ $name" -ForegroundColor Cyan
    & $scriptblock
    $ok = $?
    if ($LASTEXITCODE -ne $null -and $LASTEXITCODE -ne 0) { $ok = $false }
    $script:results += [pscustomobject]@{ Step = $name; Ok = $ok }
    if ($ok) { Write-Host "  ✓ $name" -ForegroundColor Green }
    else { Write-Host "  ✗ $name" -ForegroundColor Red }
}

Push-Location $root
try {
    Invoke-Step "백엔드 테스트 (uv run pytest)" { uv run pytest -q }

    Invoke-Step "Alembic 단일 head 확인" {
        $heads = uv run alembic heads 2>$null
        $count = ($heads | Where-Object { $_ -match '\S' } | Measure-Object).Count
        if ($count -ne 1) {
            Write-Host "  다중/누락 head 감지 ($count). 머지가 필요할 수 있음." -ForegroundColor Yellow
            $global:LASTEXITCODE = 1
        } else {
            $global:LASTEXITCODE = 0
        }
    }

    Push-Location (Join-Path $root "frontend")
    try {
        Invoke-Step "프론트 타입체크 (tsc --noEmit)" { npx tsc --noEmit }
        Invoke-Step "프론트 lint (npm run lint)" { npm run lint }
        Invoke-Step "프론트 빌드 (npm run build)" { npm run build }
        Invoke-Step "E2E 스펙 파싱 (playwright --list)" { npx playwright test --list }
    } finally {
        Pop-Location
    }
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "==================== 요약 ====================" -ForegroundColor Cyan
$failed = 0
foreach ($r in $results) {
    $mark = if ($r.Ok) { "PASS" } else { "FAIL"; $failed++ }
    $color = if ($r.Ok) { "Green" } else { "Red" }
    Write-Host ("  [{0}] {1}" -f $mark, $r.Step) -ForegroundColor $color
}
Write-Host ""
if ($failed -eq 0) {
    Write-Host "모든 검증 통과 — 배포 준비 완료. 환경변수는 docs/pre-deploy-checklist.md 참고." -ForegroundColor Green
    exit 0
} else {
    Write-Host "$failed 개 단계 실패 — 배포 전 수정 필요." -ForegroundColor Red
    exit 1
}
