'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sun, Moon, Lock, Unlock, Home, Sparkles, BookOpen, Brush, Utensils } from 'lucide-react';

interface NavbarProps {
  authRole: 'none' | 'prayer_coordinator' | 'master';
  onLogin: (password: string) => Promise<boolean> | boolean;
  onLogout: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export default function Navbar({ authRole, onLogin, onLogout, isDark, onToggleTheme }: NavbarProps) {
  const pathname = usePathname();
  const [showModal, setShowModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await onLogin(passwordInput);
    if (success) {
      setShowModal(false);
      setPasswordInput('');
      setErrorMsg('');
    } else {
      setErrorMsg('Invalid password. Try again.');
    }
  };

  const navLinks = [
    { href: '/', label: 'Main Hub', icon: Home },
    { href: '/prayer', label: 'Prayer', icon: BookOpen },
    { href: '/service', label: 'Service', icon: Sparkles },
    { href: '/cleaning', label: 'Cleaning', icon: Brush },
    { href: '/cooking', label: 'Cooking', icon: Utensils },
  ];

  return (
    <>
      <nav className="sticky top-0 z-40 w-full backdrop-blur-md bg-[var(--card-bg)]/90 border-b border-[var(--card-border)] shadow-sm transition-colors">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          
          {/* Brand Logo & Name */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-full bg-[var(--nysc-green)] flex items-center justify-center text-white font-extrabold text-lg shadow-md group-hover:scale-105 transition-transform">
              ✨
            </div>
            <div>
              <h1 className="font-extrabold text-lg tracking-tight text-[var(--nysc-green)] leading-none">
                NCCF Family House
              </h1>
              <p className="text-[10px] uppercase font-bold tracking-widest text-[var(--nysc-gold)] mt-0.5">
                Official Roster Board
              </p>
            </div>
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-1 bg-[var(--bg-page)] p-1 rounded-full border border-[var(--card-border)]">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-[var(--nysc-green)] text-white shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--card-bg)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Controls: Theme Toggle & Admin Auth */}
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-primary)] hover:bg-[var(--nysc-gold-light)] transition-colors"
              title="Toggle Theme Mode"
            >
              {isDark ? <Sun className="w-4 h-4 text-[var(--nysc-gold)]" /> : <Moon className="w-4 h-4 text-[var(--nysc-green)]" />}
            </button>

            {authRole === 'none' ? (
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--nysc-green)] text-white text-xs font-bold hover:opacity-90 shadow-sm transition-all"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Unlock Editing</span>
              </button>
            ) : (
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--nysc-gold)] text-[var(--text-primary)] text-xs font-extrabold shadow-sm hover:opacity-90 transition-all"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>{authRole === 'master' ? 'Master Admin' : 'Prayer Admin'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="flex md:hidden items-center justify-around border-t border-[var(--card-border)] py-2 px-2 bg-[var(--card-bg)]">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center gap-0.5 text-[10px] font-bold px-2 py-1 rounded-lg ${
                  isActive ? 'text-[var(--nysc-green)] font-extrabold' : 'text-[var(--text-muted)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Password Modal Dialog */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-extrabold text-[var(--nysc-green)] mb-1">
              🔐 Unlock Editing Mode
            </h3>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Enter your coordinator or master admin password to unlock live schedule editing.
            </p>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <input
                type="password"
                placeholder="Enter password..."
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                autoFocus
                className="w-full px-4 py-2.5 rounded-xl border border-[var(--card-border)] bg-[var(--bg-page)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--nysc-green)]"
              />

              {errorMsg && (
                <p className="text-xs font-bold text-red-500">{errorMsg}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setErrorMsg(''); }}
                  className="px-4 py-2 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-[var(--nysc-green)] text-white shadow-md hover:opacity-90"
                >
                  Unlock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
