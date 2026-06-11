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
    state.pinnedItemId = state.wardrobe.find((item) => item.category === "accessory")?.id || "";
    render();
    await loadWeatherAndRecommendations();
  }

  async function loadWeatherAndRecommendations() {
    state.weather = await Weather.getWeather(state.selectedCity || currentEvent().city);
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
    } catch {
      state.recommendations = localRecommendations(payload);
      state.recommendationMode = "deterministic-fallback";
      state.recommendationError = "Recommendation API unavailable; local fallback is active.";
    }
    render();
  }

  function render() {
    root.innerHTML = `
      <div class="app-frame">
        ${leftRail()}
        <main class="workspace">
          ${topActions()}
          ${viewContent()}
        </main>
        ${rightRail()}
      </div>
      <input id="csvUploadGlobal" class="sr-only" type="file" accept=".csv,text/csv">
    `;
    bindEvents();
  }

  function leftRail() {
    return `
      <aside class="left-rail">
        <div class="logo-block">
          <div class="hanger">⌁</div>
          <div class="wordmark">FITVEC<span>TOR</span></div>
        </div>
        <div class="hero-copy">
          <div class="graffiti">WHAT THE <strong>F</strong><br>DO I WEAR?</div>
          <p>Smart outfits. <span>Zero</span> overthinking.</p>
        </div>
        <nav class="rail-nav" aria-label="FitVector">
          ${navButton("planner", "▣", "Planner")}
          ${navButton("wardrobe", "♙", "Wardrobe")}
          ${navButton("profile", "♧", "Profile")}
          ${navButton("history", "◴", "History")}
          ${navButton("settings", "⚙", "Settings")}
        </nav>
        <div class="demo-card">
          <div class="spark">✦</div>
          <strong>Demo data loaded</strong>
          <p>Professional wardrobe and events ready to go.</p>
          <button class="text-link" id="resetDemo">Reset demo →</button>
        </div>
      </aside>
    `;
  }

  function navButton(id, icon, label) {
    return `
      <button class="rail-button ${state.view === id ? "active" : ""}" data-tab="${id}">
        <span>${icon}</span>
        ${label}
      </button>
    `;
  }

  function topActions() {
    return `
      <header class="workspace-header">
        <div>
          <h1>${titleForView()}</h1>
          <p>${subtitleForView()}</p>
        </div>
        <div class="header-actions">
          <button class="icon-button" title="How it works">?</button>
          <button class="outline-button" id="importCsvTop">⇩ Import CSV</button>
          <button class="pink-button" id="addEvent">＋ Add Event</button>
        </div>
      </header>
    `;
  }

  function viewContent() {
    if (state.view === "wardrobe") return wardrobeView();
    if (state.view === "profile") return profileView();
    if (state.view === "history") return historyView();
    if (state.view === "settings") return settingsView();
    return plannerView();
  }

  function plannerView() {
    return `
      ${plannerSummary()}
      <section class="recommendation-header">
        <div>
          <h2>Top Outfit Recommendations</h2>
          <p>Ranked by FitVector Score</p>
        </div>
        <button class="outline-button" id="refreshRecs">♡ How it works</button>
      </section>
      ${state.recommendationError ? `<p class="mode-note">${escapeHtml(state.recommendationError)}</p>` : ""}
      <section class="outfit-grid">
        ${state.recommendations.length ? state.recommendations.map(outfitCard).join("") : `<div class="empty dark">Recommendations will appear here.</div>`}
      </section>
      <button class="more-button">View more outfit combinations⌄</button>
      ${featureBar()}
    `;
  }

  function plannerSummary() {
    const event = currentEvent();
    const pinned = pinnedItem();
    return `
      <section class="planner-summary">
        <div class="summary-cell event-cell">
          <label>Upcoming event</label>
          <select id="eventSelect" class="naked-select">
            ${state.events.map((item) => `<option value="${item.id}" ${item.id === state.selectedEventId ? "selected" : ""}>${escapeHtml(item.title)}</option>`).join("")}
          </select>
          <div class="summary-line">▣ ${formatDate(event.startsAt)} <span>•</span> ${eventTime(event.startsAt)}</div>
          <div class="pill-row"><span>${escapeHtml(event.formality)}</span><span>${escapeHtml(event.setting)}</span></div>
        </div>
        <div class="summary-cell weather-cell">
          <label>Location</label>
          <select id="citySelect" class="naked-select">
            ${Weather.getCities().map((city) => `<option value="${city.key}" ${city.key === state.selectedCity ? "selected" : ""}>${city.label}</option>`).join("")}
          </select>
          ${weatherInline()}
        </div>
        <div class="summary-cell pin-cell">
          <label>Must-wear (optional)</label>
          <div class="pin-picker">
            ${pinned ? itemThumb(pinned, "pin-thumb") : `<div class="pin-thumb empty-thumb">+</div>`}
            <select id="pinSelect">
              <option value="">No pinned item</option>
              ${state.wardrobe.map((item) => `<option value="${item.id}" ${item.id === state.pinnedItemId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}
            </select>
            <button id="clearPin" class="clear-pin">×</button>
          </div>
          <button class="clear-button" id="clearPinWide">Clear</button>
        </div>
      </section>
    `;
  }

  function weatherInline() {
    if (!state.weather) return `<div class="weather-inline">Loading weather...</div>`;
    return `
      <div class="weather-inline">
        <div class="weather-icon">${weatherIcon()}</div>
        <div class="temp">${Math.round(state.weather.apparentTemperatureF)}°F</div>
        <div>
          <strong>${escapeHtml(state.weather.summary)}</strong>
          <span>Feels like ${Math.round(state.weather.temperatureF)}° • ${Math.round(state.weather.precipitationIn * 100)}% rain • Wind ${Math.round(state.weather.windSpeedMph)} mph</span>
        </div>
      </div>
    `;
  }

  function outfitCard(rec, index) {
    const items = rec.itemIds.map((id) => itemById(id)).filter(Boolean);
    const label = index === 0 ? "Best Match" : index === 1 ? "Strong Match" : "Solid Option";
    return `
      <article class="outfit-card">
        <div class="card-topline">
          <span class="rank">${index + 1}</span>
          <strong>${label}</strong>
          <span class="score-ring">${rec.score}</span>
        </div>
        <div class="look-stage">
          ${items.map((item, itemIndex) => lookItem(item, itemIndex)).join("")}
        </div>
        <strong>Why this works</strong>
        <ul class="reason-list">
          ${(rec.reasoning || []).slice(0, 4).map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}
        </ul>
        <div class="card-actions">
          <button class="wear-button" data-wear="${rec.id}">Wear this</button>
          <button class="save-button" title="Save outfit">♧</button>
        </div>
      </article>
    `;
  }

  function lookItem(item, index) {
    const image = imageFor(item);
    const classes = ["look-item", `pos-${index}`, item.category].join(" ");
    const fallback = `<div class="image-fallback" style="background:${safeColor(item.swatch)}">${escapeHtml(shortName(item.name))}</div>`;
    const visual = image
      ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(item.name)}" loading="lazy" onerror="this.replaceWith(this.nextElementSibling)">${fallback}`
      : fallback;
    if (item.link) {
      return `<a class="${classes}" href="${escapeAttr(item.link)}" target="_blank" rel="noreferrer" title="${escapeAttr(item.name)}">${visual}</a>`;
    }
    return `<div class="${classes}" title="${escapeAttr(item.name)}">${visual}</div>`;
  }

  function rightRail() {
    if (state.view !== "planner") return `<aside class="right-rail">${statusPanel()}${tipPanel()}</aside>`;
    const event = currentEvent();
    const pinned = pinnedItem();
    return `
      <aside class="right-rail">
        <section class="side-panel">
          <h3>▣ Event Details</h3>
          <p>▣ ${formatDate(event.startsAt)}</p>
          <p>◷ ${eventTime(event.startsAt)}</p>
          <p>⌖ ${cityLabel(state.selectedCity)}</p>
          <p>◇ ${escapeHtml(event.type)}</p>
          <p>⌘ ${escapeHtml(event.setting)} • ${escapeHtml(event.formality)}</p>
          <p>▤ ${escapeHtml(event.notes)}</p>
        </section>
        <section class="side-panel weather-panel">
          <h3>☁ Weather</h3>
          <p>${escapeHtml(state.weather?.city || cityLabel(state.selectedCity))}</p>
          <div class="big-weather">
            <div><strong>${Math.round(state.weather?.apparentTemperatureF || 72)}°F</strong><span>${escapeHtml(state.weather?.summary || "Weather")}</span></div>
            <div class="weather-icon large">${weatherIcon()}</div>
          </div>
          <div class="weather-stats">
            <span>Feels Like <strong>${Math.round(state.weather?.temperatureF || 72)}°</strong></span>
            <span>Precip <strong>${Math.round((state.weather?.precipitationIn || 0) * 100)}%</strong></span>
            <span>Wind <strong>${Math.round(state.weather?.windSpeedMph || 0)} mph</strong></span>
          </div>
          <p class="source">Source: ${escapeHtml(state.weather?.source || "demo")}</p>
        </section>
        <section class="side-panel pinned-panel">
          <h3>⊙ Pinned Item</h3>
          ${pinned ? `${itemThumb(pinned, "pinned-hero")}<strong>${escapeHtml(pinned.name)}</strong><p>${escapeHtml(pinned.category)}</p><button class="outline-pink" data-tab="wardrobe">Change</button>` : `<p>No must-wear item pinned.</p>`}
        </section>
        ${tipPanel()}
      </aside>
    `;
  }

  function wardrobeView() {
    const filtered = filteredWardrobe();
    return `
      <section class="dark-panel">
        <div class="section-heading">
          <div><h2>Wardrobe</h2><p>${filtered.length} shown of ${state.wardrobe.length}</p></div>
          <a class="outline-button" href="sample-wardrobe.csv" download>CSV template</a>
        </div>
        <div class="wardrobe-toolbar">
          <input id="searchWardrobe" value="${escapeAttr(state.search)}" placeholder="Search item, color, tag">
          <select id="categoryFilter">
            ${["all", "top", "bottom", "layer", "shoe", "accessory"].map((category) => `<option value="${category}" ${category === state.categoryFilter ? "selected" : ""}>${category}</option>`).join("")}
          </select>
          <button class="pink-button" id="importCsvWardrobe">⇩ Import CSV</button>
        </div>
        <form id="itemForm" class="add-item-form">
          <input id="itemName" required placeholder="Item name">
          <select id="itemCategory">
            ${["top", "bottom", "layer", "shoe", "accessory"].map((category) => `<option value="${category}">${category}</option>`).join("")}
          </select>
          <input id="itemColor" placeholder="Color">
          <input id="itemImageUrl" placeholder="Image URL or product link">
          <button class="outline-button" type="submit">Add item</button>
        </form>
        <p class="mode-note">${escapeHtml(state.message || "")}</p>
        <div class="wardrobe-grid">
          ${filtered.map(wardrobeCard).join("") || `<div class="empty dark">No wardrobe items match the current filters.</div>`}
        </div>
      </section>
    `;
  }

  function wardrobeCard(item) {
    return `
      <article class="wardrobe-card">
        ${itemThumb(item, "wardrobe-image")}
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <p>${escapeHtml(item.category)} • ${escapeHtml(item.formality)} • ${escapeHtml(item.warmth)}</p>
        </div>
        <div class="tags">${(item.tags || []).slice(0, 4).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
        ${item.link ? `<a href="${escapeAttr(item.link)}" target="_blank" rel="noreferrer">Open link</a>` : ""}
        <button class="outline-button" data-edit="${item.id}">Edit</button>
      </article>
    `;
  }

  function profileView() {
    return `
      <section class="dark-panel">
        <div class="section-heading"><div><h2>Profile</h2><p>Style quiz and fit preferences</p></div></div>
        <div class="quiz-grid">
          ${selectField("quiz-style", "Style", state.profile.style, [["modern classic", "Modern classic"], ["minimal", "Minimal"], ["expressive", "Expressive"], ["relaxed polish", "Relaxed polish"]])}
          ${selectField("quiz-color", "Palette", state.profile.colorPreference, [["balanced neutrals", "Balanced neutrals"], ["cool tones", "Cool tones"], ["warm tones", "Warm tones"], ["high contrast", "High contrast"]])}
          ${rangeField("quiz-comfort", "Comfort", state.profile.comfortPriority)}
          ${rangeField("quiz-risk", "Novelty", state.profile.riskTolerance)}
          <button class="pink-button" id="saveQuiz">Save profile</button>
        </div>
      </section>
    `;
  }

  function historyView() {
    return `
      <section class="dark-panel">
        <div class="section-heading"><div><h2>History</h2><p>Recently worn outfits</p></div><button class="outline-button" id="clearHistory">Clear history</button></div>
        <div class="history-list">
          ${state.history.length ? state.history.slice(0, 10).map(historyItem).join("") : `<div class="empty dark">No outfits worn yet.</div>`}
        </div>
      </section>
    `;
  }

  function settingsView() {
    return `
      <section class="dark-panel">
        <div class="section-heading"><div><h2>Settings</h2><p>Demo controls</p></div></div>
        <button class="pink-button" id="resetDemoSettings">Reload demo data</button>
        <p class="mode-note">${modeLabel()}</p>
      </section>
    `;
  }

  function featureBar() {
    return `
      <section class="feature-bar">
        <div><span>♙</span><strong>Personalized to you</strong><p>Style quiz learns your vibe</p></div>
        <div><span>☁</span><strong>Weather aware</strong><p>Real-time conditions</p></div>
        <div><span>▥</span><strong>Your wardrobe</strong><p>Use what you own</p></div>
        <div><span>▣</span><strong>Event-based planner</strong><p>Be ready for anything</p></div>
        <div><span>↻</span><strong>Repeat prevention</strong><p>We keep it fresh</p></div>
      </section>
    `;
  }

  function tipPanel() {
    return `<section class="side-panel tip-panel"><h3>✦ FitVector Tip</h3><p>Pin a must-wear item to see outfits that include it.</p></section>`;
  }

  function statusPanel() {
    return `<section class="side-panel"><h3>Status</h3><p>${escapeHtml(modeLabel())}</p><p>${escapeHtml(state.message || "")}</p></section>`;
  }

  function itemThumb(item, className) {
    const image = imageFor(item);
    if (image) {
      return `<div class="${className} item-thumb"><img src="${escapeAttr(image)}" alt="${escapeAttr(item.name)}" onerror="this.replaceWith(this.nextElementSibling)"><span style="background:${safeColor(item.swatch)}">${escapeHtml(shortName(item.name))}</span></div>`;
    }
    return `<div class="${className} item-thumb"><span style="background:${safeColor(item.swatch)}">${escapeHtml(shortName(item.name))}</span></div>`;
  }

  function bindEvents() {
    root.querySelectorAll("[data-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        state.view = button.dataset.tab;
        render();
      });
    });

    const eventSelect = root.querySelector("#eventSelect");
    if (eventSelect) {
      eventSelect.addEventListener("change", async (event) => {
        state.selectedEventId = event.target.value;
        state.selectedCity = currentEvent().city;
        await loadWeatherAndRecommendations();
      });
    }

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

    root.querySelectorAll("#clearPin, #clearPinWide").forEach((button) => {
      button.addEventListener("click", async () => {
        state.pinnedItemId = "";
        await refreshRecommendations();
      });
    });

    root.querySelectorAll("#importCsvTop, #importCsvWardrobe").forEach((button) => {
      button.addEventListener("click", () => root.querySelector("#csvUploadGlobal").click());
    });

    const csv = root.querySelector("#csvUploadGlobal");
    if (csv) {
      csv.addEventListener("change", async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const result = Store.importWardrobeCsv(await file.text());
        state.wardrobe = Store.getWardrobe();
        state.message = result.message;
        await refreshRecommendations();
      });
    }

    root.querySelectorAll("#refreshRecs").forEach((button) => button.addEventListener("click", refreshRecommendations));
    root.querySelectorAll("#resetDemo, #resetDemoSettings").forEach((button) => button.addEventListener("click", resetDemo));
    const addEvent = root.querySelector("#addEvent");
    if (addEvent) addEvent.addEventListener("click", () => { state.message = "Event add flow is ready for the next iteration."; render(); });

    const saveQuiz = root.querySelector("#saveQuiz");
    if (saveQuiz) saveQuiz.addEventListener("click", saveProfile);

    const search = root.querySelector("#searchWardrobe");
    if (search) search.addEventListener("input", (event) => { state.search = event.target.value; render(); });

    const category = root.querySelector("#categoryFilter");
    if (category) category.addEventListener("change", (event) => { state.categoryFilter = event.target.value; render(); });

    const itemForm = root.querySelector("#itemForm");
    if (itemForm) {
      itemForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const rawLink = valueOf("#itemImageUrl");
        Store.upsertWardrobeItem({
          name: valueOf("#itemName"),
          category: valueOf("#itemCategory"),
          color: valueOf("#itemColor") || "neutral",
          swatch: "#334155",
          formality: "smart-casual",
          warmth: "medium",
          season: "all",
          tags: [],
          imageUrl: looksLikeImage(rawLink) ? rawLink : "",
          link: rawLink
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
        const imageUrl = prompt("Image URL", item.imageUrl || item.link || "");
        if (imageUrl === null) return;
        Store.upsertWardrobeItem({ ...item, name, imageUrl: looksLikeImage(imageUrl) ? imageUrl : item.imageUrl, link: imageUrl });
        state.wardrobe = Store.getWardrobe();
        state.message = "Wardrobe item updated.";
        await refreshRecommendations();
      });
    });

    root.querySelectorAll("[data-wear]").forEach((button) => {
      button.addEventListener("click", async () => {
        const rec = state.recommendations.find((item) => item.id === button.dataset.wear);
        if (!rec) return;
        Store.recordWear({ recommendationId: rec.id, eventId: currentEvent().id, itemIds: rec.itemIds });
        state.history = Store.getHistory();
        state.wardrobe = Store.getWardrobe();
        state.message = "Outfit saved to history.";
        await refreshRecommendations();
      });
    });

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

  async function resetDemo() {
    const data = Store.resetDemoData();
    state.profile = data.profile;
    state.wardrobe = data.wardrobe;
    state.history = data.history;
    state.pinnedItemId = state.wardrobe.find((item) => item.category === "accessory")?.id || "";
    state.message = "Demo data loaded.";
    await refreshRecommendations();
  }

  async function saveProfile() {
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
  }

  function localRecommendations(payload) {
    const items = payload.wardrobe;
    const byCategory = (category) => items.filter((item) => item.category === category);
    const tops = byCategory("top");
    const bottoms = byCategory("bottom");
    const shoes = byCategory("shoe");
    const layers = byCategory("layer").length ? byCategory("layer") : [null];
    const accessories = byCategory("accessory").length ? byCategory("accessory") : [null];
    const combos = [];
    tops.forEach((top) => bottoms.forEach((bottom) => shoes.forEach((shoe) => {
      layers.forEach((layer) => accessories.forEach((accessory) => {
        const outfit = [top, bottom, shoe, layer, accessory].filter(Boolean);
        if (payload.pinnedItemId && !outfit.some((item) => item.id === payload.pinnedItemId)) return;
        combos.push(outfit);
      }));
    })));
    return combos.slice(0, 3).map((combo, index) => ({
      id: `local-rec-${index + 1}`,
      score: 92 - index * 6,
      itemIds: combo.map((item) => item.id),
      reasoning: [
        `Strong fit for ${payload.event.formality}`,
        `Good for ${payload.weather.summary.toLowerCase()}`,
        "Color and category balance is solid",
        "No recent exact repeat detected"
      ],
      weatherFit: `Great for ${Math.round(payload.weather.apparentTemperatureF)}°F conditions.`,
      formalityFit: `Ready for ${payload.event.formality}.`,
      recencyNotes: "No exact outfit repeat found."
    }));
  }

  function currentEvent() {
    return state.events.find((event) => event.id === state.selectedEventId) || state.events[0];
  }

  function pinnedItem() {
    return state.pinnedItemId ? itemById(state.pinnedItemId) : null;
  }

  function itemById(id) {
    return state.wardrobe.find((item) => item.id === id);
  }

  function filteredWardrobe() {
    const query = state.search.trim().toLowerCase();
    return state.wardrobe.filter((item) => {
      const text = `${item.name} ${item.color} ${item.formality} ${item.category} ${(item.tags || []).join(" ")}`.toLowerCase();
      return (state.categoryFilter === "all" || item.category === state.categoryFilter) && (!query || text.includes(query));
    });
  }

  function historyItem(record) {
    const items = (record.itemIds || []).map(itemById).filter(Boolean);
    return `<div class="history-item"><strong>${formatDate(record.wornAt)}</strong><p>${items.map((item) => escapeHtml(item.name)).join(", ") || "Unknown outfit"}</p></div>`;
  }

  function selectField(id, label, value, options) {
    return `<div class="field"><label for="${id}">${label}</label><select id="${id}">${options.map(([optionValue, optionLabel]) => `<option value="${escapeAttr(optionValue)}" ${optionValue === value ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`).join("")}</select></div>`;
  }

  function rangeField(id, label, value) {
    return `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="range" min="1" max="5" value="${Number(value) || 3}"></div>`;
  }

  function titleForView() {
    return { planner: "Planner", wardrobe: "Wardrobe", profile: "Profile", history: "History", settings: "Settings" }[state.view] || "Planner";
  }

  function subtitleForView() {
    return state.view === "planner" ? "Get smart outfit recommendations for your day." : "Manage the wardrobe intelligence behind your recommendations.";
  }

  function modeLabel() {
    if (state.recommendationMode === "oci-genai") return "OCI GenAI recommendations";
    if (state.recommendationMode === "loading") return "Ranking outfits";
    return "Deterministic fallback";
  }

  function cityLabel(key) {
    return Weather.getCities().find((city) => city.key === key)?.label || key;
  }

  function imageFor(item) {
    return item.imageUrl || (looksLikeImage(item.link) ? item.link : "");
  }

  function looksLikeImage(value) {
    return /^https?:\/\/.+\.(png|jpe?g|gif|webp|avif)(\?.*)?$/i.test(value || "") || /^https:\/\/images\.unsplash\.com\//i.test(value || "");
  }

  function shortName(name) {
    return String(name || "").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  }

  function weatherIcon() {
    if (!state.weather) return "☁";
    if (state.weather.precipitationIn > 0.05) return "🌧";
    if (state.weather.apparentTemperatureF > 88) return "☀";
    return "⛅";
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value || "No date";
    return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(date);
  }

  function eventTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "10:00 AM";
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
  }

  function valueOf(selector) {
    return root.querySelector(selector)?.value || "";
  }

  function safeColor(value) {
    return /^#[0-9a-f]{3,8}$/i.test(value || "") ? value : "#334155";
  }

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  init();
}());
