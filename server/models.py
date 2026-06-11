from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class WardrobeItem(BaseModel):
    id: str
    name: str
    category: str
    color: str = "neutral"
    formality: str = "smart-casual"
    warmth: str = "medium"
    season: str = "all"
    tags: list[str] = Field(default_factory=list)
    lastWorn: str = ""
    swatch: str = "#9ca3af"
    imageUrl: str = ""
    link: str = ""


class EventContext(BaseModel):
    id: str = "event-custom"
    title: str = "Event"
    startsAt: str = ""
    city: str = "chicago"
    type: str = "work"
    formality: str = "smart-casual"
    setting: str = "indoor"
    notes: str = ""


class WeatherContext(BaseModel):
    city: str = "Chicago"
    source: str = "fallback"
    isFallback: bool = True
    temperatureF: float = 72
    apparentTemperatureF: float = 72
    precipitationIn: float = 0
    weatherCode: int = 1
    windSpeedMph: float = 7
    summary: str = "Mild"


class Profile(BaseModel):
    style: str = "modern classic"
    colorPreference: str = "balanced neutrals"
    comfortPriority: int = 3
    riskTolerance: int = 2
    avoidRepeatsDays: int = 10
    preferredFormality: str = "polished"


class HistoryRecord(BaseModel):
    wornAt: str = ""
    eventId: str = ""
    itemIds: list[str] = Field(default_factory=list)
    recommendationId: str = ""


class RecommendationRequest(BaseModel):
    event: EventContext
    weather: WeatherContext
    profile: Profile = Field(default_factory=Profile)
    wardrobe: list[WardrobeItem]
    history: list[HistoryRecord] = Field(default_factory=list)
    pinnedItemId: str | None = None


class Recommendation(BaseModel):
    id: str
    score: int = Field(ge=0, le=100)
    itemIds: list[str]
    reasoning: list[str]
    weatherFit: str
    formalityFit: str
    recencyNotes: str


class RecommendationResponse(BaseModel):
    status: Literal["ok"] = "ok"
    mode: Literal["oci-genai", "deterministic-fallback"]
    recommendations: list[Recommendation]
    error: str | None = None


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    app: Literal["fitvector"] = "fitvector"
    inference_enabled: bool
    static_dir: str
    config_loaded: bool
    details: dict[str, Any] = Field(default_factory=dict)
