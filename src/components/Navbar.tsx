'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Sun, Moon, Edit, LogOut, Home, Sparkles, BookOpen, Brush, Utensils, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { useTheme } from '@/lib/themeContext';

export default function Navbar() {
  const pathname = usePathname();
  const { authRole, login, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  
  const [showModal, setShowModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(passwordInput);
    if (success) {
      setShowModal(false);
      setPasswordInput('');
      setErrorMsg('');
      setShowPasswordText(false);
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
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between">
          
          {/* Official NCCF Logo & Title */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-full overflow-hidden shadow-sm group-hover:scale-105 transition-transform flex items-center justify-center bg-white shrink-0">
              <Image
                src="/images/images.webp"
                alt="NCCF Official Logo"
                width={40}
                height={40}
                className="object-cover w-full h-full"
              />
            </div>
            <div>
              <h1 className="font-extrabold text-base md:text-lg tracking-tight text-[var(--nysc-green)] leading-none">
                NCCF Family House
              </h1>
              <p className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--nysc-gold)] mt-0.5">
                Official Roster Board
              </p>
            </div>
          </Link>

          {/* Desktop Nav Links */}
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
              onClick={toggleTheme}
              className="p-2 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-primary)] hover:bg-[var(--nysc-gold-light)] transition-colors"
              title="Toggle Theme Mode"
            >
              {isDark ? <Sun className="w-4 h-4 text-[var(--nysc-gold)]" /> : <Moon className="w-4 h-4 text-[var(--nysc-green)]" />}
            </button>

            {authRole === 'none' ? (
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[var(--nysc-green)] text-white text-xs font-extrabold hover:opacity-90 shadow-sm transition-all"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            ) : (
              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--nysc-gold)] text-[var(--text-primary)] text-xs font-extrabold shadow-sm hover:opacity-90 transition-all"
                title="Click to Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="flex md:hidden items-center justify-around border-t border-[var(--card-border)] py-1.5 px-2 bg-[var(--card-bg)]">
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

      {/* Password Modal Dialog with Eye Toggle */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-white shadow-sm">
                <Image src="/images/images.webp" alt="NCCF Logo" width={40} height={40} className="object-cover w-full h-full" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[var(--nysc-green)] leading-none">
                  Admin Edit Access
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-1 font-medium">
                  Enter password to unlock schedule editing.
                </p>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="relative">
                <input
                  type={showPasswordText ? 'text' : 'password'}
                  placeholder="Enter admin password..."
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  autoFocus
                  className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-[var(--card-border)] bg-[var(--bg-page)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--nysc-green)] font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordText(!showPasswordText)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1"
                >
                  {showPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {errorMsg && (
                <p className="text-xs font-bold text-red-500">{errorMsg}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setErrorMsg(''); setShowPasswordText(false); }}
                  className="px-4 py-2 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-extrabold rounded-xl bg-[var(--nysc-green)] text-white shadow-md hover:opacity-90"
                >
                  Unlock Access
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
