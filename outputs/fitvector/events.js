(function () {
  const EVENTS = [
    {
      id: "event-client-review",
      title: "Client Review",
      startsAt: "2026-06-11T13:30:00-05:00",
      city: "chicago",
      type: "client-meeting",
      formality: "business-formal",
      setting: "indoor",
      notes: "Polished, practical, camera-ready."
    },
    {
      id: "event-team-onsite",
      title: "Team Onsite",
      startsAt: "2026-06-12T09:00:00-05:00",
      city: "austin",
      type: "workshop",
      formality: "business-casual",
      setting: "indoor",
      notes: "Long day, movement between rooms, approachable polish."
    },
    {
      id: "event-rooftop-dinner",
      title: "Rooftop Dinner",
      startsAt: "2026-06-12T19:00:00-05:00",
      city: "new-york",
      type: "dinner",
      formality: "smart-casual",
      setting: "outdoor",
      notes: "Elevated but relaxed; weather matters."
    }
  ];

  function getEvents() {
    return EVENTS.map((event) => ({ ...event }));
  }

  window.FitVectorDemoData = {
    getEvents
  };
}());
