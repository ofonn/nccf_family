// NCCF Roster Web App - Application Controller

// In-memory buffer for unsaved edits
let editedRosters = null;
let activeRosterId = null;

// Predefined suggestion lists
const PREDEFINED_SUGGESTIONS = {
  members: [
    "Chidera", "Prince", "Segun", "Ofonime", "Christopher", "Opeyemi", "Mimi", "Olayinka", "Ola", "Judith", "Oluchi"
  ],
  events: [
    "Morning Prayer", "Evening Devotional: Hymns", "Theme Exposition", "Bible Study", "Praise & Worship",
    "Opening Prayer", "Testimonies", "Word Ministration", "Offering & Tithes", "Announcements", "Benediction",
    "Discussion Night", "Game Night"
  ],
  foods: [
    "Jollof Rice", "Spag Jollof", "Rice & Stew", "Eba", "Amala", "Stew Spaghetti", "Jollof Spag", "Beans", "Moi moi", "Fasting (till evening)"
  ]
};

// Initialize App
document.addEventListener("DOMContentLoaded", async () => {
  const pageType = document.body.dataset.page;
  activeRosterId = document.body.dataset.rosterId;

  // Load saved theme (default to bright)
  const savedTheme = localStorage.getItem("nccf_theme");
  if (savedTheme !== "dark") {
    document.body.classList.add("theme-bright");
  }

  // Load latest data from Node Server API
  const rosters = await DB.loadRosters();
  editedRosters = JSON.parse(JSON.stringify(rosters)); // deep clone to buffer changes

  // Update timestamps and state in UI
  updateStatusIndicators();

  // Setup common action event listeners
  setupCommonEventListeners();

  // Route page actions
  if (pageType === "hub") {
    renderHubPage();
  } else if (activeRosterId) {
    renderRosterPage(activeRosterId);
  }

  // Perform Live Conflict Checks
  performClashCheck();
});

// Setup Common Event Listeners (e.g. login modal, login actions)
function setupCommonEventListeners() {
  const btnEnableEdit = document.getElementById("btn-enable-edit");
  const btnDisableEdit = document.getElementById("btn-disable-edit");
  const modalAuth = document.getElementById("modal-auth");
  const btnCloseModal = document.getElementById("btn-close-modal");
  const formAuth = document.getElementById("form-auth");

  if (btnEnableEdit) {
    btnEnableEdit.addEventListener("click", () => {
      modalAuth.classList.add("active");
      document.getElementById("pwd-input").focus();
    });
  }

  if (btnDisableEdit) {
    btnDisableEdit.addEventListener("click", () => {
      DB.logout();
      showToast("Editing disabled. Session logged out.");
      setTimeout(() => window.location.reload(), 800);
    });
  }

  if (btnCloseModal) {
    btnCloseModal.addEventListener("click", () => {
      modalAuth.classList.remove("active");
      formAuth.reset();
    });
  }

  if (formAuth) {
    formAuth.addEventListener("submit", async (e) => {
      e.preventDefault();
      const pwd = document.getElementById("pwd-input").value;
      const level = await DB.login(pwd);

      if (level) {
        modalAuth.classList.remove("active");
        formAuth.reset();
        showToast(`Access granted! Level: ${level === "master" ? "Master Admin" : "Prayer Coordinator"}`);
        setTimeout(() => window.location.reload(), 1000);
      } else {
        showToast("Incorrect password! Try again.", true);
        const input = document.getElementById("pwd-input");
        input.value = "";
        input.focus();
      }
    });
  }

  // Floating Control Dock toggle logic
  const dock = document.getElementById("control-dock");
  const dockTrigger = document.getElementById("dock-trigger");
  const btnToggleTheme = document.getElementById("btn-toggle-theme");

  if (btnToggleTheme) {
    btnToggleTheme.addEventListener("click", (e) => {
      e.stopPropagation();
      document.body.classList.toggle("theme-bright");
      const isBright = document.body.classList.contains("theme-bright");
      localStorage.setItem("nccf_theme", isBright ? "bright" : "dark");
      showToast(`Switched to ${isBright ? "Bright" : "Dark"} Theme!`);
    });
  }

  if (dock && dockTrigger) {
    dockTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      dock.classList.toggle("active");
      
      // Update trigger icon: gear rotates on open, shows "✕"
      const triggerIcon = dockTrigger.querySelector(".trigger-icon");
      if (triggerIcon) {
        if (dock.classList.contains("active")) {
          triggerIcon.textContent = "✕";
          triggerIcon.style.fontSize = "20px";
        } else {
          triggerIcon.textContent = "⚙️";
          triggerIcon.style.fontSize = "24px";
        }
      }
    });

    // Close dock when clicking anywhere outside
    document.addEventListener("click", (e) => {
      if (!dock.contains(e.target) && dock.classList.contains("active")) {
        dock.classList.remove("active");
        const triggerIcon = dockTrigger.querySelector(".trigger-icon");
        if (triggerIcon) {
          triggerIcon.textContent = "⚙️";
          triggerIcon.style.fontSize = "24px";
        }
      }
    });

    // Initialize Draggable Control Dock
    makeDockDraggable(dock, dockTrigger);
  }
}

// Update Status Bars, edit states, and titles
function updateStatusIndicators() {
  const authLevel = DB.getAuthLevel();
  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");
  const btnEnableEdit = document.getElementById("btn-enable-edit");
  const btnDisableEdit = document.getElementById("btn-disable-edit");
  const editControls = document.getElementById("edit-controls");

  // Show conflict checker only for master admin (nccfadmin)
  const clashBoard = document.getElementById("clash-checker-board");
  if (clashBoard) {
    if (authLevel === "master") {
      clashBoard.style.display = "block";
    } else {
      clashBoard.style.display = "none";
    }
  }

  // Format Last Updated Date
  const lastUpdatedEl = document.getElementById("last-updated-time");
  if (lastUpdatedEl) {
    const d = DB.getLastUpdated();
    lastUpdatedEl.textContent = d.toLocaleString();
  }

  const btnSave = document.getElementById("btn-save");
  const btnCancel = document.getElementById("btn-cancel");
  const btnReset = document.getElementById("btn-reset");

  if (authLevel) {
    document.body.classList.add("editing-active");
    if (statusDot) statusDot.classList.add("active");
    if (statusText) {
      statusText.textContent = authLevel === "master" ? "Editing: Master Admin" : "Editing: Prayer Coordinator";
    }
    if (btnEnableEdit) btnEnableEdit.style.display = "none";
    if (btnDisableEdit) btnDisableEdit.style.display = "flex";
    if (btnSave) btnSave.style.display = "flex";
    if (btnCancel) btnCancel.style.display = "flex";
    if (btnReset) btnReset.style.display = "flex";
  } else {
    document.body.classList.remove("editing-active");
    if (statusDot) statusDot.classList.remove("active");
    if (statusText) statusText.textContent = "View Mode (Locked)";
    if (btnEnableEdit) btnEnableEdit.style.display = "flex";
    if (btnDisableEdit) btnDisableEdit.style.display = "none";
    if (btnSave) btnSave.style.display = "none";
    if (btnCancel) btnCancel.style.display = "none";
    if (btnReset) btnReset.style.display = "none";
  }
}

// Render Hub / Index Page
function renderHubPage() {
  const rosters = DB.getRosters();

  // On the hub, we provide a button to download the combined image
  const btnDownloadAll = document.getElementById("btn-download-all");
  if (btnDownloadAll) {
    btnDownloadAll.addEventListener("click", () => downloadCombinedSchedule(roastersToCardsHTML(rosters)));
  }
}

// Helper to generate the cards HTML for canvas download (formatted with Day above, Time left)
function roastersToCardsHTML(rosters) {
  let html = "";
  Object.keys(rosters).forEach(key => {
    // Exclude cleaning and cooking from combined poster
    if (key === "cleaning_roster" || key === "cooking_roster") return;
    const roster = rosters[key];
    
    html += `
      <div class="board theme-${roster.id.split("_")[0]}">
        <div class="board-title-row">
          <span class="icon">${roster.icon}</span>
          <h2>${roster.title}</h2>
        </div>
    `;

    // Group by Day
    const rowsByDay = {};
    roster.rows.forEach(row => {
      const day = row.day || "General";
      if (!rowsByDay[day]) rowsByDay[day] = [];
      rowsByDay[day].push(row);
    });

    Object.keys(rowsByDay).forEach(day => {
      html += `
        <div class="day-group" style="margin-top: 15px;">
          <h3 style="font-family: Georgia, serif; font-size: 14px; color: var(--accent-color); margin: 0 0 6px 4px; border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">${day}</h3>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  ${roster.columns.map(c => `<th>${c.label}</th>`).join("")}
                </tr>
              </thead>
              <tbody>
                ${rowsByDay[day].map(row => `
                  <tr>
                    ${roster.columns.map(c => `<td>${row[c.key] || ""}</td>`).join("")}
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
    });

    html += `</div>`;
  });
  return html;
}

// Render Individual Roster Page grouped by Day (or as single consolidated week for cleaning/cooking)
function renderRosterPage(rosterId) {
  const roster = editedRosters[rosterId];
  if (!roster) return;

  const tableWrap = document.querySelector(".table-wrap");
  if (!tableWrap) return;
  tableWrap.innerHTML = ""; // Clear static markup

  const hasEditAccess = DB.hasEditPermission(rosterId);

  // Consolidated Single Table layout for cleaning / cooking
  if (rosterId === "cleaning_roster" || rosterId === "cooking_roster") {
    const table = document.createElement("table");
    
    // Header
    const thead = document.createElement("thead");
    thead.innerHTML = `<tr><th style="width: 25%;">Day</th>${roster.columns.map(col => `<th>${col.label}</th>`).join("")}</tr>`;
    table.appendChild(thead);
    
    // Body
    const tbody = document.createElement("tbody");
    roster.rows.forEach((rowData, originalIndex) => {
      const tr = document.createElement("tr");
      
      // Day column
      const tdDay = document.createElement("td");
      tdDay.className = "day";
      tdDay.textContent = rowData.day;
      tr.appendChild(tdDay);
      
      // Other columns
      roster.columns.forEach(col => {
        const td = document.createElement("td");
        const value = rowData[col.key] || "";
        td.textContent = value;
        td.dataset.colKey = col.key;
        td.dataset.rowIndex = originalIndex;
        
        bindCellEditEvents(td, roster, originalIndex, col, hasEditAccess);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableWrap.appendChild(table);
  } else {
    // Group rows by Day (for prayer and service)
    const rowsByDay = {};
    roster.rows.forEach((row, originalIndex) => {
      const day = row.day || "General";
      if (!rowsByDay[day]) rowsByDay[day] = [];
      rowsByDay[day].push({ data: row, index: originalIndex });
    });

    // Render a Table for each Day group
    Object.keys(rowsByDay).forEach(day => {
      const dayGroup = document.createElement("div");
      dayGroup.className = "day-group";
      dayGroup.style.marginBottom = "24px";

      const dayHeader = document.createElement("h3");
      dayHeader.textContent = day;
      dayHeader.style.fontFamily = "Georgia, serif";
      dayHeader.style.fontSize = "15px";
      dayHeader.style.color = "var(--accent-color)";
      dayHeader.style.margin = "0 0 8px 4px";
      dayHeader.style.borderBottom = "1px solid var(--border-color)";
      dayHeader.style.paddingBottom = "4px";
      dayGroup.appendChild(dayHeader);

      const subTableWrap = document.createElement("div");
      subTableWrap.className = "table-wrap";
      
      const table = document.createElement("table");
      
      const thead = document.createElement("thead");
      thead.innerHTML = `<tr>${roster.columns.map(col => `<th>${col.label}</th>`).join("")}</tr>`;
      table.appendChild(thead);

      const tbody = document.createElement("tbody");
      rowsByDay[day].forEach(rowItem => {
        const tr = document.createElement("tr");
        const rowData = rowItem.data;
        const originalIndex = rowItem.index;

        roster.columns.forEach(col => {
          const td = document.createElement("td");
          const value = rowData[col.key] || "";
          td.textContent = value;
          td.dataset.colKey = col.key;
          td.dataset.rowIndex = originalIndex;

          bindCellEditEvents(td, roster, originalIndex, col, hasEditAccess);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      subTableWrap.appendChild(table);
      dayGroup.appendChild(subTableWrap);
      tableWrap.appendChild(dayGroup);
    });
  }

  // Bind controls (Save, Cancel, Reset, Download)
  setupRosterControlListeners(rosterId);
}

// Custom Dropdown Editor with Autocomplete option (replaces native OS select)
function enterAutocompleteEdit(td, roster, rowIndex, colKey, listType, directManualInput = false) {
  if (td.classList.contains("editing-cell")) return;

  const originalText = td.textContent.trim();
  td.classList.add("editing-cell");

  const saveCell = (newValue) => {
    td.classList.remove("editing-cell");
    td.textContent = newValue;

    const savedRosters = DB.getRosters();
    const originalValue = savedRosters[roster.id].rows[rowIndex][colKey] || "";

    if (newValue !== originalValue) {
      roster.rows[rowIndex][colKey] = newValue;
      td.classList.add("has-unsaved-changes");
    } else {
      roster.rows[rowIndex][colKey] = originalValue;
      td.classList.remove("has-unsaved-changes");
    }

    checkUnsavedChangesBadge(roster);
    performClashCheck(); // Re-trigger live clash check
  };

  const switchToInput = () => {
    const input = document.createElement("input");
    input.type = "text";
    input.value = originalText;
    input.style.width = "100%";
    input.style.background = "transparent";
    input.style.border = "1px solid var(--accent-color)";
    input.style.color = "var(--cream)";
    input.style.padding = "6px";
    input.style.borderRadius = "4px";

    td.innerHTML = "";
    td.appendChild(input);
    input.focus();
    setTimeout(() => input.select(), 10);

    const saveInput = () => {
      saveCell(input.value.trim());
    };

    input.addEventListener("blur", saveInput);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") input.blur();
      if (e.key === "Escape") saveCell(originalText);
    });
  };

  if (directManualInput) {
    switchToInput();
    return;
  }

  // Gather suggestions
  const suggestions = new Set();
  if (roster.id === "prayer_roster" && colKey === "event" && roster.rows[rowIndex].day === "Friday") {
    suggestions.add("Discussion Night");
    suggestions.add("Game Night");
  }
  const listItems = PREDEFINED_SUGGESTIONS[listType] || [];
  listItems.forEach(item => suggestions.add(item));
  if (originalText && !suggestions.has(originalText)) {
    suggestions.add(originalText);
  }

  // Create custom popover
  const popover = document.createElement("div");
  popover.className = "custom-dropdown-popover";

  // Calculate coordinates
  const rect = td.getBoundingClientRect();
  popover.style.left = `${rect.left}px`;
  popover.style.top = `${rect.bottom}px`;
  popover.style.width = `${Math.max(rect.width, 220)}px`;

  // Append to body to avoid overflow issues
  document.body.appendChild(popover);

  // Position adjustment if opening off-screen bottom
  const popoverHeight = Math.min(220, (suggestions.size + 1) * 44);
  if (rect.bottom + popoverHeight > window.innerHeight) {
    popover.style.top = `${rect.top - popoverHeight}px`;
  }

  td.classList.add("dropdown-open");

  const closeDropdown = () => {
    if (document.body.contains(popover)) {
      document.body.removeChild(popover);
    }
    td.classList.remove("dropdown-open");
    document.removeEventListener("click", handleOutsideClick);
  };

  const handleOutsideClick = (e) => {
    // Treat clicks on the TD itself as outside clicks if it's already open, so it closes!
    if (!popover.contains(e.target)) {
      closeDropdown();
      const text = td.textContent;
      saveCell(text.endsWith("& ") ? text.slice(0, -3) : text);
    }
  };

  // Populate options in custom popover
  suggestions.forEach(suggest => {
    const item = document.createElement("div");
    item.className = "custom-dropdown-item";
    item.textContent = suggest;
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      let finalValue = suggest;
      const currentText = td.textContent;
      if (currentText.endsWith("& ")) {
        finalValue = currentText + suggest;
      }
      saveCell(finalValue);
      closeDropdown();
    });
    popover.appendChild(item);
  });

  // Add Custom Write option
  const writeOption = document.createElement("div");
  writeOption.className = "custom-dropdown-item write-custom-item";
  writeOption.innerHTML = "✎ Write Custom...";
  writeOption.addEventListener("click", (e) => {
    e.stopPropagation();
    closeDropdown();
    switchToInput();
  });
  popover.appendChild(writeOption);

  // Add "Add Partner (&)" option for multiple selection
  if (listType === "members") {
    const partnerOption = document.createElement("div");
    partnerOption.className = "custom-dropdown-item partner-item";
    partnerOption.innerHTML = "➕ Add Partner (&)";
    partnerOption.style.color = "var(--accent-color)";
    partnerOption.addEventListener("click", (e) => {
      e.stopPropagation();
      // Auto-lock: We don't close the dropdown. We append " & " to the textContent
      if (!td.textContent.endsWith("& ")) {
        td.textContent = (td.textContent === originalText ? originalText : td.textContent) + " & ";
      }
    });
    popover.appendChild(partnerOption);
  }

  // Register click outside
  setTimeout(() => {
    document.addEventListener("click", handleOutsideClick);
  }, 10);
}

// Generate 30-minute interval items for time range selects
function generateTimeOptions() {
  const options = [];
  const periods = ["AM", "PM"];
  for (let p = 0; p < 2; p++) {
    const period = periods[p];
    for (let h = 0; h < 12; h++) {
      const hour = h === 0 ? 12 : h;
      const hourStr = hour.toString().padStart(2, "0");
      options.push(`${hourStr}:00 ${period}`);
      options.push(`${hourStr}:30 ${period}`);
    }
  }
  return options;
}

// Double Dropdown Time Range Selector implementation (Prevents manual typos)
function enterTimeRangeEdit(td, roster, rowIndex, colKey, directManualInput = false) {
  if (td.classList.contains("editing-cell")) return;

  const originalText = td.textContent;
  td.classList.add("editing-cell");

  const saveCell = (newValue) => {
    td.classList.remove("editing-cell");
    td.classList.remove("dropdown-open");
    td.innerHTML = newValue;

    const savedRosters = DB.getRosters();
    const originalValue = savedRosters[roster.id].rows[rowIndex][colKey] || "";

    if (newValue !== originalValue) {
      roster.rows[rowIndex][colKey] = newValue;
      td.classList.add("has-unsaved-changes");
    } else {
      roster.rows[rowIndex][colKey] = originalValue;
      td.classList.remove("has-unsaved-changes");
    }

    checkUnsavedChangesBadge(roster);
    performClashCheck(); // Re-trigger live clash check
  };

  if (directManualInput) {
    const input = document.createElement("input");
    input.type = "text";
    input.value = originalText;
    input.style.width = "100%";
    input.style.background = "transparent";
    input.style.border = "1px solid var(--accent-color)";
    input.style.color = "var(--cream)";
    input.style.padding = "6px";
    input.style.borderRadius = "4px";

    td.innerHTML = "";
    td.appendChild(input);
    input.focus();
    setTimeout(() => input.select(), 10);

    const saveInput = () => {
      saveCell(input.value.trim());
    };

    input.addEventListener("blur", saveInput);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") input.blur();
      if (e.key === "Escape") saveCell(originalText);
    });
    return;
  }

  td.classList.add("dropdown-open");

  // Parse current Start / End Times
  // Default fallback if time is unparseable
  let startTime = "08:00 AM";
  let endTime = "09:00 AM";

  const matches = [...originalText.matchAll(/(\d{2}:\d{2}\s+[AP]M)/gi)];
  if (matches.length >= 2) {
    startTime = matches[0][1];
    endTime = matches[1][1];
  }

  const startSelect = document.createElement("select");
  const endSelect = document.createElement("select");
  const checkBtn = document.createElement("button");

  // Style selectors slightly smaller
  startSelect.style.padding = "4px";
  startSelect.style.background = "var(--ink-light)";
  startSelect.style.border = "1px solid var(--border-color)";
  startSelect.style.color = "var(--cream)";
  startSelect.style.borderRadius = "4px";

  endSelect.style.padding = "4px";
  endSelect.style.background = "var(--ink-light)";
  endSelect.style.border = "1px solid var(--border-color)";
  endSelect.style.color = "var(--cream)";
  endSelect.style.borderRadius = "4px";

  checkBtn.textContent = "✔️";
  checkBtn.style.padding = "4px 8px";
  checkBtn.style.background = "var(--accent-color)";
  checkBtn.style.color = "var(--ink)";
  checkBtn.style.border = "none";
  checkBtn.style.borderRadius = "4px";
  checkBtn.style.cursor = "pointer";

  // Populate options
  const timeOptions = generateTimeOptions();
  timeOptions.forEach(opt => {
    startSelect.add(new Option(opt, opt));
    endSelect.add(new Option(opt, opt));
  });

  startSelect.value = startTime;
  endSelect.value = endTime;

  td.innerHTML = "";
  
  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.alignItems = "center";
  wrap.style.gap = "4px";
  wrap.style.flexWrap = "nowrap";

  wrap.appendChild(startSelect);
  const span = document.createElement("span");
  span.textContent = "–";
  span.style.color = "var(--cream)";
  wrap.appendChild(span);
  wrap.appendChild(endSelect);
  wrap.appendChild(checkBtn);
  td.appendChild(wrap);

  const saveTimeCell = () => {
    const finalVal = `${startSelect.value} – ${endSelect.value}`;
    saveCell(finalVal);
  };

  checkBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    saveTimeCell();
  });

  // Revert on click outside (blur wrapper simulation)
  document.addEventListener("click", function closeTimeEditor(e) {
    if (!td.contains(e.target) || e.target === td) {
      document.removeEventListener("click", closeTimeEditor);
      // If still editing, revert to original
      if (td.classList.contains("editing-cell")) {
        td.classList.remove("editing-cell");
        td.classList.remove("dropdown-open");
        td.textContent = originalText;
        checkUnsavedChangesBadge(roster);
      }
    }
  });
}

function checkUnsavedChangesBadge(roster) {
  const hasChanges = document.querySelectorAll("td.has-unsaved-changes").length > 0;
  const autoSaveIndicator = document.getElementById("auto-save-indicator");
  if (autoSaveIndicator) {
    if (hasChanges) {
      autoSaveIndicator.textContent = "● Unsaved Changes";
      autoSaveIndicator.style.color = "var(--accent-color)";
    } else {
      autoSaveIndicator.textContent = "● Synced";
      autoSaveIndicator.style.color = "#27AE60";
    }
  }
}

// Roster control operations
function setupRosterControlListeners(rosterId) {
  const btnSave = document.getElementById("btn-save");
  const btnCancel = document.getElementById("btn-cancel");
  const btnReset = document.getElementById("btn-reset");
  const btnDownload = document.getElementById("btn-download");

  if (btnSave) {
    // Remove previous listeners
    btnSave.replaceWith(btnSave.cloneNode(true));
    document.getElementById("btn-save").addEventListener("click", async () => {
      showToast("Saving to server file...");
      
      const saveRes = await DB.saveRosters(editedRosters);
      if (saveRes.success) {
        showToast("Roster file updated on server successfully!");
        document.querySelectorAll("td.has-unsaved-changes").forEach(td => {
          td.classList.remove("has-unsaved-changes");
        });
        updateStatusIndicators();
        checkUnsavedChangesBadge(editedRosters[rosterId]);
      } else {
        showToast(`Save failed: ${saveRes.error || "Server error"}`, true);
      }
    });
  }

  if (btnCancel) {
    btnCancel.replaceWith(btnCancel.cloneNode(true));
    document.getElementById("btn-cancel").addEventListener("click", async () => {
      // Reload cache from server
      const rosters = await DB.loadRosters();
      editedRosters = JSON.parse(JSON.stringify(rosters));
      
      renderRosterPage(rosterId);
      performClashCheck();
      showToast("Changes discarded.");
    });
  }

  if (btnReset) {
    btnReset.replaceWith(btnReset.cloneNode(true));
    document.getElementById("btn-reset").addEventListener("click", async () => {
      if (confirm("Are you sure you want to reset all schedules to their default placeholders on the server?")) {
        showToast("Resetting file...");
        const resetRes = await DB.resetToDefault();
        if (resetRes.success) {
          showToast("Roster file reset.");
          setTimeout(() => window.location.reload(), 800);
        } else {
          showToast(`Reset failed: ${resetRes.error}`, true);
        }
      }
    });
  }

  if (btnDownload) {
    btnDownload.replaceWith(btnDownload.cloneNode(true));
    document.getElementById("btn-download").addEventListener("click", () => {
      const roster = editedRosters[rosterId];
      downloadSingleRoster(roster);
    });
  }
}

// Toast System
function showToast(message, isError = false) {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${isError ? "toast-error" : ""}`;
  toast.innerHTML = isError ? `⚠️ ${message}` : `✓ ${message}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Parse "hh:mm AM/PM" into minute of day integer (0 - 1440)
function parseSingleTime(timeStr) {
  const match = timeStr.trim().match(/(\d{2}):(\d{2})\s+([AP]M)/i);
  if (!match) return 0;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const p = match[3].toUpperCase();
  if (p === "PM" && h < 12) h += 12;
  if (p === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

// Parse range "08:30 AM – 09:00 AM" into {start, end} minutes
function parseTimeRange(timeRangeStr) {
  if (!timeRangeStr) return null;
  const parts = timeRangeStr.split(/\s*[\u2013\u2014\-]\s*|\s+to\s+/i);
  if (parts.length < 2) return null;
  const start = parseSingleTime(parts[0]);
  const end = parseSingleTime(parts[1]);
  return { start, end };
}

// Extract individual clean lowercase names from assigned person strings
function normalizeNames(personStr) {
  if (!personStr) return [];
  // Split names on commas, semicolons, ampersands, and the word "and"
  return personStr.split(/[,;&]|\band\b/i)
    .map(name => name.trim())
    // Remove titles like Bro., Sis., Group A, Choir, and brackets/braces
    .map(name => name.replace(/^(bro\.|sis\.|group\s+[a-z]|choir|congregation)\b/i, ""))
    .map(name => name.replace(/[()\[\]]/g, "").trim())
    // Filter out filler words
    .filter(name => name.toLowerCase() !== "corpers" && name.toLowerCase() !== "all" && name.toLowerCase() !== "mandatory")
    .filter(name => name.length > 2) // Filter out residual short labels
    .map(name => name.toLowerCase());
}

// Clash & Conflict Checker engine
function performClashCheck() {
  const clashResultsEl = document.getElementById("clash-checker-results");
  if (!clashResultsEl) return;

  const conflicts = [];
  const daySchedule = {}; // Group all items across all tables by Day: { Day: [ { rosterName, timeStr, start, end, rawPerson, names } ] }

  // 1. Accumulate all rows across all buffered rosters
  Object.keys(editedRosters).forEach(rosterId => {
    const roster = editedRosters[rosterId];
    roster.rows.forEach(row => {
      const day = row.day;
      if (!day) return;

      const timeRange = parseTimeRange(row.time);
      if (!timeRange) return;

      const namesList = normalizeNames(row.person);
      if (namesList.length === 0) return;

      if (!daySchedule[day]) daySchedule[day] = [];
      daySchedule[day].push({
        rosterName: roster.title,
        timeStr: row.time,
        start: timeRange.start,
        end: timeRange.end,
        rawPerson: row.person,
        names: namesList
      });
    });
  });

  // 2. Intersect and check for overlapping periods and shared names
  Object.keys(daySchedule).forEach(day => {
    if (day === "Sunday") return; // Exempt Sundays completely

    const items = daySchedule[day];
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const itemA = items[i];
        const itemB = items[j];

        // Cooking restriction: anyone cooking cannot do ANY other thing on that day!
        // Sunday is already exempted above.
        const isCookingA = itemA.rosterName.toLowerCase().includes("cooking");
        const isCookingB = itemB.rosterName.toLowerCase().includes("cooking");

        let overlap = false;
        if (isCookingA || isCookingB) {
          // If either is cooking, it's an automatic clash because cooking takes the whole day
          overlap = true;
        } else {
          // Normal check: do they happen in the same period?
          const getPeriod = (item) => item.start < 12 * 60 ? "Morning" : "Evening";
          overlap = getPeriod(itemA) === getPeriod(itemB);
        }

        if (overlap) {
          // Check for shared names
          const sharedNames = itemA.names.filter(n => itemB.names.includes(n));
          if (sharedNames.length > 0) {
            // Capitalize names for warning printout
            const cleanNames = sharedNames.map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(", ");
            conflicts.push(`
              <div class="clash-item" style="background: rgba(235, 87, 87, 0.1); border-left: 4px solid #EB5757; padding: 10px; margin-bottom: 8px; border-radius: 4px;">
                <strong>⚠️ Double Scheduling Clash (${day})</strong><br>
                <span style="color: #EB5757; font-weight: bold;">${cleanNames}</span> is assigned to overlapping activities:
                <ul style="margin: 4px 0 0 16px; padding: 0; font-size: 11.5px; color: var(--cream);">
                  <li>"${itemA.rosterName}" (${itemA.timeStr || "All Day"})</li>
                  <li>"${itemB.rosterName}" (${itemB.timeStr || "All Day"})</li>
                </ul>
              </div>
            `);
          }
        }
      }
    }
  });

  // 3. Render warnings inside Conflict panel
  if (conflicts.length > 0) {
    clashResultsEl.innerHTML = conflicts.join("");
  } else {
    clashResultsEl.innerHTML = `
      <div style="color: #27AE60; font-weight: 600; display: flex; align-items: center; gap: 6px; padding: 4px 0;">
        <span>✅</span> No scheduling clashes or conflicts detected.
      </div>
    `;
  }
}

// Download single roster grouped by day
function downloadSingleRoster(roster) {
  showToast("Preparing image download...");

  const captureContainer = document.createElement("div");
  captureContainer.className = "canvas-capture-container";
  captureContainer.classList.add(`theme-${roster.id.split("_")[0]}`);
  const isBright = document.body.classList.contains("theme-bright");
  if (isBright) captureContainer.classList.add("theme-bright");
  
  let tablesHTML = "";
  if (roster.id === "cleaning_roster" || roster.id === "cooking_roster") {
    tablesHTML = `
      <div class="table-wrap" style="margin-top: 20px;">
        <table>
          <thead>
            <tr>
              <th style="width: 25%;">Day</th>
              ${roster.columns.map(c => `<th>${c.label}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${roster.rows.map(row => `
              <tr>
                <td class="day">${row.day}</td>
                ${roster.columns.map(c => `<td>${row[c.key] || ""}</td>`).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  } else {
    // Group by Day
    const rowsByDay = {};
    roster.rows.forEach(row => {
      const day = row.day || "General";
      if (!rowsByDay[day]) rowsByDay[day] = [];
      rowsByDay[day].push(row);
    });

    Object.keys(rowsByDay).forEach(day => {
      tablesHTML += `
        <div class="day-group" style="margin-top: 20px; text-align: left;">
          <h3 style="font-family: Georgia, serif; font-size: 15px; color: var(--accent-color); margin: 0 0 6px 4px; border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">${day}</h3>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>${roster.columns.map(c => `<th>${c.label}</th>`).join("")}</tr>
              </thead>
              <tbody>
                ${rowsByDay[day].map(row => `
                  <tr>
                    ${roster.columns.map(c => `<td>${row[c.key] || ""}</td>`).join("")}
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
    });
  }

  captureContainer.innerHTML = `
    <div class="canvas-header">
      <img src="images/images.jpg" alt="NCCF Logo">
      <h1>NCCF Family House</h1>
      <p>Official Schedule Board</p>
    </div>
    <div class="board">
      <div class="board-title-row">
        <span class="icon">${roster.icon}</span>
        <h2>${roster.title}</h2>
      </div>
      ${tablesHTML}
    </div>
    <div class="canvas-footer">
      Generated on ${new Date().toLocaleDateString()} · Keep the fellowship burning 🙏
    </div>
  `;

  document.body.appendChild(captureContainer);

  html2canvas(captureContainer, {
    scale: 2.5,
    backgroundColor: isBright ? "#F8F9FA" : "#17131F",
    useCORS: true,
    allowTaint: true,
    logging: false
  }).then(canvas => {
    document.body.removeChild(captureContainer);
    const link = document.createElement("a");
    link.download = `NCCF_${roster.title.replace(/\s+/g, "_")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    showToast("Download started!");
  }).catch(err => {
    console.error("Canvas export failed", err);
    document.body.removeChild(captureContainer);
    showToast("Export failed! Local file security might be blocking canvas render.", true);
  });
}

// Download all rosters stacked in a long WhatsApp poster
function downloadCombinedSchedule(cardsHTML) {
  showToast("Compiling full schedule poster...");

  const isBright = document.body.classList.contains("theme-bright");
  const captureContainer = document.createElement("div");
  captureContainer.className = "canvas-capture-container";
  if (isBright) captureContainer.classList.add("theme-bright");
  captureContainer.style.background = isBright ? "#F8F9FA" : "radial-gradient(circle at 50% 0%, #201726 0%, #0E0914 100%)";
  
  captureContainer.innerHTML = `
    <div class="canvas-header">
      <img src="images/images.jpg" alt="NCCF Logo">
      <h1>NCCF Family House</h1>
      <p>Official Combined Rosters</p>
    </div>
    ${cardsHTML}
    <div class="canvas-footer">
      Generated on ${new Date().toLocaleDateString()} · Let love continue 🙏
    </div>
  `;

  document.body.appendChild(captureContainer);

  html2canvas(captureContainer, {
    scale: 2,
    backgroundColor: isBright ? "#F8F9FA" : "#0E0914",
    useCORS: true,
    allowTaint: true,
    logging: false
  }).then(canvas => {
    document.body.removeChild(captureContainer);
    const link = document.createElement("a");
    link.download = "NCCF_Combined_Schedules.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    showToast("Download started!");
  }).catch(err => {
    console.error("Combined canvas export failed", err);
    document.body.removeChild(captureContainer);
    showToast("Export failed! Local file security might be blocking canvas render.", true);
  });
}

// Draggable Control Dock Helper Implementation
function makeDockDraggable(dock, trigger) {
  if (!dock || !trigger) return;

  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;
  let hasMoved = false;

  trigger.addEventListener("mousedown", dragStart);
  trigger.addEventListener("touchstart", dragStart, { passive: true });

  function dragStart(e) {
    if (e.target.closest(".dock-content")) return;

    isDragging = true;
    hasMoved = false;

    const clientX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;

    startX = clientX;
    startY = clientY;

    const rect = dock.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;

    dock.style.bottom = "auto";
    dock.style.right = "auto";
    dock.style.left = `${startLeft}px`;
    dock.style.top = `${startTop}px`;

    document.addEventListener("mousemove", dragMove);
    document.addEventListener("touchmove", dragMove, { passive: false });
    document.addEventListener("mouseup", dragEnd);
    document.addEventListener("touchend", dragEnd);
  }

  function dragMove(e) {
    if (!isDragging) return;
    if (e.type === "touchmove") e.preventDefault();

    const clientX = e.type === "touchmove" ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === "touchmove" ? e.touches[0].clientY : e.clientY;

    const dx = clientX - startX;
    const dy = clientY - startY;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      hasMoved = true;
    }

    let newLeft = startLeft + dx;
    let newTop = startTop + dy;

    const docWidth = window.innerWidth;
    const docHeight = window.innerHeight;
    const dockRect = dock.getBoundingClientRect();

    if (newLeft < 10) newLeft = 10;
    if (newLeft > docWidth - dockRect.width - 10) newLeft = docWidth - dockRect.width - 10;
    if (newTop < 10) newTop = 10;
    if (newTop > docHeight - dockRect.height - 10) newTop = docHeight - dockRect.height - 10;

    dock.style.left = `${newLeft}px`;
    dock.style.top = `${newTop}px`;
  }

  function dragEnd(e) {
    isDragging = false;
    document.removeEventListener("mousemove", dragMove);
    document.removeEventListener("touchmove", dragMove);
    document.removeEventListener("mouseup", dragEnd);
    document.removeEventListener("touchend", dragEnd);

    if (hasMoved) {
      trigger.style.pointerEvents = "none";
      setTimeout(() => {
        trigger.style.pointerEvents = "auto";
      }, 50);
    }
  }
}

// Bind cell edit events to support single-click (dropdown) and double-click (manual input)
function bindCellEditEvents(td, roster, originalIndex, col, hasEditAccess) {
  if (!hasEditAccess || !col.editable) return;

  td.classList.add("editable");
  
  // Legacy fix for missing list types
  if (roster.id === "cleaning_roster" && col.key === "person") col.list = "members";
  if (roster.id === "cooking_roster") {
    if (col.key === "person") col.list = "members";
    if (col.key === "breakfast") col.list = "foods";
    if (col.key === "dinner") col.list = "foods";
  }
  
  // Apply visual indicators for unsaved buffer changes
  const savedRosters = DB.getRosters();
  const savedValue = savedRosters[roster.id].rows[originalIndex][col.key] || "";
  if (td.textContent.trim() !== savedValue) {
    td.classList.add("has-unsaved-changes");
  }

  let clickTimeout = null;

  td.addEventListener("click", (e) => {
    if (e.detail === 1) {
      // Single click
      clickTimeout = setTimeout(() => {
        // If dropdown is already open, document 'click' listener handles closing it
        if (td.classList.contains("dropdown-open") || td.classList.contains("editing-cell")) return;

        if (col.isTime) {
          enterTimeRangeEdit(td, roster, originalIndex, col.key, false);
        } else {
          enterAutocompleteEdit(td, roster, originalIndex, col.key, col.list, false);
        }
      }, 250);
    } else if (e.detail === 2) {
      // Double click
      clearTimeout(clickTimeout);
      if (col.isTime) {
        enterTimeRangeEdit(td, roster, originalIndex, col.key, true);
      } else {
        enterAutocompleteEdit(td, roster, originalIndex, col.key, col.list, true);
      }
    }
  });
}

