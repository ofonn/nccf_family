'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthRole } from '@/lib/types';
import { sha256, AUTH_HASHES } from '@/lib/auth';

interface AuthContextType {
  authRole: AuthRole;
  authPassword: string;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  authRole: 'none',
  authPassword: '',
  login: async () => false,
  logout: () => {},
});

const SESSION_KEY = 'nccf_family_auth_session';
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authRole, setAuthRole] = useState<AuthRole>('none');
  const [authPassword, setAuthPassword] = useState<string>('');

  // Load session from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        const { role, password, expiresAt } = JSON.parse(saved);
        if (Date.now() < expiresAt && (role === 'master' || role === 'prayer_coordinator')) {
          setAuthRole(role);
          setAuthPassword(password);
          document.body.classList.add('editing-active');
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      }
    } catch (e) {
      console.error("Failed to restore auth session:", e);
    }
  }, []);

  const login = async (password: string): Promise<boolean> => {
    const hash = await sha256(password);
    let role: AuthRole = 'none';

    if (hash === AUTH_HASHES.master) role = 'master';
    else if (hash === AUTH_HASHES.prayer_coordinator) role = 'prayer_coordinator';

    if (role !== 'none') {
      setAuthRole(role);
      setAuthPassword(password);
      document.body.classList.add('editing-active');

      // Save to localStorage with 3-day expiration
      const session = {
        role,
        password,
        expiresAt: Date.now() + THREE_DAYS_MS,
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return true;
    }

    return false;
  };

  const logout = () => {
    setAuthRole('none');
    setAuthPassword('');
    document.body.classList.remove('editing-active');
    localStorage.removeItem(SESSION_KEY);
  };

  return (
    <AuthContext.Provider value={{ authRole, authPassword, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
