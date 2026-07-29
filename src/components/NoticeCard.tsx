'use client';

import React from 'react';
import { Notice } from '@/lib/types';
import { exportNoticePNG } from '@/components/PosterExporter';
import { Download, Edit, Trash2, Megaphone, CreditCard, DollarSign, AlertTriangle } from 'lucide-react';

interface NoticeCardProps {
  notice: Notice;
  hasEditAccess: boolean;
  onEdit?: (notice: Notice) => void;
  onDelete?: (notice: Notice) => void;
}

export default function NoticeCard({ notice, hasEditAccess, onEdit, onDelete }: NoticeCardProps) {
  const getCategoryTheme = (category: Notice['category']) => {
    switch (category) {
      case 'Maintenance Dues':
        return { bg: 'from-amber-600 to-amber-800', border: 'border-amber-500/40', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40', icon: CreditCard };
      case 'Food & Gas':
        return { bg: 'from-emerald-600 to-emerald-800', border: 'border-emerald-500/40', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', icon: DollarSign };
      case 'Urgent':
        return { bg: 'from-red-600 to-red-800', border: 'border-red-500/40', badge: 'bg-red-500/20 text-red-300 border-red-500/40', icon: AlertTriangle };
      default:
        return { bg: 'from-blue-600 to-indigo-800', border: 'border-blue-500/40', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40', icon: Megaphone };
    }
  };

  const theme = getCategoryTheme(notice.category);
  const CategoryIcon = theme.icon;

  const handleDownloadPNG = async () => {
    await exportNoticePNG(notice);
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-3">
      {/* Printable Poster Card */}
      <div
        className={`relative overflow-hidden rounded-2xl border ${theme.border} bg-gradient-to-br from-[#0B132B] via-[#1C2541] to-[#0B132B] text-white p-5 shadow-2xl font-sans`}
      >
        {/* Subtle Decorative Background Circles */}
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/5 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />

        {/* Poster Header */}
        <div className="flex items-center justify-between border-b border-white/15 pb-3 mb-3.5">
          <div className="flex items-center gap-2.5">
            {/* Logo */}
            <img src="/images/images.webp" alt="NCCF Logo" className="h-9 w-auto object-contain" />
            <div>
              <h2 className="text-xs font-black tracking-tight text-emerald-400 uppercase leading-none">
                NCCF Family House
              </h2>
              <p className="text-[9px] font-extrabold uppercase tracking-widest text-amber-400 mt-0.5">
                Official Announcement
              </p>
            </div>
          </div>

          <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${theme.badge}`}>
            <CategoryIcon className="w-3 h-3" />
            {notice.category}
          </span>
        </div>

        {/* Poster Title */}
        <h3 className="text-base sm:text-lg font-black tracking-tight text-white mb-2 leading-snug">
          {notice.title}
        </h3>

        {/* Main Content Body */}
        <div className="text-xs font-medium text-slate-200 leading-relaxed space-y-2 whitespace-pre-line mb-4 bg-white/5 p-3 rounded-xl border border-white/10">
          {notice.content}
        </div>

        {/* Amount Highlight Box */}
        {notice.amount && (
          <div className="mb-3 p-3 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
              Amount Due
            </span>
            <span className="text-sm font-black text-amber-400">
              {notice.amount}
            </span>
          </div>
        )}

        {/* Account & Payment Details Box */}
        {notice.accountDetails && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
            <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider block">
              💳 Payment Account Details
            </span>
            <p className="text-xs font-bold text-slate-100 font-mono">
              {notice.accountDetails}
            </p>
          </div>
        )}

        {/* Poster Footer */}
        <div className="border-t border-white/10 pt-2.5 text-center flex items-center justify-between text-[9.5px] font-extrabold text-amber-400 uppercase tracking-wider">
          <span>Official Notice</span>
          <span>{new Date(notice.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Action Controls Bar */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={handleDownloadPNG}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--sky-blue)] text-white text-xs font-extrabold shadow-sm hover:opacity-90 active:scale-95 transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download PNG Poster</span>
        </button>

        {hasEditAccess && (
          <div className="flex items-center gap-1.5">
            {onEdit && (
              <button
                onClick={() => onEdit(notice)}
                className="p-1.5 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:text-[var(--nysc-green)] transition-colors"
                title="Edit Notice Poster"
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
            )}

            {onDelete && (
              <button
                onClick={() => onDelete(notice)}
                className="p-1.5 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                title="Delete Notice Poster"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
