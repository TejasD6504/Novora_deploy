#!/usr/bin/env bash
set -e
echo "Cleanup: remove node_modules from git index, commit and push"

[ -d .git ] || git init

git add .gitignore || true
git commit -m "Ensure .gitignore" || true

git rm -r --cached node_modules || true
git rm -r --cached public/video || true
git rm -r --cached public/media || true

git add -A
git commit -m "Remove node_modules and large public media from repository index" || true

# Push
if git remote | grep origin >/dev/null 2>&1; then
  git branch -M main
  git push -u origin main
  echo "Pushed. If node_modules was already pushed previously and you need to remove it from history, see BFG instructions in this file."
else
  echo "No remote configured. Run:"
  echo "  git remote add origin https://github.com/<youruser>/<repo>.git"
  echo "  git branch -M main"
  echo "  git push -u origin main"
fi

# To purge from history if already pushed:
# 1) Install BFG (https://rtyley.github.io/bfg-repo-cleaner/)
# 2) Run:
#    git clone --mirror https://github.com/youruser/yourrepo.git repo-mirror.git
#    bfg --delete-folders node_modules repo-mirror.git
#    cd repo-mirror.git
#    git reflog expire --expire=now --all && git gc --prune=now --aggressive
#    git push
