import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";
import SOSButton from "../components/SOSButton.jsx";

export default function Dashboard() {
  const { token, user } = useAuth();
  const [battery, setBattery] = useState(null);
  const [contactsCount, setContactsCount] = useState(0);
  const [activeTimer, setActiveTimer] = useState(null);
  const [risk, setRisk] = useState(null);
  const [shakeDetected, setShakeDetected] = useState(false);
  const sosRef = useRef(null);
  const lastShakeRef = useRef(0);

  useEffect(() => {
    api.latestBattery(token).then(({ latest }) => setBattery(latest)).catch(() => {});
    api.getContacts(token).then(({ contacts }) => setContactsCount(contacts.length)).catch(() => {});
    api.activeTimer(token).then(({ timer }) => setActiveTimer(timer)).catch(() => {});
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          api
            .scoreLocation(token, { lat: pos.coords.latitude, lng: pos.coords.longitude })
            .then(setRisk)
            .catch(() => {});
        },
        () => {}
      );
    }
  }, [token]);

  // Shake detection for SOS (using DeviceMotion API)
  useEffect(() => {
    function handleMotion(event) {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;
      const totalAcc = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
      const now = Date.now();
      if (totalAcc > 30 && now - lastShakeRef.current > 3000) {
        lastShakeRef.current = now;
        setShakeDetected(true);
        setTimeout(() => setShakeDetected(false), 3000);
        // Auto-trigger SOS on shake
        if (sosRef.current) {
          sosRef.current.click();
        }
      }
    }
    window.addEventListener("devicemotion", handleMotion);
    return () => window.removeEventListener("devicemotion", handleMotion);
  }, []);

  // Panic alarm function
  const [panicAlarm, setPanicAlarm] = useState(false);
  const panicAudioRef = useRef(null);

  function triggerPanicAlarm() {
    if (panicAlarm) {
      // Stop alarm
      stopPanicAlarm();
      return;
    }
    setPanicAlarm(true);
    if (navigator.vibrate) {
      navigator.vibrate([500, 200, 500, 200, 500, 200, 500, 200, 500]);
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(2500, ctx.currentTime);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      // Rapid beeping pattern
      const now = ctx.currentTime;
      for (let i = 0; i < 60; i++) {
        const t = now + i * 0.2;
        gain.gain.setValueAtTime(0.4, t);
        gain.gain.setValueAtTime(0, t + 0.1);
      }
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      panicAudioRef.current = { ctx, osc, gain };
    } catch (e) {
      console.warn("Panic alarm sound failed:", e);
    }
  }

  const [callingService, setCallingService] = useState(null);

  function stopPanicAlarm() {
    setPanicAlarm(false);
    if (navigator.vibrate) navigator.vibrate(0);
    if (panicAudioRef.current) {
      try {
        panicAudioRef.current.osc.stop();
        panicAudioRef.current.ctx.close();
      } catch (e) {}
      panicAudioRef.current = null;
    }
  }

  function callEmergency(number, serviceName) {
    setCallingService({ number, name: serviceName });
    
    // Ringing sound
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        setTimeout(() => {
          try { osc.stop(); ctx.close(); } catch (_) {}
        }, 1500);
      }
    } catch (_) {}

    // Voice announcement
    try {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(`Calling ${serviceName} on ${number}`);
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    } catch (_) {}

    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 300]);
    }

    // Direct phone dialer trigger
    window.location.href = `tel:${number}`;
  }

  return (
    <div className="space-y-8">
      {/* Active Calling Overlay Modal */}
      {callingService && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="card max-w-sm w-full p-6 text-center space-y-5 bg-gradient-to-b from-red-950/90 to-night-950 border-red-500/50 shadow-2xl rounded-3xl">
            <div className="w-20 h-20 mx-auto rounded-full bg-red-600/20 border-2 border-red-500/60 flex items-center justify-center animate-pulse">
              <span className="text-4xl">🚨</span>
            </div>
            <div>
              <h3 className="font-bold text-2xl text-white">Calling {callingService.name}</h3>
              <p className="text-red-400 font-mono text-3xl font-bold mt-1 tracking-wider">{callingService.number}</p>
              <p className="text-slate-300 text-xs mt-2">Opening your phone's dialer automatically...</p>
            </div>

            <div className="space-y-2.5 pt-1">
              <a
                href={`tel:${callingService.number}`}
                onClick={() => { window.location.href = `tel:${callingService.number}`; }}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-base shadow-xl active:scale-95 transition ring-2 ring-red-400/40"
              >
                <span>📞</span>
                <span>Tap to Dial {callingService.number}</span>
              </a>
              <button
                onClick={() => setCallingService(null)}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 font-semibold text-xs transition cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <p className="text-slate-400 text-sm">Welcome back,</p>
        <h1 className="font-display text-3xl font-semibold">{user?.name?.split(" ")[0] || "there"} 👋</h1>
      </div>

      {/* Shake detection indicator */}
      {shakeDetected && (
        <div className="card p-3 bg-red-950/50 border-red-500/40 text-center animate-pulse">
          <p className="text-red-300 font-semibold text-sm">📳 Shake detected! SOS triggering...</p>
        </div>
      )}

      {/* Emergency section */}
      <div className="card p-8 flex flex-col items-center">
        <span className="pill bg-coral-500/15 text-coral-400 mb-4">Emergency</span>
        <SOSButton />
        
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {/* Panic Alarm Button */}
          <button
            onClick={triggerPanicAlarm}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm shadow-lg transition active:scale-95 ${
              panicAlarm
                ? "bg-amber-500 hover:bg-amber-400 text-black animate-pulse"
                : "bg-amber-600 hover:bg-amber-500 text-white"
            }`}
          >
            {panicAlarm ? "🔇 Stop Alarm" : "🔔 Panic Alarm"}
          </button>

          {/* Quick Emergency Dial Buttons */}
          <button
            onClick={() => callEmergency("112", "National Emergency (112)")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-xl transition active:scale-95 cursor-pointer ring-2 ring-red-400/40"
          >
            🚨 Call 112
          </button>
          <button
            onClick={() => callEmergency("100", "Police Control Room (100)")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg transition active:scale-95 cursor-pointer ring-1 ring-blue-400/30"
          >
            🚔 Police (100)
          </button>
          <button
            onClick={() => callEmergency("108", "Free Ambulance (108)")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg transition active:scale-95 cursor-pointer ring-1 ring-emerald-400/30"
          >
            🚑 Ambulance (108)
          </button>
          <button
            onClick={() => callEmergency("1091", "Women Helpline (1091)")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-sm shadow-lg transition active:scale-95 cursor-pointer ring-1 ring-pink-400/30"
          >
            📞 Women Helpline (1091)
          </button>

          <ShareLiveLocationButton token={token} />
        </div>
      </div>

      {/* Quick stat row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Trusted contacts" value={contactsCount} link="/contacts" accent="violet" />
        <StatCard
          label="Battery"
          value={battery ? `${battery.level}%` : "—"}
          link="/battery"
          accent={battery && battery.level <= 15 ? "coral" : "teal"}
        />
        <StatCard label="Safety timer" value={activeTimer ? "Active" : "Off"} link="/safety-timer" accent={activeTimer ? "amber" : "violet"} />
        <StatCard label="Area risk" value={risk ? risk.level : "…"} link="/safe-route" accent={risk?.level === "high" ? "coral" : risk?.level === "medium" ? "amber" : "teal"} />
      </div>

      {/* Flow sections matching: Smart Safety Navigation / Wearable / AI Assistant */}
      <div className="grid md:grid-cols-3 gap-4">
        <FeatureCard
          to="/safe-route"
          icon="◎"
          title="Smart Safety Navigation"
          desc="Enter a destination and get an AI-suggested route that avoids reported unsafe spots."
        />
        <FeatureCard
          to="/wearable"
          icon="⌚"
          title="Wearable Integration"
          desc="Pair your safety band — its SOS button and fall sensor connect straight into this app."
        />
        <FeatureCard
          to="/ai-assistant"
          icon="✧"
          title="AI Assistant"
          desc="Ask about routes, timers, or what to do right now — available anytime."
        />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <FeatureCard to="/safety-timer" icon="◷" title="Safety Timer" desc="Auto-alert contacts if you don't check in on time." />
        <FeatureCard to="/unsafe-areas" icon="▲" title="Unsafe Area Reporting" desc="See and report unsafe spots near you." />
        <FeatureCard to="/history" icon="≡" title="Emergency History" desc="Review every past SOS, fall alert and timer event." />
      </div>
    </div>
  );
}

function StatCard({ label, value, link, accent }) {
  const colors = {
    violet: "text-violet-400",
    coral: "text-coral-400",
    teal: "text-teal-400",
    amber: "text-amber-400"
  };
  return (
    <Link to={link} className="card p-4 hover:border-white/10 transition-colors">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={`font-display text-xl font-semibold capitalize ${colors[accent]}`}>{value}</p>
    </Link>
  );
}

function FeatureCard({ to, icon, title, desc }) {
  return (
    <Link to={to} className="card p-5 hover:border-violet-500/30 hover:bg-white/[0.03] transition-colors group">
      <div className="w-10 h-10 rounded-xl bg-violet-500/15 text-violet-300 flex items-center justify-center mb-3 group-hover:bg-violet-500/25 transition-colors">
        {icon}
      </div>
      <h3 className="font-display font-semibold mb-1">{title}</h3>
      <p className="text-sm text-slate-400">{desc}</p>
    </Link>
  );
}

function ShareLiveLocationButton({ token }) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState("");

  async function handleShare() {
    setLoading(true);
    try {
      const res = await api.getShareToken(token);
      const fullUrl = `${window.location.origin}${res.shareUrl}`;
      setLink(fullUrl);
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(fullUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }
      // Also try to use native share if available
      if (navigator.share) {
        try {
          await navigator.share({
            title: "🚨 Guardian — My Live Location",
            text: "Track my live location for safety:",
            url: fullUrl
          });
        } catch (e) {
          // user cancelled share dialog, that's OK
        }
      }
    } catch (e) {
      alert("Failed to generate live location share link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleShare}
        disabled={loading}
        className="btn-secondary text-xs flex items-center gap-2 px-4 py-2 border-violet-500/30 text-violet-300 hover:bg-violet-500/10"
      >
        <span>📡</span>
        {copied ? "Link Copied! ✓" : "Share Live Location"}
      </button>
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-slate-400 hover:text-slate-200 underline font-mono"
        >
          {link}
        </a>
      )}
    </div>
  );
}
