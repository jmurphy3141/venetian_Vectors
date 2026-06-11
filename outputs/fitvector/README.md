# FitVector Static Frontend

Open through the FastAPI backend at `/` or `/fitvector/` so calls to `/api/recommendations` resolve correctly.

Core files:

```text
index.html
styles.css
app.js
api.js
data.js
events.js
weather.js
sample-wardrobe.csv
```

The frontend stores profile, wardrobe, and outfit history in localStorage. It never stores OCI credentials or calls OCI GenAI directly.
