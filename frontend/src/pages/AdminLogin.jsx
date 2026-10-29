import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout.jsx";
import PasswordInput from "../components/PasswordInput.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";

export default function AdminLogin() {
  const { adminLogin } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login"); // login | bootstrap
  const [form, setForm] = useState({ name: "", email: "", password: "", setupKey: "" });
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token, admin } = await api.adminLogin(form);
      adminLogin(token, admin);
      navigate("/admin");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleBootstrap(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      await api.adminBootstrap(form);
      setInfo("Admin account created — you can log in now.");
      setMode("login");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title={mode === "login" ? "Admin login" : "Create admin account"}
      subtitle={mode === "login" ? "Guardian control center" : "Requires the ADMIN_SETUP_KEY set in the backend .env"}
      backTo="/login"
      backText="Back to Login"
    >
      <form onSubmit={mode === "login" ? handleLogin : handleBootstrap} className="space-y-4">
        {mode === "bootstrap" && (
          <div>
            <label className="label">Your name</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
        )}
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="label">Password</label>
          <PasswordInput required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        {mode === "bootstrap" && (
          <div>
            <label className="label">Setup key</label>
            <input className="input" required value={form.setupKey} onChange={(e) => setForm({ ...form, setupKey: e.target.value })} />
          </div>
        )}
        {error && <p className="text-coral-400 text-sm">{error}</p>}
        {info && <p className="text-teal-400 text-sm">{info}</p>}
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create admin"}
        </button>
      </form>
      <button onClick={() => setMode(mode === "login" ? "bootstrap" : "login")} className="text-xs text-slate-400 hover:text-slate-300 mt-4 w-full text-center">
        {mode === "login" ? "First time setup? Create the admin account" : "Back to admin login"}
      </button>
    </AuthLayout>
  );
}
