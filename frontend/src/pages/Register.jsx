import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout.jsx";
import PasswordInput from "../components/PasswordInput.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", phone: "", email: "", bloodGroup: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token, user } = await api.register(form);
      login(token, user);
      navigate("/dashboard");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="A few details to set up your safety profile"
      backTo="/login"
      backText="Back to Login"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Full name</label>
          <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Priya Sharma" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Phone number</label>
            <input className="input" type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="9876543210" />
          </div>
          <div>
            <label className="label">Blood group</label>
            <input className="input" value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })} placeholder="O+" />
          </div>
        </div>
        <div>
          <label className="label">Email (optional)</label>
          <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
        </div>
        <div>
          <label className="label">Password</label>
          <PasswordInput required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 6 characters" />
        </div>
        {error && (
          <div className="p-3 rounded-xl bg-coral-500/10 border border-coral-500/20 text-coral-400 text-sm">
            <p>{error}</p>
            {error.includes("already exists") && (
              <Link to="/login" className="inline-block mt-2 font-semibold text-violet-400 hover:text-violet-300 underline">
                Go to Login →
              </Link>
            )}
          </div>
        )}
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="text-sm text-slate-400 mt-6 text-center">
        Already have an account?{" "}
        <Link to="/login" className="text-violet-400 hover:text-violet-300">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
