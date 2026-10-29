import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Home", icon: "⌂" },
  { to: "/contacts", label: "Contacts", icon: "☎" },
  { to: "/safe-route", label: "Safe Route", icon: "◎" },
  { to: "/unsafe-areas", label: "Unsafe Areas", icon: "▲" },
  { to: "/safety-timer", label: "Timer", icon: "◷" },
  { to: "/fall-detection", label: "Fall Alerts", icon: "✦" },
  { to: "/wearable", label: "Wearable", icon: "⌚" },
  { to: "/battery", label: "Battery", icon: "⚡" },
  { to: "/period-tracker", label: "Period Tracker", icon: "♥" },
  { to: "/ai-assistant", label: "AI Assistant", icon: "✧" },
  { to: "/history", label: "History", icon: "≡" }
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-64 shrink-0 h-screen sticky top-0 border-r border-white/5 bg-night-950/60 px-4 py-6">
        <div className="flex items-center gap-2 px-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-violet-500 flex items-center justify-center font-display font-bold shadow-glow">G</div>
          <span className="font-display font-semibold text-lg tracking-tight">Guardian</span>
        </div>
        <nav className="flex-1 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive ? "bg-violet-500/15 text-violet-300" : "text-slate-400 hover:text-slate-100 hover:bg-white/5"
                }`
              }
            >
              <span className="w-5 text-center">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/5 pt-4 mt-4">
          <p className="text-sm text-slate-300 px-2 mb-2 truncate">{user?.name}</p>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="w-full text-left px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-coral-400 hover:bg-white/5 transition-colors"
          >
            Log out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-night-950/90 backdrop-blur border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-500 flex items-center justify-center text-sm font-display font-bold">G</div>
          <span className="font-display font-semibold">Guardian</span>
        </div>
        <button onClick={() => { logout(); navigate("/login"); }} className="text-xs text-slate-400">
          Log out
        </button>
      </header>

      {/* Mobile bottom nav (subset) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-night-950/95 backdrop-blur border-t border-white/5 flex justify-around py-2">
        {NAV_ITEMS.slice(0, 5).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center text-[10px] gap-0.5 px-2 py-1 rounded-lg ${
                isActive ? "text-violet-300" : "text-slate-500"
              }`
            }
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
