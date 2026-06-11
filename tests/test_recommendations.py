from __future__ import annotations

import json
from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from server.app import app


@pytest.fixture(autouse=True)
def restore_app_state():
    original_config = deepcopy(app.state.config)
    original_runner = app.state.run_inference
    yield
    app.state.config = original_config
    app.state.run_inference = original_runner


def test_recommendations_parse_valid_model_json():
    payload = _payload()
    item_sets = _candidate_item_sets(payload)
    _enable_mock_inference_config()

    def fake_runner(*args, **kwargs):
        recs = []
        for index, item_ids in enumerate(item_sets[:3], start=1):
            recs.append(
                {
                    "id": f"oci-rec-{index}",
                    "score": 94 - index,
                    "itemIds": item_ids,
                    "reasoning": ["Strong event match", "Weather fit is balanced"],
                    "weatherFit": "Good for mild conditions.",
                    "formalityFit": "Strong business-formal match.",
                    "recencyNotes": "No exact outfit repeat found.",
                }
            )
        return json.dumps({"recommendations": recs})

    app.state.run_inference = fake_runner
    client = TestClient(app)
    response = client.post("/api/recommendations", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "oci-genai"
    assert len(body["recommendations"]) == 3


def test_invalid_model_json_falls_back():
    _enable_mock_inference_config()
    app.state.run_inference = lambda *args, **kwargs: "not json"
    client = TestClient(app)
    response = client.post("/api/recommendations", json=_payload())

    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "deterministic-fallback"
    assert len(body["recommendations"]) == 3


def test_pinned_item_is_enforced_in_fallback():
    payload = _payload()
    payload["pinnedItemId"] = "item-navy-blazer"
    app.state.config["inference"]["enabled"] = False

    client = TestClient(app)
    response = client.post("/api/recommendations", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "deterministic-fallback"
    assert body["recommendations"]
    for rec in body["recommendations"]:
        assert "item-navy-blazer" in rec["itemIds"]


def test_model_cannot_invent_item_ids():
    _enable_mock_inference_config()

    def fake_runner(*args, **kwargs):
        return json.dumps(
            {
                "recommendations": [
                    {
                        "id": "bad-rec",
                        "score": 99,
                        "itemIds": ["item-imaginary-jacket"],
                        "reasoning": ["Invented item"],
                        "weatherFit": "Unknown",
                        "formalityFit": "Unknown",
                        "recencyNotes": "Unknown",
                    }
                ]
            }
        )

    app.state.run_inference = fake_runner
    client = TestClient(app)
    response = client.post("/api/recommendations", json=_payload())

    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "deterministic-fallback"
    all_ids = {item["id"] for item in _payload()["wardrobe"]}
    for rec in body["recommendations"]:
        assert set(rec["itemIds"]).issubset(all_ids)


def _payload() -> dict:
    return {
        "event": {
            "id": "event-client-review",
            "title": "Client Review",
            "startsAt": "2026-06-11T13:30:00-05:00",
            "city": "chicago",
            "type": "client-meeting",
            "formality": "business-formal",
            "setting": "indoor",
            "notes": "Polished and camera-ready.",
        },
        "weather": {
            "city": "Chicago",
            "source": "test",
            "isFallback": True,
            "temperatureF": 78,
            "apparentTemperatureF": 80,
            "precipitationIn": 0,
            "weatherCode": 1,
            "windSpeedMph": 9,
            "summary": "Mild and mostly clear",
        },
        "profile": {
            "style": "modern classic",
            "colorPreference": "balanced neutrals",
            "comfortPriority": 3,
            "riskTolerance": 2,
            "avoidRepeatsDays": 10,
            "preferredFormality": "polished",
        },
        "wardrobe": [
            _item("item-white-oxford", "White Oxford", "top", "white", "business-formal"),
            _item("item-blue-poplin", "Blue Poplin", "top", "blue", "business-formal"),
            _item("item-charcoal-trouser", "Charcoal Trousers", "bottom", "charcoal", "business-formal"),
            _item("item-navy-trouser", "Navy Trousers", "bottom", "navy", "business-casual"),
            _item("item-black-oxfords", "Black Oxfords", "shoe", "black", "business-formal"),
            _item("item-brown-loafers", "Brown Loafers", "shoe", "brown", "business-casual"),
            _item("item-navy-blazer", "Navy Blazer", "layer", "navy", "business-formal", "warm"),
            _item("item-silver-watch", "Silver Watch", "accessory", "gray", "business-casual", "light"),
        ],
        "history": [],
        "pinnedItemId": None,
    }


def _item(
    item_id: str,
    name: str,
    category: str,
    color: str,
    formality: str,
    warmth: str = "medium",
) -> dict:
    return {
        "id": item_id,
        "name": name,
        "category": category,
        "color": color,
        "formality": formality,
        "warmth": warmth,
        "season": "all",
        "tags": ["classic"],
        "lastWorn": "",
        "swatch": "#1f2a44",
    }


def _candidate_item_sets(payload: dict) -> list[list[str]]:
    tops = [item for item in payload["wardrobe"] if item["category"] == "top"]
    bottoms = [item for item in payload["wardrobe"] if item["category"] == "bottom"]
    shoes = [item for item in payload["wardrobe"] if item["category"] == "shoe"]
    layers = [item for item in payload["wardrobe"] if item["category"] == "layer"]
    accessories = [item for item in payload["wardrobe"] if item["category"] == "accessory"]
    sets = []
    for top in tops:
        for bottom in bottoms:
            for shoe in shoes:
                for layer in layers:
                    for accessory in accessories:
                        sets.append([top["id"], bottom["id"], shoe["id"], layer["id"], accessory["id"]])
    return sets


def _enable_mock_inference_config() -> None:
    app.state.config["compartment_id"] = "ocid1.compartment.oc1..test"
    app.state.config.setdefault("inference", {})
    app.state.config["inference"].update(
        {
            "enabled": True,
            "service_endpoint": "https://inference.generativeai.us-chicago-1.oci.oraclecloud.com",
            "model_id": "ocid1.generativeaimodel.oc1.us-chicago-1.test",
        }
    )
