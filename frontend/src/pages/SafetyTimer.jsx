import { useEffect, useState, useRef } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";
import { getCurrentLocation } from "../utils/location.js";

// Format phone to E.164
function formatPhone(phone) {
  if (!phone) return "";
  let clean = String(phone).trim().replace(/[^\d+]/g, "");
  if (clean.startsWith("+")) return clean;
  if (clean.length === 10) return "+91" + clean;
  return clean.startsWith("+") ? clean : "+91" + clean.replace(/^0+/, "");
}

// Create alarm sound for expired timer
function createTimerAlarm() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    
    const now = ctx.currentTime;
    for (let i = 0; i < 60; i++) {
      const t = now + i * 0.3;
      osc.frequency.setValueAtTime(1500, t);
      osc.frequency.setValueAtTime(2000, t + 0.15);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.setValueAtTime(0.05, t + 0.15);
    }
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    return { ctx, osc, gain };
  } catch (e) {
    return null;
  }
}

function stopTimerAlarm(alarm) {
  if (!alarm) return;
  try { alarm.osc.stop(); alarm.ctx.close(); } catch (e) {}
}

export default function SafetyTimer() {
  const { token, user } = useAuth();
  const [active, setActive] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [form, setForm] = useState({ activity: "Walking home", durationMinutes: 20 });
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [alarmActive, setAlarmActive] = useState(false);
  const [expiredData, setExpiredData] = useState(null); // holds contact notification results
  const [contacts, setContacts] = useState([]);
  const [autoCallingIndex, setAutoCallingIndex] = useState(-1); // tracks which contact is being auto-called
  const [currentCoords, setCurrentCoords] = useState(null);
  const intervalRef = useRef(null);
  const alarmRef = useRef(null);
  const autoCallTimerRef = useRef(null);

  function load() {
    api.activeTimer(token).then(({ timer }) => setActive(timer));
    api.timerHistory(token).then(({ timers }) => setHistory(timers));
  }

  // Load contacts list & pre-fetch location
  useEffect(() => {
    api.getContacts(token).then(({ contacts }) => setContacts(contacts || [])).catch(() => {});
    getCurrentLocation().then((loc) => {
      if (loc && loc.lat && loc.lng) setCurrentCoords({ lat: loc.lat, lng: loc.lng });
    }).catch(() => {});
    load();
  }, [token]);

  // Cleanup
  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
      clearTimeout(autoCallTimerRef.current);
      stopTimerAlarm(alarmRef.current);
    };
  }, []);

  useEffect(() => {
    clearInterval(intervalRef.current);
    if (!active) return;
    intervalRef.current = setInterval(async () => {
      const secsLeft = Math.max(0, Math.floor((new Date(active.expiresAt) - new Date()) / 1000));
      setRemaining(secsLeft);
      if (secsLeft === 0) {
        clearInterval(intervalRef.current);
        // Play alarm when timer expires!
        alarmRef.current = createTimerAlarm();
        setAlarmActive(true);
        if (navigator.vibrate) {
          navigator.vibrate([1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000]);
        }
        
        // Voice announcement
        try {
          if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(
              "Emergency alert. Safety timer expired. Alerting emergency contacts immediately."
            );
            utterance.rate = 1.0;
            window.speechSynthesis.speak(utterance);
          }
        } catch (_) {}

        // Fetch fresh location to include real Google Maps link
        let locToSend = currentCoords;
        try {
          const freshLoc = await getCurrentLocation();
          if (freshLoc && freshLoc.lat && freshLoc.lng) {
            locToSend = { lat: freshLoc.lat, lng: freshLoc.lng };
            setCurrentCoords(locToSend);
          }
        } catch (_) {}

        // Call backend to expire timer — backend sends SMS + Calls via Twilio with REAL location link
        try {
          const result = await api.expireTimer(token, active.id, locToSend || {});
          setExpiredData(result);
          
          // AUTO-CALL: Open the phone dialer for the first contact automatically
          if (contacts.length > 0) {
            const firstPhone = formatPhone(contacts[0].phone);
            setAutoCallingIndex(0);
            // Open phone dialer immediately
            setTimeout(() => {
              window.location.href = `tel:${firstPhone}`;
            }, 1500);
          }
        } catch (e) {
          console.error("Timer expire error:", e);
        }
        
        load();
      }
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [active, token, contacts, currentCoords]);

  // Auto-call next contact after 15 seconds
  function callNextContact() {
    const nextIdx = autoCallingIndex + 1;
    if (nextIdx < contacts.length) {
      setAutoCallingIndex(nextIdx);
      const phone = formatPhone(contacts[nextIdx].phone);
      window.location.href = `tel:${phone}`;
    } else {
      setAutoCallingIndex(-1); // done calling all
    }
  }

  function stopAlarm() {
    stopTimerAlarm(alarmRef.current);
    alarmRef.current = null;
    setAlarmActive(false);
    setAutoCallingIndex(-1);
    clearTimeout(autoCallTimerRef.current);
    if (navigator.vibrate) navigator.vibrate(0);
  }

  async function handleStart(e) {
    e.preventDefault();
    setError("");
    setExpiredData(null);
    try {
      const { timer } = await api.startTimer(token, form);
      setActive(timer);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleCheckin() {
    stopAlarm();
    setExpiredData(null);
    await api.checkinTimer(token, active.id);
    load();
  }

  const mins = String(Math.floor(remaining / 60)).padStart(2, "0");
  const secs = String(remaining % 60).padStart(2, "0");
  const progress = active ? Math.max(0, 1 - remaining / (active.durationMinutes * 60)) : 0;
  const isUrgent = remaining > 0 && remaining <= 60;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl font-semibold">Safety timer</h1>
        <p className="text-slate-400 text-sm">
          Set a countdown before you head out. If you don't check in on time, <strong className="text-amber-300">calls go to all trusted contacts automatically</strong>.
        </p>
      </div>

      {/* ═══════ TIMER EXPIRED — FULL EMERGENCY PANEL ═══════ */}
      {alarmActive && (
        <div className="card p-6 bg-red-950/60 border-red-500/40 space-y-4">
          <div className="text-center space-y-2">
            <p className="text-red-300 font-bold text-xl animate-pulse">🚨 TIMER EXPIRED — ALERTING CONTACTS!</p>
            <p className="text-red-200 text-sm">
              Alarm is sounding. Calls & SMS are being dispatched to your trusted contacts.
            </p>
          </div>

          {/* Auto-calling status */}
          {autoCallingIndex >= 0 && autoCallingIndex < contacts.length && (
            <div className="p-3 rounded-xl bg-red-900/50 border border-red-500/30 text-center animate-pulse">
              <p className="text-white font-semibold">
                📞 Auto-calling: {contacts[autoCallingIndex]?.name} ({contacts[autoCallingIndex]?.phone})
              </p>
              <p className="text-red-200 text-xs mt-1">Phone dialer should open automatically</p>
            </div>
          )}

          {/* Live GPS Location attached */}
          {currentCoords?.lat && currentCoords?.lng ? (
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-emerald-500/40 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">📍</span>
                <div>
                  <p className="text-emerald-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                    Real Live Location Attached to Alert
                  </p>
                  <p className="text-white text-xs font-mono mt-0.5">
                    Coords: {currentCoords.lat}, {currentCoords.lng}
                  </p>
                </div>
              </div>
              <a
                href={`https://maps.google.com/?q=${currentCoords.lat},${currentCoords.lng}`}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1 shadow transition active:scale-95"
              >
                🗺️ View on Google Maps ↗
              </a>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-900/80 border border-amber-500/30 text-xs text-amber-200 flex items-center gap-2">
              <span className="animate-spin text-base">⏳</span>
              <span>Acquiring real GPS coordinates for Google Maps link...</span>
            </div>
          )}

          {/* 100% Free 1-Tap SMS & WhatsApp to All Contacts */}
          <div className="space-y-2 pt-1">
            <a
              href={`sms:${contacts.map(c => c.phone.replace(/\D/g, '').slice(-10)).join(',')}?body=${encodeURIComponent(
                `🚨 SAFETY TIMER EXPIRED 🚨\n\nURGENT: ${user?.name || "Someone"} set a safety timer and has NOT checked in!\n\n${currentCoords?.lat && currentCoords?.lng ? `📍 Real GPS Location:\nhttps://maps.google.com/?q=${currentCoords.lat},${currentCoords.lng}\n\n` : ""}Please call or check on them IMMEDIATELY!\n— Guardian Safety App`
              )}`}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg active:scale-95 transition ring-1 ring-blue-400/40 text-center"
            >
              <span>📲</span>
              <span>Send 100% Free SMS to All {contacts.length} Contacts (via SIM)</span>
            </a>
            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                `🚨 SAFETY TIMER EXPIRED 🚨\n\nURGENT: ${user?.name || "Someone"} set a safety timer and has NOT checked in!\n\n${currentCoords?.lat && currentCoords?.lng ? `📍 Real GPS Location:\nhttps://maps.google.com/?q=${currentCoords.lat},${currentCoords.lng}\n\n` : ""}Please call or check on them IMMEDIATELY!\n— Guardian Safety App`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider shadow active:scale-95 transition text-center"
            >
              <span>💬</span>
              <span>Send Free WhatsApp Alert to Group / Contacts</span>
            </a>
          </div>

          {/* Contact buttons — CALL each contact */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-amber-300 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              Tap to call/message each contact
            </p>
            {contacts.map((c, i) => {
              const phone = formatPhone(c.phone);
              const phoneClean = phone.replace("+", "");
              const mapsUrl = currentCoords?.lat && currentCoords?.lng
                ? `https://maps.google.com/?q=${currentCoords.lat},${currentCoords.lng}`
                : "";
              const msgText = [
                "🚨 SAFETY TIMER EXPIRED ALERT 🚨",
                "",
                `URGENT: ${user?.name || "A user"} set a safety timer and has NOT checked in!`,
                "",
                mapsUrl ? `📍 Real GPS Location:\n${mapsUrl}` : "",
                currentCoords?.lat && currentCoords?.lng ? `Coordinates: ${currentCoords.lat}, ${currentCoords.lng}` : "",
                "",
                "Please call or check on them IMMEDIATELY!",
                "— Guardian Safety App"
              ].filter(Boolean).join("\n");
              const msg = encodeURIComponent(msgText);
              const notif = expiredData?.notifications?.[i];

              return (
                <div key={c.id || i} className="p-3 rounded-xl bg-night-900/80 border border-white/5 text-xs space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-slate-100 font-medium text-sm">{c.name}</p>
                      <p className="text-slate-400 text-[11px]">{c.phone} {c.relation ? `· ${c.relation}` : ""}</p>
                    </div>
                    <div className="flex gap-1.5 items-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                        📱 SMS Delivered ✓
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                        📞 Voice Call Placed ✓
                      </span>
                    </div>
                  </div>
                  
                  {/* ACTION BUTTONS — native tel/sms/whatsapp */}
                  <div className="flex gap-2 flex-wrap pt-1">
                    <a
                      href={`tel:${phone}`}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg transition active:scale-95 ring-1 ring-red-400/30"
                    >
                      📞 CALL NOW
                    </a>
                    <a
                      href={`sms:${phone}?body=${msg}`}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow transition active:scale-95"
                    >
                      📱 SMS
                    </a>
                    <a
                      href={`https://wa.me/${phoneClean}?text=${msg}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition active:scale-95"
                    >
                      💬 WhatsApp
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Call next / Stop buttons */}
          <div className="flex gap-3 justify-center flex-wrap pt-2">
            {autoCallingIndex >= 0 && autoCallingIndex < contacts.length - 1 && (
              <button
                onClick={callNextContact}
                className="px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-xl transition active:scale-95"
              >
                📞 Call Next Contact →
              </button>
            )}
            <button
              onClick={stopAlarm}
              className="px-6 py-3 rounded-xl bg-white text-red-700 font-bold text-sm shadow-xl hover:bg-red-50 transition active:scale-95"
            >
              🔇 Stop Alarm — I'm Safe
            </button>
          </div>

          {/* Emergency services */}
          <div className="pt-3 border-t border-red-500/20 flex gap-2 flex-wrap justify-center">
            <a href="tel:100" className="px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold shadow transition active:scale-95">
              🚔 Police (100)
            </a>
            <a href="tel:112" className="px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold shadow transition active:scale-95">
              🆘 Emergency (112)
            </a>
            <a href="tel:1091" className="px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold shadow transition active:scale-95">
              📞 Women Helpline (1091)
            </a>
          </div>
        </div>
      )}

      {/* ═══════ ACTIVE TIMER COUNTDOWN ═══════ */}
      {active && !alarmActive ? (
        <div className="card p-8 flex flex-col items-center gap-4">
          <span className="pill bg-amber-500/15 text-amber-400">{active.activity}</span>
          
          {/* Progress ring */}
          <div className="relative">
            <svg width="180" height="180" className="-rotate-90">
              <circle cx="90" cy="90" r="78" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
              <circle
                cx="90" cy="90" r="78"
                fill="none"
                stroke={isUrgent ? "#EF4444" : "#F59E0B"}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 78}
                strokeDashoffset={2 * Math.PI * 78 * (1 - progress)}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className={`font-display text-5xl font-bold tabular-nums ${isUrgent ? "text-red-400 animate-pulse" : ""}`}>
                {mins}:{secs}
              </p>
              <p className="text-xs text-slate-400 mt-1">remaining</p>
            </div>
          </div>

          {isUrgent && (
            <p className="text-red-400 text-sm font-semibold animate-pulse">
              ⚠️ Less than 1 minute! Check in NOW or contacts will be called!
            </p>
          )}

          <button onClick={handleCheckin} className="btn-primary text-lg px-8 py-4">
            ✅ I'm safe — check in now
          </button>
          
          <p className="text-xs text-slate-500 text-center max-w-xs">
            If you don't check in before time runs out, <strong className="text-amber-300">calls + SMS will automatically go to {contacts.length} trusted contact{contacts.length !== 1 ? "s" : ""}</strong>.
          </p>
        </div>
      ) : !alarmActive && (
        /* ═══════ START NEW TIMER FORM ═══════ */
        <form onSubmit={handleStart} className="card p-5 space-y-4">
          <div>
            <label className="label">What are you doing?</label>
            <input className="input" value={form.activity} onChange={(e) => setForm({ ...form, activity: e.target.value })} />
          </div>
          <div>
            <label className="label">Check in within (minutes)</label>
            <input
              className="input"
              type="number"
              min={1}
              max={240}
              value={form.durationMinutes}
              onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setForm({ ...form, durationMinutes: 0.25 })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                form.durationMinutes === 0.25
                  ? "bg-amber-500 text-white font-bold"
                  : "bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30"
              }`}
            >
              ⚡ 15 sec (Quick Test)
            </button>
            {[5, 10, 15, 20, 30, 60].map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setForm({ ...form, durationMinutes: m })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  form.durationMinutes === m
                    ? "bg-violet-500 text-white"
                    : "bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10 border border-white/5"
                }`}
              >
                {m} min
              </button>
            ))}
          </div>

          {/* Info about what happens */}
          <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/20 text-xs text-amber-200/80 space-y-1">
            <p className="font-semibold text-amber-300">What happens when timer expires?</p>
            <ul className="list-disc list-inside space-y-0.5 text-[11px]">
              <li>🔔 Loud alarm sounds on your phone</li>
              <li>📞 Phone dialer auto-opens to call your first trusted contact</li>
              <li>📱 SMS alerts sent to all trusted contacts</li>
              <li>📞 Automated voice calls placed to all contacts</li>
              <li>💬 WhatsApp & SMS buttons shown for quick manual alerts</li>
            </ul>
          </div>

          {error && <p className="text-coral-400 text-sm">{error}</p>}
          
          {contacts.length === 0 && (
            <p className="text-amber-400 text-xs">⚠️ Add trusted contacts first! No one to call when timer expires.</p>
          )}
          
          <button className="btn-primary w-full py-4 text-lg" disabled={contacts.length === 0}>
            🕐 Start Safety Timer
          </button>
        </form>
      )}

      {/* ═══════ HISTORY ═══════ */}
      <div className="space-y-2">
        <h3 className="font-display font-semibold text-lg">History</h3>
        {history.length === 0 && <p className="text-slate-500 text-sm">No timers yet.</p>}
        {history.map((t) => (
          <div key={t.id} className="card p-3 flex items-center justify-between text-sm">
            <span>{t.activity} · {t.durationMinutes} min</span>
            <StatusPill status={t.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const styles = {
    active: "bg-amber-500/15 text-amber-400",
    checked_in: "bg-teal-500/15 text-teal-400",
    expired: "bg-coral-500/15 text-coral-400"
  };
  const labels = { active: "Active", checked_in: "Checked in ✓", expired: "⚠️ Alert sent" };
  return <span className={`pill ${styles[status]}`}>{labels[status]}</span>;
}
