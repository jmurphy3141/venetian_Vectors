from __future__ import annotations

import os

import pytest
import yaml

from server.oci_genai import run_inference


@pytest.mark.skipif(
    os.environ.get("RUN_LIVE_OCI_GENAI_TESTS") != "1",
    reason="Set RUN_LIVE_OCI_GENAI_TESTS=1 to call OCI GenAI.",
)
def test_live_oci_genai_returns_text():
    with open("config.yaml", "r", encoding="utf-8") as handle:
        cfg = yaml.safe_load(handle) or {}
    inference = cfg.get("inference", {}) or {}
    assert cfg.get("compartment_id") and "replace-with" not in cfg.get("compartment_id", "")
    assert inference.get("model_id") and "replace-with" not in inference.get("model_id", "")
    assert inference.get("service_endpoint")

    text = run_inference(
        "Return this exact JSON: {\"status\":\"ok\"}",
        endpoint=inference["service_endpoint"],
        model_id=inference["model_id"],
        compartment_id=cfg["compartment_id"],
        max_tokens=128,
        temperature=0,
        top_p=float(inference.get("top_p", 0.9)),
        top_k=int(inference.get("top_k", 0)),
        system_message="Return only JSON.",
    )
    assert text.strip()
