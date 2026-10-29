import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { setUnauthorizedHandler, tokenStore } from '@/services/http.js';
import { authService } from '@/services/index.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!tokenStore.get());

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!tokenStore.get()) return;
    authService.me()
      .then(setUser)
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [logout]);

  const login = async (email, password) => {
    const res = await authService.login(email, password);
    tokenStore.set(res.token);
    setUser(res.user);
    return res.user;
  };

  const isAdmin = user?.role === 'ADMIN';
  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
