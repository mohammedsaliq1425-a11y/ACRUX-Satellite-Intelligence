# Terminal 1:  .\scripts\start-backend.ps1   (API on http://127.0.0.1:8000, docs at /docs)
$root = Split-Path -Parent $PSScriptRoot
Push-Location "$root\backend"
& .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
Pop-Location
