(function () {
  const Store = window.FitVectorStore;
  const Weather = window.FitVectorWeather;
  const DemoData = window.FitVectorDemoData;
  const Api = window.FitVectorApi;

  const state = {
    view: "planner",
    profile: Store.getProfile(),
    wardrobe: Store.getWardrobe(),
    history: Store.getHistory(),
    events: DemoData.getEvents(),
    selectedEventId: "",
    selectedCity: "chicago",
    weather: null,
    pinnedItemId: "",
    recommendations: [],
    recommendationMode: "loading",
    recommendationError: "",
    categoryFilter: "all",
    search: "",
    message: "Demo data loaded."
  };

  const root = document.getElementById("app");

  async function init() {
    state.selectedEventId = state.events[0].id;
    state.selectedCity = state.events[0].city;
    render();
    await loadWeatherAndRecommendations();
  }

  async function loadWeatherAndRecommendations() {
    const selectedEvent = currentEvent();
    state.selectedCity = state.selectedCity || selectedEvent.city;
    state.weather = await Weather.getWeather(state.selectedCity);
    render();
    await refreshRecommendations();
  }

  async function refreshRecommendations() {
    const payload = {
      event: currentEvent(),
      weather: state.weather || await Weather.getWeather(state.selectedCity),
      profile: state.profile,
      wardrobe: state.wardrobe,
      history: state.history,
      pinnedItemId: state.pinnedItemId || null
    };
    state.recommendationMode = "loading";
    state.recommendationError = "";
    render();
    try {
      const result = await Api.getRecommendations(payload);
      state.recommendations = result.recommendations || [];
      state.recommendationMode = result.mode || "oci-genai";
      state.recommendationError = result.error || "";
    } catch (error) {
      state.recommendations = localRecommendations(payload);
      state.recommendationMode = "deterministic-fallback";
      state.recommendationError = "Recommendation API unavailable; local fallback is active.";
    }
    render();
  }

  function render() {
    root.innerHTML = `
      <header class="topbar">
        <div class="brand">
          <div class="mark">FV</div>
          <div>
            <h1>FitVector</h1>
            <p>Outfit decisions from your wardrobe, event context, weather, and GenAI.</p>
          </div>
        </div>
        <nav class="tabs" aria-label="FitVector views">
          ${tab("planner", "Planner")}
          ${tab("wardrobe", "Wardrobe")}
          ${tab("profile", "Profile")}
        </nav>
      </header>
      <main class="main">
        <div class="status-row">
          ${modeChip()}
          <span class="chip good">Demo data loaded</span>
          ${state.weather ? `<span class="chip ${state.weather.isFallback ? "warn" : "good"}">${escapeHtml(state.weather.source)}</span>` : ""}
          ${state.message ? `<span class="chip">${escapeHtml(state.message)}</span>` : ""}
        </div>
        ${quizPanel()}
        <section class="view ${state.view === "planner" ? "active" : ""}">${plannerView()}</section>
        <section class="view ${state.view === "wardrobe" ? "active" : ""}">${wardrobeView()}</section>
        <section class="view ${state.view === "profile" ? "active" : ""}">${profileView()}</section>
      </main>
    `;
    bindEvents();
  }

  function tab(id, label) {
    return `<button class="tab ${state.view === id ? "active" : ""}" data-tab="${id}">${label}</button>`;
  }

  function modeChip() {
    if (state.recommendationMode === "loading") return `<span class="chip warn">Ranking outfits</span>`;
    if (state.recommendationMode === "oci-genai") return `<span class="chip good">OCI GenAI recommendations</span>`;
    return `<span class="chip warn">Deterministic fallback</span>`;
  }

  function quizPanel() {
    return `
      <section class="panel quiz-panel">
        <div class="section-title">
          <h2>FitVector style quiz</h2>
          <span class="small">${state.profile.quizComplete ? "Profile saved" : "Fast setup"}</span>
        </div>
        <div class="quiz-grid">
          ${selectField("quiz-style", "Style", state.profile.style, [
            ["modern classic", "Modern classic"],
            ["minimal", "Minimal"],
            ["expressive", "Expressive"],
            ["relaxed polish", "Relaxed polish"]
          ])}
          ${selectField("quiz-color", "Palette", state.profile.colorPreference, [
            ["balanced neutrals", "Balanced neutrals"],
            ["cool tones", "Cool tones"],
            ["warm tones", "Warm tones"],
            ["high contrast", "High contrast"]
          ])}
          ${rangeField("quiz-comfort", "Comfort", state.profile.comfortPriority)}
          ${rangeField("quiz-risk", "Novelty", state.profile.riskTolerance)}
          <button class="primary" id="saveQuiz">Save profile</button>
        </div>
      </section>
    `;
  }

  function plannerView() {
    return `
      <div class="planner-grid">
        <aside class="panel sidebar">
          <div class="section-title"><h2>Planner</h2><button class="secondary" id="resetDemo">Reset demo</button></div>
          <div class="event-list">
            ${state.events.map((event) => `
              <button class="event-button ${event.id === state.selectedEventId ? "active" : ""}" data-event="${event.id}">
                <strong>${escapeHtml(event.title)}</strong>
                <span>${formatDate(event.startsAt)} | ${escapeHtml(event.formality)} | ${escapeHtml(event.setting)}</span>
              </button>
            `).join("")}
          </div>
          <div class="field" style="margin-top:0.9rem">
            <label for="citySelect">City</label>
            <select id="citySelect">
              ${Weather.getCities().map((city) => `
                <option value="${city.key}" ${city.key === state.selectedCity ? "selected" : ""}>${city.label}</option>
              `).join("")}
            </select>
          </div>
          <div class="field" style="margin-top:0.9rem">
            <label for="pinSelect">Must-wear item</label>
            <select id="pinSelect">
              <option value="">None</option>
              ${state.wardrobe.map((item) => `
                <option value="${item.id}" ${item.id === state.pinnedItemId ? "selected" : ""}>${escapeHtml(item.name)}</option>
              `).join("")}
            </select>
          </div>
          ${weatherBox()}
        </aside>
        <section class="panel content-panel">
          <div class="section-title">
            <div>
              <h2>${escapeHtml(currentEvent().title)}</h2>
              <div class="small">${escapeHtml(currentEvent().notes)}</div>
            </div>
            <button class="secondary" id="refreshRecs">Refresh</button>
          </div>
          ${state.recommendationError ? `<p class="message">${escapeHtml(state.recommendationError)}</p>` : ""}
          <div class="recs">
            ${state.recommendations.length ? state.recommendations.map(outfitCard).join("") : `<div class="empty">Recommendations will appear here.</div>`}
          </div>
        </section>
      </div>
    `;
  }

  function weatherBox() {
    if (!state.weather) return `<div class="weather-box">Loading weather...</div>`;
    return `
      <div class="weather-box">
        <strong>${escapeHtml(state.weather.city)}</strong>
        <div class="weather-temp">${Math.round(state.weather.apparentTemperatureF)}F</div>
        <span>${escapeHtml(state.weather.summary)}</span>
        <span class="small">Rain ${Number(state.weather.precipitationIn).toFixed(2)} in | Wind ${Math.round(state.weather.windSpeedMph)} mph</span>
      </div>
    `;
  }

  function outfitCard(rec, index) {
    const items = rec.itemIds.map((id) => itemById(id)).filter(Boolean);
    return `
      <article class="outfit-card">
        <div class="section-title">
          <h3>Option ${index + 1}</h3>
          <span class="score">${rec.score}</span>
        </div>
        <div class="garments">
          ${items.map((item) => `
            <div class="garment">
              <span class="swatch" style="background:${safeColor(item.swatch)}"></span>
              <span>${escapeHtml(item.name)}</span>
            </div>
          `).join("")}
        </div>
        <ul class="reasoning">
          ${(rec.reasoning || []).slice(0, 3).map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}
        </ul>
        <div class="meta-grid">
          <span>${escapeHtml(rec.weatherFit || "")}</span>
          <span>${escapeHtml(rec.formalityFit || "")}</span>
          <span>${escapeHtml(rec.recencyNotes || "")}</span>
        </div>
        <button class="primary" data-wear="${rec.id}">Wear this</button>
      </article>
    `;
  }

  function wardrobeView() {
    const filtered = filteredWardrobe();
    return `
      <section class="panel content-panel">
        <div class="section-title">
          <h2>Wardrobe</h2>
          <span class="small">${filtered.length} shown of ${state.wardrobe.length}</span>
        </div>
        <div class="toolbar">
          <div class="field">
            <label for="searchWardrobe">Search</label>
            <input id="searchWardrobe" value="${escapeAttr(state.search)}" placeholder="shirt, navy, rain">
          </div>
          ${selectField("categoryFilter", "Category", state.categoryFilter, [
            ["all", "All"],
            ["top", "Top"],
            ["bottom", "Bottom"],
            ["layer", "Layer"],
            ["shoe", "Shoe"],
            ["accessory", "Accessory"]
          ])}
          <div class="field">
            <label for="csvUpload">CSV import</label>
            <input id="csvUpload" type="file" accept=".csv,text/csv">
          </div>
          <a class="secondary" href="sample-wardrobe.csv" download>CSV template</a>
        </div>
        <form id="itemForm" class="form-grid">
          <div class="field"><label for="itemName">Name</label><input id="itemName" required placeholder="Item name"></div>
          ${selectField("itemCategory", "Category", "top", [
            ["top", "Top"],
            ["bottom", "Bottom"],
            ["layer", "Layer"],
            ["shoe", "Shoe"],
            ["accessory", "Accessory"]
          ])}
          <div class="field"><label for="itemColor">Color</label><input id="itemColor" placeholder="navy"></div>
          <div class="field"><label for="itemSwatch">Swatch</label><input id="itemSwatch" type="color" value="#1f2a44"></div>
          <button class="primary" type="submit">Add item</button>
        </form>
        <p class="message">${escapeHtml(state.message || "")}</p>
        <div class="wardrobe-grid">
          ${filtered.map(wardrobeCard).join("") || `<div class="empty">No wardrobe items match the current filters.</div>`}
        </div>
      </section>
    `;
  }

  function wardrobeCard(item) {
    return `
      <article class="wardrobe-card">
        <div class="wardrobe-card-header">
          <span class="swatch large" style="background:${safeColor(item.swatch)}"></span>
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <div class="small">${escapeHtml(item.category)} | ${escapeHtml(item.formality)} | ${escapeHtml(item.warmth)}</div>
          </div>
        </div>
        <div class="tags">${(item.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
        <button class="secondary" data-edit="${item.id}">Edit</button>
      </article>
    `;
  }

  function profileView() {
    return `
      <section class="panel content-panel">
        <div class="section-title">
          <h2>Profile</h2>
          <button class="danger" id="clearHistory">Clear history</button>
        </div>
        <div class="form-grid">
          ${selectField("profileFormality", "Preference", state.profile.preferredFormality, [
            ["polished", "Polished"],
            ["relaxed", "Relaxed"],
            ["bold", "Bold"],
            ["minimal", "Minimal"]
          ])}
          <div class="field"><label for="repeatDays">Repeat window</label><input id="repeatDays" type="number" min="0" max="60" value="${state.profile.avoidRepeatsDays || 10}"></div>
          <button class="primary" id="saveProfile">Save settings</button>
        </div>
        <h3>Outfit history</h3>
        <div class="history-list">
          ${state.history.length ? state.history.slice(0, 8).map(historyItem).join("") : `<div class="empty">No outfits worn yet.</div>`}
        </div>
      </section>
    `;
  }

  function historyItem(record) {
    const names = (record.itemIds || []).map((id) => itemById(id)?.name).filter(Boolean).join(", ");
    return `
      <div class="history-item">
        <strong>${formatDate(record.wornAt)}</strong>
        <div class="small">${escapeHtml(names || "Unknown outfit")}</div>
      </div>
    `;
  }

  function bindEvents() {
    root.querySelectorAll("[data-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        state.view = button.dataset.tab;
        render();
      });
    });

    root.querySelectorAll("[data-event]").forEach((button) => {
      button.addEventListener("click", async () => {
        state.selectedEventId = button.dataset.event;
        state.selectedCity = currentEvent().city;
        await loadWeatherAndRecommendations();
      });
    });

    const citySelect = root.querySelector("#citySelect");
    if (citySelect) {
      citySelect.addEventListener("change", async (event) => {
        state.selectedCity = event.target.value;
        await loadWeatherAndRecommendations();
      });
    }

    const pinSelect = root.querySelector("#pinSelect");
    if (pinSelect) {
      pinSelect.addEventListener("change", async (event) => {
        state.pinnedItemId = event.target.value;
        await refreshRecommendations();
      });
    }

    const refresh = root.querySelector("#refreshRecs");
    if (refresh) refresh.addEventListener("click", refreshRecommendations);

    const reset = root.querySelector("#resetDemo");
    if (reset) {
      reset.addEventListener("click", async () => {
        const data = Store.resetDemoData();
        state.profile = data.profile;
        state.wardrobe = data.wardrobe;
        state.history = data.history;
        state.pinnedItemId = "";
        state.message = "Demo data loaded.";
        await refreshRecommendations();
      });
    }

    const saveQuiz = root.querySelector("#saveQuiz");
    if (saveQuiz) {
      saveQuiz.addEventListener("click", async () => {
        state.profile = Store.saveProfile({
          ...state.profile,
          style: valueOf("#quiz-style"),
          colorPreference: valueOf("#quiz-color"),
          comfortPriority: Number(valueOf("#quiz-comfort")),
          riskTolerance: Number(valueOf("#quiz-risk")),
          quizComplete: true
        });
        state.message = "Style profile saved.";
        await refreshRecommendations();
      });
    }

    const search = root.querySelector("#searchWardrobe");
    if (search) {
      search.addEventListener("input", (event) => {
        state.search = event.target.value;
        render();
      });
    }

    const category = root.querySelector("#categoryFilter");
    if (category) {
      category.addEventListener("change", (event) => {
        state.categoryFilter = event.target.value;
        render();
      });
    }

    const csv = root.querySelector("#csvUpload");
    if (csv) {
      csv.addEventListener("change", async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const text = await file.text();
        const result = Store.importWardrobeCsv(text);
        state.wardrobe = Store.getWardrobe();
        state.message = result.message;
        await refreshRecommendations();
      });
    }

    const itemForm = root.querySelector("#itemForm");
    if (itemForm) {
      itemForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        Store.upsertWardrobeItem({
          name: valueOf("#itemName"),
          category: valueOf("#itemCategory"),
          color: valueOf("#itemColor") || "neutral",
          swatch: valueOf("#itemSwatch"),
          formality: "smart-casual",
          warmth: "medium",
          season: "all",
          tags: []
        });
        state.wardrobe = Store.getWardrobe();
        state.message = "Wardrobe item saved.";
        await refreshRecommendations();
      });
    }

    root.querySelectorAll("[data-edit]").forEach((button) => {
      button.addEventListener("click", async () => {
        const item = itemById(button.dataset.edit);
        if (!item) return;
        const name = prompt("Item name", item.name);
        if (name === null) return;
        const color = prompt("Color", item.color);
        if (color === null) return;
        Store.upsertWardrobeItem({ ...item, name, color });
        state.wardrobe = Store.getWardrobe();
        state.message = "Wardrobe item updated.";
        await refreshRecommendations();
      });
    });

    root.querySelectorAll("[data-wear]").forEach((button) => {
      button.addEventListener("click", async () => {
        const rec = state.recommendations.find((item) => item.id === button.dataset.wear);
        if (!rec) return;
        Store.recordWear({
          recommendationId: rec.id,
          eventId: currentEvent().id,
          itemIds: rec.itemIds
        });
        state.history = Store.getHistory();
        state.wardrobe = Store.getWardrobe();
        state.message = "Outfit saved to history.";
        await refreshRecommendations();
      });
    });

    const saveProfile = root.querySelector("#saveProfile");
    if (saveProfile) {
      saveProfile.addEventListener("click", async () => {
        state.profile = Store.saveProfile({
          ...state.profile,
          preferredFormality: valueOf("#profileFormality"),
          avoidRepeatsDays: Number(valueOf("#repeatDays"))
        });
        state.message = "Profile settings saved.";
        await refreshRecommendations();
      });
    }

    const clearHistory = root.querySelector("#clearHistory");
    if (clearHistory) {
      clearHistory.addEventListener("click", async () => {
        Store.saveHistory([]);
        state.history = [];
        state.message = "Outfit history cleared.";
        await refreshRecommendations();
      });
    }
  }

  function currentEvent() {
    return state.events.find((event) => event.id === state.selectedEventId) || state.events[0];
  }

  function filteredWardrobe() {
    const query = state.search.trim().toLowerCase();
    return state.wardrobe.filter((item) => {
      const categoryMatch = state.categoryFilter === "all" || item.category === state.categoryFilter;
      const text = `${item.name} ${item.color} ${item.formality} ${(item.tags || []).join(" ")}`.toLowerCase();
      return categoryMatch && (!query || text.includes(query));
    });
  }

  function itemById(id) {
    return state.wardrobe.find((item) => item.id === id);
  }

  function selectField(id, label, value, options) {
    return `
      <div class="field">
        <label for="${id}">${label}</label>
        <select id="${id}">
          ${options.map(([optionValue, optionLabel]) => `
            <option value="${escapeAttr(optionValue)}" ${optionValue === value ? "selected" : ""}>${escapeHtml(optionLabel)}</option>
          `).join("")}
        </select>
      </div>
    `;
  }

  function rangeField(id, label, value) {
    return `
      <div class="field">
        <label for="${id}">${label}</label>
        <input id="${id}" type="range" min="1" max="5" value="${Number(value) || 3}">
      </div>
    `;
  }

  function valueOf(selector) {
    const element = root.querySelector(selector);
    return element ? element.value : "";
  }

  function localRecommendations(payload) {
    const items = payload.wardrobe;
    const byCategory = (category) => items.filter((item) => item.category === category);
    const required = [byCategory("top"), byCategory("bottom"), byCategory("shoe")];
    const layers = byCategory("layer").length ? byCategory("layer") : [null];
    const accessories = byCategory("accessory").length ? byCategory("accessory") : [null];
    const combos = [];
    required[0].forEach((top) => {
      required[1].forEach((bottom) => {
        required[2].forEach((shoe) => {
          layers.forEach((layer) => {
            accessories.forEach((accessory) => {
              const outfit = [top, bottom, shoe, layer, accessory].filter(Boolean);
              if (payload.pinnedItemId && !outfit.some((item) => item.id === payload.pinnedItemId)) return;
              combos.push(outfit);
            });
          });
        });
      });
    });
    return combos.slice(0, 3).map((combo, index) => ({
      id: `local-rec-${index + 1}`,
      score: 82 - index * 4,
      itemIds: combo.map((item) => item.id),
      reasoning: [
        `Matches ${payload.event.formality} expectations.`,
        `Built for ${payload.weather.summary.toLowerCase()} conditions.`,
        "Uses available wardrobe items without a live model call."
      ],
      weatherFit: `Good for ${Math.round(payload.weather.apparentTemperatureF)}F conditions.`,
      formalityFit: `Suitable for ${payload.event.formality}.`,
      recencyNotes: "Local fallback does not deepen recency scoring."
    }));
  }

  function formatDate(value) {
    if (!value) return "No date";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  }

  function safeColor(value) {
    return /^#[0-9a-f]{3,8}$/i.test(value || "") ? value : "#9ca3af";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  init();
}());
