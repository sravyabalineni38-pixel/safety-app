import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";

export default function Wearable() {
  const { token } = useAuth();
  const [devices, setDevices] = useState([]);
  const [form, setForm] = useState({ deviceName: "Guardian Band", deviceId: "" });
  const [error, setError] = useState("");

  function load() {
    api.getDevices(token).then(({ devices }) => setDevices(devices));
  }
  useEffect(load, [token]);

  async function handlePair(e) {
    e.preventDefault();
    setError("");
    try {
      await api.pairDevice(token, form);
      setForm({ deviceName: "Guardian Band", deviceId: "" });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleSync(id) {
    const level = Math.max(0, Math.min(100, Math.round(Math.random() * 100)));
    await api.syncDevice(token, id, { battery: level, connected: true });
    load();
  }

  async function handleUnpair(id) {
    await api.unpairDevice(token, id);
    load();
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl font-semibold">Wearable integration</h1>
        <p className="text-slate-400 text-sm">
          Pair an ESP32-based safety band (GPS + MPU6050 + SOS button). Once paired, the band's SOS press and fall
          sensor connect straight into this app's emergency flow.
        </p>
      </div>

      <form onSubmit={handlePair} className="card p-5 grid sm:grid-cols-2 gap-3 items-end">
        <div>
          <label className="label">Device name</label>
          <input className="input" value={form.deviceName} onChange={(e) => setForm({ ...form, deviceName: e.target.value })} />
        </div>
        <div>
          <label className="label">Device ID (from the band)</label>
          <input className="input" required value={form.deviceId} onChange={(e) => setForm({ ...form, deviceId: e.target.value })} placeholder="ESP32-XXXXXX" />
        </div>
        {error && <p className="text-coral-400 text-sm sm:col-span-2">{error}</p>}
        <button className="btn-primary sm:col-span-2">Pair device</button>
      </form>

      <div className="space-y-3">
        {devices.length === 0 && <p className="text-slate-500 text-sm">No wearable paired yet.</p>}
        {devices.map((d) => (
          <div key={d.id} className="card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`w-2.5 h-2.5 rounded-full ${d.connected ? "bg-teal-400" : "bg-slate-600"}`} />
              <div>
                <p className="font-medium">{d.deviceName}</p>
                <p className="text-xs text-slate-500">{d.deviceId} · battery {d.battery}% · synced {new Date(d.lastSync).toLocaleTimeString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => handleSync(d.id)} className="btn-secondary text-xs px-3 py-2">Sync now</button>
              <button onClick={() => handleUnpair(d.id)} className="text-coral-400 hover:text-coral-300 text-xs px-2">Unpair</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <h3 className="font-display font-semibold mb-2">Firmware wiring notes</h3>
        <p className="text-sm text-slate-400">
          On the ESP32: read GPS via a NEO-6M module, poll the MPU6050 for a hard-fall pattern, and wire a push button
          to a GPIO pin for SOS. On button press or fall detection, have the board POST to
          <code className="mx-1 px-1.5 py-0.5 rounded bg-night-900 text-violet-300">/api/sos/trigger</code>
          or
          <code className="mx-1 px-1.5 py-0.5 rounded bg-night-900 text-violet-300">/api/fall-detection</code>
          over Wi-Fi/GSM with the paired user's auth token.
        </p>
      </div>
    </div>
  );
}
