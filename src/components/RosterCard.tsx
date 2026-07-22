'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Roster, RosterRow, RosterColumnKey } from '@/lib/types';
import { PREDEFINED_SUGGESTIONS } from '@/lib/constants';
import { Check, Edit3, Plus } from 'lucide-react';

interface RosterCardProps {
  roster: Roster;
  hasEditAccess: boolean;
  onCellChange: (rosterId: string, rowIndex: number, colKey: RosterColumnKey, newValue: string) => void;
  savedRows: RosterRow[];
}

interface ActiveCellRef {
  rowIndex: number;
  colKey: RosterColumnKey;
  rect: DOMRect;
}

export default function RosterCard({ roster, hasEditAccess, onCellChange, savedRows }: RosterCardProps) {
  const [activeDropdown, setActiveDropdown] = useState<ActiveCellRef | null>(null);
  const [activeInputCell, setActiveInputCell] = useState<{ rowIndex: number; colKey: RosterColumnKey } | null>(null);
  const clickTimerRef = useRef<{ lastTime: number; timer: NodeJS.Timeout | null }>({ lastTime: 0, timer: null });

  // Close active dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const popoverEl = document.getElementById('roster-portal-popover');
      if (popoverEl && !popoverEl.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (!target.closest('td.editable')) {
          setActiveDropdown(null);
        }
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, []);

  const handleCellClick = (e: React.MouseEvent<HTMLTableCellElement>, rowIndex: number, colKey: RosterColumnKey) => {
    if (!hasEditAccess) return;

    // Direct toggle check: if clicking the active dropdown cell, close it immediately!
    if (activeDropdown && activeDropdown.rowIndex === rowIndex && activeDropdown.colKey === colKey) {
      setActiveDropdown(null);
      return;
    }

    const targetTd = e.currentTarget;
    const rect = targetTd.getBoundingClientRect();
    const now = Date.now();
    const timeDiff = now - clickTimerRef.current.lastTime;

    // Double tap / click (< 350ms) -> Direct typing mode
    if (timeDiff < 350 && timeDiff > 40) {
      if (clickTimerRef.current.timer) clearTimeout(clickTimerRef.current.timer);
      setActiveDropdown(null);
      setActiveInputCell({ rowIndex, colKey });
      clickTimerRef.current = { lastTime: 0, timer: null };
    } else {
      // Single tap / click -> Toggle option dropdown
      const timer = setTimeout(() => {
        setActiveInputCell(null);
        setActiveDropdown({ rowIndex, colKey, rect });
      }, 120);
      clickTimerRef.current = { lastTime: now, timer };
    }
  };

  const isGroupedByDay = roster.id === 'prayer_roster' || roster.id === 'glorious_service';
  const rowsByDay: Record<string, { row: RosterRow; originalIndex: number }[]> = {};

  roster.rows.forEach((row, originalIndex) => {
    const day = row.day || 'General';
    if (!rowsByDay[day]) rowsByDay[day] = [];
    rowsByDay[day].push({ row, originalIndex });
  });

  return (
    <div className="w-full max-w-3xl mx-auto bg-[var(--card-bg)]/90 border border-[var(--card-border)] rounded-2xl p-3.5 sm:p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-all">
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-[var(--card-border)] pb-3 mb-3.5">
        <div className="flex items-center gap-2.5">
          <span className="text-xl sm:text-2xl">{roster.icon}</span>
          <div>
            <h2 className="text-base sm:text-lg font-black text-[var(--nysc-green)] tracking-tight">
              {roster.title}
            </h2>
            <p className="text-[11px] text-[var(--text-muted)] font-medium">
              {hasEditAccess ? '⚡ Unlocked for Live Editing' : '🔒 View Mode'}
            </p>
          </div>
        </div>
      </div>

      {/* Roster Layout Rendering */}
      {!isGroupedByDay ? (
        <RenderTableGroup
          title="Weekly Schedule"
          columns={roster.columns}
          rowsWithIndices={roster.rows.map((row, index) => ({ row, originalIndex: index }))}
          savedRows={savedRows}
          hasEditAccess={hasEditAccess}
          activeDropdown={activeDropdown}
          activeInputCell={activeInputCell}
          onCellClick={handleCellClick}
          onCellChange={onCellChange}
          setActiveDropdown={setActiveDropdown}
          setActiveInputCell={setActiveInputCell}
          roster={roster}
        />
      ) : (
        <div className="space-y-4">
          {Object.keys(rowsByDay).map((day) => (
            <RenderTableGroup
              key={day}
              title={day}
              columns={roster.columns}
              rowsWithIndices={rowsByDay[day]}
              savedRows={savedRows}
              hasEditAccess={hasEditAccess}
              activeDropdown={activeDropdown}
              activeInputCell={activeInputCell}
              onCellClick={handleCellClick}
              onCellChange={onCellChange}
              setActiveDropdown={setActiveDropdown}
              setActiveInputCell={setActiveInputCell}
              roster={roster}
            />
          ))}
        </div>
      )}

      {/* Portal Popover with Subtle Backdrop Blur for Depth */}
      {activeDropdown && typeof window !== 'undefined' && createPortal(
        <>
          {/* Subtle 1px Backdrop Blur for depth while keeping content readable */}
          <div
            className="fixed inset-0 bg-black/25 backdrop-blur-[1px] z-[9998]"
            onClick={() => setActiveDropdown(null)}
          />

          {/* Portal Popover */}
          <PortalDropdownPopover
            activeCell={activeDropdown}
            columns={roster.columns}
            currentValue={roster.rows[activeDropdown.rowIndex]?.[activeDropdown.colKey] || ''}
            onSelect={(newVal) => {
              onCellChange(roster.id, activeDropdown.rowIndex, activeDropdown.colKey, newVal);
              setActiveDropdown(null);
            }}
            onSwitchToInput={() => {
              setActiveInputCell({ rowIndex: activeDropdown.rowIndex, colKey: activeDropdown.colKey });
              setActiveDropdown(null);
            }}
            onAppendPartner={() => {
              const cur = roster.rows[activeDropdown.rowIndex]?.[activeDropdown.colKey] || '';
              if (!cur.endsWith('& ')) {
                onCellChange(roster.id, activeDropdown.rowIndex, activeDropdown.colKey, `${cur} & `);
              }
            }}
          />
        </>,
        document.body
      )}
    </div>
  );
}

interface RenderTableGroupProps {
  title: string;
  columns: Roster['columns'];
  rowsWithIndices: { row: RosterRow; originalIndex: number }[];
  savedRows: RosterRow[];
  hasEditAccess: boolean;
  activeDropdown: ActiveCellRef | null;
  activeInputCell: { rowIndex: number; colKey: RosterColumnKey } | null;
  onCellClick: (e: React.MouseEvent<HTMLTableCellElement>, rowIndex: number, colKey: RosterColumnKey) => void;
  onCellChange: (rosterId: string, rowIndex: number, colKey: RosterColumnKey, newValue: string) => void;
  setActiveDropdown: (val: ActiveCellRef | null) => void;
  setActiveInputCell: (val: { rowIndex: number; colKey: RosterColumnKey } | null) => void;
  roster: Roster;
}

function RenderTableGroup({
  title,
  columns,
  rowsWithIndices,
  savedRows,
  hasEditAccess,
  activeDropdown,
  activeInputCell,
  onCellClick,
  onCellChange,
  setActiveDropdown,
  setActiveInputCell,
  roster,
}: RenderTableGroupProps) {
  return (
    <div className="space-y-1.5">
      {title !== 'Weekly Schedule' && (
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--nysc-green)] border-b border-[var(--card-border)] pb-1 pl-1">
          📅 {title}
        </h3>
      )}

      {/* Responsive Table Wrap */}
      <div className="w-full overflow-x-auto rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-sm">
        <table className="w-full text-left border-collapse min-w-[340px] sm:min-w-[500px]">
          <thead>
            <tr className="bg-[var(--table-header-bg)] text-[var(--table-header-text)] text-[10px] sm:text-xs font-black uppercase tracking-wider">
              {title === 'Weekly Schedule' && (
                <th className="py-2.5 px-3 border-b border-[var(--card-border)] whitespace-nowrap w-[20%]">
                  Day
                </th>
              )}
              {columns.map((col) => (
                <th key={col.key} className="py-2.5 px-3 border-b border-[var(--card-border)] whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/10 text-xs font-semibold">
            {rowsWithIndices.map(({ row, originalIndex }) => (
              <tr key={originalIndex} className="hover:bg-[var(--table-hover)] transition-colors">
                {title === 'Weekly Schedule' && (
                  <td className="py-3 px-3 font-extrabold text-[var(--nysc-green)] text-[11px] sm:text-xs whitespace-nowrap">
                    {row.day}
                  </td>
                )}
                {columns.map((col) => {
                  const currentValue = row[col.key] || '';
                  const savedValue = savedRows[originalIndex]?.[col.key] || '';
                  const hasUnsavedChanges = hasEditAccess && currentValue.trim() !== savedValue.trim();

                  const isInputOpen = activeInputCell?.rowIndex === originalIndex && activeInputCell?.colKey === col.key;
                  const isActiveSelectedCell = activeDropdown?.rowIndex === originalIndex && activeDropdown?.colKey === col.key;

                  // Text wrapping rule: stretch to single line unless text length exceeds 22 characters
                  const isShortText = currentValue.length <= 22;
                  const textWrapClass = isShortText ? 'whitespace-nowrap' : 'break-words';

                  return (
                    <td
                      key={col.key}
                      onClick={(e) => onCellClick(e, originalIndex, col.key)}
                      className={`relative py-3 px-3 transition-all ${
                        col.isTime ? 'whitespace-nowrap text-xs font-semibold tracking-tight text-[var(--text-muted)]' : ''
                      } ${
                        hasEditAccess && col.editable
                          ? 'editable cursor-pointer hover:bg-emerald-500/10 active:scale-[0.99]'
                          : ''
                      } ${isActiveSelectedCell ? 'ring-2 ring-[var(--nysc-green)] bg-[var(--nysc-gold-light)]' : ''}`}
                    >
                      {isInputOpen ? (
                        <InlineTextInput
                          initialValue={currentValue}
                          onSave={(val) => {
                            onCellChange(roster.id, originalIndex, col.key, val);
                            setActiveInputCell(null);
                          }}
                          onCancel={() => setActiveInputCell(null)}
                        />
                      ) : (
                        <div className="flex items-center justify-between gap-1.5 min-h-[24px]">
                          <span
                            className={
                              col.key === 'person' || col.key === 'breakfast' || col.key === 'dinner'
                                ? `inline-flex items-center rounded-full bg-emerald-100 text-emerald-950 dark:bg-emerald-600/40 dark:text-white dark:ring-1 dark:ring-emerald-400/60 px-3 py-0.5 text-xs font-black shadow-sm ${textWrapClass}`
                                : `text-[11px] sm:text-xs text-[var(--text-primary)] ${textWrapClass}`
                            }
                          >
                            {currentValue || <span className="opacity-40 italic font-normal">Empty</span>}
                          </span>

                          {hasUnsavedChanges && (
                            <span className="w-2 h-2 rounded-full bg-[var(--nysc-gold)] shrink-0 animate-pulse" title="Unsaved edit" />
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InlineTextInput({ initialValue, onSave, onCancel }: { initialValue: string; onSave: (val: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => onSave(val)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSave(val);
        if (e.key === 'Escape') onCancel();
      }}
      className="w-full bg-[var(--card-bg)] border-2 border-[var(--nysc-green)] rounded px-2 py-1 text-xs text-[var(--text-primary)] font-bold focus:outline-none shadow-sm"
    />
  );
}

// Portal Dropdown Popover floating on top of viewport
interface PortalDropdownPopoverProps {
  activeCell: ActiveCellRef;
  columns: Roster['columns'];
  currentValue: string;
  onSelect: (val: string) => void;
  onSwitchToInput: () => void;
  onAppendPartner: () => void;
}

function PortalDropdownPopover({ activeCell, columns, currentValue, onSelect, onSwitchToInput, onAppendPartner }: PortalDropdownPopoverProps) {
  const colDef = columns.find(c => c.key === activeCell.colKey);
  const suggestions = new Set<string>();

  if (colDef?.list && PREDEFINED_SUGGESTIONS[colDef.list]) {
    PREDEFINED_SUGGESTIONS[colDef.list].forEach((s) => suggestions.add(s));
  }

  if (colDef?.isTime) {
    const timeOpts = [
      '05:30 AM – 06:00 AM',
      '06:00 AM – 07:00 AM',
      '09:00 AM – 10:00 AM',
      '04:00 PM – 04:30 PM',
      '04:30 PM – 06:00 PM',
      '06:00 PM – 07:00 PM',
      '08:30 PM – 09:00 PM',
      '08:30 PM – 09:30 PM'
    ];
    timeOpts.forEach(t => suggestions.add(t));
  }

  const suggestionList = Array.from(suggestions);

  const rect = activeCell.rect;
  const popoverWidth = Math.max(220, rect.width);
  let top = rect.bottom + window.scrollY + 4;
  let left = Math.min(rect.left + window.scrollX, window.innerWidth - popoverWidth - 16);
  left = Math.max(16, left);

  return (
    <div
      id="roster-portal-popover"
      style={{
        position: 'absolute',
        top: `${top}px`,
        left: `${left}px`,
        width: `${popoverWidth}px`,
      }}
      className="z-[9999] max-h-60 overflow-y-auto bg-white dark:bg-[#1C2541] border border-black/20 dark:border-white/20 rounded-xl shadow-[0_16px_48px_-8px_rgba(0,0,0,0.4)] p-1.5 text-xs animate-in fade-in-0 zoom-in-95 duration-150"
    >
      {suggestionList.map((item) => (
        <div
          key={item}
          onClick={(e) => {
            e.stopPropagation();
            let finalVal = item;
            if (currentValue.endsWith('& ')) {
              finalVal = `${currentValue}${item}`;
            }
            onSelect(finalVal);
          }}
          className="px-3.5 py-2.5 rounded-lg text-slate-900 dark:text-slate-100 hover:bg-emerald-500/20 cursor-pointer font-bold flex items-center justify-between transition-colors"
        >
          <span>{item}</span>
          {currentValue.includes(item) && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
        </div>
      ))}

      <div className="border-t border-slate-200 dark:border-slate-700/60 mt-1.5 pt-1.5 space-y-0.5">
        {colDef?.list === 'members' && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onAppendPartner();
            }}
            className="px-3.5 py-2.5 rounded-lg text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer font-black flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Add Partner (&)</span>
          </div>
        )}

        <div
          onClick={(e) => {
            e.stopPropagation();
            onSwitchToInput();
          }}
          className="px-3.5 py-2.5 rounded-lg text-sky-700 dark:text-sky-400 hover:bg-sky-500/10 cursor-pointer font-black flex items-center gap-1.5 transition-colors"
        >
          <Edit3 className="w-4 h-4 shrink-0" />
          <span>Write Custom...</span>
        </div>
      </div>
    </div>
  );
}
