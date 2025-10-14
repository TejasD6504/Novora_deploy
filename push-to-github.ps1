Param(
  [string]$GitHubUser = "patilshraddha0304",
  [string]$RepoName = "NOVORA1",
  [switch]$Force
)

Write-Host "Preparing to push project to GitHub as $GitHubUser/$RepoName" -ForegroundColor Cyan

# Confirm
if (-not $Force) {
  $ok = Read-Host "Proceed? (y/N)"
  if ($ok.ToLower() -ne 'y') { Write-Host "Aborted."; exit 1 }
}

# Ensure git is initialized
if (-not (Test-Path .git)) {
  git init
  Write-Host "Initialized git repository."
}

# Ensure .gitignore exists
if (-not (Test-Path .gitignore)) {
  Write-Host "No .gitignore found — creating a minimal one."
  @"
node_modules/
.env
.env.*.local
.DS_Store
"@ | Out-File -Encoding utf8 .gitignore
  git add .gitignore
  git commit -m "Add minimal .gitignore" 2>$null
}

# Remove sensitive files from index (if previously added)
git rm --cached -r .env 2>$null
git rm --cached -r node_modules 2>$null
git rm --cached -r public/video 2>$null
# safe commit to remove from index (if changes)
git add -A
git commit -m "Prepare repo: remove secrets and node_modules from index" 2>$null

# Create remote repo using gh if available
$ghExists = (Get-Command gh -ErrorAction SilentlyContinue) -ne $null
if ($ghExists) {
  Write-Host "Creating GitHub repo via gh..." -ForegroundColor Green
  gh repo create "$GitHubUser/$RepoName" --public --source=. --remote=origin --push --confirm
} else {
  Write-Host "gh CLI not found. Please create a repository on GitHub named $RepoName and paste the remote URL."
  $remoteUrl = Read-Host "Enter remote URL (e.g. https://github.com/$GitHubUser/$RepoName.git)"
  if ($remoteUrl) {
    git remote add origin $remoteUrl 2>$null
    git branch -M main
    git push -u origin main
  } else {
    Write-Host "No remote provided. Aborting." -ForegroundColor Red
    exit 1
  }
}

Write-Host "Done. Repository pushed. Please verify on https://github.com/$GitHubUser/$RepoName" -ForegroundColor Green
