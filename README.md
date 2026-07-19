# NCCF Family House Schedule Roster Hub

A lightweight, mobile-friendly static web application for managing the NCCF (Nigeria Christian Corpers' Fellowship) schedules. Suitable for deployment on GitHub Pages.

---

## 📂 Project Structure

```
/
├── index.html              # Main Hub Menu (linking to rosters, download poster feature)
├── prayer-roster.html      # Prayer Roster Page (Deep purple/wine theme)
├── glorious-service.html   # Glorious Service Roster Page (Deep navy/gold theme)
├── cleaning-roster.html    # Cleaning Roster Page (Deep forest green/gold theme)
├── style.css               # Global Stylesheet (Design system, responsive cards)
├── data.js                 # Local Database Controller (Defaults, SHA-256 Auth, localStorage)
├── script.js               # Application Controller (Inline editing, canvas rendering)
└── images/                 # Assets directory
    ├── images.jpg          # NCCF logo watermark background
    ├── prayer_glow.jpg     # Prayer Roster illustration banner
    ├── service_glory.jpg   # Service Roster illustration banner
    └── clean_vessel.jpg    # Cleaning Roster illustration banner
```

---

## 🔑 Access Credentials

Authentication credentials are encrypted using SHA-256 hashes inside `data.js`.

1. **Master Administrator**
   - **Password:** `nccfadmin`
   - **Access Level:** Can edit all three rosters (Prayer, Glorious Service, and Cleaning Roster).
2. **Prayer Coordinator**
   - **Password:** `nccfprayer`
   - **Access Level:** Restricted access. Can *only* edit the **Prayer Roster**. The other pages remain locked.

*Note: Session authentication is stored in `sessionStorage` and remains active as you navigate between roster pages.*

---

## 🌟 Main Features

* **Dynamic Data-Driven Schema:** Rosters are loaded as JSON structures defined in `data.js` and rendered programmatically. Extra columns or rows can be modified/added easily.
* **Local Browser Persistence:** Edits are stored immediately in `localStorage`. Page refreshes or browser restarts do not clear your modifications.
* **Inline Table Cell Editing:** Click on any cell (when logged in and authorized) to toggle an inline input field. Focus and blur actions handle updates automatically.
* **WhatsApp Image Export:** Powered by `html2canvas`. 
  - On the **Main Hub**: Clicking *Download Combined Poster* compiles all three schedules into one single long high-resolution PNG image suitable for WhatsApp status sharing.
  - On **Individual Pages**: Clicking *Download (PNG)* captures and outputs that roster's schedule board.
* **Interactive Badging:** Displays unsaved changes badges (`● Unsaved Changes`) and toast messages to prevent accidental navigation before saving.
* **Reset to Default:** An option to reset all schedules back to the original JSON templates (with a confirmation modal).
* **Responsive Visuals:** Beautiful dark-themed aesthetic with glowing accents, subtle watermarks, and smooth micro-animations that adapt perfectly to mobile screens.
