(function () {
  async function getRecommendations(payload) {
    const response = await fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || `Recommendation API returned ${response.status}`);
    }
    return response.json();
  }

  async function getHealth() {
    const response = await fetch("/api/health");
    if (!response.ok) throw new Error("Health check failed");
    return response.json();
  }

  window.FitVectorApi = {
    getRecommendations,
    getHealth
  };
}());
