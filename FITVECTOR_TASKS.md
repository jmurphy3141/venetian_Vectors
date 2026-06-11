# FitVector Five-Codex Split With Real OCI GenAI

FitVector is now a static browser app backed by a small FastAPI service. The browser never calls a model directly. The backend generates candidate outfits, calls OCI Generative AI Inference for top-3 selection and explanation, validates the model output, and falls back to deterministic ranking when OCI is unavailable.

## Shared Architecture

- Frontend static files: `outputs/fitvector/`
- Backend app: `server/app.py`
- Recommendation API: `POST /api/recommendations`
- Health API: `GET /api/health`
- OCI GenAI auth: Instance Principal on OCI Compute
- Browser storage keys: `fitvector.profile`, `fitvector.wardrobe`, `fitvector.history`
- Wardrobe CSV supports `imageUrl` and `link` columns so outfit cards can render garment photos from uploaded clothing lists.

Frontend request shape:

```js
await fetch("/api/recommendations", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    event,
    weather,
    profile,
    wardrobe,
    history,
    pinnedItemId
  })
});
```

Backend response shape:

```js
{
  status: "ok",
  mode: "oci-genai",
  recommendations: [
    {
      id,
      score,
      itemIds,
      reasoning,
      weatherFit,
      formalityFit,
      recencyNotes
    }
  ]
}
```

## Task 1: OCI GenAI Backend Foundation

Branch: `task/oci-genai-backend`

Owns:

```text
server/app.py
server/oci_genai.py
config.yaml
requirements.txt
```

Build:

- FastAPI app with `/api/health`.
- Static file serving for `outputs/fitvector/`.
- OCI GenAI inference client using direct SDK calls.
- Config-driven region, compartment OCID, service endpoint, model OCID, token settings, and system message.
- Instance Principal auth in production.

Acceptance:

- `uvicorn server.app:app` starts.
- `/api/health` returns config and inference readiness.
- No API keys or browser credentials exist in source.

## Task 2: AI Recommendation API

Branch: `task/ai-recommendations`

Owns:

```text
server/routes/recommendations.py
server/models.py
server/fitvector_prompt.py
server/outfit_candidates.py
```

Build:

- `POST /api/recommendations`.
- Candidate outfit generation.
- Pinned item enforcement.
- JSON-only OCI GenAI prompt.
- Validation that model output only uses generated candidate item sets.
- Deterministic fallback when OCI fails or model JSON is invalid.

Acceptance:

- Valid mocked GenAI output returns `mode: "oci-genai"`.
- Invalid GenAI output returns `mode: "deterministic-fallback"`.
- Model-invented item IDs are rejected.
- Pinned item appears in every recommendation.

## Task 3: Frontend App And Choice UX

Branch: `task/frontend-app`

Owns:

```text
outputs/fitvector/index.html
outputs/fitvector/styles.css
outputs/fitvector/app.js
outputs/fitvector/api.js
```

Build:

- Planner, Wardrobe, Profile views.
- Fast style quiz as the first usable screen.
- Calls `/api/recommendations`.
- Shows OCI GenAI vs fallback status.
- Displays top 3 outfit cards.
- "Wear this" records selected outfit to local history.
- Handles backend/API unavailable state.

Acceptance:

- User can choose an event, city, and pinned item.
- Recommendations refresh after event, city, profile, wardrobe, or history changes.
- "Wear this" updates history and future ranking inputs.

## Task 4: Data, CSV, Weather, Events

Branch: `task/data-weather`

Owns:

```text
outputs/fitvector/data.js
outputs/fitvector/weather.js
outputs/fitvector/events.js
outputs/fitvector/sample-wardrobe.csv
```

Build:

- Seeded professional wardrobe.
- CSV import with required `name` and `category`.
- Preserve `imageUrl` and `link` columns; use direct image links in top outfit cards.
- Safe defaults for optional CSV fields.
- LocalStorage persistence.
- Open-Meteo weather from city presets.
- Demo fallback weather.
- Seeded upcoming professional events.

Acceptance:

- Fresh load seeds demo data.
- Valid CSV import adds wardrobe cards.
- Invalid CSV gives clear feedback.
- Weather updates by city or falls back cleanly.

## Task 5: Docs, Deploy, QA

Branch: `task/docs-deploy-qa`

Owns:

```text
README.md
FITVECTOR_TASKS.md
outputs/fitvector/README.md
deploy/fitvector.service
deploy/deploy-checklist.md
```

Build:

- Judge-facing demo steps.
- Local development instructions.
- OCI GenAI setup instructions.
- OCI Compute deployment checklist.
- Manual QA checklist.
- Opt-in live GenAI test instructions.

Acceptance:

- README explains the FastAPI backend and static frontend.
- Deployment checklist names all required config values.
- Test plan covers API fallback, pinned items, CSV import, weather fallback, and history.

## Merge Order

1. Backend foundation.
2. Recommendation API.
3. Data/weather and frontend in either order.
4. Docs and QA after behavior is stable.

Keep the backend response contract stable so each Codex instance can work without waiting on others.
