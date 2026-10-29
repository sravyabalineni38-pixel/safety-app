import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";

export default function EmergencyHistory() {
  const { token } = useAuth();
  const [sos, setSos] = useState([]);
  const [falls, setFalls] = useState([]);
  const [tab, setTab] = useState("sos");

  useEffect(() => {
    api.sosHistory(token).then(({ events }) => setSos(events));
    api.fallHistory(token).then(({ events }) => setFalls(events));
  }, [token]);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl font-semibold">Emergency history</h1>
        <p className="text-slate-400 text-sm">Every SOS trigger and fall alert, with who was notified.</p>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab("sos")} className={`px-4 py-2 rounded-xl text-sm ${tab === "sos" ? "bg-violet-500/15 text-violet-300" : "text-slate-400"}`}>
          SOS events ({sos.length})
        </button>
        <button onClick={() => setTab("falls")} className={`px-4 py-2 rounded-xl text-sm ${tab === "falls" ? "bg-violet-500/15 text-violet-300" : "text-slate-400"}`}>
          Fall alerts ({falls.length})
        </button>
      </div>

      {tab === "sos" && (
        <div className="space-y-3">
          {sos.length === 0 && <p className="text-slate-500 text-sm">No SOS events yet — hopefully it stays that way.</p>}
          {sos.map((e) => (
            <div key={e.id} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className={`pill ${e.status === "active" ? "bg-coral-500/15 text-coral-400" : "bg-teal-500/15 text-teal-400"}`}>
                  {e.status}
                </span>
                <span className="text-xs text-slate-500">{new Date(e.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-sm text-slate-400">
                Notified {e.notifiedContacts?.length || 0} trusted contact(s) and {e.notifiedServices?.length || 0} emergency service(s).
              </p>
              {e.location && (
                <a
                  className="text-xs text-violet-400 hover:text-violet-300"
                  href={`https://maps.google.com/?q=${e.location.lat},${e.location.lng}`}
                  target="_blank" rel="noreferrer"
                >
                  View location on map ↗
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "falls" && (
        <div className="space-y-3">
          {falls.length === 0 && <p className="text-slate-500 text-sm">No fall events recorded.</p>}
          {falls.map((e) => (
            <div key={e.id} className="card p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Confidence {(e.confidence * 100).toFixed(0)}%</p>
                <p className="text-xs text-slate-500">{new Date(e.createdAt).toLocaleString()}</p>
              </div>
              <span className="pill bg-white/5 text-slate-300">{e.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
