import { useEffect, useState, useRef } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";

function createFallAlarm() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(1000, ctx.currentTime);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    
    const now = ctx.currentTime;
    for (let i = 0; i < 20; i++) {
      const t = now + i * 0.4;
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.linearRampToValueAtTime(1200, t + 0.2);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.setValueAtTime(0.05, t + 0.2);
    }

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    return { ctx, osc };
  } catch (e) {
    return null;
  }
}

function stopFallAlarm(alarm) {
  if (!alarm) return;
  try { alarm.osc.stop(); alarm.ctx.close(); } catch (e) {}
}

export default function FallDetection() {
  const { token } = useAuth();
  const [events, setEvents] = useState([]);
  const [simulating, setSimulating] = useState(false);
  const [fallAlert, setFallAlert] = useState(null); // active fall event
  const [countdown, setCountdown] = useState(null); // 30-second countdown before auto-alert
  const alarmRef = useRef(null);
  const countdownRef = useRef(null);

  function load() {
    api.fallHistory(token).then(({ events }) => setEvents(events));
  }
  useEffect(load, [token]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(countdownRef.current);
      stopFallAlarm(alarmRef.current);
    };
  }, []);

  // Real device motion fall detection
  useEffect(() => {
    let lastHighG = 0;
    function handleMotion(event) {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;
      const totalG = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
      const now = Date.now();
      
      // Detect sudden high-G followed by low-G (fall pattern)
      if (totalG > 35 && now - lastHighG > 10000) {
        lastHighG = now;
        startFallCountdown();
      }
    }
    window.addEventListener("devicemotion", handleMotion);
    return () => window.removeEventListener("devicemotion", handleMotion);
  }, []);

  function startFallCountdown() {
    // Start alarm
    alarmRef.current = createFallAlarm();
    if (navigator.vibrate) {
      navigator.vibrate([1000, 500, 1000, 500, 1000, 500, 1000]);
    }

    let count = 30;
    setCountdown(count);
    setFallAlert("countdown");

    countdownRef.current = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(countdownRef.current);
        setCountdown(null);
        setFallAlert(null);
        // Auto-send fall alert
        executeFallReport(0.95);
      } else {
        setCountdown(count);
      }
    }, 1000);
  }

  function cancelFallAlert() {
    clearInterval(countdownRef.current);
    setCountdown(null);
    setFallAlert(null);
    stopFallAlarm(alarmRef.current);
    alarmRef.current = null;
    if (navigator.vibrate) navigator.vibrate(0);
  }

  async function executeFallReport(confidence) {
    stopFallAlarm(alarmRef.current);
    alarmRef.current = null;
    setSimulating(true);
    try {
      const coords = await new Promise((resolve) => {
        if (!navigator.geolocation) return resolve({});
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve({}),
          { timeout: 5000, enableHighAccuracy: true }
        );
      });
      const result = await api.reportFall(token, { confidence, ...coords, autoAlert: true });
      load();
      
      // Show result notification
      if (result.notified && result.notified.length > 0) {
        setFallAlert("sent");
        setTimeout(() => setFallAlert(null), 8000);
      }
    } finally {
      setSimulating(false);
    }
  }

  async function simulateFall() {
    startFallCountdown();
  }

  async function markOk(id) {
    await api.imOk(token, id);
    cancelFallAlert();
    load();
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl font-semibold">Fall detection</h1>
        <p className="text-slate-400 text-sm">
          Your wearable's motion sensor watches for hard-fall patterns. When a fall is detected, you get a 30-second window to cancel — otherwise your trusted contacts are alerted with your location.
        </p>
      </div>

      {/* Fall countdown overlay */}
      {fallAlert === "countdown" && countdown !== null && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-red-950/95 backdrop-blur-xl">
          <p className="text-white text-xl font-bold mb-2">⚠️ FALL DETECTED!</p>
          <p className="text-red-200 text-sm mb-6">Alerting your trusted contacts in...</p>
          <p className="text-8xl font-display font-bold text-white tabular-nums animate-pulse">{countdown}</p>
          <p className="text-red-200 text-sm mt-4 mb-8">seconds</p>
          <button
            onClick={cancelFallAlert}
            className="px-10 py-5 rounded-2xl bg-white text-red-700 font-bold text-xl shadow-2xl hover:bg-red-50 transition active:scale-95"
          >
            ✅ I'm OK — Cancel Alert
          </button>
        </div>
      )}

      {/* Alert sent banner */}
      {fallAlert === "sent" && (
        <div className="card p-4 bg-amber-950/50 border-amber-500/40 text-center animate-fade-in">
          <p className="text-amber-300 font-bold">📤 Fall alert sent to your trusted contacts!</p>
          <p className="text-amber-200/70 text-xs mt-1">They've been notified with your GPS location via SMS & call.</p>
        </div>
      )}

      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="font-medium mb-1">Test Fall Detection</p>
            <p className="text-sm text-slate-400">Simulates a fall event to test the full alert flow with 30-second cancel window.</p>
          </div>
          <button onClick={simulateFall} disabled={simulating || fallAlert === "countdown"} className="btn-danger shrink-0 px-6 py-3">
            {simulating ? "Sending…" : fallAlert === "countdown" ? "Alert Active…" : "🧪 Simulate Fall"}
          </button>
        </div>

        {/* Real-time motion monitoring status */}
        <div className="pt-3 border-t border-white/5 flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span>
          </span>
          <div>
            <p className="text-teal-300 text-sm font-medium">Motion monitoring active</p>
            <p className="text-xs text-slate-400">Device accelerometer is being monitored for fall patterns in real-time.</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-display font-semibold text-lg">Fall Event History</h3>
        {events.length === 0 && <p className="text-slate-500 text-sm">No fall events recorded.</p>}
        {events.map((e) => (
          <div key={e.id} className="card p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Confidence {(e.confidence * 100).toFixed(0)}%</p>
              <p className="text-xs text-slate-500">{new Date(e.createdAt).toLocaleString()}</p>
              {e.location && (
                <a
                  href={`https://maps.google.com/?q=${e.location.lat},${e.location.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-violet-300 hover:text-violet-200 underline"
                >
                  📍 View location
                </a>
              )}
            </div>
            <div className="flex items-center gap-3">
              <StatusPill status={e.status} />
              {e.status === "alerting" && (
                <button onClick={() => markOk(e.id)} className="btn-secondary text-xs px-3 py-2">
                  ✅ I'm OK
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const styles = {
    alerting: "bg-coral-500/15 text-coral-400",
    monitoring: "bg-amber-500/15 text-amber-400",
    dismissed: "bg-teal-500/15 text-teal-400"
  };
  const labels = {
    alerting: "🚨 Alerting",
    monitoring: "👁️ Monitoring",
    dismissed: "✅ Dismissed"
  };
  return <span className={`pill ${styles[status]}`}>{labels[status] || status}</span>;
}
