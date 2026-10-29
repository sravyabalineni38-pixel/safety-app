import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("guardian_token"));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("guardian_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem("guardian_admin_token"));
  const [admin, setAdmin] = useState(() => {
    const raw = localStorage.getItem("guardian_admin");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (token) {
        try {
          const { user } = await api.me(token);
          setUser(user);
          localStorage.setItem("guardian_user", JSON.stringify(user));
        } catch {
          logout();
        }
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function login(newToken, newUser) {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem("guardian_token", newToken);
    localStorage.setItem("guardian_user", JSON.stringify(newUser));
  }

  function logout() {
    setToken(null);
    setUser(null);
    localStorage.removeItem("guardian_token");
    localStorage.removeItem("guardian_user");
  }

  function adminLogin(newToken, newAdmin) {
    setAdminToken(newToken);
    setAdmin(newAdmin);
    localStorage.setItem("guardian_admin_token", newToken);
    localStorage.setItem("guardian_admin", JSON.stringify(newAdmin));
  }

  function adminLogout() {
    setAdminToken(null);
    setAdmin(null);
    localStorage.removeItem("guardian_admin_token");
    localStorage.removeItem("guardian_admin");
  }

  return (
    <AuthContext.Provider
      value={{ token, user, login, logout, loading, adminToken, admin, adminLogin, adminLogout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
