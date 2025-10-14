# 1) Optional: create repo on GitHub via gh CLI (install gh first), then push:
gh repo create patilshraddha0304/NOVORA1 --public --source=. --remote=origin --push

# If you prefer to create repo on github.com manually, run these after creating the repo:
git init
git add .
git commit -m "Initial commit"

# If you accidentally committed .env or node_modules, remove them from index first:
git rm --cached .env || true
git rm -r --cached node_modules || true
git commit -m "Remove secrets and node_modules from index" || true

# Add remote and push (replace URL if you created repo with a different name)
git remote add origin https://github.com/patilshraddha0304/NOVORA1.git
git branch -M main
git push -u origin main

# If you need to add a .env.example (recommended)
echo "PORT=3000" > .env.example
echo "DB_USER=postgres" >> .env.example
git add .env.example
git commit -m "Add .env.example"
git push
