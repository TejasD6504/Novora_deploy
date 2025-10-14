# NOVORA1

Local project. To push to GitHub:

1. Ensure .env is not committed and .gitignore contains `.env` and `node_modules`.
2. (Windows) Run:
   - Open PowerShell in project root and run:
     .\push-to-github.ps1
3. (Unix) Run:
   - bash push-to-github.sh

Notes:
- Install GitHub CLI (gh) for automatic repo creation: https://cli.github.com/
- If you already pushed secrets, remove them from history (BFG or git-filter-repo).
- Add real secrets only to your environment or GitHub Secrets.
"# NOVORA1" 
