import { createContext, useContext, useState, useEffect } from "react";
import { api } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load from localStorage safely on mount
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem("streamangle_token");
      const savedUser = localStorage.getItem("streamangle_user");

      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      }
    } catch (err) {
      console.error("Failed to parse saved user from localStorage:", err);
      // Clear corrupted data
      localStorage.removeItem("streamangle_token");
      localStorage.removeItem("streamangle_user");
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    try {
      const data = await api.login(email, password);

      // Backend returns { token }, we create a simple user object
      const userData = { email };

      setToken(data.token);
      setUser(userData);

      localStorage.setItem("streamangle_token", data.token);
      localStorage.setItem("streamangle_user", JSON.stringify(userData));

      return data;
    } catch (err) {
      throw err;
    }
  };

  const register = async (email, password) => {
    try {
      await api.register(email, password); // just creates user

      // After successful register, automatically log in
      return await login(email, password);
    } catch (err) {
      throw err;
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("streamangle_token");
    localStorage.removeItem("streamangle_user");
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
