import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";

const SYMPTOMS = ["Cramps", "Headache", "Mood swings", "Fatigue", "Bloating", "Back pain"];

export default function PeriodTracker() {
  const { token } = useAuth();
  const [logs, setLogs] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [form, setForm] = useState({ startDate: "", endDate: "", flow: "medium", symptoms: [], notes: "" });
  const [error, setError] = useState("");

  function load() {
    api.getPeriodLogs(token).then(({ logs, prediction }) => {
      setLogs(logs);
      setPrediction(prediction);
    });
  }
  useEffect(load, [token]);

  function toggleSymptom(s) {
    setForm((f) => ({
      ...f,
      symptoms: f.symptoms.includes(s) ? f.symptoms.filter((x) => x !== s) : [...f.symptoms, s]
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      await api.addPeriodLog(token, form);
      setForm({ startDate: "", endDate: "", flow: "medium", symptoms: [], notes: "" });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleDelete(id) {
    await api.deletePeriodLog(token, id);
    load();
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl font-semibold">Period tracker</h1>
        <p className="text-slate-400 text-sm">Log your cycle to get predictions for your next period and fertile window.</p>
      </div>

      {prediction && (
        <div className="card p-6 grid sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-400 mb-1">Next period estimated</p>
            <p className="font-display text-xl font-semibold text-coral-400">{prediction.nextPeriodStart}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Fertile window</p>
            <p className="font-display text-xl font-semibold text-violet-400">
              {prediction.fertileWindow.start} → {prediction.fertileWindow.end}
            </p>
          </div>
          <p className="text-xs text-slate-500 sm:col-span-2">
            Based on an average cycle of {prediction.avgCycleLengthDays} days from your logged history.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Period start date</label>
            <input className="input" type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </div>
          <div>
            <label className="label">End date (optional)</label>
            <input className="input" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">Flow</label>
          <div className="flex gap-2">
            {["light", "medium", "heavy"].map((f) => (
              <button
                type="button"
                key={f}
                onClick={() => setForm({ ...form, flow: f })}
                className={`px-4 py-2 rounded-xl text-sm capitalize border ${
                  form.flow === f ? "bg-coral-500/15 border-coral-500/40 text-coral-400" : "border-white/10 text-slate-400"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Symptoms</label>
          <div className="flex flex-wrap gap-2">
            {SYMPTOMS.map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => toggleSymptom(s)}
                className={`px-3 py-1.5 rounded-full text-xs border ${
                  form.symptoms.includes(s) ? "bg-violet-500/15 border-violet-500/40 text-violet-300" : "border-white/10 text-slate-400"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Notes (optional)</label>
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        {error && <p className="text-coral-400 text-sm">{error}</p>}
        <button className="btn-primary w-full">Log entry</button>
      </form>

      <div className="space-y-2">
        <h3 className="font-display font-semibold text-lg">History</h3>
        {logs.length === 0 && <p className="text-slate-500 text-sm">No entries logged yet.</p>}
        {logs.map((l) => (
          <div key={l.id} className="card p-4 flex items-start justify-between">
            <div>
              <p className="font-medium text-sm">{l.startDate} {l.endDate && `→ ${l.endDate}`}</p>
              <p className="text-xs text-slate-400 capitalize">{l.flow} flow{l.symptoms?.length ? ` · ${l.symptoms.join(", ")}` : ""}</p>
              {l.notes && <p className="text-xs text-slate-500 mt-1">{l.notes}</p>}
            </div>
            <button onClick={() => handleDelete(l.id)} className="text-coral-400 hover:text-coral-300 text-xs">Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
