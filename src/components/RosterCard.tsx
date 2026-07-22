'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Roster, RosterRow, RosterColumnKey } from '@/lib/types';
import { PREDEFINED_SUGGESTIONS } from '@/lib/constants';
import { Check, Edit3, Plus, Sparkles } from 'lucide-react';

interface RosterCardProps {
  roster: Roster;
  hasEditAccess: boolean;
  onCellChange: (rosterId: string, rowIndex: number, colKey: RosterColumnKey, newValue: string) => void;
  savedRows: RosterRow[];
}

export default function RosterCard({ roster, hasEditAccess, onCellChange, savedRows }: RosterCardProps) {
  // Global active dropdown state: tracks which cell index & colKey is open
  const [activeDropdown, setActiveDropdown] = useState<{ rowIndex: number; colKey: RosterColumnKey } | null>(null);
  const [activeInputCell, setActiveInputCell] = useState<{ rowIndex: number; colKey: RosterColumnKey } | null>(null);
  const [clickTimer, setClickTimer] = useState<{ timer: NodeJS.Timeout | null; lastTime: number }>({ timer: null, lastTime: 0 });

  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCellClick = (rowIndex: number, colKey: RosterColumnKey, isTime?: boolean) => {
    if (!hasEditAccess) return;

    const now = Date.now();
    const timeDiff = now - clickTimer.lastTime;

    // Double tap / double click detection (< 400ms)
    if (timeDiff < 400 && timeDiff > 50) {
      if (clickTimer.timer) clearTimeout(clickTimer.timer);
      setActiveDropdown(null);
      setActiveInputCell({ rowIndex, colKey });
      setClickTimer({ timer: null, lastTime: 0 });
    } else {
      // Single tap / single click: toggle popover after short wait
      const timer = setTimeout(() => {
        if (activeDropdown && activeDropdown.rowIndex === rowIndex && activeDropdown.colKey === colKey) {
          // Toggle off if clicking same cell again!
          setActiveDropdown(null);
        } else {
          // Auto-close any previous popover and open this one!
          setActiveInputCell(null);
          setActiveDropdown({ rowIndex, colKey });
        }
      }, 250);
      setClickTimer({ timer, lastTime: now });
    }
  };

  // Group rows by Day if prayer or service roster
  const isGroupedByDay = roster.id === 'prayer_roster' || roster.id === 'glorious_service';
  const rowsByDay: Record<string, { row: RosterRow; originalIndex: number }[]> = {};

  roster.rows.forEach((row, originalIndex) => {
    const day = row.day || 'General';
    if (!rowsByDay[day]) rowsByDay[day] = [];
    rowsByDay[day].push({ row, originalIndex });
  });

  return (
    <div ref={containerRef} className="w-full bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-4 md:p-6 shadow-[var(--shadow-card)] transition-all">
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-[var(--card-border)] pb-4 mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{roster.icon}</span>
          <div>
            <h2 className="text-lg md:text-xl font-extrabold text-[var(--nysc-green)] tracking-tight">
              {roster.title}
            </h2>
            <p className="text-xs text-[var(--text-muted)] font-medium">
              {hasEditAccess ? '⚡ Unlocked for Live Editing' : '🔒 View Mode'}
            </p>
          </div>
        </div>

        {hasEditAccess && (
          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[var(--nysc-gold-light)] text-[var(--nysc-gold)] border border-[var(--nysc-gold)]/30">
            Edit Mode
          </span>
        )}
      </div>

      {/* Roster Layout Rendering */}
      {!isGroupedByDay ? (
        // Single Tabular Layout (Cleaning / Cooking)
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
        // Day-Grouped Component Tables (Prayer / Service)
        <div className="space-y-6">
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
    </div>
  );
}

// Sub-component: Renders a single tabular component section
interface RenderTableGroupProps {
  title: string;
  columns: Roster['columns'];
  rowsWithIndices: { row: RosterRow; originalIndex: number }[];
  savedRows: RosterRow[];
  hasEditAccess: boolean;
  activeDropdown: { rowIndex: number; colKey: RosterColumnKey } | null;
  activeInputCell: { rowIndex: number; colKey: RosterColumnKey } | null;
  onCellClick: (rowIndex: number, colKey: RosterColumnKey, isTime?: boolean) => void;
  onCellChange: (rosterId: string, rowIndex: number, colKey: RosterColumnKey, newValue: string) => void;
  setActiveDropdown: (val: { rowIndex: number; colKey: RosterColumnKey } | null) => void;
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
    <div className="space-y-2">
      {title !== 'Weekly Schedule' && (
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--nysc-green)] border-b border-[var(--card-border)] pb-1.5 pl-1">
          📅 {title}
        </h3>
      )}

      {/* Scrollable Responsive Table Wrapper */}
      <div className="w-full overflow-x-auto rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-sm">
        <table className="w-full text-left border-collapse min-w-[500px]">
          <thead>
            <tr className="bg-[var(--table-header-bg)] text-[var(--table-header-text)] text-[11px] font-extrabold uppercase tracking-wider">
              {title === 'Weekly Schedule' && <th className="py-2.5 px-3 border-b border-[var(--card-border)]">Day</th>}
              {columns.map((col) => (
                <th key={col.key} className="py-2.5 px-3 border-b border-[var(--card-border)]">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--card-border)] text-xs font-semibold">
            {rowsWithIndices.map(({ row, originalIndex }) => (
              <tr key={originalIndex} className="hover:bg-[var(--table-hover)] transition-colors">
                {title === 'Weekly Schedule' && (
                  <td className="py-3 px-3 font-extrabold text-[var(--nysc-green)]">
                    {row.day}
                  </td>
                )}
                {columns.map((col) => {
                  const currentValue = row[col.key] || '';
                  const savedValue = savedRows[originalIndex]?.[col.key] || '';
                  const hasUnsavedChanges = currentValue.trim() !== savedValue.trim();

                  const isDropdownOpen = activeDropdown?.rowIndex === originalIndex && activeDropdown?.colKey === col.key;
                  const isInputOpen = activeInputCell?.rowIndex === originalIndex && activeInputCell?.colKey === col.key;

                  return (
                    <td
                      key={col.key}
                      onClick={() => onCellClick(originalIndex, col.key, col.isTime)}
                      className={`relative py-3 px-3 transition-all ${
                        hasEditAccess && col.editable ? 'editable cursor-pointer' : ''
                      }`}
                    >
                      {/* Cell Content or Edit Controls */}
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
                        <div className="flex items-center justify-between gap-1">
                          <span className={col.key === 'person' || col.key === 'breakfast' || col.key === 'dinner' ? 'inline-block bg-[var(--sky-blue-light)] text-[var(--sky-blue)] px-2.5 py-1 rounded-full text-xs font-extrabold' : ''}>
                            {currentValue || <span className="opacity-40 italic">Empty</span>}
                          </span>

                          {hasUnsavedChanges && (
                            <span className="w-2 h-2 rounded-full bg-[var(--nysc-gold)] animate-pulse" title="Unsaved edit" />
                          )}
                        </div>
                      )}

                      {/* Dropdown Popover */}
                      {isDropdownOpen && (
                        <DropdownPopover
                          listType={col.list}
                          currentValue={currentValue}
                          isTime={col.isTime}
                          onSelect={(newVal) => {
                            onCellChange(roster.id, originalIndex, col.key, newVal);
                            setActiveDropdown(null);
                          }}
                          onSwitchToInput={() => {
                            setActiveDropdown(null);
                            setActiveInputCell({ rowIndex: originalIndex, colKey: col.key });
                          }}
                          onAppendPartner={() => {
                            if (!currentValue.endsWith('& ')) {
                              onCellChange(roster.id, originalIndex, col.key, `${currentValue} & `);
                            }
                          }}
                        />
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

// Sub-component: Inline Text Input for direct typing
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
      className="w-full bg-transparent border border-[var(--nysc-gold)] rounded px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none"
    />
  );
}

// Sub-component: Floating Dropdown Popover
interface DropdownPopoverProps {
  listType?: 'members' | 'events' | 'foods';
  currentValue: string;
  isTime?: boolean;
  onSelect: (val: string) => void;
  onSwitchToInput: () => void;
  onAppendPartner: () => void;
}

function DropdownPopover({ listType, currentValue, isTime, onSelect, onSwitchToInput, onAppendPartner }: DropdownPopoverProps) {
  const suggestions = new Set<string>();

  if (listType && PREDEFINED_SUGGESTIONS[listType]) {
    PREDEFINED_SUGGESTIONS[listType].forEach((s) => suggestions.add(s));
  }

  // Time range generator
  if (isTime) {
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

  return (
    <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] max-h-56 overflow-y-auto bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl shadow-2xl p-1 text-xs text-[var(--text-primary)] backdrop-blur-md animate-fade-in">
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
          className="px-3 py-2 rounded-lg hover:bg-[var(--table-hover)] cursor-pointer font-semibold flex items-center justify-between"
        >
          <span>{item}</span>
          {currentValue.includes(item) && <Check className="w-3.5 h-3.5 text-[var(--nysc-green)]" />}
        </div>
      ))}

      {/* Action Buttons inside Dropdown */}
      <div className="border-t border-[var(--card-border)] mt-1 pt-1 space-y-0.5">
        {listType === 'members' && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onAppendPartner();
            }}
            className="px-3 py-2 rounded-lg text-[var(--nysc-gold)] hover:bg-[var(--nysc-gold-light)] cursor-pointer font-extrabold flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Partner (&)</span>
          </div>
        )}

        <div
          onClick={(e) => {
            e.stopPropagation();
            onSwitchToInput();
          }}
          className="px-3 py-2 rounded-lg text-[var(--sky-blue)] hover:bg-[var(--sky-blue-light)] cursor-pointer font-extrabold flex items-center gap-1.5"
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>Write Custom...</span>
        </div>
      </div>
    </div>
  );
}
