# One-time setup (Windows PowerShell). Run from the project root:  .\scripts\setup.ps1
# If scripts are blocked:  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Push-Location "$root\backend"
python -m venv .venv
& .\.venv\Scripts\python.exe -m pip install --upgrade pip
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt
Pop-Location
Push-Location "$root\frontend"
npm install
Pop-Location
if (-not (Test-Path "$root\.env")) { Copy-Item "$root\.env.example" "$root\.env"; Write-Host "Created .env from .env.example (all keys optional)." }
Write-Host "Setup complete. Start the backend and frontend in two terminals (see scripts\start-*.ps1)."
