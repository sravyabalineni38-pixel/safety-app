import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";
import { getCurrentLocation } from "../utils/location.js";
import { reverseGeocode, searchPlace } from "../utils/geocoding.js";
import RealRouteMap from "../components/RealRouteMap.jsx";

export default function SafeRoute() {
  const { token } = useAuth();
  const [originName, setOriginName] = useState("");
  const [origin, setOrigin] = useState({ lat: "", lng: "" });
  
  const [destName, setDestName] = useState("");
  const [destination, setDestination] = useState({ lat: "", lng: "" });

  const [route, setRoute] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [locatingOrigin, setLocatingOrigin] = useState(false);
  const [locatingDest, setLocatingDest] = useState(false);

  // Sentinel Guard state
  const [isGuardActive, setIsGuardActive] = useState(false);
  const [breachAlert, setBreachAlert] = useState(null);
  const [testAlertStatus, setTestAlertStatus] = useState(null); // { ok, message }

  // Handle "Use my location" button click
  async function handleUseLocation(target) {
    if (target === "origin") setLocatingOrigin(true);
    else setLocatingDest(true);
    setNotice("");

    try {
      const loc = await getCurrentLocation();
      if (loc.lat && loc.lng) {
        // Reverse geocode to get city / location name (e.g. Ongole)
        const geocode = await reverseGeocode(loc.lat, loc.lng);
        if (target === "origin") {
          setOrigin({ lat: loc.lat, lng: loc.lng });
          setOriginName(geocode.placeName || "Ongole");
        } else {
          setDestination({ lat: loc.lat, lng: loc.lng });
          setDestName(geocode.placeName || "Maddipadu");
        }
      }
      if (loc.error) setNotice(loc.error);
    } catch (e) {
      setNotice("Could not fetch device GPS location. Please enter place names or coordinates.");
    } finally {
      if (target === "origin") setLocatingOrigin(false);
      else setLocatingDest(false);
    }
  }

  // Handle Place Name Search (e.g. searching "Ongole" or "Maddipadu")
  async function handleSearch(target) {
    const query = target === "origin" ? originName : destName;
    if (!query) return;
    try {
      const results = await searchPlace(query);
      if (results && results.length > 0) {
        const best = results[0];
        if (target === "origin") {
          setOrigin({ lat: best.lat, lng: best.lng });
          setOriginName(best.placeName);
        } else {
          setDestination({ lat: best.lat, lng: best.lng });
          setDestName(best.placeName);
        }
      } else {
        setNotice(`Could not find coordinates for "${query}". Please enter latitude/longitude.`);
      }
    } catch (e) {
      setNotice("Failed to search place location.");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    setRoute(null);

    let startLat = Number(origin.lat);
    let startLng = Number(origin.lng);
    let endLat = Number(destination.lat);
    let endLng = Number(destination.lng);

    // Forward geocode place names if coordinates are missing
    if ((!startLat || !startLng) && originName) {
      const res = await searchPlace(originName);
      if (res.length > 0) {
        startLat = res[0].lat;
        startLng = res[0].lng;
        setOrigin({ lat: startLat, lng: startLng });
      }
    }

    if ((!endLat || !endLng) && destName) {
      const res = await searchPlace(destName);
      if (res.length > 0) {
        endLat = res[0].lat;
        endLng = res[0].lng;
        setDestination({ lat: endLat, lng: endLng });
      }
    }

    if (!startLat || !startLng || !endLat || !endLng) {
      setError("Please enter valid locations or coordinates for both Start and Destination.");
      setLoading(false);
      return;
    }

    try {
      const result = await api.safeRoute(token, {
        origin: { lat: startLat, lng: startLng },
        destination: { lat: endLat, lng: endLng }
      });
      setRoute(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Sentinel Guard monitoring
  useEffect(() => {
    let timer;
    if (isGuardActive) {
      const checkBreach = async () => {
        try {
          const loc = await getCurrentLocation();
          if (loc.lat && loc.lng) {
            const res = await api.checkUnsafeBreach(token, { lat: loc.lat, lng: loc.lng });
            if (res.isUnsafe) {
              setBreachAlert(res);
              playSiren();
            }
          }
        } catch (err) {
          console.error("Sentinel check failed", err);
        }
      };
      checkBreach();
      timer = setInterval(checkBreach, 10000);
    }
    return () => clearInterval(timer);
  }, [isGuardActive, token]);

  function playSiren() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch (e) {}
  }

  async function simulateUnsafeBreach() {
    setTestAlertStatus(null);
    try {
      const res = await api.checkUnsafeBreach(token, { lat: 17.385, lng: 78.486 });
      setBreachAlert(res);
      playSiren();
      setTestAlertStatus({
        ok: true,
        message: res.alerted
          ? `✅ Alert sent! Emergency contacts have been notified via SMS.`
          : `⚠️ Test ran (risk score: ${res.risk?.score ?? "?"}). No contacts notified — risk threshold not met for this test location.`
      });
    } catch (e) {
      setTestAlertStatus({ ok: false, message: `❌ Failed to send test alert: ${e.message}` });
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-semibold">Smart Safety Route Navigation</h1>
        <p className="text-slate-400 text-sm">
          Enter place names (e.g. Ongole to Maddipadu) or use your live location. AI calculates the safest route on a real interactive map, avoiding unsafe areas and dark spots!
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card p-5 space-y-5">
        {/* Starting Point */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="label mb-0 font-semibold text-slate-200">Starting Point (Origin)</label>
            <button
              type="button"
              disabled={locatingOrigin}
              onClick={() => handleUseLocation("origin")}
              className="text-xs text-violet-400 hover:text-violet-300 disabled:opacity-50 flex items-center gap-1 font-medium"
            >
              {locatingOrigin ? "📍 Fetching location…" : "📍 Use my location"}
            </button>
          </div>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Location Name (e.g. Ongole)"
              value={originName}
              onChange={(e) => setOriginName(e.target.value)}
              onBlur={() => handleSearch("origin")}
            />
            <button
              type="button"
              onClick={() => handleSearch("origin")}
              className="btn-secondary text-xs px-3 text-slate-300"
            >
              Search
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <input
              className="input py-2 text-xs font-mono"
              placeholder="Latitude (e.g. 15.5057)"
              value={origin.lat}
              onChange={(e) => setOrigin({ ...origin, lat: e.target.value })}
            />
            <input
              className="input py-2 text-xs font-mono"
              placeholder="Longitude (e.g. 80.0499)"
              value={origin.lng}
              onChange={(e) => setOrigin({ ...origin, lng: e.target.value })}
            />
          </div>
        </div>

        {/* Destination */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="label mb-0 font-semibold text-slate-200">Destination</label>
            <button
              type="button"
              disabled={locatingDest}
              onClick={() => handleUseLocation("dest")}
              className="text-xs text-violet-400 hover:text-violet-300 disabled:opacity-50 flex items-center gap-1 font-medium"
            >
              {locatingDest ? "📍 Fetching location…" : "📍 Use my location"}
            </button>
          </div>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Destination Name (e.g. Maddipadu)"
              value={destName}
              onChange={(e) => setDestName(e.target.value)}
              onBlur={() => handleSearch("dest")}
            />
            <button
              type="button"
              onClick={() => handleSearch("dest")}
              className="btn-secondary text-xs px-3 text-slate-300"
            >
              Search
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <input
              className="input py-2 text-xs font-mono"
              placeholder="Latitude (e.g. 15.6320)"
              value={destination.lat}
              onChange={(e) => setDestination({ ...destination, lat: e.target.value })}
            />
            <input
              className="input py-2 text-xs font-mono"
              placeholder="Longitude (e.g. 80.0150)"
              value={destination.lng}
              onChange={(e) => setDestination({ ...destination, lng: e.target.value })}
            />
          </div>
        </div>

        {notice && <p className="text-amber-400 text-xs bg-amber-500/10 p-2 rounded">{notice}</p>}
        {error && <p className="text-coral-400 text-sm">{error}</p>}

        <button className="btn-primary w-full py-3" disabled={loading}>
          {loading ? "Calculating AI Safe Route…" : "Analyze Route & Show Real Map"}
        </button>
      </form>

      {/* Test Unsafe Alert — always visible */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-200">🚨 Test Unsafe Area Alert</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Click to instantly send an unsafe-area alert SMS to your emergency contacts (simulates entering a high-risk zone).
            </p>
          </div>
          <button
            id="test-unsafe-alert-btn"
            type="button"
            onClick={simulateUnsafeBreach}
            className="btn-secondary text-sm px-4 py-2 text-amber-300 border-amber-500/40 hover:bg-amber-500/10 transition shrink-0"
          >
            🚨 Send Test Alert
          </button>
        </div>
        {testAlertStatus && (
          <p className={`text-xs px-3 py-2 rounded-lg ${testAlertStatus.ok ? "bg-teal-500/10 text-teal-300" : "bg-coral-500/10 text-coral-300"}`}>
            {testAlertStatus.message}
          </p>
        )}
      </div>

      {/* Breach Alert */}
      {breachAlert && (
        <div className="card p-5 bg-coral-950/60 border border-coral-500/60 rounded-2xl space-y-3 animate-pulse">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-coral-300 text-lg flex items-center gap-2">
              🚨 UNSAFE ROUTE / AREA ALERT DETECTED!
            </h3>
            <button onClick={() => setBreachAlert(null)} className="text-xs text-slate-400 hover:text-slate-200">
              Dismiss
            </button>
          </div>
          <p className="text-sm text-coral-100">{breachAlert.message}</p>
        </div>
      )}

      {/* Route Results & Real Interactive Map */}
      {route && (
        <div className="card p-6 space-y-6">
          {/* Recommendation Banner */}
          <div className={`p-4 rounded-xl border ${route.directRoute?.isUnsafe ? "bg-coral-950/40 border-coral-500/40 text-coral-200" : "bg-teal-950/40 border-teal-500/40 text-teal-200"}`}>
            <h3 className="font-bold text-base mb-1">{route.recommendation}</h3>
            <p className="text-xs opacity-90">
              Comparing route from <span className="font-semibold text-white">{originName || "Start"}</span> to <span className="font-semibold text-white">{destName || "Destination"}</span>.
            </p>
          </div>

          {/* Route Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-night-900 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-semibold uppercase">Direct Route</span>
                <RiskPill level={route.directRoute?.riskLevel || "medium"} score={route.directRoute?.avgRiskScore || 50} />
              </div>
              <div className="text-xs text-coral-400 font-medium">
                {route.directRoute?.isUnsafe ? "⚠️ High Risk - Direct Path Unsafe" : "✓ Low Risk Direct Path"}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-violet-950/30 border border-violet-500/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-violet-300 font-semibold uppercase">🛡️ AI Safe Route</span>
                <RiskPill level={route.riskLevel} score={route.avgRiskScore} />
              </div>
              <div className="text-xs text-teal-300 font-semibold">
                ✓ Recommended AI Safe Route (Safest)
              </div>
            </div>
          </div>

          {/* Real Leaflet Street Map Preview */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-200">Real Interactive Map Route Preview</h4>
              <span className="text-xs text-slate-400">Powered by OpenStreetMap & Leaflet</span>
            </div>
            <RealRouteMap
              waypoints={route.waypoints}
              directWaypoints={route.directRoute?.waypoints}
              originName={originName || "Start"}
              destinationName={destName || "Destination"}
            />
          </div>

          {/* Sentinel Guard Toggle */}
          <div className="pt-4 border-t border-white/5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-200">Real-Time Unsafe Route Guard</p>
              <p className="text-xs text-slate-400">Monitors your travel path & dispatches SMS alerts if you enter an unsafe area.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsGuardActive(!isGuardActive)}
                className={`px-4 py-2 text-xs font-semibold rounded-xl transition ${isGuardActive ? "bg-coral-500 text-white animate-pulse" : "btn-secondary text-violet-300 border-violet-500/40"}`}
              >
                {isGuardActive ? "🛑 Stop Sentinel Guard" : "🛡️ Activate Sentinel Guard"}
              </button>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RiskPill({ level, score }) {
  const styles = {
    low: "bg-teal-500/15 text-teal-400 border border-teal-500/30",
    medium: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    high: "bg-coral-500/15 text-coral-400 border border-coral-500/30"
  };
  return <span className={`pill ${styles[level]}`}>{level.toUpperCase()} · {score}/100</span>;
}
