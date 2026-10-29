import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";

export default function Battery() {
  const { token } = useAuth();
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [warning, setWarning] = useState("");
  const [manualLevel, setManualLevel] = useState(80);

  function load() {
    api.latestBattery(token).then(({ latest }) => setLatest(latest));
    api.batteryHistory(token).then(({ history }) => setHistory(history));
  }

  useEffect(() => {
    load();
    // Try the native Battery Status API where available (most desktop
    // Chromium browsers; not supported on iOS/most modern browsers, in
    // which case use the manual slider below).
    if ("getBattery" in navigator) {
      navigator.getBattery().then((battery) => {
        report(Math.round(battery.level * 100), battery.charging);
        battery.addEventListener("levelchange", () => report(Math.round(battery.level * 100), battery.charging));
        battery.addEventListener("chargingchange", () => report(Math.round(battery.level * 100), battery.charging));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function report(level, charging) {
    const { lowBatteryWarning } = await api.postBattery(token, { level, charging, device: "phone" });
    setWarning(lowBatteryWarning || "");
    load();
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl font-semibold">Battery monitoring</h1>
        <p className="text-slate-400 text-sm">If your phone battery drops below 15%, you'll get a nudge to notify a trusted contact before it dies.</p>
      </div>

      <div className="card p-8 flex flex-col items-center gap-4">
        <BatteryRing level={latest?.level ?? 0} />
        <p className="text-sm text-slate-400">{latest ? (latest.charging ? "Charging" : "On battery") : "No reading yet"}</p>
        {warning && <div className="card px-4 py-3 text-sm text-amber-400 border-amber-500/20">{warning}</div>}
      </div>

      <div className="card p-5">
        <label className="label">No battery API on your device? Report manually</label>
        <div className="flex items-center gap-4">
          <input type="range" min={0} max={100} value={manualLevel} onChange={(e) => setManualLevel(Number(e.target.value))} className="flex-1 accent-violet-500" />
          <span className="w-12 text-right font-medium">{manualLevel}%</span>
          <button onClick={() => report(manualLevel, false)} className="btn-secondary text-sm px-4 py-2">Report</button>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-display font-semibold text-lg">Recent readings</h3>
        {history.slice(0, 10).map((h) => (
          <div key={h.id} className="card p-3 flex items-center justify-between text-sm">
            <span>{h.level}% {h.charging ? "(charging)" : ""}</span>
            <span className="text-slate-500 text-xs">{new Date(h.timestamp).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BatteryRing({ level }) {
  const color = level <= 15 ? "#FF4757" : level <= 40 ? "#FF9F1C" : "#2EE6A8";
  const circumference = 2 * Math.PI * 54;
  const offset = circumference * (1 - level / 100);
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r="54" fill="none" stroke="#1F2247" strokeWidth="12" />
      <circle
        cx="70" cy="70" r="54" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        transform="rotate(-90 70 70)"
      />
      <text x="70" y="78" textAnchor="middle" fontSize="26" fontWeight="700" fill="#F2F1F8" fontFamily="Space Grotesk">
        {level}%
      </text>
    </svg>
  );
}
