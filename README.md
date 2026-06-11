# FitVector

FitVector helps a user choose outfits from their own wardrobe using event context, weather, wardrobe history, style preferences, and an optional must-wear item.

This version uses a static vanilla HTML/CSS/JS frontend with a small FastAPI backend. The browser calls `/api/recommendations`; the backend calls OCI Generative AI Inference using Instance Principal auth, validates the model output, and falls back to deterministic recommendations if OCI is unavailable.

## Run Locally

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn server.app:app --host 0.0.0.0 --port 8000
```

Open `http://localhost:8000/`.

For local work without OCI credentials, the app still runs and returns deterministic fallback recommendations.

## OCI GenAI Configuration

Edit `config.yaml` before deploying:

```yaml
region: "us-chicago-1"
compartment_id: "ocid1.compartment.oc1..replace-with-compartment-ocid"
inference:
  enabled: true
  service_endpoint: "https://inference.generativeai.us-chicago-1.oci.oraclecloud.com"
  model_id: "ocid1.generativeaimodel.oc1.us-chicago-1.replace-with-model-ocid"
```

Production auth follows the `arch_assistant` pattern: OCI Python SDK, `GenerativeAiInferenceClient`, `GenericChatRequest`, `OnDemandServingMode`, and `InstancePrincipalsSecurityTokenSigner`.

## Demo Steps

1. Open the app and save the style quiz.
2. Select a seeded event in Planner.
3. Change city and confirm weather context updates.
4. Pin a must-wear wardrobe item.
5. Confirm every recommendation includes the pinned item.
6. Click "Wear this" and confirm history is updated.
7. Import `outputs/fitvector/sample-wardrobe.csv` from Wardrobe.

## Source Layout

```text
server/                  FastAPI backend and OCI GenAI route
outputs/fitvector/       Static frontend deliverable
tests/                   Mocked API tests
deploy/                  OCI deployment checklist and systemd unit
```

## CSV Schema

```csv
name,category,color,formality,warmth,season,tags,lastWorn,swatch
Navy Blazer,layer,navy,business-formal,warm,all,client-meeting|classic,,#1f2a44
```

Required fields: `name`, `category`.

## Tests

```bash
pytest
```

Live OCI GenAI tests should be opt-in only:

```bash
RUN_LIVE_OCI_GENAI_TESTS=1 pytest
```
