const fs = require('fs');

// 1. Fix HTML Theme Flash by injecting synchronous script into all HTML files
const htmlFiles = fs.readdirSync(__dirname).filter(f => f.endsWith('.html'));
const themeScript = `
  <script>
    if (localStorage.getItem("nccf_theme") !== "dark") {
      document.documentElement.classList.add("theme-bright");
      document.write('<style>body { visibility: hidden; }</style>');
      document.addEventListener("DOMContentLoaded", () => {
        document.body.classList.add("theme-bright");
        document.body.style.visibility = "visible";
      });
    }
  </script>
`;

htmlFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('localStorage.getItem("nccf_theme")')) {
    content = content.replace('<head>', `<head>\n${themeScript}`);
    fs.writeFileSync(file, content);
    console.log(`Updated ${file} with theme script.`);
  }
});

// 2. Fix style.css: remove pencil icon & fix canvas export styles
let css = fs.readFileSync('style.css', 'utf8');

// Remove the pencil icon pseudo-elements completely
css = css.replace(/body\.editing-active td\.editable::after[\s\S]*?opacity: 0\.8;\n}/g, '');

// Fix canvas capture container to support both themes
css = css.replace(/\.canvas-capture-container {[\s\S]*?color: #0F172A !important;\n}/, `
.canvas-capture-container {
  position: absolute;
  left: -9999px;
  top: -9999px;
  width: 600px;
  padding: 40px;
  border-radius: 0;
  box-sizing: border-box;
}

.canvas-capture-container:not(.theme-bright) {
  background: var(--bg-gradient) !important;
  color: var(--cream) !important;
}

.canvas-capture-container:not(.theme-bright) .board {
  background: var(--ink-light) !important;
  border: 1px solid var(--border-color) !important;
  color: var(--cream) !important;
}

.canvas-capture-container:not(.theme-bright) .board h2,
.canvas-capture-container:not(.theme-bright) .board h3,
.canvas-capture-container:not(.theme-bright) .board .day {
  color: var(--accent-color) !important;
}

.canvas-capture-container:not(.theme-bright) .board td {
  color: var(--cream) !important;
}

.canvas-capture-container:not(.theme-bright) .board thead th {
  background: var(--accent-color) !important;
  color: var(--ink) !important;
}

.canvas-capture-container:not(.theme-bright) .canvas-header h1,
.canvas-capture-container:not(.theme-bright) .canvas-footer {
  color: var(--cream) !important;
}

.canvas-capture-container.theme-bright {
  background: radial-gradient(ellipse at top, #EBF3FC 0%, #FFFFFF 100%) !important;
  color: #0F172A !important;
}
`);

// Also fix the theme-bright .board to be opaque solid white to prevent dullness
if (!css.includes('backdrop-filter: none !important;')) {
  css = css.replace(/\.canvas-capture-container .board {\n/g, `.canvas-capture-container .board {\n  backdrop-filter: none !important;\n`);
}

fs.writeFileSync('style.css', css);
console.log('Fixed style.css.');
