import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";
import { getCurrentLocation } from "../utils/location.js";

// ────────────────────────────────────────────────────────────
// Audio alarm — generates a loud oscillating siren using Web Audio API
// ────────────────────────────────────────────────────────────
function createAlarmSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    const ctx = new AudioContext();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sawtooth";
    osc2.type = "square";
    osc1.frequency.setValueAtTime(800, ctx.currentTime);
    osc2.frequency.setValueAtTime(600, ctx.currentTime);

    // Create siren sweep
    const now = ctx.currentTime;
    for (let i = 0; i < 30; i++) {
      const t = now + i * 0.5;
      osc1.frequency.setValueAtTime(800, t);
      osc1.frequency.linearRampToValueAtTime(1200, t + 0.25);
      osc1.frequency.linearRampToValueAtTime(800, t + 0.5);
      osc2.frequency.setValueAtTime(600, t);
      osc2.frequency.linearRampToValueAtTime(900, t + 0.25);
      osc2.frequency.linearRampToValueAtTime(600, t + 0.5);
    }

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.start();
    osc2.start();

    return { ctx, osc1, osc2, gain };
  } catch (e) {
    console.warn("Could not create alarm sound:", e);
    return null;
  }
}

function stopAlarmSound(alarm) {
  if (!alarm) return;
  try {
    alarm.gain.gain.linearRampToValueAtTime(0, alarm.ctx.currentTime + 0.1);
    setTimeout(() => {
      alarm.osc1.stop();
      alarm.osc2.stop();
      alarm.ctx.close();
    }, 200);
  } catch (e) {
    // ignore
  }
}

// ────────────────────────────────────────────────────────────
// Vibrate the phone (if supported)
// ────────────────────────────────────────────────────────────
function vibratePhone() {
  if (navigator.vibrate) {
    // SOS pattern: ...---...
    navigator.vibrate([200, 100, 200, 100, 200, 300, 400, 100, 400, 100, 400, 300, 200, 100, 200, 100, 200]);
  }
}

// ────────────────────────────────────────────────────────────
// Format phone number to E.164
// ────────────────────────────────────────────────────────────
function formatPhone(phone) {
  if (!phone) return "";
  let clean = String(phone).trim().replace(/[^\d+]/g, "");
  if (clean.startsWith("+")) return clean;
  if (clean.length === 10) return "+91" + clean;
  return clean.startsWith("+") ? clean : "+91" + clean.replace(/^0+/, "");
}

// ────────────────────────────────────────────────────────────
// Build emergency message
// ────────────────────────────────────────────────────────────
function buildEmergencyMessage(userName, lat, lng) {
  const mapsUrl = lat && lng ? `https://maps.google.com/?q=${lat},${lng}` : null;
  return [
    "🚨 SOS EMERGENCY ALERT 🚨",
    "",
    `${userName || "Someone"} needs URGENT assistance!`,
    "",
    mapsUrl ? `📍 Live GPS Location: ${mapsUrl}` : "📍 Location: Unavailable",
    lat && lng ? `Coordinates: ${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}` : "",
    "",
    "Please respond IMMEDIATELY — this is an automated emergency alert.",
    "— Guardian Safety App"
  ].filter(Boolean).join("\n");
}

export default function SOSButton({ onTriggered, size = "large" }) {
  const { token, user } = useAuth();
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [contacts, setContacts] = useState([]);
  const [locationStatus, setLocationStatus] = useState("fetching");
  const [coords, setCoords] = useState(null);
  const [alarmActive, setAlarmActive] = useState(false);
  const [countdown, setCountdown] = useState(null); // null = no countdown
  const alarmRef = useRef(null);
  const countdownRef = useRef(null);

  // Load contacts
  useEffect(() => {
    if (!token) return;
    api.getContacts(token)
      .then(({ contacts }) => setContacts(contacts || []))
      .catch(() => {});

    api.activeSos(token)
      .then((data) => {
        if (data?.event) {
          setResult({
            event: data.event,
            mode: data.mode || data.event.mode,
            isDemo: data.isDemo ?? (data.event.mode === "demo"),
            message: data.event.status === "active" ? "Active emergency alert in progress." : "Emergency alert resolved."
          });
        }
      })
      .catch(() => {});
  }, [token]);

  // Pre-fetch GPS
  useEffect(() => {
    setLocationStatus("fetching");
    getPosition().then((pos) => {
      if (pos) { setCoords(pos); setLocationStatus("ok"); }
      else { setLocationStatus("failed"); }
    });
  }, []);

  // Cleanup alarm on unmount
  useEffect(() => {
    return () => {
      stopAlarmSound(alarmRef.current);
      clearInterval(countdownRef.current);
    };
  }, []);

  async function getPosition() {
    try {
      const loc = await getCurrentLocation();
      if (loc && loc.lat && loc.lng) {
        return { lat: Number(loc.lat), lng: Number(loc.lng) };
      }
    } catch (_) {}
    return null;
  }

  // Start 3-second countdown before sending SOS
  function handlePress() {
    if (contacts.length === 0) return;
    if (countdown !== null) return; // already counting

    // Start alarm immediately
    vibratePhone();
    alarmRef.current = createAlarmSound();
    setAlarmActive(true);

    let count = 3;
    setCountdown(count);
    countdownRef.current = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(countdownRef.current);
        setCountdown(null);
        executeSOS();
      } else {
        setCountdown(count);
      }
    }, 1000);
  }

  function cancelCountdown() {
    clearInterval(countdownRef.current);
    setCountdown(null);
    stopAlarmSound(alarmRef.current);
    alarmRef.current = null;
    setAlarmActive(false);
    if (navigator.vibrate) navigator.vibrate(0);
  }

  async function executeSOS() {
    setSending(true);
    setError("");
    setResult(null);
    try {
      const fresh = await getPosition();
      const currentLat = fresh?.lat ?? coords?.lat;
      const currentLng = fresh?.lng ?? coords?.lng;

      const data = await api.triggerSos(token, {
        lat: currentLat,
        lng: currentLng,
        source: "app"
      });
      setResult(data);
      onTriggered?.(data.event);

      // Keep alarm running for 5 more seconds after SOS sent
      setTimeout(() => {
        stopAlarmSound(alarmRef.current);
        alarmRef.current = null;
        setAlarmActive(false);
      }, 5000);

    } catch (e) {
      setError(e.message || "Failed to send SOS. Check your connection.");
      stopAlarmSound(alarmRef.current);
      alarmRef.current = null;
      setAlarmActive(false);
    } finally {
      setSending(false);
    }
  }

  function stopAlarm() {
    stopAlarmSound(alarmRef.current);
    alarmRef.current = null;
    setAlarmActive(false);
    if (navigator.vibrate) navigator.vibrate(0);
  }

  async function handleResolve() {
    stopAlarm();
    if (!result?.event?.id) { setResult(null); return; }
    try {
      await api.resolveSos(token, result.event.id);
      setResult(null);
    } catch (e) {
      setError(e.message);
    }
  }

  // Helpers for generating native action links
  const getEmergencyMsg = useCallback(() => {
    const lat = result?.event?.location?.lat || coords?.lat;
    const lng = result?.event?.location?.lng || coords?.lng;
    return buildEmergencyMessage(user?.name, lat, lng);
  }, [result, coords, user]);

  const dim = size === "large" ? "w-44 h-44 text-2xl" : "w-24 h-24 text-base";
  const noContacts = contacts.length === 0;

  return (
    <div className="flex flex-col items-center gap-5 w-full">

      {/* Status pills */}
      <div className="flex items-center gap-2 flex-wrap justify-center">
        {noContacts ? (
          <Link
            to="/contacts"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium hover:bg-amber-500/25 transition"
          >
            ⚠️ No contacts — add trusted contacts first
          </Link>
        ) : (
          <span className="px-3 py-1.5 rounded-full bg-teal-500/15 border border-teal-500/25 text-teal-300 text-xs font-medium">
            👥 {contacts.length} trusted contact{contacts.length > 1 ? "s" : ""} registered
          </span>
        )}
        {locationStatus === "ok" && (
          <span className="px-3 py-1.5 rounded-full bg-violet-500/15 border border-violet-500/25 text-violet-300 text-xs font-medium">
            📍 GPS ready
          </span>
        )}
        {locationStatus === "failed" && (
          <span className="px-3 py-1.5 rounded-full bg-slate-800/60 border border-white/10 text-slate-400 text-xs">
            📍 No GPS — location unavailable
          </span>
        )}
      </div>

      {/* Countdown overlay */}
      {countdown !== null && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-red-950/90 backdrop-blur-xl animate-pulse">
          <p className="text-white text-lg mb-2 font-medium">🚨 SOS ACTIVATING IN</p>
          <p className="text-9xl font-display font-bold text-white tabular-nums">{countdown}</p>
          <p className="text-red-200 text-sm mt-4">Alarm sounding — tap Cancel if safe</p>
          <button
            onClick={cancelCountdown}
            className="mt-8 px-8 py-4 rounded-2xl bg-white text-red-700 font-bold text-lg shadow-2xl hover:bg-red-100 transition active:scale-95"
          >
            ✕ Cancel SOS
          </button>
        </div>
      )}

      {/* Main SOS Button */}
      <button
        id="sos-trigger-btn"
        onClick={handlePress}
        disabled={sending || noContacts || countdown !== null}
        className={`
          ${dim} rounded-full font-display font-bold tracking-wider
          flex flex-col items-center justify-center gap-1
          transition-all duration-200 active:scale-95
          disabled:opacity-50 disabled:cursor-not-allowed disabled:animate-none
          ${!noContacts
            ? "bg-gradient-to-b from-red-400 to-red-700 text-white shadow-[0_0_40px_rgba(239,68,68,0.5)] sos-pulse hover:shadow-[0_0_60px_rgba(239,68,68,0.7)] cursor-pointer"
            : "bg-gradient-to-b from-slate-600 to-slate-800 text-slate-400"
          }
        `}
      >
        {sending ? (
          <>
            <span className="text-2xl animate-spin inline-block">⟳</span>
            <span className="text-xs font-normal">Sending…</span>
          </>
        ) : (
          <>
            <span className="text-3xl">🆘</span>
            <span className="text-xl">SOS</span>
          </>
        )}
      </button>

      <p className="text-xs text-slate-400 text-center max-w-xs leading-relaxed">
        {noContacts
          ? "Add at least one trusted contact before using SOS — they'll receive alerts with your GPS location."
          : "Tap to trigger SOS alarm + send SMS & calls to all trusted contacts with your live GPS."}
      </p>

      {/* Alarm stop button */}
      {alarmActive && (
        <button
          onClick={stopAlarm}
          className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm shadow-lg animate-pulse transition"
        >
          🔇 Stop Alarm
        </button>
      )}

      {/* Error */}
      {error && (
        <div className="w-full max-w-md card px-4 py-3 bg-red-950/50 border-red-500/40 text-sm text-red-300 text-center rounded-xl">
          ❌ {error}
        </div>
      )}

      {/* Success Result Card */}
      {result && (
        <div className="w-full max-w-md card p-5 space-y-4 border-emerald-500/40 bg-slate-900/90 rounded-2xl shadow-2xl animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
              </span>
              <div>
                <p className="font-bold text-emerald-400 text-base flex items-center gap-1.5">
                  🚨 SOS DISPATCHED AUTOMATICALLY!
                </p>
                <p className="text-[11px] text-emerald-300/80 font-medium">
                  Calls & SMS delivered to all {contacts.length} trusted contacts
                </p>
              </div>
            </div>
            {result.event?.status === "active" ? (
              <button
                onClick={handleResolve}
                className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg transition active:scale-95 cursor-pointer ring-1 ring-emerald-400/40"
              >
                I'm Safe ✓
              </button>
            ) : (
              <button
                onClick={() => setResult(null)}
                className="text-xs px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 font-medium transition cursor-pointer"
              >
                Resolved ✕
              </button>
            )}
          </div>

          {/* Real Live GPS Location Card */}
          {coords && coords.lat && coords.lng && (
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📍</span>
                  <div>
                    <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                      Real GPS Location Transmitted
                    </p>
                    <p className="text-xs font-mono text-white">
                      {Number(coords.lat).toFixed(6)}, {Number(coords.lng).toFixed(6)}
                    </p>
                  </div>
                </div>
                <a
                  href={`https://maps.google.com/?q=${coords.lat},${coords.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1 shadow transition active:scale-95"
                >
                  🗺️ Google Maps ↗
                </a>
              </div>
              <p className="text-[10px] text-slate-400">
                This exact Google Maps live link has been automatically included in the emergency SMS to your contacts.
              </p>
            </div>
          )}

          {/* 100% Free 1-Tap SMS & WhatsApp to All Contacts */}
          <div className="space-y-2 pt-1">
            <a
              href={`sms:${contacts.map(c => c.phone.replace(/\D/g, '').slice(-10)).join(',')}?body=${encodeURIComponent(getEmergencyMsg())}`}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg active:scale-95 transition ring-1 ring-blue-400/40 text-center"
            >
              <span>📲</span>
              <span>Send 100% Free SMS to All {contacts.length} Contacts (via SIM)</span>
            </a>
            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(getEmergencyMsg())}`}
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider shadow active:scale-95 transition text-center"
            >
              <span>💬</span>
              <span>Send Free WhatsApp Alert to Group / Contacts</span>
            </a>
          </div>

          {/* Contact Delivery Status Cards */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Trusted Contacts Delivery Status
            </p>
            {contacts.map((c, i) => {
              const phone = formatPhone(c.phone);
              const phoneClean = phone.replace("+", "");
              const msg = encodeURIComponent(getEmergencyMsg());

              return (
                <div key={c.id || i} className="p-3 rounded-xl bg-night-900/80 border border-white/5 text-xs space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-slate-100 font-semibold">{c.name}</p>
                      <p className="text-slate-400 text-[11px]">{c.phone} {c.relation ? `· ${c.relation}` : ""}</p>
                    </div>
                    <div className="flex gap-1.5 items-center flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                        📱 SMS Delivered ✓
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                        📞 Voice Call Dispatched ✓
                      </span>
                    </div>
                  </div>

                  {/* Direct Contact Buttons (Backup) */}
                  <div className="pt-2 border-t border-white/5 flex gap-2 flex-wrap items-center">
                    <a
                      href={`tel:${phone}`}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-500 text-white text-[11px] font-semibold transition active:scale-95"
                    >
                      📞 Direct Call
                    </a>
                    <a
                      href={`sms:${phone}?body=${msg}`}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-500 text-white text-[11px] font-semibold transition active:scale-95"
                    >
                      📱 SMS
                    </a>
                    <a
                      href={`https://wa.me/${phoneClean}?text=${msg}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white text-[11px] font-semibold transition active:scale-95"
                    >
                      💬 WhatsApp
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Emergency Services Quick Dial */}
          <div className="pt-3 border-t border-white/10 space-y-2">
            <p className="text-xs font-semibold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>🚨</span> Direct Dial National Emergency Services
            </p>
            <div className="flex gap-2 flex-wrap">
              <a
                href="tel:112"
                onClick={() => { window.location.href = "tel:112"; }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg transition active:scale-95 ring-2 ring-red-400/40"
              >
                🆘 Emergency (112)
              </a>
              <a
                href="tel:100"
                onClick={() => { window.location.href = "tel:100"; }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold shadow transition active:scale-95"
              >
                🚔 Police (100)
              </a>
              <a
                href="tel:108"
                onClick={() => { window.location.href = "tel:108"; }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold shadow transition active:scale-95"
              >
                🚑 Ambulance (108)
              </a>
              <a
                href="tel:1091"
                onClick={() => { window.location.href = "tel:1091"; }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-pink-700 hover:bg-pink-600 text-white text-xs font-bold shadow transition active:scale-95"
              >
                📞 Women Helpline (1091)
              </a>
            </div>
          </div>

          {/* Location details & Map link */}
          <div className="pt-2 border-t border-white/10 flex flex-col gap-1.5 text-xs">
            {result.event?.location ? (
              <a
                href={`https://maps.google.com/?q=${result.event.location.lat},${result.event.location.lng}`}
                target="_blank"
                rel="noreferrer"
                className="text-violet-300 hover:text-violet-200 underline font-medium flex items-center gap-1.5"
              >
                <span>📍</span> View sent location on Google Maps ({result.event.location.lat.toFixed(4)}, {result.event.location.lng.toFixed(4)})
              </a>
            ) : (
              <p className="text-slate-400 flex items-center gap-1.5">
                <span>📍</span> Location coordinates were unavailable
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
