# Terminal 2:  .\scripts\start-frontend.ps1   (open http://localhost:5173)
$root = Split-Path -Parent $PSScriptRoot
Push-Location "$root\frontend"
npm run dev
Pop-Location
