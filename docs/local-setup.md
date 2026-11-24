# Local setup (Windows PowerShell)

See the README for the full walkthrough. Quick reference:

```powershell
cd project-acrux\backend
python -m venv .venv ; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item ..\.env.example ..\.env        # optional keys
uvicorn app.main:app --reload --port 8000
pytest                                    # in a second terminal, same venv
```

Troubleshooting
* **Activation blocked:** `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`.
* **Port 8000 in use:** pick another (`--port 8001`) and update the frontend base URL later.
* **A source shows `not_configured`:** add its key to `.env` and restart uvicorn (settings load at startup).
* **`auth_failed`:** the key was rejected; re-check it. **`rate_limited`:** wait; NASA's `DEMO_KEY` is very limited.
* **`unavailable`/`timeout`:** the provider or your network; raise `HTTP_TIMEOUT_SECONDS` modestly or retry.

Frontend
```powershell
cd project-acrux\frontend ; npm install ; npm run dev     # http://localhost:5173
```
* **Top bar says "Backend offline":** start uvicorn on port 8000 first; the dev server proxies `/api` there.
* **Port 5173 in use:** `strictPort` is on, so Vite will refuse to start; close the other process.
* **`npm install` fails on lucide-react version:** the range is `>=0.400.0 <1.0.0`; if an icon name is missing, rename it to your installed version's name.
