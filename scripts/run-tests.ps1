# Backend tests + frontend type-check:  .\scripts\run-tests.ps1
$root = Split-Path -Parent $PSScriptRoot
Push-Location "$root\backend"; & .\.venv\Scripts\python.exe -m pytest; Pop-Location
Push-Location "$root\frontend"; npm run typecheck; Pop-Location
