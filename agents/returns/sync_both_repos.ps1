param(
    [string]$CommitMessage = "Update Returns Manager agent code and sync to repositories"
)

$rtnDir = "C:\Users\91996\Downloads\RTN"
$podDir = "C:\Users\91996\.gemini\antigravity\brain\a3f42cbb-02e7-4969-9335-a3de921d7821\scratch\pod_repo"
$targetReturnsDir = Join-Path $podDir "agents\returns"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " 1. Committing and Pushing to YOUR Repository... " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

Set-Location $rtnDir
git add -A
$rtnStatus = git status --porcelain
if ($rtnStatus) {
    git commit -m $CommitMessage
    git push origin main
    Write-Host "Successfully updated: 2420030580-HEMA repo" -ForegroundColor Green
} else {
    Write-Host "No pending changes in your repository." -ForegroundColor Yellow
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " 2. Syncing files to YOGESH's Pod Repository... " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

robocopy $rtnDir $targetReturnsDir /E /XD node_modules venv .git __pycache__ storage RTN dist /XF *.pyc .env | Out-Null

Set-Location $podDir
git pull origin main --rebase | Out-Null
git add agents/returns
$podStatus = git status --porcelain agents/returns
if ($podStatus) {
    git commit -m $CommitMessage
    git push origin main
    Write-Host "Successfully updated: Yogesh-101/cube-round3-pod (agents/returns)" -ForegroundColor Green
} else {
    Write-Host "Yogesh's repository is already up to date." -ForegroundColor Yellow
}

Set-Location $rtnDir
Write-Host "==========================================================" -ForegroundColor Green
Write-Host " ALL REPOSITORIES IN SYNC! " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
