import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export function ProtectedRoute({ children }) {
  const { token, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export function AdminProtectedRoute({ children }) {
  const { adminToken } = useAuth();
  if (!adminToken) return <Navigate to="/admin/login" replace />;
  return children;
}

function FullScreenLoader() {
  return (
    <div className="h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
