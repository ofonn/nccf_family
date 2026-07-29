'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import NoticeCard from '@/components/NoticeCard';
import ConfirmModal from '@/components/ConfirmModal';
import { Notice } from '@/lib/types';
import { useAuth } from '@/lib/authContext';
import { useToast } from '@/lib/toastContext';
import {
  Megaphone,
  Plus,
  ArrowLeft,
  Loader2,
  X,
  Sparkles,
  CreditCard
} from 'lucide-react';

export default function NoticesPage() {
  const { authRole, authPassword } = useAuth();
  const { showToast } = useToast();

  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form & Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [deletingNotice, setDeletingNotice] = useState<Notice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Notice['category']>('Maintenance Dues');
  const [content, setContent] = useState('');
  const [amount, setAmount] = useState('');
  const [accountDetails, setAccountDetails] = useState('');

  const fetchNotices = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/notices', {
        headers: { 'Cache-Control': 'no-cache' }
      });
      const data = await res.json();
      if (data.notices) setNotices(data.notices);
    } catch (err) {
      console.error("Failed to load notices:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  const openCreateModal = () => {
    setEditingNotice(null);
    setTitle('');
    setCategory('Maintenance Dues');
    setContent('');
    setAmount('');
    setAccountDetails('');
    setIsFormOpen(true);
  };

  const openEditModal = (notice: Notice) => {
    setEditingNotice(notice);
    setTitle(notice.title);
    setCategory(notice.category);
    setContent(notice.content);
    setAmount(notice.amount || '');
    setAccountDetails(notice.accountDetails || '');
    setIsFormOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authPassword || authRole === 'none') return;
    if (!title.trim() || !content.trim()) {
      showToast('Title and content are required.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const action = editingNotice ? 'update' : 'create';
      const payloadNotice = {
        ...(editingNotice ? { id: editingNotice.id } : {}),
        title: title.trim(),
        category,
        content: content.trim(),
        amount: amount.trim(),
        accountDetails: accountDetails.trim()
      };

      const res = await fetch('/api/notices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': authPassword,
        },
        body: JSON.stringify({ action, notice: payloadNotice }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(editingNotice ? 'Notice poster updated!' : 'New notice poster created!', 'success');
        setNotices(data.notices);
        setIsFormOpen(false);
      } else {
        showToast(data.error || 'Failed to save notice.', 'error');
      }
    } catch (err) {
      showToast('Error connecting to server.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNotice = async () => {
    if (!deletingNotice || !authPassword || authRole === 'none') return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/notices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': authPassword,
        },
        body: JSON.stringify({ action: 'delete', notice: { id: deletingNotice.id } }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast('Notice poster deleted.', 'info');
        setNotices(data.notices);
      } else {
        showToast(data.error || 'Failed to delete notice.', 'error');
      }
    } catch (err) {
      showToast('Error connecting to server.', 'error');
    } finally {
      setIsSubmitting(false);
      setDeletingNotice(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col pb-24">
      <Navbar />

      <main className="flex-1 w-full max-w-4xl mx-auto px-3.5 py-6 space-y-6">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between border-b border-[var(--card-border)] pb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-[var(--nysc-green)]" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[var(--nysc-green)] tracking-tight flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-[var(--nysc-gold)]" />
                House Notice Board
              </h1>
              <p className="text-[11px] text-[var(--text-muted)] font-medium">
                Official announcements & auto-formatted PNG posters
              </p>
            </div>
          </div>

          {/* Admin Create Poster Button */}
          {authRole !== 'none' && (
            <button
              onClick={openCreateModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--nysc-green)] text-white text-xs font-extrabold shadow-md hover:opacity-90 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Poster</span>
            </button>
          )}
        </div>

        {/* Notice Posters Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--nysc-green)]">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
              Loading Notice Board...
            </p>
          </div>
        ) : notices.length === 0 ? (
          <div className="text-center py-16 p-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] space-y-2">
            <Sparkles className="w-8 h-8 mx-auto text-[var(--nysc-gold)]" />
            <h3 className="text-sm font-bold text-[var(--foreground)]">No Announcements Posted Yet</h3>
            <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
              Admins can post house maintenance dues, food sub updates, and official announcements here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {notices.map((notice) => (
              <NoticeCard
                key={notice.id}
                notice={notice}
                hasEditAccess={authRole !== 'none'}
                onEdit={openEditModal}
                onDelete={(n) => setDeletingNotice(n)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Create / Edit Notice Poster Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md" onClick={() => setIsFormOpen(false)} />

          <div className="relative w-full max-w-md bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5 shadow-2xl z-10 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--card-border)] pb-3">
              <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-[var(--nysc-green)]" />
                <h3 className="text-base font-black text-[var(--nysc-green)]">
                  {editingNotice ? 'Edit Notice Poster' : 'Create Notice Poster'}
                </h3>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1 rounded-full text-[var(--text-muted)] hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-[var(--foreground)] uppercase block mb-1">
                  Poster Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. August Maintenance Dues"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--bg-page)] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--nysc-green)]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[var(--foreground)] uppercase block mb-1">
                  Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Notice['category'])}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--bg-page)] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--nysc-green)]"
                >
                  <option value="Maintenance Dues">Maintenance Dues</option>
                  <option value="Food & Gas">Food & Gas</option>
                  <option value="General Notice">General Notice</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[var(--foreground)] uppercase block mb-1">
                  Announcement Message / Text *
                </label>
                <textarea
                  rows={4}
                  placeholder="Paste or type notice message (e.g. Good evening @all. Please let's pay maintenance dues...)"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--bg-page)] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--nysc-green)]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[var(--foreground)] uppercase block mb-1">
                  Amount Due (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. ₦3,000 or ₦23,400 Total"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--bg-page)] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--nysc-green)]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[var(--foreground)] uppercase block mb-1">
                  Account Details (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Uche Chidera Joseph | Kuda | 2087338124"
                  value={accountDetails}
                  onChange={(e) => setAccountDetails(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--bg-page)] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--nysc-green)]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-[var(--text-muted)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-extrabold rounded-xl bg-[var(--nysc-green)] text-white shadow-md hover:opacity-90"
                >
                  {isSubmitting ? 'Saving...' : editingNotice ? 'Update Poster' : 'Create Poster'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deletingNotice)}
        title="Delete Notice Poster?"
        message={`Are you sure you want to delete "${deletingNotice?.title}"?`}
        confirmText="Delete Poster"
        isDangerous={true}
        onConfirm={handleDeleteNotice}
        onCancel={() => setDeletingNotice(null)}
      />
    </div>
  );
}
