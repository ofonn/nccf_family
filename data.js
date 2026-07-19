// NCCF Roster Web App - Client-Side Data Controller (AJAX Link)

// SHA-256 hashes for credentials (kept for frontend checking and modals)
const HASHES = {
  master: "9d598ba5b4f3fda46daa17f9c0ff96ce72f6c6390a8b0488fcbc2ddd57dcdc0a",
  prayer_coordinator: "559cbfb727a428db14c17b3a925c201ac283e3800b3e034f55153077d8d56e29"
};

const DB = {
  loadedRosters: null,
  lastUpdated: null,

  // Fetch all roster configs from the Node.js backend
  async loadRosters() {
    try {
      const res = await fetch('/api/rosters');
      if (!res.ok) throw new Error("Server returned non-OK status");
      const data = await res.json();
      this.loadedRosters = data.rosters;
      this.lastUpdated = new Date(data.lastUpdated);
      return this.loadedRosters;
    } catch (e) {
      console.error("Failed to load rosters from server, using local fallback", e);
      // Fallback: Read from local storage if network is down
      const data = localStorage.getItem("nccf_rosters");
      if (data) {
        try {
          const parsed = JSON.parse(data);
          this.loadedRosters = parsed;
          this.lastUpdated = new Date();
          return parsed;
        } catch (err) {}
      }
      // Zero fallback (should not happen in normal conditions)
      this.loadedRosters = {};
      this.lastUpdated = new Date();
      return {};
    }
  },

  // Get active in-memory cache
  getRosters() {
    return this.loadedRosters || {};
  },

  // Save edits back to backend via POST
  async saveRosters(rosters) {
    const password = sessionStorage.getItem("nccf_auth_password") || "";
    try {
      const res = await fetch('/api/rosters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': password
        },
        body: JSON.stringify(rosters)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Save request failed.");
      }
      
      // Update local cache
      this.loadedRosters = rosters;
      this.lastUpdated = new Date();
      
      // Also update localStorage as local redundancy
      localStorage.setItem("nccf_rosters", JSON.stringify(rosters));
      return { success: true };
    } catch (e) {
      console.error("Failed to save changes on backend", e);
      return { success: false, error: e.message };
    }
  },

  // Trigger default reset on backend
  async resetToDefault() {
    const password = sessionStorage.getItem("nccf_auth_password") || "";
    try {
      const res = await fetch('/api/rosters', {
        method: 'POST',
        headers: {
          'x-auth-password': password,
          'x-action': 'reset'
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Reset request failed.");
      }
      return { success: true };
    } catch (e) {
      console.error("Failed to reset rosters on backend", e);
      return { success: false, error: e.message };
    }
  },

  // Get last updated date
  getLastUpdated() {
    return this.lastUpdated || new Date();
  },

  // Asynchronously compute SHA-256 hash
  async sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  },

  // Check credentials and return auth level
  async login(password) {
    const hash = await this.sha256(password);
    if (hash === HASHES.master) {
      sessionStorage.setItem("nccf_auth_level", "master");
      sessionStorage.setItem("nccf_auth_password", password); // Store password for API saves
      return "master";
    } else if (hash === HASHES.prayer_coordinator) {
      sessionStorage.setItem("nccf_auth_level", "prayer_coordinator");
      sessionStorage.setItem("nccf_auth_password", password);
      return "prayer_coordinator";
    }
    return null;
  },

  // Clear session variables
  logout() {
    sessionStorage.removeItem("nccf_auth_level");
    sessionStorage.removeItem("nccf_auth_password");
  },

  // Get current auth level
  getAuthLevel() {
    return sessionStorage.getItem("nccf_auth_level") || null;
  },

  // Check if current user has edit permission for a roster
  hasEditPermission(rosterId) {
    const authLevel = this.getAuthLevel();
    if (!authLevel) return false;
    if (authLevel === "master") return true;
    
    // Prayer coordinator can only edit prayer_roster
    if (rosterId === "prayer_roster" && authLevel === "prayer_coordinator") {
      return true;
    }
    return false;
  }
};
