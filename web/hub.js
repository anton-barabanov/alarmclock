import { alarmApp } from "./apps/alarm/app.js";
import { civApp } from "./apps/civ/app.js";

const APPS = [alarmApp, civApp];

const root = document.getElementById("app");
let cleanup = null;

function parseHash() {
  const m = (location.hash || "").match(/^#\/app\/([\w-]+)/);
  return m ? m[1] : null;
}

function renderHub() {
  root.innerHTML = `
    <div class="topbar"><h1>Приложения</h1></div>
    <div class="hub">
      ${APPS.map((app) => `
        <div class="hub-card" data-app="${app.id}">
          <div class="hub-icon">${app.icon}</div>
          <div class="hub-info">
            <div class="hub-title">${app.title}</div>
            <div class="hub-desc">${app.description}</div>
          </div>
          <div class="hub-arrow">→</div>
        </div>`).join("")}
    </div>
    <div class="hub-footer">Новое приложение: модуль в <code>apps/&lt;id&gt;/app.js</code> и запись в реестр <code>hub.js</code></div>
  `;
  root.querySelectorAll(".hub-card").forEach((card) => {
    card.onclick = () => { location.hash = `#/app/${card.dataset.app}`; };
  });
}

function render() {
  if (cleanup) { cleanup(); cleanup = null; }
  root.innerHTML = "";
  const id = parseHash();
  const app = APPS.find((a) => a.id === id);
  if (!app) {
    renderHub();
    return;
  }
  cleanup = app.mount(root, { back: () => { location.hash = "#/"; } }) || null;
}

window.addEventListener("hashchange", render);
render();
