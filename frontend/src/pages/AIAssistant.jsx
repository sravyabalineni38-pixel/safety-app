import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";

const SUGGESTIONS = [
  "I feel unsafe",
  "trigger SOS",
  "show my contacts",
  "how does SOS work",
  "safe route",
  "safety timer",
  "call my contact",
  "am I safe?",
  "share location",
  "battery status",
];

export default function AIAssistant() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  // Microphone & Speech Recognition states
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [autoSendVoice, setAutoSendVoice] = useState(true);
  const [voiceLang, setVoiceLang] = useState("en-IN"); // en-IN, te-IN, en-US
  const [speechError, setSpeechError] = useState("");
  const [speechSupported, setSpeechSupported] = useState(true);
  const [voiceOutput, setVoiceOutput] = useState(true); // Speak AI replies
  const [speakingMessageIndex, setSpeakingMessageIndex] = useState(null);

  const endRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const autoSendTimeoutRef = useRef(null);

  // Play subtle feedback chimes on mic start/stop
  function playMicSound(type = "start") {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (type === "start") {
        osc.frequency.setValueAtTime(520, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(520, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      }
    } catch {}
  }

  // Text-To-Speech for assistant responses
  const speakText = useCallback((text, index = null) => {
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      if (text) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        utterance.onstart = () => setSpeakingMessageIndex(index);
        utterance.onend = () => setSpeakingMessageIndex(null);
        utterance.onerror = () => setSpeakingMessageIndex(null);
        window.speechSynthesis.speak(utterance);
      } else {
        setSpeakingMessageIndex(null);
      }
    } catch (e) {
      console.warn("TTS error:", e);
    }
  }, []);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = voiceLang;

    recognition.onstart = () => {
      setIsListening(true);
      setSpeechError("");
      setInterimTranscript("");
      playMicSound("start");
    };

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      const currentSpeech = final || interim;
      if (currentSpeech) {
        setInput(currentSpeech);
        setInterimTranscript(interim);
      }

      // If user finished a final phrase and autoSend is enabled
      if (final.trim() && autoSendVoice) {
        clearTimeout(autoSendTimeoutRef.current);
        autoSendTimeoutRef.current = setTimeout(() => {
          handleSend(final.trim());
          stopListening();
        }, 400); // 400ms buffer for seamless delivery without delay
      }
    };

    recognition.onerror = (event) => {
      console.warn("Speech recognition error:", event.error);
      if (event.error === "not-allowed") {
        setSpeechError("Microphone permission denied. Please allow mic access in your browser.");
      } else if (event.error !== "no-speech") {
        setSpeechError(`Voice error: ${event.error}`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript("");
      playMicSound("stop");
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
      clearTimeout(autoSendTimeoutRef.current);
    };
  }, [voiceLang, autoSendVoice]);

  // Toggle Microphone
  function toggleListening() {
    if (!speechSupported) {
      setSpeechError("Voice recognition is not supported in this browser. Try Chrome, Edge, or Safari.");
      return;
    }
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }

  function startListening() {
    setSpeechError("");
    setInterimTranscript("");
    try {
      if (recognitionRef.current) {
        recognitionRef.current.lang = voiceLang;
        recognitionRef.current.start();
      }
    } catch (e) {
      console.warn("Recognition already active or restart error:", e);
    }
  }

  function stopListening() {
    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    } catch (e) {}
    setIsListening(false);
  }

  // Load chat history
  useEffect(() => {
    api.chatHistory(token)
      .then(({ messages }) => {
        setMessages(messages || []);
        if ((messages || []).length > 0) setShowSuggestions(false);
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function handleSend(text) {
    const msgText = (text || input).trim();
    if (!msgText) return;

    // Stop listening if active
    if (isListening) {
      stopListening();
    }

    setInput("");
    setInterimTranscript("");
    setShowSuggestions(false);
    setMessages((m) => [...m, { role: "user", text: msgText, at: new Date().toISOString() }]);
    setSending(true);

    try {
      const { reply } = await api.sendChatMessage(token, { message: msgText });
      setMessages((m) => {
        const nextList = [...m, reply];
        // If voice output is enabled, speak the assistant's reply automatically
        if (voiceOutput && reply?.text) {
          speakText(reply.text, nextList.length - 1);
        }
        return nextList;
      });
    } catch (e) {
      const errorMsg = "Sorry, I couldn't connect to the server. Please check your connection and try again.";
      setMessages((m) => [...m, {
        role: "assistant",
        text: errorMsg,
        at: new Date().toISOString()
      }]);
      if (voiceOutput) speakText(errorMsg);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function clearHistory() {
    try {
      window.speechSynthesis?.cancel();
      await fetch("/api/ai-assistant/history", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages([]);
      setShowSuggestions(true);
    } catch {}
  }

  return (
    <div className="max-w-2xl w-full flex flex-col" style={{ height: "calc(100vh - 6rem)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0 flex-wrap gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
            <span className="text-violet-400">✧</span> AI Safety Assistant
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm">
            Speak with the microphone or type anything — acts instantly without delay.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Voice Response Output Toggle */}
          <button
            type="button"
            onClick={() => {
              if (voiceOutput) window.speechSynthesis?.cancel();
              setVoiceOutput(!voiceOutput);
            }}
            className={`text-xs px-2.5 py-1 rounded-lg border transition flex items-center gap-1 ${
              voiceOutput
                ? "bg-violet-600/20 text-violet-300 border-violet-500/30"
                : "bg-white/5 text-slate-400 border-white/10"
            }`}
            title="Read assistant replies out loud"
          >
            <span>{voiceOutput ? "🔊 Voice Reply: ON" : "🔇 Voice Reply: OFF"}</span>
          </button>

          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              className="text-xs text-slate-500 hover:text-slate-300 transition px-2 py-1 rounded border border-white/10 hover:border-white/20"
            >
              Clear chat
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-2">
        {/* Welcome card */}
        {messages.length === 0 && (
          <div className="card p-5 text-sm text-slate-300 space-y-2 border-violet-500/20 bg-violet-900/10">
            <p className="font-semibold text-violet-300 flex items-center gap-2">
              <span>👋 Hello! I'm your Guardian safety assistant.</span>
            </p>
            <p className="text-slate-400 text-xs leading-relaxed">
              Tap the <strong className="text-violet-300">🎙️ Microphone button</strong> below to speak your request instantly without typing! You can say:
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="px-2 py-0.5 rounded bg-white/5 text-[11px] text-slate-300">"Trigger SOS now"</span>
              <span className="px-2 py-0.5 rounded bg-white/5 text-[11px] text-slate-300">"I feel unsafe here"</span>
              <span className="px-2 py-0.5 rounded bg-white/5 text-[11px] text-slate-300">"Show my contacts"</span>
              <span className="px-2 py-0.5 rounded bg-white/5 text-[11px] text-slate-300">"Calculate safe route"</span>
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"} gap-1`}>
            <div className="relative group max-w-[85%]">
              <div
                className={`px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                  m.role === "user"
                    ? "bg-violet-600 text-white rounded-br-sm shadow-md"
                    : "card rounded-bl-sm text-slate-200 border-violet-500/15"
                }`}
              >
                {m.text}
              </div>

              {/* TTS Listen Button on Assistant Messages */}
              {m.role === "assistant" && (
                <button
                  type="button"
                  onClick={() => {
                    if (speakingMessageIndex === i) {
                      window.speechSynthesis?.cancel();
                      setSpeakingMessageIndex(null);
                    } else {
                      speakText(m.text, i);
                    }
                  }}
                  className={`absolute -bottom-2 -right-2 p-1.5 rounded-full border shadow-sm transition text-xs ${
                    speakingMessageIndex === i
                      ? "bg-violet-600 text-white border-violet-400 animate-pulse"
                      : "bg-night-900/90 text-slate-400 border-white/10 hover:text-slate-200 hover:border-violet-500/40"
                  }`}
                  title={speakingMessageIndex === i ? "Stop speaking" : "Listen to this reply"}
                >
                  {speakingMessageIndex === i ? "⏹️" : "🔊"}
                </button>
              )}
            </div>

            {/* SOS Action Result Card */}
            {m.actionResult?.type === "SOS_SENT" && (
              <div className="max-w-[85%] w-full card p-4 border-teal-500/30 bg-teal-950/30 rounded-xl text-xs space-y-2">
                <p className="text-teal-300 font-semibold flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-500"></span>
                  </span>
                  SOS Dispatched via AI Assistant
                </p>
                {m.actionResult.results?.map((r, j) => (
                  <div key={j} className="flex items-center justify-between bg-night-900/60 px-3 py-2 rounded-lg border border-white/5">
                    <div>
                      <p className="text-slate-200 font-medium">{r.contact?.name}</p>
                      <p className="text-slate-500 text-[10px]">{r.contact?.phone}</p>
                    </div>
                    <div className="flex gap-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${r.sms?.ok ? "bg-teal-500/20 text-teal-300" : "bg-red-500/20 text-red-300"}`}>
                        📱 {r.sms?.ok ? (r.sms.mode === "demo" ? "Demo" : "SMS ✓") : "SMS ✗"}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${r.call?.ok ? "bg-violet-500/20 text-violet-300" : "bg-red-500/20 text-red-300"}`}>
                        📞 {r.call?.ok ? (r.call.mode === "demo" ? "Demo" : "Call ✓") : "Call ✗"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {m.actionResult?.type === "SOS_ERROR" && (
              <div className="max-w-[85%] card p-3 border-red-500/30 bg-red-950/20 text-xs text-red-300 rounded-xl">
                ❌ SOS Error: {m.actionResult.error}
              </div>
            )}

            <span className="text-[10px] text-slate-600 px-1">
              {m.role === "assistant" ? "🛡️ Guardian" : "You"} · {m.at ? new Date(m.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : ""}
            </span>
          </div>
        ))}

        {/* Typing indicator */}
        {sending && (
          <div className="flex items-start">
            <div className="card px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Quick suggestions */}
      {showSuggestions && (
        <div className="shrink-0 flex flex-wrap gap-2 py-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleSend(s)}
              className="px-3 py-1.5 rounded-full text-xs border border-violet-500/30 text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 transition"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* LIVE VOICE RECORDING STATUS BANNER */}
      {isListening && (
        <div className="shrink-0 mb-2 p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 flex items-center justify-between gap-3 animate-fade-in shadow-lg">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
            <div className="truncate">
              <span className="text-xs font-semibold text-rose-300">Listening to your voice… </span>
              <span className="text-xs text-slate-200 italic">
                {input ? `"${input}"` : "Speak now, auto-sending upon pause…"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {input.trim() && (
              <button
                type="button"
                onClick={() => handleSend(input)}
                className="px-2.5 py-1 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg transition"
              >
                Send Now ⚡
              </button>
            )}
            <button
              type="button"
              onClick={stopListening}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-slate-300 text-xs rounded-lg transition"
            >
              Cancel ✕
            </button>
          </div>
        </div>
      )}

      {/* Voice Error notice */}
      {speechError && (
        <div className="shrink-0 mb-2 p-2 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center justify-between">
          <span>⚠️ {speechError}</span>
          <button onClick={() => setSpeechError("")} className="text-slate-400 hover:text-white text-xs ml-2">✕</button>
        </div>
      )}

      {/* Input controls & Microphone integration */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        className="shrink-0 mt-1 flex gap-2 items-center"
      >
        <div className="relative flex-1">
          <input
            ref={inputRef}
            className={`input w-full pr-10 text-sm ${
              isListening ? "border-rose-500/50 ring-2 ring-rose-500/30 bg-rose-950/10" : ""
            }`}
            placeholder={isListening ? "Listening to your voice..." : "Ask me anything or use the mic to speak…"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending}
          />

          {input && (
            <button
              type="button"
              onClick={() => { setInput(""); setInterimTranscript(""); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* HIGH-VISIBILITY MICROPHONE BUTTON */}
        <button
          type="button"
          onClick={toggleListening}
          disabled={sending}
          className={`shrink-0 p-3 rounded-xl flex items-center justify-center transition-all ${
            isListening
              ? "bg-rose-500 text-white shadow-glow-coral ring-4 ring-rose-500/40 scale-105"
              : "bg-night-800 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 hover:border-violet-500/60 shadow-sm"
          }`}
          title={isListening ? "Click to stop listening" : "Click to speak with microphone (zero delay)"}
        >
          {isListening ? (
            <span className="text-lg animate-pulse">⏹️</span>
          ) : (
            <span className="text-lg">🎙️</span>
          )}
        </button>

        {/* Send Button */}
        <button
          className="btn-primary shrink-0 px-5 flex items-center gap-1 font-semibold"
          disabled={sending || !input.trim()}
        >
          {sending ? (
            <span className="animate-spin inline-block">⟳</span>
          ) : (
            <span>Send</span>
          )}
        </button>
      </form>

      {/* Voice Settings Bar */}
      <div className="shrink-0 flex items-center justify-between text-[11px] text-slate-500 px-1 pt-2 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-200">
            <input
              type="checkbox"
              checked={autoSendVoice}
              onChange={(e) => setAutoSendVoice(e.target.checked)}
              className="rounded accent-violet-500"
            />
            <span>Auto-send voice on pause (instant)</span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <span>Mic language:</span>
          <select
            value={voiceLang}
            onChange={(e) => setVoiceLang(e.target.value)}
            className="bg-night-900 border border-white/10 rounded px-2 py-0.5 text-[11px] text-slate-300 focus:outline-none"
          >
            <option value="en-IN">English (India)</option>
            <option value="te-IN">Telugu (తెలుగు)</option>
            <option value="en-US">English (US)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
