import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import { ProtectedRoute, AdminProtectedRoute } from "./components/ProtectedRoute.jsx";

import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Contacts from "./pages/Contacts.jsx";
import SafeRoute from "./pages/SafeRoute.jsx";
import UnsafeAreas from "./pages/UnsafeAreas.jsx";
import SafetyTimer from "./pages/SafetyTimer.jsx";
import FallDetection from "./pages/FallDetection.jsx";
import Wearable from "./pages/Wearable.jsx";
import Battery from "./pages/Battery.jsx";
import PeriodTracker from "./pages/PeriodTracker.jsx";
import AIAssistant from "./pages/AIAssistant.jsx";
import EmergencyHistory from "./pages/EmergencyHistory.jsx";
import AdminLogin from "./pages/AdminLogin.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import PublicLiveTracker from "./pages/PublicLiveTracker.jsx";

function AppShell() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Navbar />
      <main className="flex-1 px-4 md:px-8 py-6 pb-24 md:pb-6 max-w-6xl w-full mx-auto">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/track/:token" element={<PublicLiveTracker />} />

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/safe-route" element={<SafeRoute />} />
        <Route path="/unsafe-areas" element={<UnsafeAreas />} />
        <Route path="/safety-timer" element={<SafetyTimer />} />
        <Route path="/fall-detection" element={<FallDetection />} />
        <Route path="/wearable" element={<Wearable />} />
        <Route path="/battery" element={<Battery />} />
        <Route path="/period-tracker" element={<PeriodTracker />} />
        <Route path="/ai-assistant" element={<AIAssistant />} />
        <Route path="/history" element={<EmergencyHistory />} />
      </Route>

      <Route
        path="/admin"
        element={
          <AdminProtectedRoute>
            <AdminDashboard />
          </AdminProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
