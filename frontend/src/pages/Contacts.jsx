import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";

export default function Contacts() {
  const { token } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [form, setForm] = useState({ name: "", phone: "", relation: "" });
  const [error, setError] = useState("");

  function load() {
    api.getContacts(token).then(({ contacts }) => setContacts(contacts));
  }
  useEffect(load, [token]);

  async function handleAdd(e) {
    e.preventDefault();
    setError("");
    try {
      const { contacts } = await api.addContact(token, form);
      setContacts(contacts);
      setForm({ name: "", phone: "", relation: "" });
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleRemove(id) {
    const { contacts } = await api.removeContact(token, id);
    setContacts(contacts);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl font-semibold">Trusted contacts</h1>
        <p className="text-slate-400 text-sm">These are the people who get an SMS + call the moment you hit SOS.</p>
      </div>

      <form onSubmit={handleAdd} className="card p-5 grid sm:grid-cols-3 gap-3 items-end">
        <div>
          <label className="label">Name</label>
          <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 9876543210" />
        </div>
        <div>
          <label className="label">Relation</label>
          <input className="input" value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} placeholder="Mother, friend…" />
        </div>
        <button className="btn-primary sm:col-span-3">Add contact</button>
        {error && <p className="text-coral-400 text-sm sm:col-span-3">{error}</p>}
      </form>

      <div className="space-y-3">
        {contacts.length === 0 && (
          <p className="text-slate-500 text-sm">No contacts yet — add at least one so SOS has someone to reach.</p>
        )}
        {contacts.map((c) => (
          <div key={c.id} className="card p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{c.name}</p>
              <p className="text-sm text-slate-400">{c.phone} · {c.relation}</p>
            </div>
            <button onClick={() => handleRemove(c.id)} className="text-coral-400 hover:text-coral-300 text-sm">
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
