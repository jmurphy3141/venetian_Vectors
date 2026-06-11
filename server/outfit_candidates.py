from __future__ import annotations

import itertools
from datetime import datetime, timezone

from server.models import HistoryRecord, Recommendation, RecommendationRequest, WardrobeItem


FORMALITY_ORDER = {
    "casual": 1,
    "smart-casual": 2,
    "business-casual": 3,
    "business-formal": 4,
    "formal": 5,
}

WARMTH_ORDER = {
    "light": 1,
    "medium": 2,
    "warm": 3,
    "heavy": 4,
}

NEUTRALS = {"black", "white", "gray", "grey", "charcoal", "navy", "cream", "tan", "brown"}
ACCENTS = {"blue", "green", "burgundy", "red", "pink", "teal", "purple"}


def generate_candidates(req: RecommendationRequest, limit: int = 80) -> list[dict]:
    by_category = _group_by_category(req.wardrobe)
    tops = by_category.get("top", [])
    bottoms = by_category.get("bottom", [])
    shoes = by_category.get("shoe", [])
    layers = by_category.get("layer", [None])
    accessories = by_category.get("accessory", [None])

    candidates: list[dict] = []
    for combo in itertools.product(tops, bottoms, shoes, layers, accessories):
        items = [item for item in combo if item is not None]
        if req.pinnedItemId and req.pinnedItemId not in {item.id for item in items}:
            continue
        candidate = _score_candidate(req, items)
        candidates.append(candidate)

    if not candidates and req.pinnedItemId:
        pinned = next((item for item in req.wardrobe if item.id == req.pinnedItemId), None)
        if pinned:
            candidates = _build_pinned_fallbacks(req, pinned)

    candidates.sort(key=lambda item: item["score"], reverse=True)
    return candidates[:limit]


def deterministic_recommendations(req: RecommendationRequest, *, count: int = 3) -> list[Recommendation]:
    candidates = generate_candidates(req, limit=max(count, 12))
    recommendations: list[Recommendation] = []
    for index, candidate in enumerate(candidates[:count], start=1):
        item_ids = [item["id"] for item in candidate["items"]]
        recommendations.append(
            Recommendation(
                id=f"rec-{index}",
                score=max(0, min(100, int(candidate["score"]))),
                itemIds=item_ids,
                reasoning=candidate["reasoning"][:3],
                weatherFit=candidate["weatherFit"],
                formalityFit=candidate["formalityFit"],
                recencyNotes=candidate["recencyNotes"],
            )
        )
    return recommendations


def _group_by_category(items: list[WardrobeItem]) -> dict[str, list[WardrobeItem]]:
    grouped: dict[str, list[WardrobeItem]] = {}
    for item in items:
        grouped.setdefault(item.category, []).append(item)
    return grouped


def _build_pinned_fallbacks(req: RecommendationRequest, pinned: WardrobeItem) -> list[dict]:
    candidates = []
    by_category = _group_by_category([item for item in req.wardrobe if item.id != pinned.id])
    required = ["top", "bottom", "shoe"]
    picks = [pinned]
    for category in required:
        if pinned.category == category:
            continue
        choices = by_category.get(category, [])
        if choices:
            picks.append(choices[0])
    if len(picks) >= 2:
        candidates.append(_score_candidate(req, picks))
    return candidates


def _score_candidate(req: RecommendationRequest, items: list[WardrobeItem]) -> dict:
    score = 52
    reasoning: list[str] = []

    category_set = {item.category for item in items}
    completeness = {"top", "bottom", "shoe"}.issubset(category_set)
    if completeness:
        score += 16
        reasoning.append("Builds a complete outfit with top, bottom, and shoes.")
    if "layer" in category_set:
        score += 5
    if "accessory" in category_set:
        score += 4

    formality_score, formality_text = _score_formality(req, items)
    score += formality_score
    reasoning.append(formality_text)

    weather_score, weather_text = _score_weather(req, items)
    score += weather_score
    reasoning.append(weather_text)

    color_score, color_text = _score_color(items)
    score += color_score
    reasoning.append(color_text)

    if req.pinnedItemId and req.pinnedItemId in {item.id for item in items}:
        score += 10
        reasoning.append("Includes the must-wear item.")

    recency_penalty, recency_text = _recency_penalty(req.history, [item.id for item in items])
    score -= recency_penalty

    preference_score = _score_preferences(req, items)
    score += preference_score
    if preference_score > 0:
        reasoning.append("Aligns with the saved style profile.")

    return {
        "id": "-".join(item.id for item in items),
        "score": max(0, min(100, score)),
        "items": [item.model_dump() for item in items],
        "reasoning": reasoning,
        "weatherFit": weather_text,
        "formalityFit": formality_text,
        "recencyNotes": recency_text,
    }


def _score_formality(req: RecommendationRequest, items: list[WardrobeItem]) -> tuple[int, str]:
    target = FORMALITY_ORDER.get(req.event.formality, 3)
    item_scores = [FORMALITY_ORDER.get(item.formality, 3) for item in items]
    avg = sum(item_scores) / max(len(item_scores), 1)
    gap = abs(avg - target)
    if gap < 0.6:
        return 16, f"Strong {req.event.formality} match for {req.event.title}."
    if gap < 1.2:
        return 8, f"Close to the requested {req.event.formality} dress level."
    return -6, f"Formality is a stretch for {req.event.formality}."


def _score_weather(req: RecommendationRequest, items: list[WardrobeItem]) -> tuple[int, str]:
    apparent = req.weather.apparentTemperatureF
    warmth = sum(WARMTH_ORDER.get(item.warmth, 2) for item in items)
    if apparent < 45:
        target = 8
        label = "cold"
    elif apparent < 65:
        target = 7
        label = "cool"
    elif apparent > 82:
        target = 4
        label = "hot"
    else:
        target = 5
        label = "mild"

    rain_penalty = 0
    if req.weather.precipitationIn > 0.05:
        rain_penalty = -5
        if any("rain" in item.tags or "weatherproof" in item.tags for item in items):
            rain_penalty = 5

    gap = abs(warmth - target)
    base = 12 if gap <= 1 else 5 if gap <= 3 else -8
    score = base + rain_penalty
    if rain_penalty > 0:
        return score, f"Weather fit is strong for {label} conditions with precipitation coverage."
    if rain_penalty < 0:
        return score, f"Weather fit is fair for {label} conditions, but rain risk needs attention."
    return score, f"Weather fit is good for {label} conditions."


def _score_color(items: list[WardrobeItem]) -> tuple[int, str]:
    colors = [item.color.lower() for item in items if item.color]
    neutral_count = sum(1 for color in colors if color in NEUTRALS)
    accent_count = sum(1 for color in colors if color in ACCENTS)
    if neutral_count >= 3 and accent_count <= 1:
        return 9, "Balanced neutral palette with an easy professional read."
    if len(set(colors)) <= 3:
        return 7, "Color palette stays cohesive."
    return -3, "Color palette is more expressive and may need confidence."


def _score_preferences(req: RecommendationRequest, items: list[WardrobeItem]) -> int:
    profile_terms = {
        req.profile.style.lower(),
        req.profile.colorPreference.lower(),
        req.profile.preferredFormality.lower(),
    }
    tags = {tag.lower() for item in items for tag in item.tags}
    score = 0
    if any("classic" in tag for tag in tags) and "modern classic" in profile_terms:
        score += 4
    if req.profile.comfortPriority >= 4 and any("stretch" in tag or "comfortable" in tag for tag in tags):
        score += 4
    if req.profile.riskTolerance <= 2 and all(item.color.lower() in NEUTRALS for item in items):
        score += 3
    return score


def _recency_penalty(history: list[HistoryRecord], item_ids: list[str]) -> tuple[int, str]:
    target = set(item_ids)
    exact_repeat = None
    for record in history:
        if set(record.itemIds) == target:
            exact_repeat = record
            break
    if exact_repeat is None:
        return 0, "No exact outfit repeat found."

    days = _days_since(exact_repeat.wornAt)
    if days is None:
        return 12, "Exact outfit appears in history; ranked lower for freshness."
    if days <= 3:
        return 18, f"Exact outfit was worn {days} days ago, so it is penalized heavily."
    if days <= 10:
        return 10, f"Exact outfit was worn {days} days ago, so it is nudged down."
    return 4, f"Exact outfit has been worn before, but not recently."


def _days_since(value: str) -> int | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return max(0, (now - dt).days)
