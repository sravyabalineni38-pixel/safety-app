import { Link } from "react-router-dom";

export default function AuthLayout({ title, subtitle, backTo, backText, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-11 h-11 rounded-2xl bg-violet-500 flex items-center justify-center font-display font-bold text-xl shadow-glow">
            G
          </div>
          <span className="font-display font-semibold text-2xl tracking-tight">Guardian</span>
        </div>
        <div className="card p-8">
          {backTo && (
            <Link
              to={backTo}
              className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-violet-300 transition-colors mb-4 group"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 transform group-hover:-translate-x-1 transition-transform"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              {backText || "Back"}
            </Link>
          )}
          <h1 className="font-display text-2xl font-semibold mb-1">{title}</h1>
          {subtitle && <p className="text-slate-400 text-sm mb-6">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
