// Determine API base dynamically:
// 1. If running in browser on localhost or local network, default to relative "/api" so Vite proxy handles it cleanly.
// 2. If VITE_API_URL is explicitly set and not on localhost browser, or for mobile apps, use configured URL.
const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    // When running in local browser, prefer relative /api proxy to avoid network IP mismatches
    return "/api";
  }
  return envUrl || "/api";
};

const BASE = getBaseUrl();

async function request(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new Error("Unable to connect to the server. Please ensure the backend is running on port 4000.");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (data.error) throw new Error(data.error);
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      throw new Error("Backend server is not responding (port 4000). Please make sure backend is running.");
    }
    if (res.status === 404) {
      throw new Error("API route not found.");
    }
    throw new Error("Server error occurred. Please try again.");
  }
  return data;
}

export const api = {
  // auth
  register: (body) => request("/auth/register", { method: "POST", body }),
  login: (body) => request("/auth/login", { method: "POST", body }),
  me: (token) => request("/auth/me", { token }),

  // contacts
  getContacts: (token) => request("/contacts", { token }),
  addContact: (token, body) => request("/contacts", { method: "POST", body, token }),
  removeContact: (token, id) => request(`/contacts/${id}`, { method: "DELETE", token }),

  // sos
  triggerSos: (token, body) => request("/sos/trigger", { method: "POST", body, token }),
  resolveSos: (token, id) => request(`/sos/${id}/resolve`, { method: "POST", token }),
  sosHistory: (token) => request("/sos/history", { token }),
  activeSos: (token) => request("/sos/active", { token }),

  // location
  postLocation: (token, body) => request("/location", { method: "POST", body, token }),
  latestLocation: (token) => request("/location/latest", { token }),
  locationTrail: (token) => request("/location/trail", { token }),
  getShareToken: (token) => request("/location/share-token", { method: "POST", token }),
  publicTrack: (shareToken) => request(`/location/public-track/${shareToken}`),

  // unsafe areas
  getUnsafeAreas: (token, params = {}) => {
    const query = new URLSearchParams();
    if (params.lat != null && params.lat !== "") query.append("lat", params.lat);
    if (params.lng != null && params.lng !== "") query.append("lng", params.lng);
    if (params.radiusKm != null && params.radiusKm !== "") query.append("radiusKm", params.radiusKm);
    const qs = query.toString();
    return request(`/unsafe-areas${qs ? `?${qs}` : ""}`, { token });
  },
  reportUnsafeArea: (token, body) => request("/unsafe-areas", { method: "POST", body, token }),
  upvoteUnsafeArea: (token, id) => request(`/unsafe-areas/${id}/upvote`, { method: "POST", token }),

  // battery
  postBattery: (token, body) => request("/battery", { method: "POST", body, token }),
  latestBattery: (token) => request("/battery/latest", { token }),
  batteryHistory: (token) => request("/battery/history", { token }),

  // period tracker
  getPeriodLogs: (token) => request("/period-tracker", { token }),
  addPeriodLog: (token, body) => request("/period-tracker", { method: "POST", body, token }),
  deletePeriodLog: (token, id) => request(`/period-tracker/${id}`, { method: "DELETE", token }),

  // safety timer
  startTimer: (token, body) => request("/safety-timer/start", { method: "POST", body, token }),
  checkinTimer: (token, id) => request(`/safety-timer/${id}/checkin`, { method: "POST", token }),
  expireTimer: (token, id, body) => request(`/safety-timer/${id}/expire`, { method: "POST", body, token }),
  activeTimer: (token) => request("/safety-timer/active", { token }),
  timerHistory: (token) => request("/safety-timer/history", { token }),

  // fall detection
  reportFall: (token, body) => request("/fall-detection", { method: "POST", body, token }),
  imOk: (token, id) => request(`/fall-detection/${id}/im-ok`, { method: "POST", token }),
  fallHistory: (token) => request("/fall-detection/history", { token }),

  // wearable
  getDevices: (token) => request("/wearable", { token }),
  pairDevice: (token, body) => request("/wearable/pair", { method: "POST", body, token }),
  syncDevice: (token, id, body) => request(`/wearable/${id}/sync`, { method: "POST", body, token }),
  unpairDevice: (token, id) => request(`/wearable/${id}`, { method: "DELETE", token }),

  // ai risk
  scoreLocation: (token, body) => request("/ai-risk/score", { method: "POST", body, token }),
  safeRoute: (token, body) => request("/ai-risk/safe-route", { method: "POST", body, token }),
  checkUnsafeBreach: (token, body) => request("/ai-risk/check-unsafe-breach", { method: "POST", body, token }),

  // ai assistant
  chatHistory: (token) => request("/ai-assistant/history", { token }),
  sendChatMessage: (token, body) => request("/ai-assistant/message", { method: "POST", body, token }),

  // emergency numbers
  emergencyNumbers: () => request("/emergency-numbers"),

  // admin
  adminBootstrap: (body) => request("/admin/bootstrap", { method: "POST", body }),
  adminLogin: (body) => request("/admin/login", { method: "POST", body }),
  adminOverview: (token) => request("/admin/overview", { token }),
  adminUsers: (token) => request("/admin/users", { token }),
  adminSosEvents: (token) => request("/admin/sos-events", { token }),
  adminUnsafeAreas: (token) => request("/admin/unsafe-areas", { token })
};
