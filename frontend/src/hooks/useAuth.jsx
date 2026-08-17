import React, { createContext, useContext, useEffect, useState } from "react";
import { fetchCurrentUser, login as apiLogin, logout as apiLogout } from "../api/auth";
import { tokenStore } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function bootstrap() {
      if (tokenStore.getAccess()) {
        try {
          const me = await fetchCurrentUser();
          setUser(me);
        } catch {
          tokenStore.clear();
        }
      }
      setLoading(false);
    }
    bootstrap();

    function onForcedLogout() {
      setUser(null);
    }
    window.addEventListener("auth:logout", onForcedLogout);
    return () => window.removeEventListener("auth:logout", onForcedLogout);
  }, []);

  async function login(username, password) {
    const loggedInUser = await apiLogin(username, password);
    setUser(loggedInUser);
    return loggedInUser;
  }

  async function logout() {
    await apiLogout().catch(() => {});
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
