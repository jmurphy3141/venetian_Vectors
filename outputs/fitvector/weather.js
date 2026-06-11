(function () {
  const CITIES = {
    chicago: { key: "chicago", label: "Chicago", latitude: 41.8781, longitude: -87.6298 },
    austin: { key: "austin", label: "Austin", latitude: 30.2672, longitude: -97.7431 },
    "new-york": { key: "new-york", label: "New York", latitude: 40.7128, longitude: -74.0060 },
    seattle: { key: "seattle", label: "Seattle", latitude: 47.6062, longitude: -122.3321 },
    phoenix: { key: "phoenix", label: "Phoenix", latitude: 33.4484, longitude: -112.0740 }
  };

  const FALLBACK = {
    chicago: weather("Chicago", 78, 80, 0.01, 1, 9, "Mild and mostly clear"),
    austin: weather("Austin", 91, 95, 0, 2, 11, "Hot and bright"),
    "new-york": weather("New York", 74, 76, 0.08, 61, 13, "Mild with light rain risk"),
    seattle: weather("Seattle", 64, 63, 0.04, 3, 8, "Cool and cloudy"),
    phoenix: weather("Phoenix", 102, 101, 0, 0, 7, "Very hot and dry")
  };

  function getCities() {
    return Object.values(CITIES).map((city) => ({ ...city }));
  }

  async function getWeather(cityKey) {
    const city = CITIES[cityKey] || CITIES.chicago;
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", city.latitude);
    url.searchParams.set("longitude", city.longitude);
    url.searchParams.set("current", "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m");
    url.searchParams.set("temperature_unit", "fahrenheit");
    url.searchParams.set("wind_speed_unit", "mph");
    url.searchParams.set("precipitation_unit", "inch");
    url.searchParams.set("timezone", "auto");

    try {
      const response = await fetch(url.toString(), { cache: "no-store" });
      if (!response.ok) throw new Error(`Weather status ${response.status}`);
      const json = await response.json();
      const current = json.current || {};
      return {
        city: city.label,
        source: "open-meteo",
        isFallback: false,
        temperatureF: number(current.temperature_2m, FALLBACK[city.key].temperatureF),
        apparentTemperatureF: number(current.apparent_temperature, FALLBACK[city.key].apparentTemperatureF),
        precipitationIn: number(current.precipitation, FALLBACK[city.key].precipitationIn),
        weatherCode: number(current.weather_code, FALLBACK[city.key].weatherCode),
        windSpeedMph: number(current.wind_speed_10m, FALLBACK[city.key].windSpeedMph),
        summary: summarize(number(current.weather_code, 1), number(current.apparent_temperature, 72))
      };
    } catch {
      return { ...FALLBACK[city.key], isFallback: true, source: "demo-fallback" };
    }
  }

  function weather(city, temperatureF, apparentTemperatureF, precipitationIn, weatherCode, windSpeedMph, summary) {
    return {
      city,
      source: "demo-fallback",
      isFallback: true,
      temperatureF,
      apparentTemperatureF,
      precipitationIn,
      weatherCode,
      windSpeedMph,
      summary
    };
  }

  function summarize(code, apparent) {
    if ([61, 63, 65, 80, 81, 82].includes(code)) return "Rain likely";
    if ([71, 73, 75, 85, 86].includes(code)) return "Snow or wintry mix";
    if (apparent >= 90) return "Hot";
    if (apparent <= 45) return "Cold";
    if ([0, 1].includes(code)) return "Clear to mostly clear";
    if ([2, 3].includes(code)) return "Partly cloudy";
    return "Current conditions";
  }

  function number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  window.FitVectorWeather = {
    getCities,
    getWeather
  };
}());
