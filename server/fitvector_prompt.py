from __future__ import annotations

import json
import re

from server.models import Recommendation, RecommendationRequest


def build_recommendation_prompt(req: RecommendationRequest, candidates: list[dict]) -> str:
    payload = {
        "task": "Choose the best 3 outfits for the event.",
        "rules": [
            "Return only JSON.",
            "Use only item IDs present in the candidate outfits.",
            "Do not invent garments or candidate IDs.",
            "If a pinned item is supplied, every recommendation must include it.",
            "Score each recommendation from 0 to 100.",
            "Reasoning must mention event formality, weather, style preference, and recency.",
        ],
        "response_schema": {
            "recommendations": [
                {
                    "id": "string",
                    "score": 0,
                    "itemIds": ["string"],
                    "reasoning": ["string"],
                    "weatherFit": "string",
                    "formalityFit": "string",
                    "recencyNotes": "string",
                }
            ]
        },
        "context": {
            "event": req.event.model_dump(),
            "weather": req.weather.model_dump(),
            "profile": req.profile.model_dump(),
            "history": [record.model_dump() for record in req.history[-20:]],
            "pinnedItemId": req.pinnedItemId,
        },
        "candidates": [
            {
                "id": candidate["id"],
                "score": candidate["score"],
                "itemIds": [item["id"] for item in candidate["items"]],
                "items": [
                    {
                        "id": item["id"],
                        "name": item["name"],
                        "category": item["category"],
                        "color": item["color"],
                        "formality": item["formality"],
                        "warmth": item["warmth"],
                        "tags": item["tags"],
                    }
                    for item in candidate["items"]
                ],
                "deterministicReasoning": candidate["reasoning"],
                "weatherFit": candidate["weatherFit"],
                "formalityFit": candidate["formalityFit"],
                "recencyNotes": candidate["recencyNotes"],
            }
            for candidate in candidates[:20]
        ],
    }
    return json.dumps(payload, indent=2)


def parse_recommendation_json(text: str) -> list[Recommendation]:
    cleaned = _strip_json_fences(text)
    raw = json.loads(cleaned)
    if isinstance(raw, list):
        raw = {"recommendations": raw}
    recommendations = raw.get("recommendations", [])
    if not isinstance(recommendations, list):
        raise ValueError("Model output missing recommendations list")
    return [Recommendation.model_validate(item) for item in recommendations[:3]]


def validate_recommendations(
    recommendations: list[Recommendation],
    *,
    candidate_item_sets: set[frozenset[str]],
    wardrobe_ids: set[str],
    pinned_item_id: str | None,
) -> list[Recommendation]:
    valid: list[Recommendation] = []
    for recommendation in recommendations:
        if not recommendation.itemIds:
            continue
        item_set = set(recommendation.itemIds)
        if not item_set.issubset(wardrobe_ids):
            continue
        if frozenset(item_set) not in candidate_item_sets:
            continue
        if pinned_item_id and pinned_item_id not in item_set:
            continue
        valid.append(recommendation)
    return valid[:3]


def _strip_json_fences(text: str) -> str:
    raw = (text or "").strip()
    match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", raw, flags=re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw)
    return raw.strip()
