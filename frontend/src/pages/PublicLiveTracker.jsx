import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api.js";

export default function PublicLiveTracker() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadTracker() {
    try {
      const res = await api.publicTrack(token);
      setData(res);
      setError("");
    } catch (e) {
      setError(e.message || "Failed to load live tracking details.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTracker();
    const interval = setInterval(loadTracker, 5000);
    return () => clearInterval(interval);
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-night-950 text-slate-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading Live Location Tracking feed...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-night-950 text-slate-100 flex items-center justify-center p-4">
        <div className="card p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full bg-coral-500/20 text-coral-400 flex items-center justify-center mx-auto mb-4">
            ⚠️
          </div>
          <h2 className="text-xl font-bold mb-2">Tracking Unavailable</h2>
          <p className="text-slate-400 text-sm mb-6">{error || "Invalid tracking link."}</p>
          <Link to="/login" className="btn-primary inline-block">
            Go to Guardian Login
          </Link>
        </div>
      </div>
    );
  }

  const { user, location, activeSos } = data;
  const isEmergency = !!activeSos;

  return (
    <div className="min-h-screen bg-night-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Banner */}
        <header className="flex items-center justify-between card p-4 border-l-4 border-l-violet-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500 flex items-center justify-center font-bold text-lg shadow-glow">
              G
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">Guardian Live Protection Portal</h1>
              <p className="text-xs text-slate-400">Trusted Contact & Emergency Service Monitoring Feed</p>
            </div>
          </div>
          <span className={`pill ${isEmergency ? "bg-coral-500/20 text-coral-400 animate-pulse border border-coral-500/40" : "bg-teal-500/20 text-teal-300 border border-teal-500/40"}`}>
            {isEmergency ? "🚨 ACTIVE SOS EMERGENCY" : "🟢 SAFE / MONITORING"}
          </span>
        </header>

        {/* User Card */}
        <div className="card p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider block">User Profile</span>
            <p className="text-xl font-bold text-violet-300">{user.name}</p>
            <p className="text-xs text-slate-400">Phone: {user.phone}</p>
            {user.bloodGroup && <p className="text-xs text-slate-400">Blood Group: <span className="text-rose-400 font-semibold">{user.bloodGroup}</span></p>}
          </div>
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider block">Last Battery Level</span>
            <p className="text-lg font-semibold text-slate-200">
              ⚡ {location?.battery !== null && location?.battery !== undefined ? `${location.battery}%` : "Unknown"}
            </p>
            <span className="text-xs text-slate-400">Auto updates every 5 seconds</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider block">Last Updated</span>
            <p className="text-sm font-medium text-slate-300">
              {location ? new Date(location.timestamp).toLocaleTimeString() : "No signal"}
            </p>
            <p className="text-xs text-slate-400">
              {location ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : ""}
            </p>
          </div>
        </div>

        {/* Active Emergency Alert Banner if trigger SOS */}
        {activeSos && (
          <div className="card p-6 bg-coral-950/40 border border-coral-500/50 rounded-2xl animate-pulse">
            <h3 className="text-lg font-bold text-coral-300 flex items-center gap-2">
              🚨 Emergency Alert Active!
            </h3>
            <p className="text-sm text-coral-200 mt-1">
              User triggered SOS on {new Date(activeSos.createdAt).toLocaleString()}.
            </p>
            {activeSos.note && <p className="text-xs text-coral-300 mt-2 bg-coral-900/50 p-2 rounded">Note: {activeSos.note}</p>}
            <div className="mt-4 flex flex-wrap gap-3">
              <a href={`tel:${user.phone}`} className="btn-primary bg-coral-500 hover:bg-coral-600 text-sm">
                📞 Call {user.name}
              </a>
              <a href={`https://maps.google.com/?q=${location?.lat},${location?.lng}`} target="_blank" rel="noreferrer" className="btn-secondary text-sm">
                🗺️ Open in Google Maps
              </a>
            </div>
          </div>
        )}

        {/* Map Visualization */}
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center justify-between">
            <span>📍 Live Map Position</span>
            <span className="text-xs text-slate-400">Live Satellite Radar</span>
          </h3>
          {location ? (
            <div className="relative w-full h-80 rounded-xl bg-night-900 border border-white/10 flex items-center justify-center overflow-hidden">
              <svg className="w-full h-full" viewBox="0 0 600 300">
                <defs>
                  <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                    <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
                {/* Simulated Radar Ring */}
                <circle cx="300" cy="150" r="80" fill="none" stroke="rgba(124, 92, 252, 0.2)" strokeWidth="1.5" />
                <circle cx="300" cy="150" r="130" fill="none" stroke="rgba(124, 92, 252, 0.1)" strokeWidth="1" />
                {/* User Beacon */}
                <circle cx="300" cy="150" r="18" fill="rgba(255, 71, 87, 0.2)" className="animate-ping" />
                <circle cx="300" cy="150" r="8" fill="#7c5cfc" stroke="#ffffff" strokeWidth="2" />
              </svg>
              <div className="absolute bottom-4 left-4 bg-night-950/90 border border-white/10 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300">
                Lat: {location.lat.toFixed(5)} | Lng: {location.lng.toFixed(5)}
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-sm text-center py-12">No location signal recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
