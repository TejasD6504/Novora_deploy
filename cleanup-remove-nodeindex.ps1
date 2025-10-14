Write-Host "Cleanup: remove node_modules from git index, commit and push" -ForegroundColor Cyan
if (-not (Test-Path .git)) { git init | Out-Null }

# ensure .gitignore updated
git add .gitignore
git commit -m "Ensure .gitignore" 2>$null

# remove node_modules from index (keeps files locally)
git rm -r --cached node_modules 2>$null || Write-Host "node_modules not tracked or already removed"
git rm --cached -r public/video public/media 2>$null

git add -A
git commit -m "Remove node_modules and large public media from repository index" || Write-Host "Nothing to commit"

# push (make sure remote exists)
git remote -v | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "No remote found. Add remote and push manually:" -ForegroundColor Yellow
  Write-Host "  git remote add origin https://github.com/<youruser>/<repo>.git"
  Write-Host "  git branch -M main"
  Write-Host "  git push -u origin main"
} else {
  git branch -M main
  git push -u origin main
  Write-Host "Pushed. If node_modules was already pushed previously and you need to remove it from history, use the BFG or git-filter-repo tool (see script comments)." -ForegroundColor Green
}

# If you previously pushed node_modules and want to purge it from history:
# 1) Install BFG: https://rtyley.github.io/bfg-repo-cleaner/
# 2) Run:
#    git clone --mirror https://github.com/youruser/yourrepo.git repo-mirror.git
#    bfg --delete-folders node_modules repo-mirror.git
#    cd repo-mirror.git
#    git reflog expire --expire=now --all && git gc --prune=now --aggressive
#    git push
