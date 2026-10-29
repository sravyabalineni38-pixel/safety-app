import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";
import { getCurrentLocation } from "../utils/location.js";
import { reverseGeocode, searchPlace } from "../utils/geocoding.js";
import UnsafeAreasMap from "../components/UnsafeAreasMap.jsx";

const CATEGORIES = [
  "Poor lighting",
  "Harassment reported",
  "Isolated / empty area",
  "No CCTV",
  "Stray animals",
  "Other"
];

export default function UnsafeAreas() {
  const { token } = useAuth();

  // Location state
  const [placeName, setPlaceName] = useState("");
  const [coords, setCoords] = useState({ lat: "", lng: "" });
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);

  // Optional route destination check
  const [showRouteCheck, setShowRouteCheck] = useState(false);
  const [destName, setDestName] = useState("");
  const [destCoords, setDestCoords] = useState({ lat: "", lng: "" });
  const [routeData, setRouteData] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // Safety & Hazard assessment state
  const [riskAssessment, setRiskAssessment] = useState(null); // { score, level, nearbyReports, reports }
  const [evaluatingSafety, setEvaluatingSafety] = useState(false);

  // Voice announcement state
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [lastSpokenText, setLastSpokenText] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Reports state
  const [reports, setReports] = useState([]);
  const [filterRadius, setFilterRadius] = useState("all_nearby"); // all_nearby | critical_1km | 3km | all

  // Report submission form state
  const [form, setForm] = useState({
    lat: "",
    lng: "",
    category: CATEGORIES[0],
    description: "",
    severity: "medium"
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reference to avoid duplicate speech triggers
  const lastEvaluatedKey = useRef("");

  // Speak voice announcement
  const speakAdvisory = useCallback((text) => {
    if (!voiceEnabled || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setLastSpokenText(text);
    } catch (e) {
      console.warn("Speech synthesis error:", e);
    }
  }, [voiceEnabled]);

  // Load all reports or nearby reports
  const loadReports = useCallback(async (currentLat, currentLng) => {
    try {
      const params = {};
      if (currentLat && currentLng) {
        params.lat = currentLat;
        params.lng = currentLng;
      }
      const { reports: resReports } = await api.getUnsafeAreas(token, params);
      setReports(resReports || []);
      return resReports || [];
    } catch (e) {
      console.error("Failed to load reports:", e);
      return [];
    }
  }, [token]);

  // Initial load
  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Automatic safety evaluation whenever coordinates change
  const evaluateLocationSafety = useCallback(
    async (latVal, lngVal, placeStr = "") => {
      const latNum = Number(latVal);
      const lngNum = Number(lngVal);
      if (isNaN(latNum) || isNaN(lngNum) || !latVal || !lngVal) return;

      const evalKey = `${latNum.toFixed(4)}_${lngNum.toFixed(4)}`;
      if (evalKey === lastEvaluatedKey.current) return;
      lastEvaluatedKey.current = evalKey;

      setEvaluatingSafety(true);
      try {
        // 1. Fetch nearby reports with distance calculations
        const fetchedReports = await loadReports(latNum, lngNum);

        // 2. Fetch AI Risk Score
        const scoreRes = await api.scoreLocation(token, { lat: latNum, lng: lngNum });

        // Filter reports within 1 km for immediate danger notice
        const nearbyWithin1Km = fetchedReports.filter(
          (r) => r.distanceKm != null && r.distanceKm <= 1.0
        );
        const nearestReport = fetchedReports.length > 0 ? fetchedReports[0] : null;

        const assessment = {
          score: scoreRes.score,
          level: scoreRes.level,
          nearbyWithin1KmCount: nearbyWithin1Km.length,
          nearestReport,
          totalNearby: fetchedReports.length
        };
        setRiskAssessment(assessment);

        // 3. Voice Announcement: "Outomatic gaa cheppali"
        let speechMessage = "";
        const locationLabel = placeStr || "your location";

        if (nearbyWithin1Km.length > 0) {
          const nearestDistMeters = nearestReport?.distanceMeters || Math.round((nearestReport?.distanceKm || 0) * 1000);
          speechMessage = `Safety Alert for ${locationLabel}! Warning: ${nearbyWithin1Km.length} unsafe ${nearbyWithin1Km.length === 1 ? "area" : "areas"} reported within one kilometer. Nearest hazard is ${nearestReport?.category || "an unsafe spot"} at ${nearestDistMeters} meters away. Please exercise caution!`;
        } else if (assessment.level === "high" || assessment.score >= 50) {
          speechMessage = `Warning! High risk score detected near ${locationLabel}. Please stay on well-lit main roads.`;
        } else if (assessment.level === "medium") {
          speechMessage = `Moderate safety risk detected near ${locationLabel}. Stay aware of your surroundings.`;
        } else {
          speechMessage = `Location verified for ${locationLabel}. No unsafe areas reported nearby. This area is safe.`;
        }

        speakAdvisory(speechMessage);
      } catch (err) {
        console.error("Safety evaluation failed:", err);
      } finally {
        setEvaluatingSafety(false);
      }
    },
    [loadReports, token, speakAdvisory]
  );

  // Set coordinates and automatically trigger safety evaluation
  const setLocation = useCallback(
    (lat, lng, name = "") => {
      setCoords({ lat, lng });
      setForm((prev) => ({ ...prev, lat, lng }));
      if (name) setPlaceName(name);
      evaluateLocationSafety(lat, lng, name);
    },
    [evaluateLocationSafety]
  );

  // Auto-fetch user's GPS on first render if available
  useEffect(() => {
    let mounted = true;
    getCurrentLocation()
      .then(async (loc) => {
        if (!mounted || !loc.lat || !loc.lng) return;
        const geocode = await reverseGeocode(Number(loc.lat), Number(loc.lng));
        if (mounted) {
          setLocation(loc.lat, loc.lng, geocode.placeName);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [setLocation]);

  // "Use my location" button click handler
  async function handleUseMyLocation() {
    setLocating(true);
    setError("");
    try {
      const loc = await getCurrentLocation();
      if (loc.lat && loc.lng) {
        const geocode = await reverseGeocode(Number(loc.lat), Number(loc.lng));
        setLocation(loc.lat, loc.lng, geocode.placeName);
      }
      if (loc.error) {
        setError(loc.error);
      }
    } catch (e) {
      setError("Could not retrieve live location. Please search or enter coordinates.");
    } finally {
      setLocating(false);
    }
  }

  // Search Place Name (e.g., "Ongole", "Maddipadu", "Kurnool")
  async function handleSearchPlace() {
    if (!placeName.trim()) return;
    setSearching(true);
    setError("");
    try {
      const results = await searchPlace(placeName);
      if (results && results.length > 0) {
        const best = results[0];
        setLocation(best.lat, best.lng, best.placeName);
      } else {
        setError(`No location found for "${placeName}". Please enter latitude/longitude.`);
      }
    } catch (e) {
      setError("Failed to search location.");
    } finally {
      setSearching(false);
    }
  }

  // Automatic Route Safety Evaluation (if destination is provided)
  async function handleAnalyzeRoute(e) {
    if (e) e.preventDefault();
    if (!coords.lat || !coords.lng) {
      setError("Please set a starting location first.");
      return;
    }

    let endLat = Number(destCoords.lat);
    let endLng = Number(destCoords.lng);

    setRouteLoading(true);
    setError("");

    try {
      if ((!endLat || !endLng) && destName.trim()) {
        const res = await searchPlace(destName);
        if (res.length > 0) {
          endLat = res[0].lat;
          endLng = res[0].lng;
          setDestCoords({ lat: endLat, lng: endLng });
        }
      }

      if (!endLat || !endLng) {
        setError("Please enter a valid destination location or coordinates.");
        setRouteLoading(false);
        return;
      }

      const res = await api.safeRoute(token, {
        origin: { lat: Number(coords.lat), lng: Number(coords.lng) },
        destination: { lat: endLat, lng: endLng }
      });
      setRouteData(res);

      // Speak route status
      let routeSpeech = "";
      if (res.directRoute?.isUnsafe) {
        routeSpeech = `Route analysis complete: Warning! The direct path to ${destName || "destination"} passes through high-risk unsafe spots. An AI-calculated safe detour has been prepared.`;
      } else {
        routeSpeech = `Route analysis complete: The route to ${destName || "destination"} is clear of major reported hazards and appears safe for travel.`;
      }
      speakAdvisory(routeSpeech);
    } catch (err) {
      setError(err.message || "Route calculation failed.");
    } finally {
      setRouteLoading(false);
    }
  }

  // Submit new report
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      await api.reportUnsafeArea(token, {
        ...form,
        lat: Number(form.lat),
        lng: Number(form.lng)
      });
      setSuccess("Thank you! Report saved — this immediately updates the safety map and AI routing.");
      setForm((prev) => ({
        ...prev,
        category: CATEGORIES[0],
        description: "",
        severity: "medium"
      }));

      // Refresh reports and re-evaluate
      const updated = await loadReports(coords.lat, coords.lng);
      if (coords.lat && coords.lng) {
        lastEvaluatedKey.current = ""; // Reset to re-evaluate
        evaluateLocationSafety(coords.lat, coords.lng, placeName);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Upvote report
  async function handleUpvote(id) {
    try {
      await api.upvoteUnsafeArea(token, id);
      loadReports(coords.lat, coords.lng);
    } catch (err) {
      console.error("Upvote failed:", err);
    }
  }

  // Filter reports according to selected tab
  const displayedReports = reports.filter((r) => {
    if (filterRadius === "critical_1km") {
      return r.distanceKm != null ? r.distanceKm <= 1.0 : true;
    }
    if (filterRadius === "3km") {
      return r.distanceKm != null ? r.distanceKm <= 3.0 : true;
    }
    return true; // all_nearby or all
  });

  return (
    <div className="space-y-6 max-w-4xl pb-12">
      {/* Page Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">⚠️</span>
            <h1 className="font-display text-2xl font-bold tracking-tight">Unsafe Area & Route Safety Scanner</h1>
          </div>
          <p className="text-slate-400 text-sm">
            Enter any location or use GPS — Guardian <strong className="text-violet-300">automatically detects</strong> unsafe areas, speaks audio warnings, and highlights nearby hazards in real time.
          </p>
        </div>

        {/* Voice Announcement Toggle */}
        <button
          type="button"
          onClick={() => {
            if (voiceEnabled) {
              window.speechSynthesis?.cancel();
              setVoiceEnabled(false);
            } else {
              setVoiceEnabled(true);
              if (lastSpokenText) speakAdvisory(lastSpokenText);
            }
          }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
            voiceEnabled
              ? "bg-violet-500/20 text-violet-300 border-violet-500/40 shadow-sm"
              : "bg-white/5 text-slate-400 border-white/10 hover:text-slate-200"
          }`}
          title="Toggle automatic voice warning speech"
        >
          <span>{voiceEnabled ? "🔊 Voice Alerts: ON" : "🔇 Voice Alerts: OFF"}</span>
          {isSpeaking && <span className="w-2 h-2 rounded-full bg-violet-400 animate-ping"></span>}
        </button>
      </div>

      {/* 1. Location Input & Automatic Scan Card */}
      <div className="card p-5 space-y-4 border border-violet-500/20 shadow-xl bg-night-900/90">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <span>📍</span>
            <span>Check Location (Auto-scans nearby hazards)</span>
          </label>
          <button
            type="button"
            disabled={locating}
            onClick={handleUseMyLocation}
            className="text-xs bg-violet-600/30 hover:bg-violet-600/50 text-violet-300 border border-violet-500/30 px-3 py-1.5 rounded-lg disabled:opacity-50 flex items-center gap-1.5 transition font-medium"
          >
            <span>{locating ? "🛰️ Detecting GPS…" : "📍 Use My Live Location"}</span>
          </button>
        </div>

        {/* Place search input */}
        <div className="flex gap-2">
          <input
            className="input flex-1 text-sm placeholder:text-slate-500"
            placeholder="Type place name, area, or landmark (e.g. Ongole, Maddipadu, RTC Bus Stand)"
            value={placeName}
            onChange={(e) => setPlaceName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearchPlace()}
          />
          <button
            type="button"
            disabled={searching}
            onClick={handleSearchPlace}
            className="btn-secondary text-xs px-4 text-slate-200 font-semibold"
          >
            {searching ? "Searching…" : "🔍 Scan Place"}
          </button>
        </div>

        {/* Coordinates grid (automatically updated) */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Latitude</label>
            <input
              className="input py-2 text-xs font-mono"
              placeholder="e.g. 15.4793"
              value={coords.lat}
              onChange={(e) => setLocation(e.target.value, coords.lng, placeName)}
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Longitude</label>
            <input
              className="input py-2 text-xs font-mono"
              placeholder="e.g. 80.0199"
              value={coords.lng}
              onChange={(e) => setLocation(coords.lat, e.target.value, placeName)}
            />
          </div>
        </div>

        {/* Quick Place Chips for Instant Testing */}
        <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
          <span className="text-slate-400 text-[11px]">Quick picks:</span>
          {[
            { name: "Ongole", lat: 15.4793, lng: 80.0198 },
            { name: "Maddipadu", lat: 15.632, lng: 80.015 },
            { name: "Guntur", lat: 16.3067, lng: 80.4365 },
            { name: "Vijayawada", lat: 16.5062, lng: 80.648 }
          ].map((item) => (
            <button
              key={item.name}
              type="button"
              onClick={() => setLocation(item.lat, item.lng, item.name)}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 transition text-[11px]"
            >
              📍 {item.name}
            </button>
          ))}
        </div>

        {/* Toggle Route Navigation Check */}
        <div className="pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={() => setShowRouteCheck(!showRouteCheck)}
            className="text-xs text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1.5 transition"
          >
            <span>{showRouteCheck ? "▼ Hide Route Hazard Checker" : "▶ Also Check Hazards Along My Route / Destination"}</span>
          </button>

          {showRouteCheck && (
            <div className="mt-3 p-4 rounded-xl bg-night-950/60 border border-white/5 space-y-3 animate-fade-in">
              <p className="text-xs text-slate-300">
                Enter your travel destination to scan if your travel route passes through any unsafe reported areas:
              </p>
              <div className="flex gap-2">
                <input
                  className="input flex-1 text-xs"
                  placeholder="Destination Name (e.g. Maddipadu or College Road)"
                  value={destName}
                  onChange={(e) => setDestName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAnalyzeRoute(e)}
                />
                <button
                  type="button"
                  disabled={routeLoading}
                  onClick={handleAnalyzeRoute}
                  className="btn-primary text-xs px-4"
                >
                  {routeLoading ? "Analyzing Route…" : "🛣️ Scan Route Hazards"}
                </button>
              </div>

              {routeData && (
                <div className={`p-3 rounded-xl border text-xs space-y-2 ${
                  routeData.directRoute?.isUnsafe
                    ? "bg-rose-950/30 border-rose-500/40 text-rose-200"
                    : "bg-emerald-950/30 border-emerald-500/40 text-emerald-200"
                }`}>
                  <div className="flex items-center justify-between font-semibold">
                    <span>{routeData.recommendation}</span>
                    <span className="px-2 py-0.5 rounded text-[11px] bg-white/10 font-mono">
                      Risk: {routeData.avgRiskScore}/100
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-slate-300">AI Safe Route plotted on map below avoiding hazards.</span>
                    <Link
                      to="/safe-route"
                      className="underline font-semibold text-violet-300 hover:text-violet-200"
                    >
                      Open Full Safe Navigation →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. AUTOMATIC SAFETY & HAZARD ASSESSMENT CARD ("Outomatic gaa cheppali") */}
      {coords.lat && coords.lng && (
        <div className={`card p-5 border shadow-2xl transition-all ${
          evaluatingSafety
            ? "border-violet-500/30 bg-night-800"
            : riskAssessment?.level === "high" || (riskAssessment?.score || 0) >= 50
            ? "border-rose-500/50 bg-rose-950/20 shadow-rose-900/20"
            : riskAssessment?.level === "medium" || (riskAssessment?.score || 0) >= 25
            ? "border-amber-500/50 bg-amber-950/20 shadow-amber-900/20"
            : "border-teal-500/50 bg-teal-950/20 shadow-teal-900/20"
        }`}>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3.5 w-3.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  riskAssessment?.level === "high" ? "bg-rose-400" : riskAssessment?.level === "medium" ? "bg-amber-400" : "bg-teal-400"
                }`}></span>
                <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${
                  riskAssessment?.level === "high" ? "bg-rose-500" : riskAssessment?.level === "medium" ? "bg-amber-500" : "bg-teal-500"
                }`}></span>
              </span>
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                  {evaluatingSafety ? "Scanning Area Safety…" : "Live Area Risk Assessment"}
                </span>
                <h3 className="font-display text-lg font-bold">
                  {evaluatingSafety
                    ? "Analyzing nearby reports & hazards…"
                    : riskAssessment?.level === "high"
                    ? "🚨 High Danger / Unsafe Area Warning"
                    : riskAssessment?.level === "medium"
                    ? "⚠️ Moderate Caution Area"
                    : "🟢 Safe Area (No Major Hazards)"}
                </h3>
              </div>
            </div>

            {/* Replay Voice Announcement Button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (lastSpokenText) speakAdvisory(lastSpokenText);
                }}
                className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 hover:bg-violet-600/20 text-slate-200"
                title="Speak safety advisory aloud"
              >
                <span>🔊 Listen Voice Advisory</span>
              </button>
              {riskAssessment?.level === "high" && (
                <Link
                  to="/"
                  className="px-3 py-1.5 rounded-xl bg-coral-500 hover:bg-coral-600 text-white font-semibold text-xs shadow-glow-coral flex items-center gap-1 transition"
                >
                  <span>🆘 Emergency SOS</span>
                </Link>
              )}
            </div>
          </div>

          {/* Quick Metrics & Hazard Highlights */}
          {riskAssessment && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
              {/* Risk Score */}
              <div className="p-3 rounded-xl bg-night-900/80 border border-white/5 space-y-1">
                <span className="text-slate-400 text-[11px]">AI Area Risk Score</span>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-bold font-display ${
                    riskAssessment.level === "high" ? "text-rose-400" : riskAssessment.level === "medium" ? "text-amber-400" : "text-teal-400"
                  }`}>
                    {riskAssessment.score}
                  </span>
                  <span className="text-slate-500 font-mono">/ 100</span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      riskAssessment.level === "high" ? "bg-rose-500" : riskAssessment.level === "medium" ? "bg-amber-500" : "bg-teal-500"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(5, riskAssessment.score))}%` }}
                  ></div>
                </div>
              </div>

              {/* Hazards within 1 KM */}
              <div className="p-3 rounded-xl bg-night-900/80 border border-white/5 space-y-1">
                <span className="text-slate-400 text-[11px]">Unsafe Spots within 1 km</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-display text-slate-100">
                    {riskAssessment.nearbyWithin1KmCount}
                  </span>
                  <span className="text-slate-400">spots reported</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {riskAssessment.nearbyWithin1KmCount > 0
                    ? `⚠️ ${riskAssessment.nearbyWithin1KmCount} immediate hazards nearby!`
                    : "No immediate hazards within 1 km."}
                </p>
              </div>

              {/* Nearest Hazard */}
              <div className="p-3 rounded-xl bg-night-900/80 border border-white/5 space-y-1">
                <span className="text-slate-400 text-[11px]">Nearest Hazard Reported</span>
                {riskAssessment.nearestReport ? (
                  <div>
                    <p className="font-semibold text-slate-200 truncate">
                      {riskAssessment.nearestReport.category}
                    </p>
                    <p className="text-[11px] text-amber-300 font-medium">
                      ⚡{" "}
                      {riskAssessment.nearestReport.distanceMeters != null &&
                      riskAssessment.nearestReport.distanceMeters < 1000
                        ? `${riskAssessment.nearestReport.distanceMeters} meters away`
                        : `${riskAssessment.nearestReport.distanceKm} km away`}
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-2">None reported nearby</p>
                )}
              </div>
            </div>
          )}

          {/* Voice text banner */}
          {lastSpokenText && (
            <div className="mt-3 p-2.5 rounded-xl bg-violet-950/40 border border-violet-500/20 flex items-center gap-2 text-xs text-violet-200">
              <span>🔊</span>
              <span className="font-medium italic">"{lastSpokenText}"</span>
            </div>
          )}
        </div>
      )}

      {/* 3. Interactive Map (Visualizing Hazards & Route) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <span>🗺️</span>
            <span>Interactive Unsafe Spots Map</span>
          </h2>
          <span className="text-xs text-slate-400">
            {reports.length} total reports plotted
          </span>
        </div>
        <UnsafeAreasMap
          userLocation={{
            lat: coords.lat,
            lng: coords.lng,
            placeName: placeName || "Your Point"
          }}
          reports={reports}
          riskAssessment={riskAssessment}
          routeWaypoints={routeData?.waypoints || []}
          onLocationSelect={(clickedLat, clickedLng) => {
            setLocation(clickedLat, clickedLng, `${clickedLat.toFixed(4)}, ${clickedLng.toFixed(4)}`);
          }}
        />
      </div>

      {/* 4. Report a New Unsafe Spot Form */}
      <form onSubmit={handleSubmit} className="card p-5 space-y-4 border border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold flex items-center gap-2">
              <span>📢</span>
              <span>Report an Unsafe Spot</span>
            </h2>
            <p className="text-xs text-slate-400">
              Flag dark alleys, harassment spots, or hazards to keep other women and travelers safe.
            </p>
          </div>
          <button
            type="button"
            disabled={locating}
            onClick={handleUseMyLocation}
            className="text-xs text-violet-400 hover:text-violet-300 font-medium"
          >
            {locating ? "📍 Getting GPS…" : "📍 Set to My GPS"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Latitude</label>
            <input
              className="input font-mono text-sm"
              required
              placeholder="e.g. 15.4793"
              value={form.lat}
              onChange={(e) => setForm({ ...form, lat: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Longitude</label>
            <input
              className="input font-mono text-sm"
              required
              placeholder="e.g. 80.0199"
              value={form.lng}
              onChange={(e) => setForm({ ...form, lng: e.target.value })}
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Category</label>
            <select
              className="input"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Severity Level</label>
            <select
              className="input"
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value })}
            >
              <option value="low">Low (Minor inconvenience)</option>
              <option value="medium">Medium (Uncomfortable / Avoid at night)</option>
              <option value="high">High (Active danger / Urgent caution)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">What happened / Description (optional)</label>
          <textarea
            className="input"
            rows={2}
            placeholder="e.g. Very dark after 8 PM, streetlights not working, or isolated area"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        {error && <p className="text-coral-400 text-sm">{error}</p>}
        {success && <p className="text-teal-400 text-sm font-medium">{success}</p>}

        <button className="btn-primary w-full py-3" disabled={submitting}>
          {submitting ? "Submitting Report…" : "Submit Unsafe Area Report"}
        </button>
      </form>

      {/* 5. RECENT REPORTS NEARBY (Sorted by Proximity) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-display font-semibold text-lg flex items-center gap-2">
              <span>📋</span>
              <span>Recent Reports Nearby</span>
            </h3>
            <p className="text-xs text-slate-400">
              {coords.lat && coords.lng
                ? `Sorted by distance from ${placeName || `${Number(coords.lat).toFixed(4)}, ${Number(coords.lng).toFixed(4)}`}`
                : "Latest safety hazard reports from the community"}
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/5 text-xs">
            <button
              type="button"
              onClick={() => setFilterRadius("all_nearby")}
              className={`px-3 py-1 rounded-lg transition ${
                filterRadius === "all_nearby" ? "bg-violet-600 text-white font-medium" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All Nearby
            </button>
            <button
              type="button"
              onClick={() => setFilterRadius("critical_1km")}
              className={`px-3 py-1 rounded-lg transition ${
                filterRadius === "critical_1km" ? "bg-rose-600 text-white font-medium" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              ⚡ Critical (&lt; 1 km)
            </button>
            <button
              type="button"
              onClick={() => setFilterRadius("3km")}
              className={`px-3 py-1 rounded-lg transition ${
                filterRadius === "3km" ? "bg-violet-600 text-white font-medium" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              &lt; 3 km
            </button>
          </div>
        </div>

        {displayedReports.length === 0 && (
          <div className="card p-6 text-center text-slate-500 text-sm">
            <p className="text-2xl mb-1">🛡️</p>
            <p>No unsafe reports found within this range. The area looks clear!</p>
          </div>
        )}

        <div className="space-y-2.5">
          {displayedReports.map((r) => {
            const isVeryClose = r.distanceMeters != null && r.distanceMeters <= 500;
            const isWithin1Km = r.distanceKm != null && r.distanceKm <= 1.0;

            return (
              <div
                key={r.id}
                className={`card p-4 flex items-start justify-between gap-3 border transition hover:border-violet-500/30 ${
                  r.severity === "high" || isVeryClose
                    ? "border-rose-500/30 bg-night-800/90"
                    : "border-white/5"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <SeverityDot severity={r.severity} />
                    <p className="font-semibold text-sm text-slate-100">{r.category}</p>

                    {/* Distance Badge */}
                    {r.distanceMeters != null && (
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                          isVeryClose
                            ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                            : isWithin1Km
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                            : "bg-slate-700/40 text-slate-300 border-white/5"
                        }`}
                      >
                        📍 {r.distanceMeters < 1000 ? `${r.distanceMeters}m away` : `${r.distanceKm} km away`}
                        {isVeryClose && " (Immediate vicinity!)"}
                      </span>
                    )}

                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                      {r.severity} priority
                    </span>
                  </div>

                  {r.description && <p className="text-sm text-slate-300">{r.description}</p>}

                  <p className="text-xs text-slate-500 font-mono">
                    {r.lat.toFixed(4)}, {r.lng.toFixed(4)} · {new Date(r.createdAt).toLocaleString()}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleUpvote(r.id)}
                  className="btn-secondary text-xs shrink-0 px-3 py-2 flex items-center gap-1.5 hover:bg-violet-500/20"
                  title="Upvote / confirm this report"
                >
                  <span>👍</span>
                  <span>{r.upvotes || 0}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SeverityDot({ severity }) {
  const colors = {
    low: "bg-teal-400 ring-teal-400/30",
    medium: "bg-amber-400 ring-amber-400/30",
    high: "bg-rose-500 ring-rose-500/30"
  };
  return <span className={`w-2.5 h-2.5 rounded-full ring-2 ${colors[severity] || colors.medium}`} />;
}
