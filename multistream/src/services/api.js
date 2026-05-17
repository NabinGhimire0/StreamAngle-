const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

function getAuthHeaders() {
  const token = localStorage.getItem("streamangle_token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// ---------- Auth ----------
export async function login(email, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");
  return data;
}

export async function register(email, password) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Registration failed");
  return data;
}

// ---------- Events ----------
export async function createEvent(name, description = "") {
  const res = await fetch(`${API_BASE}/api/events`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ name, description }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to create event");
  return data;
}

export async function getEvents() {
  const res = await fetch(`${API_BASE}/api/events`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch events");
  return data;
}

export async function updateEvent(id, updates) {
  const res = await fetch(`${API_BASE}/api/events/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to update event");
  return data;
}

export async function deleteEvent(id) {
  const res = await fetch(`${API_BASE}/api/events/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to delete event");
  return data;
}

// ---------- Overlays ----------
export async function createOverlay(eventId, overlay) {
  const res = await fetch(`${API_BASE}/api/overlays`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ event_id: eventId, ...overlay }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to create overlay");
  return data;
}

export async function getOverlays(eventId) {
  const res = await fetch(`${API_BASE}/api/overlays?event_id=${eventId}`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch overlays");
  return data;
}

export async function updateOverlay(id, updates) {
  const res = await fetch(`${API_BASE}/api/overlays/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to update overlay");
  return data;
}

export async function deleteOverlay(id) {
  const res = await fetch(`${API_BASE}/api/overlays/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to delete overlay");
  return data;
}

// ---------- Stream Destinations ----------
export async function addDestination(eventId, destination) {
  const res = await fetch(`${API_BASE}/api/destinations`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ event_id: eventId, ...destination }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to add destination");
  return data;
}

export async function getDestinations(eventId) {
  const res = await fetch(`${API_BASE}/api/destinations?event_id=${eventId}`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch destinations");
  return data;
}

export async function updateDestination(id, updates) {
  const res = await fetch(`${API_BASE}/api/destinations/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to update destination");
  return data;
}

export async function deleteDestination(id) {
  const res = await fetch(`${API_BASE}/api/destinations/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to delete destination");
  return data;
}

// ---------- RTMP Streaming ----------
export async function startRTMPStream(eventId) {
  const res = await fetch(`${API_BASE}/api/stream/start`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ event_id: eventId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to start stream");
  return data;
}

export async function sendStreamChunk(chunk) {
  const token = localStorage.getItem("streamangle_token");
  const res = await fetch(`${API_BASE}/api/stream/chunk`, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      Authorization: `Bearer ${token}`,
    },
    body: chunk,
  });
  if (!res.ok) throw new Error("Failed to send chunk");
  return true;
}

export async function stopRTMPStream(eventId) {
  const res = await fetch(`${API_BASE}/api/stream/stop`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ event_id: eventId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to stop stream");
  return data;
}

export const api = {
  login,
  register,
  createEvent,
  getEvents,
  updateEvent,
  deleteEvent,
  createOverlay,
  getOverlays,
  updateOverlay,
  deleteOverlay,
  addDestination,
  getDestinations,
  updateDestination,
  deleteDestination,
  startRTMPStream,
  sendStreamChunk,
  stopRTMPStream,
};