import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";

export default function AdminDashboard() {
  const { adminToken, admin, adminLogout } = useAuth();
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [tab, setTab] = useState("overview");
  const [users, setUsers] = useState([]);
  const [sosEvents, setSosEvents] = useState([]);
  const [reports, setReports] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!adminToken) return;
    api.adminOverview(adminToken).then(setOverview).catch(console.error);
    // Fetch all collections upfront for rich graphs & analytics
    api.adminUsers(adminToken).then(({ users }) => setUsers(users || [])).catch(() => {});
    api.adminSosEvents(adminToken).then(({ events }) => setSosEvents(events || [])).catch(() => {});
    api.adminUnsafeAreas(adminToken).then(({ reports }) => setReports(reports || [])).catch(() => {});
  }, [adminToken]);

  // Analytics: SOS Events grouped by day/date for trends
  const sosTrendData = useMemo(() => {
    if (!sosEvents || sosEvents.length === 0) return [];
    const counts = {};
    sosEvents.forEach((ev) => {
      const d = new Date(ev.createdAt);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    const entries = Object.entries(counts);
    // take the most recent 7-10 dates
    const slice = entries.slice(-8);
    const maxVal = Math.max(...slice.map(([, v]) => v), 1);
    return slice.map(([date, val]) => ({ date, count: val, heightPct: Math.round((val / maxVal) * 100) }));
  }, [sosEvents]);

  // Severity distribution for Unsafe Area Reports
  const severityDistribution = useMemo(() => {
    const counts = { high: 0, medium: 0, low: 0 };
    reports.forEach((r) => {
      const s = (r.severity || "medium").toLowerCase();
      if (counts[s] !== undefined) counts[s]++;
      else counts.medium++;
    });
    const total = reports.length || 1;
    return [
      { level: "High", count: counts.high, pct: Math.round((counts.high / total) * 100), color: "bg-coral-500", text: "text-coral-400" },
      { level: "Medium", count: counts.medium, pct: Math.round((counts.medium / total) * 100), color: "bg-amber-500", text: "text-amber-400" },
      { level: "Low", count: counts.low, pct: Math.round((counts.low / total) * 100), color: "bg-teal-500", text: "text-teal-400" },
    ];
  }, [reports]);

  // SOS Resolution Rate Donut metrics
  const sosStatusMetrics = useMemo(() => {
    const active = overview?.totals?.activeSos || 0;
    const total = overview?.totals?.totalSos || sosEvents.length || 0;
    const resolved = Math.max(0, total - active);
    const resolvedPct = total > 0 ? Math.round((resolved / total) * 100) : 0;
    return { active, resolved, total, resolvedPct };
  }, [overview, sosEvents]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    const q = searchQuery.toLowerCase();
    return users.filter((u) => u.name?.toLowerCase().includes(q) || u.phone?.includes(q) || u.email?.toLowerCase().includes(q));
  }, [users, searchQuery]);

  if (!overview) {
    return (
      <div className="min-h-screen bg-night-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-3 border-violet-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-display text-slate-400">Loading Safety Analytics Hub…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-night-950 text-slate-100 pb-16">
      {/* Modern Top Navigation Bar */}
      <header className="sticky top-0 z-30 backdrop-blur-md border-b border-white/10 bg-night-950/80 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center font-display font-bold text-xl shadow-glow">
              G
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-display font-bold text-lg leading-tight tracking-wide text-white">Guardian Safety Command</p>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  Admin v2.0
                </span>
              </div>
              <p className="text-xs text-slate-400">Welcome, {admin?.name || "Administrator"} · System Status: <span className="text-teal-400 font-medium">Online</span></p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                adminLogout();
                navigate("/admin/login");
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-coral-400 hover:border-coral-500/30 hover:bg-coral-500/10 transition-all duration-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-8 space-y-8">
        {/* KPI Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Registered Users"
            value={overview.totals.users}
            sub="+100% Secure Auth"
            icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            gradient="from-violet-500/20 to-purple-500/5"
            border="border-violet-500/30"
            color="text-violet-400"
          />
          <StatCard
            label="Active SOS Alerts"
            value={overview.totals.activeSos}
            sub={overview.totals.activeSos > 0 ? "Requires Immediate Attention" : "All Clear"}
            icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            gradient="from-coral-500/20 to-rose-500/5"
            border="border-coral-500/30"
            color="text-coral-400"
            highlightPulse={overview.totals.activeSos > 0}
          />
          <StatCard
            label="Community Reports"
            value={overview.totals.unsafeAreaReports}
            sub="Geo-flagged Hazard Zones"
            icon="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            gradient="from-amber-500/20 to-orange-500/5"
            border="border-amber-500/30"
            color="text-amber-400"
          />
          <StatCard
            label="Fall Detections & Devices"
            value={overview.totals.pairedDevices + (overview.totals.fallEvents || 0)}
            sub={`${overview.totals.fallEvents || 0} Falls · ${overview.totals.pairedDevices} Connected`}
            icon="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
            gradient="from-teal-500/20 to-emerald-500/5"
            border="border-teal-500/30"
            color="text-teal-400"
          />
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 border-b border-white/10 pb-1">
          {[
            { id: "overview", label: "📊 Analytics & Graphs" },
            { id: "users", label: `👥 User Directory (${users.length})` },
            { id: "sos", label: `🚨 SOS Emergency Logs (${sosEvents.length})` },
            { id: "reports", label: `📍 Unsafe Reports (${reports.length})` },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`px-5 py-2.5 text-sm font-semibold rounded-t-xl transition-all duration-200 border-b-2 -mb-[3px] ${
                tab === item.id
                  ? "border-violet-500 text-violet-300 bg-violet-500/10"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* ================= TAB: OVERVIEW (CHARTS & ANALYTICS) ================= */}
        {tab === "overview" && (
          <div className="space-y-8 animate-fade-in">
            {/* Visual Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Bar Graph: SOS Events Over Time */}
              <div className="lg:col-span-2 card p-6 bg-night-900/90 border border-white/10 rounded-2xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-violet-400"></span>
                      <h3 className="font-display font-semibold text-base text-white">Emergency Alert Activity Trends</h3>
                    </div>
                    <span className="text-xs text-slate-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                      Timeline Breakdown
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-6">Distribution of triggered SOS incidents across recorded dates</p>
                </div>

                {sosTrendData.length > 0 ? (
                  <div className="pt-4">
                    <div className="h-44 flex items-end justify-between gap-3 px-2 border-b border-white/10 pb-2">
                      {sosTrendData.map((d, idx) => (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                          {/* Tooltip on hover */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-mono bg-violet-950 border border-violet-500/40 text-violet-200 px-1.5 py-0.5 rounded shadow-lg">
                            {d.count} alerts
                          </div>
                          {/* The Bar */}
                          <div className="w-full max-w-[48px] bg-white/5 rounded-t-lg overflow-hidden flex items-end h-32">
                            <div
                              style={{ height: `${Math.max(12, d.heightPct)}%` }}
                              className="w-full bg-gradient-to-t from-violet-600 to-indigo-400 group-hover:from-violet-500 group-hover:to-pink-400 rounded-t-lg transition-all duration-300"
                            />
                          </div>
                          {/* X-axis date */}
                          <span className="text-[11px] text-slate-400 font-mono group-hover:text-white transition-colors">
                            {d.date}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mt-3 pt-1">
                      <span>Historical Incident Log</span>
                      <span className="text-violet-400 font-medium">Total: {sosEvents.length} recorded SOS alerts</span>
                    </div>
                  </div>
                ) : (
                  <div className="h-44 flex items-center justify-center text-sm text-slate-500">No trend data available yet.</div>
                )}
              </div>

              {/* Pie / Progress Breakdown: Incident Status & Hazard Severity */}
              <div className="card p-6 bg-night-900/90 border border-white/10 rounded-2xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-coral-400"></span>
                      <h3 className="font-display font-semibold text-base text-white">Hazard Severity Distribution</h3>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mb-6">Unsafe Area Reports classified by risk level</p>

                  {/* Horizontal Segment Bars */}
                  <div className="space-y-4">
                    {severityDistribution.map((item, idx) => (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-300 font-medium">{item.level} Severity</span>
                          <span className={`${item.text} font-mono font-semibold`}>
                            {item.count} ({item.pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${item.pct}%` }}
                            className={`h-full ${item.color} rounded-full transition-all duration-500`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Donut Resolution Metric */}
                <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400">SOS Resolution Rate</p>
                    <p className="text-xl font-display font-bold text-teal-400">{sosStatusMetrics.resolvedPct}%</p>
                    <p className="text-[11px] text-slate-500">
                      {sosStatusMetrics.resolved} resolved · {sosStatusMetrics.active} active
                    </p>
                  </div>
                  <div className="relative w-14 h-14 flex items-center justify-center">
                    <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-white/10"
                        strokeWidth="3.8"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-teal-400"
                        strokeDasharray={`${sosStatusMetrics.resolvedPct}, 100`}
                        strokeWidth="3.8"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <span className="absolute text-[11px] font-bold text-white font-mono">
                      {sosStatusMetrics.resolvedPct}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Feed Panels */}
            <div className="grid md:grid-cols-3 gap-6">
              {/* Recent SOS alerts */}
              <div className="card p-5 bg-night-900/80 border border-white/10 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-display font-semibold text-sm text-slate-200 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-coral-400 animate-ping"></span>
                    Recent SOS Alerts
                  </h4>
                  <span className="text-[11px] text-coral-400 font-mono font-medium">Live Feed</span>
                </div>
                <div className="space-y-3">
                  {overview.recentSos.length === 0 ? (
                    <Empty />
                  ) : (
                    overview.recentSos.slice(0, 5).map((e) => (
                      <div key={e.id} className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs uppercase font-bold px-2 py-0.5 rounded-full ${e.status === "active" ? "bg-coral-500/20 text-coral-400 border border-coral-500/30" : "bg-teal-500/20 text-teal-400 border border-teal-500/30"}`}>
                              {e.status}
                            </span>
                            <span className="text-xs text-slate-300 capitalize">{e.source || "App"} SOS</span>
                          </div>
                          {e.location && (
                            <p className="text-[11px] text-slate-400 mt-1 font-mono">
                              📍 {e.location.lat.toFixed(4)}, {e.location.lng.toFixed(4)}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">{new Date(e.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Recent Community Hazard Reports */}
              <div className="card p-5 bg-night-900/80 border border-white/10 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-display font-semibold text-sm text-slate-200">Recent Hazard Reports</h4>
                  <span className="text-[11px] text-amber-400 font-mono font-medium">Crowdsourced</span>
                </div>
                <div className="space-y-3">
                  {overview.recentReports.length === 0 ? (
                    <Empty />
                  ) : (
                    overview.recentReports.slice(0, 5).map((r) => (
                      <div key={r.id} className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-start justify-between">
                        <div>
                          <p className="text-xs font-medium text-slate-200">{r.category || "Unsafe Condition"}</p>
                          <p className="text-[11px] text-slate-400 line-clamp-1">{r.description || "No description provided"}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium capitalize ${r.severity === "high" ? "bg-coral-500/20 text-coral-300" : r.severity === "medium" ? "bg-amber-500/20 text-amber-300" : "bg-teal-500/20 text-teal-300"}`}>
                              {r.severity} Risk
                            </span>
                            <span className="text-[10px] text-slate-500">👍 {r.upvotes || 0} votes</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">{new Date(r.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Hardware & Fall Detections */}
              <div className="card p-5 bg-night-900/80 border border-white/10 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-display font-semibold text-sm text-slate-200">Fall & Wearable Events</h4>
                  <span className="text-[11px] text-violet-400 font-mono font-medium">IoT Sensors</span>
                </div>
                <div className="space-y-3">
                  {overview.recentFalls.length === 0 ? (
                    <Empty text="No fall incidents recorded." />
                  ) : (
                    overview.recentFalls.slice(0, 5).map((f) => (
                      <div key={f.id} className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-start justify-between">
                        <div>
                          <p className="text-xs font-semibold text-violet-300">Confidence: {(f.confidence * 100).toFixed(0)}%</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Status: <span className="text-white capitalize">{f.status}</span></p>
                          {f.lat && <p className="text-[10px] font-mono text-slate-500 mt-1">Lat: {f.lat}, Lng: {f.lng}</p>}
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">{new Date(f.createdAt).toLocaleDateString()}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB: USERS DIRECTORY ================= */}
        {tab === "users" && (
          <div className="card p-6 bg-night-900/90 border border-white/10 rounded-2xl space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-display font-bold text-lg text-white">Registered Users Directory</h3>
                <p className="text-xs text-slate-400">Total {users.length} active registered citizens and protectors</p>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search user name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-white/5 border border-white/10 text-xs text-white rounded-xl px-4 py-2 pl-9 w-64 focus:outline-none focus:border-violet-500"
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 font-medium">
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Blood Group</th>
                    <th className="py-3 px-4">Emergency Contacts</th>
                    <th className="py-3 px-4">Registered Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-200 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-violet-600/30 text-violet-300 flex items-center justify-center font-bold text-xs uppercase border border-violet-500/20">
                          {u.name?.charAt(0) || "U"}
                        </div>
                        {u.name}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">{u.phone}</td>
                      <td className="py-3 px-4 text-slate-400">{u.email || "—"}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-coral-500/10 text-coral-400 border border-coral-500/20 uppercase font-bold text-[10px]">
                          {u.bloodGroup || "N/A"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20 font-medium text-[11px]">
                          {u.emergencyContacts?.length || 0} contacts
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= TAB: SOS EMERGENCY LOGS ================= */}
        {tab === "sos" && (
          <div className="card p-6 bg-night-900/90 border border-white/10 rounded-2xl space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-lg text-white">Full SOS Emergency Logs</h3>
                <p className="text-xs text-slate-400">Total {sosEvents.length} incidents logged with GPS Coordinates & Dispatches</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 font-medium">
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Live Location Coordinates</th>
                    <th className="py-3 px-4">Trigger Time</th>
                    <th className="py-3 px-4">Services Alerted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sosEvents.map((e) => (
                    <tr key={e.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full uppercase text-[10px] font-bold ${
                          e.status === "active"
                            ? "bg-coral-500/20 text-coral-400 border border-coral-500/30"
                            : "bg-teal-500/20 text-teal-400 border border-teal-500/30"
                        }`}>
                          {e.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 capitalize font-medium text-slate-300">{e.source || "App"}</td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {e.location ? (
                          <a
                            href={`https://maps.google.com/?q=${e.location.lat},${e.location.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-violet-400 hover:underline flex items-center gap-1"
                          >
                            <span>📍 {e.location.lat.toFixed(5)}, {e.location.lng.toFixed(5)}</span>
                          </a>
                        ) : (
                          "Unknown"
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono">
                        {new Date(e.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {e.notifiedServices?.length || 3} automated calls/SMS
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= TAB: UNSAFE REPORTS ================= */}
        {tab === "reports" && (
          <div className="card p-6 bg-night-900/90 border border-white/10 rounded-2xl space-y-6 animate-fade-in">
            <div>
              <h3 className="font-display font-bold text-lg text-white">Community Hazard Reports</h3>
              <p className="text-xs text-slate-400">Total {reports.length} user-submitted unsafe hazard zones</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {reports.map((r) => (
                <div key={r.id} className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-200">{r.category}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      r.severity === "high"
                        ? "bg-coral-500/20 text-coral-400 border border-coral-500/30"
                        : r.severity === "medium"
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        : "bg-teal-500/20 text-teal-400 border border-teal-500/30"
                    }`}>
                      {r.severity} Severity
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{r.description || "No additional commentary provided."}</p>
                  <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] text-slate-500">
                    <span className="font-mono">📍 {r.lat?.toFixed(4)}, {r.lng?.toFixed(4)}</span>
                    <span>👍 {r.upvotes || 0} Upvotes</span>
                    <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, sub, icon, gradient, border, color, highlightPulse }) {
  return (
    <div className={`card p-5 bg-gradient-to-br ${gradient} border ${border} rounded-2xl relative overflow-hidden transition-all hover:scale-[1.01]`}>
      {highlightPulse && (
        <span className="absolute top-3 right-3 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-coral-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-coral-500"></span>
        </span>
      )}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400 font-medium">{label}</p>
        <div className={`p-2 rounded-xl bg-white/5 ${color}`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={icon} />
          </svg>
        </div>
      </div>
      <p className={`font-display text-3xl font-bold mt-2 ${color}`}>{value}</p>
      <p className="text-[11px] text-slate-400 mt-1 font-medium">{sub}</p>
    </div>
  );
}

function Empty({ text = "Nothing recorded yet." }) {
  return <p className="text-xs text-slate-500 py-3 text-center">{text}</p>;
}
