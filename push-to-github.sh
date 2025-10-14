#!/usr/bin/env bash
set -e

GITHUB_USER="${1:-patilshraddha0304}"
REPO="${2:-NOVORA1}"

echo "Preparing to push project to GitHub as ${GITHUB_USER}/${REPO}"

read -p "Proceed? (y/N) " yn
if [[ "${yn,,}" != "y" ]]; then
  echo "Aborted."
  exit 1
fi

if [ ! -d .git ]; then
  git init
  echo "Initialized git repository."
fi

# ensure .gitignore exists
if [ ! -f .gitignore ]; then
  cat > .gitignore <<'EOF'
node_modules/
.env
.env.*.local
.DS_Store
EOF
  git add .gitignore
  git commit -m "Add minimal .gitignore" || true
fi

# remove sensitive files from index
git rm --cached -r .env || true
git rm -r --cached node_modules || true

git add -A
git commit -m "Prepare repo: remove secrets and node_modules from index" || true

if command -v gh >/dev/null 2>&1; then
  echo "Creating repo with gh..."
  gh repo create "${GITHUB_USER}/${REPO}" --public --source=. --remote=origin --push --confirm
else
  echo "gh CLI not found. Please create repo manually on GitHub and provide remote URL."
  read -p "Remote URL: " remote
  git remote add origin "$remote"
  git branch -M main
  git push -u origin main
fi

echo "Done. Verify https://github.com/${GITHUB_USER}/${REPO}"
