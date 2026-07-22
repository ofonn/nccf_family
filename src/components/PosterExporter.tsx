'use client';

import React from 'react';
import { Roster, RostersMap } from '@/lib/types';
import html2canvas from 'html2canvas';

export async function exportRosterPNG(roster: Roster, isDark: boolean) {
  const container = document.createElement('div');
  container.className = 'poster-export-node';
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '600px';
  container.style.padding = '36px';
  container.style.boxSizing = 'border-box';

  // NYSC Palette Hex Constants
  const bg = isDark ? '#0B132B' : '#FFFFFF';
  const cardBg = isDark ? '#1C2541' : '#F8FAF7';
  const textColor = isDark ? '#F8FAFC' : '#0F172A';
  const nyscGreen = isDark ? '#10B981' : '#008751';
  const nyscGold = '#F59E0B';
  const borderColor = isDark ? '#2E3B5B' : '#D1E7DD';
  const thBg = nyscGreen;
  const thText = isDark ? '#064E3B' : '#FFFFFF';

  // Group rows by day for Prayer/Service or tabular for Cleaning/Cooking
  const isGroupedByDay = roster.id === 'prayer_roster' || roster.id === 'glorious_service';
  let tablesHTML = '';

  if (!isGroupedByDay) {
    tablesHTML = `
      <div style="margin-top: 16px; border: 1px solid ${borderColor}; border-radius: 12px; overflow: hidden; background: ${cardBg};">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
          <thead>
            <tr style="background: ${thBg}; color: ${thText}; font-size: 11px; font-weight: 800; text-transform: uppercase;">
              <th style="padding: 12px;">Day</th>
              ${roster.columns.map(c => `<th style="padding: 12px;">${c.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${roster.rows.map(r => `
              <tr style="border-bottom: 1px solid ${borderColor};">
                <td style="padding: 12px; font-weight: 800; color: ${nyscGreen};">${r.day}</td>
                ${roster.columns.map(c => `<td style="padding: 12px; color: ${textColor}; font-weight: 600;">${r[c.key] || ''}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else {
    const rowsByDay: Record<string, typeof roster.rows> = {};
    roster.rows.forEach(r => {
      const day = r.day || 'General';
      if (!rowsByDay[day]) rowsByDay[day] = [];
      rowsByDay[day].push(r);
    });

    Object.keys(rowsByDay).forEach(day => {
      tablesHTML += `
        <div style="margin-top: 16px;">
          <div style="font-size: 13px; font-weight: 800; color: ${nyscGreen}; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid ${borderColor}; padding-bottom: 4px;">
            📅 ${day}
          </div>
          <div style="border: 1px solid ${borderColor}; border-radius: 12px; overflow: hidden; background: ${cardBg};">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
              <thead>
                <tr style="background: ${thBg}; color: ${thText}; font-size: 11px; font-weight: 800; text-transform: uppercase;">
                  ${roster.columns.map(c => `<th style="padding: 10px 12px;">${c.label}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${rowsByDay[day].map(r => `
                  <tr style="border-bottom: 1px solid ${borderColor};">
                    ${roster.columns.map(c => `<td style="padding: 10px 12px; color: ${textColor}; font-weight: 600;">${r[c.key] || ''}</td>`).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    });
  }

  container.innerHTML = `
    <div style="background: ${bg}; padding: 28px; border-radius: 20px; border: 2px solid ${nyscGreen}; box-shadow: 0 20px 40px rgba(0,0,0,0.3); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <!-- Header Banner -->
      <div style="text-align: center; border-bottom: 2px dashed ${nyscGold}; padding-bottom: 16px; margin-bottom: 20px;">
        <h1 style="margin: 0; font-size: 26px; font-weight: 900; color: ${nyscGreen}; tracking-tight: -0.5px;">
          NCCF Family House
        </h1>
        <p style="margin: 4px 0 0 0; font-size: 11px; font-weight: 800; text-transform: uppercase; color: ${nyscGold}; letter-spacing: 1.5px;">
          Official Schedule Board
        </p>
      </div>

      <!-- Card Title -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: ${nyscGreen}; display: flex; align-items: center; gap: 8px;">
          <span>${roster.icon}</span> ${roster.title}
        </h2>
        <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 4px 10px; border-radius: 12px; background: rgba(245, 158, 11, 0.2); color: ${nyscGold}; border: 1px solid ${nyscGold};">
          Official Roster
        </span>
      </div>

      <!-- Tables Content -->
      ${tablesHTML}

      <!-- Footer -->
      <div style="margin-top: 24px; text-align: center; border-top: 1px solid ${borderColor}; padding-top: 12px; font-size: 11px; font-weight: 700; color: ${nyscGold};">
        Generated on ${new Date().toLocaleDateString()} · Keep the fellowship burning 🙏
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: bg,
      useCORS: true,
      allowTaint: true,
      logging: false,
    });
    document.body.removeChild(container);

    const link = document.createElement('a');
    link.download = `NCCF_${roster.title.replace(/\s+/g, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    console.error("Poster export error:", err);
    if (document.body.contains(container)) document.body.removeChild(container);
  }
}
