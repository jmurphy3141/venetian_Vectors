(function () {
  const KEYS = {
    profile: "fitvector.profile",
    wardrobe: "fitvector.wardrobe",
    history: "fitvector.history"
  };

  const DEFAULT_PROFILE = {
    style: "modern classic",
    colorPreference: "balanced neutrals",
    comfortPriority: 3,
    riskTolerance: 2,
    avoidRepeatsDays: 10,
    preferredFormality: "polished",
    quizComplete: false
  };

  const SEEDED_WARDROBE = [
    item("navy-blazer", "Navy Blazer", "layer", "navy", "business-formal", "warm", "all", ["client-meeting", "classic"], "", "#1f2a44"),
    item("charcoal-suit-jacket", "Charcoal Suit Jacket", "layer", "charcoal", "business-formal", "warm", "all", ["executive", "tailored"], "", "#30343b"),
    item("camel-trench", "Camel Trench", "layer", "tan", "business-casual", "medium", "spring", ["rain", "commute"], "", "#b68b5f"),
    item("white-oxford", "White Oxford Shirt", "top", "white", "business-formal", "medium", "all", ["classic", "crisp"], "", "#f8fafc"),
    item("blue-poplin", "Light Blue Poplin", "top", "blue", "business-formal", "light", "all", ["client-meeting", "cool"], "", "#bcd7f0"),
    item("gray-merino", "Gray Merino Crew", "top", "gray", "business-casual", "warm", "fall", ["comfortable", "layering"], "", "#737373"),
    item("black-knit", "Black Knit Polo", "top", "black", "smart-casual", "light", "summer", ["modern", "travel"], "", "#171717"),
    item("charcoal-trouser", "Charcoal Trousers", "bottom", "charcoal", "business-formal", "medium", "all", ["classic", "tailored"], "", "#3f3f46"),
    item("navy-trouser", "Navy Trousers", "bottom", "navy", "business-casual", "medium", "all", ["versatile", "stretch"], "", "#24324f"),
    item("olive-chinos", "Olive Chinos", "bottom", "green", "business-casual", "medium", "all", ["relaxed", "stretch"], "", "#556b2f"),
    item("black-oxfords", "Black Oxfords", "shoe", "black", "business-formal", "medium", "all", ["client-meeting", "polished"], "", "#111827"),
    item("brown-loafers", "Brown Loafers", "shoe", "brown", "business-casual", "medium", "all", ["comfortable", "polished"], "", "#6b3f24"),
    item("white-sneakers", "Clean White Sneakers", "shoe", "white", "smart-casual", "light", "all", ["casual", "comfortable"], "", "#f5f5f4"),
    item("burgundy-tie", "Silk Dot Tie", "accessory", "burgundy", "business-formal", "light", "all", ["accent", "classic"], "", "#7f1d1d"),
    item("silver-watch", "Silver Watch", "accessory", "gray", "business-casual", "light", "all", ["minimal", "polished"], "", "#a3a3a3"),
    item("navy-scarf", "Navy Scarf", "accessory", "navy", "business-casual", "warm", "winter", ["cold", "commute"], "", "#1e3a8a")
  ];

  function item(id, name, category, color, formality, warmth, season, tags, lastWorn, swatch) {
    return {
      id: `item-${id}`,
      name,
      category,
      color,
      formality,
      warmth,
      season,
      tags,
      lastWorn,
      swatch
    };
  }

  function read(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    return value;
  }

  function ensureSeeded() {
    if (!localStorage.getItem(KEYS.profile)) {
      write(KEYS.profile, DEFAULT_PROFILE);
    }
    if (!localStorage.getItem(KEYS.wardrobe)) {
      write(KEYS.wardrobe, SEEDED_WARDROBE);
    }
    if (!localStorage.getItem(KEYS.history)) {
      write(KEYS.history, []);
    }
  }

  function getProfile() {
    ensureSeeded();
    return read(KEYS.profile, DEFAULT_PROFILE);
  }

  function saveProfile(profile) {
    return write(KEYS.profile, { ...DEFAULT_PROFILE, ...profile });
  }

  function getWardrobe() {
    ensureSeeded();
    return read(KEYS.wardrobe, SEEDED_WARDROBE);
  }

  function saveWardrobe(items) {
    return write(KEYS.wardrobe, items);
  }

  function getHistory() {
    ensureSeeded();
    return read(KEYS.history, []);
  }

  function saveHistory(history) {
    return write(KEYS.history, history);
  }

  function upsertWardrobeItem(item) {
    const items = getWardrobe();
    const normalized = normalizeItem(item);
    const index = items.findIndex((existing) => existing.id === normalized.id);
    if (index >= 0) {
      items[index] = normalized;
    } else {
      items.push(normalized);
    }
    saveWardrobe(items);
    return normalized;
  }

  function recordWear(outfitRecord) {
    const history = getHistory();
    const record = {
      wornAt: new Date().toISOString(),
      eventId: outfitRecord.eventId || "",
      itemIds: outfitRecord.itemIds || [],
      recommendationId: outfitRecord.recommendationId || outfitRecord.id || ""
    };
    history.unshift(record);
    saveHistory(history.slice(0, 40));
    const wornSet = new Set(record.itemIds);
    saveWardrobe(getWardrobe().map((item) => (
      wornSet.has(item.id) ? { ...item, lastWorn: record.wornAt } : item
    )));
    return record;
  }

  function resetDemoData() {
    write(KEYS.profile, DEFAULT_PROFILE);
    write(KEYS.wardrobe, SEEDED_WARDROBE);
    write(KEYS.history, []);
    return { profile: DEFAULT_PROFILE, wardrobe: SEEDED_WARDROBE, history: [] };
  }

  function importWardrobeCsv(csvText) {
    const rows = parseCsv(csvText);
    if (rows.length < 2) {
      return { ok: false, message: "CSV needs a header row and at least one item.", items: [] };
    }
    const headers = rows[0].map((header) => header.trim());
    const nameIndex = headers.indexOf("name");
    const categoryIndex = headers.indexOf("category");
    if (nameIndex < 0 || categoryIndex < 0) {
      return { ok: false, message: "CSV must include name and category columns.", items: [] };
    }

    const imported = [];
    const errors = [];
    rows.slice(1).forEach((row, index) => {
      if (row.every((cell) => !cell.trim())) return;
      const record = Object.fromEntries(headers.map((header, i) => [header, row[i] || ""]));
      if (!record.name.trim() || !record.category.trim()) {
        errors.push(`Row ${index + 2} is missing name or category.`);
        return;
      }
      imported.push(normalizeItem(record));
    });

    if (errors.length > 0) {
      return { ok: false, message: errors.join(" "), items: [] };
    }
    const byId = new Map(getWardrobe().map((existing) => [existing.id, existing]));
    imported.forEach((entry) => byId.set(entry.id, entry));
    saveWardrobe(Array.from(byId.values()));
    return { ok: true, message: `${imported.length} wardrobe items imported.`, items: imported };
  }

  function normalizeItem(raw) {
    const name = String(raw.name || "Wardrobe Item").trim();
    const category = String(raw.category || "top").trim();
    const tags = Array.isArray(raw.tags)
      ? raw.tags
      : String(raw.tags || "").split("|").map((tag) => tag.trim()).filter(Boolean);
    return {
      id: raw.id || `item-${slug(name)}`,
      name,
      category,
      color: String(raw.color || "neutral").trim(),
      formality: String(raw.formality || "smart-casual").trim(),
      warmth: String(raw.warmth || "medium").trim(),
      season: String(raw.season || "all").trim(),
      tags,
      lastWorn: String(raw.lastWorn || "").trim(),
      swatch: String(raw.swatch || "#9ca3af").trim()
    };
  }

  function parseCsv(text) {
    const rows = [];
    let current = "";
    let row = [];
    let inQuotes = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];
      if (char === "\"" && next === "\"") {
        current += "\"";
        i += 1;
      } else if (char === "\"") {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        row.push(current);
        current = "";
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && next === "\n") i += 1;
        row.push(current);
        rows.push(row);
        row = [];
        current = "";
      } else {
        current += char;
      }
    }
    row.push(current);
    rows.push(row);
    return rows.filter((cells) => cells.some((cell) => cell.trim()));
  }

  function slug(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || crypto.randomUUID();
  }

  window.FitVectorStore = {
    getProfile,
    saveProfile,
    getWardrobe,
    saveWardrobe,
    upsertWardrobeItem,
    importWardrobeCsv,
    getHistory,
    saveHistory,
    recordWear,
    resetDemoData
  };
}());
