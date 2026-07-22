'use client';

import { Roster, RostersMap } from '@/lib/types';
import html2canvas from 'html2canvas';

export async function exportRosterPNG(roster: Roster, isDark: boolean) {
  const container = document.createElement('div');
  container.className = 'poster-export-node';
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '640px';
  container.style.padding = '40px';
  container.style.boxSizing = 'border-box';

  const bg = isDark ? '#0B132B' : '#FFFFFF';
  const cardBg = isDark ? '#1C2541' : '#F8FAF7';
  const textColor = isDark ? '#F8FAFC' : '#0F172A';
  const nyscGreen = isDark ? '#10B981' : '#008751';
  const nyscGold = '#D9A441';
  const borderColor = isDark ? '#2E3B5B' : '#D1E7DD';
  const thBg = nyscGreen;
  const thText = isDark ? '#064E3B' : '#FFFFFF';

  const isGroupedByDay = roster.id === 'prayer_roster' || roster.id === 'glorious_service';
  let tablesHTML = '';

  if (!isGroupedByDay) {
    tablesHTML = `
      <div style="margin-top: 20px; border: 1px solid ${borderColor}; border-radius: 12px; overflow: hidden; background: ${cardBg}; position: relative; z-index: 2;">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13.5px;">
          <thead>
            <tr style="background: ${thBg}; color: ${thText}; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
              <th style="padding: 12px 14px;">Day</th>
              ${roster.columns.map(c => `<th style="padding: 12px 14px;">${c.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${roster.rows.map(r => `
              <tr style="border-bottom: 1px solid ${borderColor};">
                <td style="padding: 12px 14px; font-weight: 800; color: ${nyscGreen};">${r.day}</td>
                ${roster.columns.map(c => `<td style="padding: 12px 14px; color: ${textColor}; font-weight: 700;">${r[c.key] || ''}</td>`).join('')}
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
        <div style="margin-top: 18px; position: relative; z-index: 2;">
          <div style="font-size: 12.5px; font-weight: 800; color: ${nyscGreen}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; border-bottom: 1px solid ${borderColor}; padding-bottom: 4px;">
            📅 ${day}
          </div>
          <div style="border: 1px solid ${borderColor}; border-radius: 12px; overflow: hidden; background: ${cardBg};">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
              <thead>
                <tr style="background: ${thBg}; color: ${thText}; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
                  ${roster.columns.map(c => `<th style="padding: 10px 12px;">${c.label}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${rowsByDay[day].map(r => `
                  <tr style="border-bottom: 1px solid ${borderColor};">
                    ${roster.columns.map(c => `<td style="padding: 10px 12px; color: ${textColor}; font-weight: 700;">${r[c.key] || ''}</td>`).join('')}
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
    <div style="position: relative; background: ${bg}; padding: 36px; border-radius: 20px; border: 2px solid ${nyscGreen}; box-shadow: 0 20px 50px rgba(0,0,0,0.3); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; overflow: hidden;">
      
      <!-- Watermark Background Logo -->
      <div style="position: absolute; top: 55%; left: 50%; transform: translate(-50%, -50%); width: 300px; height: 300px; opacity: 0.05; pointer-events: none; z-index: 1;">
        <img src="/images/images.webp" style="width: 100%; height: 100%; object-fit: contain; filter: grayscale(100%);" />
      </div>

      <!-- Natural Unclipped Top Logo -->
      <div style="position: relative; z-index: 2; text-align: center; margin-bottom: 10px;">
        <img src="/images/images.webp" style="height: 60px; object-fit: contain; margin: 0 auto; display: block;" />
      </div>

      <!-- Heading Hierarchy under Logo -->
      <div style="position: relative; z-index: 2; text-align: center; border-bottom: 2px solid ${nyscGreen}; padding-bottom: 16px; margin-bottom: 20px;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: ${nyscGreen}; letter-spacing: -0.5px;">
          NCCF Family House
        </h1>
        <p style="margin: 4px 0 0 0; font-size: 12px; font-weight: 800; text-transform: uppercase; color: ${nyscGold}; letter-spacing: 2px;">
          OFFICIAL SCHEDULE BOARD
        </p>
        <p style="margin: 8px 0 0 0; font-size: 18px; font-weight: 800; color: ${textColor};">
          ${roster.title}
        </p>
      </div>

      <!-- Dynamic Tables -->
      ${tablesHTML}

      <!-- Footer -->
      <div style="position: relative; z-index: 2; margin-top: 24px; text-align: center; border-top: 1px solid ${borderColor}; padding-top: 14px; font-size: 11px; font-weight: 800; color: ${nyscGold}; letter-spacing: 0.5px;">
        OFFICIAL PUBLICATION · NCCF FAMILY HOUSE · GENERATED ON ${new Date().toLocaleDateString().toUpperCase()}
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

// Export All 4 Rosters in a Single Master Poster Image
export async function exportAllRostersPNG(rosters: RostersMap, isDark: boolean) {
  const container = document.createElement('div');
  container.className = 'poster-export-node';
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '680px';
  container.style.padding = '40px';
  container.style.boxSizing = 'border-box';

  const bg = isDark ? '#0B132B' : '#FFFFFF';
  const cardBg = isDark ? '#1C2541' : '#F8FAF7';
  const textColor = isDark ? '#F8FAFC' : '#0F172A';
  const nyscGreen = isDark ? '#10B981' : '#008751';
  const nyscGold = '#D9A441';
  const borderColor = isDark ? '#2E3B5B' : '#D1E7DD';
  const thBg = nyscGreen;
  const thText = isDark ? '#064E3B' : '#FFFFFF';

  let allRostersHTML = '';

  (Object.values(rosters) as Roster[]).forEach((roster) => {
    const isGroupedByDay = roster.id === 'prayer_roster' || roster.id === 'glorious_service';
    let sectionTablesHTML = '';

    if (!isGroupedByDay) {
      sectionTablesHTML = `
        <div style="margin-top: 10px; border: 1px solid ${borderColor}; border-radius: 12px; overflow: hidden; background: ${cardBg};">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
            <thead>
              <tr style="background: ${thBg}; color: ${thText}; font-size: 11px; font-weight: 800; text-transform: uppercase;">
                <th style="padding: 10px 12px;">Day</th>
                ${roster.columns.map(c => `<th style="padding: 10px 12px;">${c.label}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${roster.rows.map(r => `
                <tr style="border-bottom: 1px solid ${borderColor};">
                  <td style="padding: 10px 12px; font-weight: 800; color: ${nyscGreen};">${r.day}</td>
                  ${roster.columns.map(c => `<td style="padding: 10px 12px; color: ${textColor}; font-weight: 700;">${r[c.key] || ''}</td>`).join('')}
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
        sectionTablesHTML += `
          <div style="margin-top: 10px;">
            <div style="font-size: 11.5px; font-weight: 800; color: ${nyscGreen}; text-transform: uppercase; margin-bottom: 4px;">
              📅 ${day}
            </div>
            <div style="border: 1px solid ${borderColor}; border-radius: 10px; overflow: hidden; background: ${cardBg};">
              <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 12.5px;">
                <thead>
                  <tr style="background: ${thBg}; color: ${thText}; font-size: 10.5px; font-weight: 800; text-transform: uppercase;">
                    ${roster.columns.map(c => `<th style="padding: 8px 10px;">${c.label}</th>`).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${rowsByDay[day].map(r => `
                    <tr style="border-bottom: 1px solid ${borderColor};">
                      ${roster.columns.map(c => `<td style="padding: 8px 10px; color: ${textColor}; font-weight: 700;">${r[c.key] || ''}</td>`).join('')}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      });
    }

    allRostersHTML += `
      <div style="margin-top: 24px; position: relative; z-index: 2;">
        <h2 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 900; color: ${nyscGreen}; border-b: 2px solid ${nyscGreen}; padding-bottom: 6px;">
          ${roster.icon} ${roster.title}
        </h2>
        ${sectionTablesHTML}
      </div>
    `;
  });

  container.innerHTML = `
    <div style="position: relative; background: ${bg}; padding: 36px; border-radius: 20px; border: 2px solid ${nyscGreen}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; overflow: hidden;">
      
      <!-- Watermark Background Logo -->
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 360px; height: 360px; opacity: 0.04; pointer-events: none; z-index: 1;">
        <img src="/images/images.webp" style="width: 100%; height: 100%; object-fit: contain; filter: grayscale(100%);" />
      </div>

      <!-- Top Unclipped Logo -->
      <div style="position: relative; z-index: 2; text-align: center; margin-bottom: 10px;">
        <img src="/images/images.webp" style="height: 64px; object-fit: contain; margin: 0 auto; display: block;" />
      </div>

      <!-- Header under Logo -->
      <div style="position: relative; z-index: 2; text-align: center; border-bottom: 2px solid ${nyscGreen}; padding-bottom: 16px; margin-bottom: 10px;">
        <h1 style="margin: 0; font-size: 26px; font-weight: 900; color: ${nyscGreen}; letter-spacing: -0.5px;">
          NCCF Family House
        </h1>
        <p style="margin: 4px 0 0 0; font-size: 13px; font-weight: 800; text-transform: uppercase; color: ${nyscGold}; letter-spacing: 2px;">
          OFFICIAL SCHEDULE BOARD
        </p>
        <p style="margin: 6px 0 0 0; font-size: 15px; font-weight: 800; color: ${textColor};">
          Complete Weekly Master Roster
        </p>
      </div>

      <!-- All Rosters Sections -->
      ${allRostersHTML}

      <!-- Footer -->
      <div style="position: relative; z-index: 2; margin-top: 28px; text-align: center; border-top: 1px solid ${borderColor}; padding-top: 14px; font-size: 11px; font-weight: 800; color: ${nyscGold}; letter-spacing: 0.5px;">
        OFFICIAL PUBLICATION · NCCF FAMILY HOUSE · GENERATED ON ${new Date().toLocaleDateString().toUpperCase()}
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
    link.download = `NCCF_Full_Master_Schedule.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    console.error("Master poster export error:", err);
    if (document.body.contains(container)) document.body.removeChild(container);
  }
}
