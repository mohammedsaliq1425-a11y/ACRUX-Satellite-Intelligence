"""Project Acrux backend entry point.

Run (from the backend directory):  uvicorn app.main:app --reload --port 8000
"""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api.routes import router
from .core.config import get_settings
from .core.errors import InputError, SourceError

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
# httpx logs full request URLs at INFO, and the FIRMS MAP_KEY lives in the URL path.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

settings = get_settings()
app = FastAPI(title="Project Acrux API", version="0.1.0",
              description="Local backend for Project Acrux. Observe Earth. Understand Space. Predict the Future.")

app.add_middleware(CORSMiddleware, allow_origins=list(settings.frontend_origins),
                   allow_methods=["GET", "POST"], allow_headers=["Content-Type"],
                   allow_credentials=False)


@app.exception_handler(SourceError)
async def _source_error(_: Request, exc: SourceError):
    return JSONResponse(status_code=exc.http_status, content=exc.to_dict())


@app.exception_handler(InputError)
async def _input_error(_: Request, exc: InputError):
    return JSONResponse(status_code=422, content={"error": {"kind": "bad_request", "message": str(exc), "source": None}})


@app.exception_handler(ValueError)
async def _value_error(_: Request, exc: ValueError):
    # Calculator/simulation validation messages are written to be user-safe.
    return JSONResponse(status_code=422, content={"error": {"kind": "bad_request", "message": str(exc), "source": None}})


@app.exception_handler(Exception)
async def _unhandled(_: Request, exc: Exception):
    logging.getLogger("acrux").exception("Unhandled error")   # stack trace stays in the local log
    return JSONResponse(status_code=500, content={"error": {"kind": "internal", "message": "Unexpected server error. Check the backend terminal.", "source": None}})


app.include_router(router)
