import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout.jsx";
import PasswordInput from "../components/PasswordInput.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ phone: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token, user } = await api.login(form);
      login(token, user);
      navigate("/dashboard");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to your safety dashboard">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Phone number</label>
          <input
            className="input"
            type="tel"
            required
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="9876543210"
          />
        </div>
        <div>
          <label className="label">Password</label>
          <PasswordInput
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="••••••••"
          />
        </div>
        {error && (
          <div className="p-3 rounded-xl bg-coral-500/10 border border-coral-500/20 text-coral-400 text-sm">
            <p>{error}</p>
            {error.includes("Invalid") && (
              <Link to="/register" className="inline-block mt-2 font-semibold text-violet-400 hover:text-violet-300 underline">
                Need an account? Register here →
              </Link>
            )}
          </div>
        )}
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="text-sm text-slate-400 mt-6 text-center">
        New here?{" "}
        <Link to="/register" className="text-violet-400 hover:text-violet-300">
          Create an account
        </Link>
      </p>
      <p className="text-xs text-slate-500 mt-3 text-center">
        Are you an admin?{" "}
        <Link to="/admin/login" className="text-slate-400 hover:text-slate-300 underline">
          Go to admin login
        </Link>
      </p>
    </AuthLayout>
  );
}
