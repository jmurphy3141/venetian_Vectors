from __future__ import annotations

from fastapi import APIRouter, Request

from server.fitvector_prompt import (
    build_recommendation_prompt,
    parse_recommendation_json,
    validate_recommendations,
)
from server.models import RecommendationRequest, RecommendationResponse
from server.outfit_candidates import deterministic_recommendations, generate_candidates

router = APIRouter()


@router.post("/api/recommendations", response_model=RecommendationResponse)
async def recommend(req: RecommendationRequest, request: Request) -> RecommendationResponse:
    candidates = generate_candidates(req)
    if not candidates:
        return RecommendationResponse(mode="deterministic-fallback", recommendations=[])

    cfg = request.app.state.config
    inference_cfg = cfg.get("inference", {}) or {}
    enabled = bool(inference_cfg.get("enabled", False))
    compartment_id = str(cfg.get("compartment_id", "")).strip()
    model_id = str(inference_cfg.get("model_id", "")).strip()
    endpoint = str(inference_cfg.get("service_endpoint", "")).strip()

    if not (enabled and _configured(compartment_id) and _configured(model_id) and endpoint):
        return RecommendationResponse(
            mode="deterministic-fallback",
            recommendations=deterministic_recommendations(req),
            error="OCI GenAI is not fully configured.",
        )

    try:
        prompt = build_recommendation_prompt(req, candidates)
        raw_text = request.app.state.run_inference(
            prompt,
            endpoint=endpoint,
            model_id=model_id,
            compartment_id=compartment_id,
            max_tokens=int(inference_cfg.get("max_tokens", 1800)),
            temperature=float(inference_cfg.get("temperature", 0.2)),
            top_p=float(inference_cfg.get("top_p", 0.9)),
            top_k=int(inference_cfg.get("top_k", 0)),
            system_message=str(inference_cfg.get("system_message", "")),
        )
        parsed = parse_recommendation_json(raw_text)
        valid = validate_recommendations(
            parsed,
            candidate_item_sets={frozenset(item["id"] for item in candidate["items"]) for candidate in candidates},
            wardrobe_ids={item.id for item in req.wardrobe},
            pinned_item_id=req.pinnedItemId,
        )
        if len(valid) < 3:
            raise ValueError("OCI GenAI returned fewer than 3 valid recommendations")
        return RecommendationResponse(mode="oci-genai", recommendations=valid[:3])
    except Exception as exc:
        request.app.state.logger.warning("Recommendation fallback: %s", exc)
        return RecommendationResponse(
            mode="deterministic-fallback",
            recommendations=deterministic_recommendations(req),
            error=str(exc),
        )


def _configured(value: str) -> bool:
    return bool(value) and "replace-with" not in value
