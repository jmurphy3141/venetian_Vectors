# FitVector OCI Deployment Checklist

## OCI Setup

- Deploy on OCI Compute or another host with Python 3.11+.
- Enable Instance Principal for the compute instance.
- Grant the dynamic group permission to call OCI Generative AI in the target compartment.
- Confirm the GenAI model OCID and endpoint region match.

## Server Setup

```bash
cd /home/opc/venetian_Vectors
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

Update `config.yaml`:

- `region`
- `compartment_id`
- `inference.service_endpoint`
- `inference.model_id`
- token settings if needed

## Smoke Tests

```bash
uvicorn server.app:app --host 0.0.0.0 --port 8000
curl http://localhost:8000/api/health
```

Open:

```text
http://<public-host>/
```

## systemd

```bash
sudo cp deploy/fitvector.service /etc/systemd/system/fitvector.service
sudo systemctl daemon-reload
sudo systemctl enable --now fitvector
sudo systemctl status fitvector
```

## Submission Checks

- Live URL opens on desktop.
- Live URL opens on mobile.
- Planner returns top 3 outfits.
- OCI GenAI mode appears when backend inference succeeds.
- Fallback mode appears cleanly if OCI is unavailable.
- Pinned item appears in every recommendation.
- CSV import works.
- "Wear this" updates history.
