from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import yaml
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from server.models import HealthResponse
from server.oci_genai import run_inference
from server.routes.recommendations import router as recommendations_router

ROOT = Path(__file__).resolve().parents[1]
STATIC_DIR = ROOT / "outputs" / "fitvector"
CONFIG_PATH = ROOT / "config.yaml"


def load_config() -> dict[str, Any]:
    if not CONFIG_PATH.exists():
        return {}
    with CONFIG_PATH.open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle) or {}


def create_app() -> FastAPI:
    logging.basicConfig(level=logging.INFO)
    app = FastAPI(title="FitVector", version="0.1.0")
    app.state.config = load_config()
    app.state.run_inference = run_inference
    app.state.logger = logging.getLogger("fitvector")

    app.include_router(recommendations_router)

    if STATIC_DIR.exists():
        app.mount("/fitvector", StaticFiles(directory=STATIC_DIR, html=True), name="fitvector")

    @app.get("/api/health", response_model=HealthResponse)
    def api_health() -> HealthResponse:
        inference_cfg = app.state.config.get("inference", {}) if app.state.config else {}
        return HealthResponse(
            inference_enabled=bool(inference_cfg.get("enabled", False)),
            static_dir=str(STATIC_DIR),
            config_loaded=bool(app.state.config),
            details={
                "region": app.state.config.get("region", ""),
                "has_compartment_id": _configured(str(app.state.config.get("compartment_id", "")).strip()),
                "has_model_id": _configured(str(inference_cfg.get("model_id", "")).strip()),
            },
        )

    if STATIC_DIR.exists():
        app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="fitvector-root")
    else:
        @app.get("/")
        def index():
            return {"status": "ok", "message": "FitVector backend is running."}

    return app


app = create_app()


def _configured(value: str) -> bool:
    return bool(value) and "replace-with" not in value
