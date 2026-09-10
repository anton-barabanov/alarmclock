const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 7];
const DAY_NAMES = { 1: "Пн", 2: "Вт", 3: "Ср", 4: "Чт", 5: "Пт", 6: "Сб", 7: "Вс" };
const DIFFICULTY_LABELS = { OFF: "Выкл", EASY: "Легко", MEDIUM: "Средне", HARD: "Сложно" };
const RINGTONES = [
  { id: "", title: "По умолчанию" },
  { id: "classic", title: "Классический" },
  { id: "rise", title: "Нарастающий" },
  { id: "arpeggio", title: "Арпеджио" },
  { id: "bell", title: "Колокольчик" },
  { id: "phone", title: "Телефон" },
];
const DAYS_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const MONTHS_SHORT = ["янв.", "февр.", "марта", "апр.", "мая", "июн.", "июл.", "авг.", "сент.", "окт.", "нояб.", "дек."];

const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const pad2 = (n) => String(n).padStart(2, "0");

function newAlarm() {
  const now = new Date();
  return {
    id: Date.now(),
    hour: (now.getHours() + 1) % 24,
    minute: 0,
    enabled: true,
    daysMask: 0,
    label: "",
    vibrate: true,
    snoozeMinutes: 10,
    mathDifficulty: "EASY",
    ringtoneId: "",
  };
}

function isRepeating(a) { return a.daysMask !== 0; }
function isScheduledOn(a, jsDay) { return (a.daysMask >> ((jsDay + 6) % 7)) & 1; }

function daysLabel(a) {
  if (!isRepeating(a)) return "Один раз";
  const selected = WEEK_ORDER.filter((d) => (a.daysMask >> (d - 1)) & 1).map((d) => DAY_NAMES[d]);
  if (selected.length === 7) return "Каждый день";
  if (selected.join(",") === "Пн,Вт,Ср,Чт,Пт") return "По будням";
  if (selected.join(",") === "Сб,Вс") return "По выходным";
  return selected.join(", ");
}

function formatTimeOfDay(h, m) { return `${pad2(h)}:${pad2(m)}`; }

function nextTriggerTime(a, now = Date.now()) {
  const cal = new Date(now);
  cal.setSeconds(0, 0);
  cal.setHours(a.hour, a.minute);
  let attempts = 0;
  while (attempts < 8) {
    const dayMatches = !isRepeating(a) || isScheduledOn(a, cal.getDay());
    if (cal.getTime() > now && dayMatches) break;
    cal.setDate(cal.getDate() + 1);
    attempts++;
  }
  return cal.getTime();
}

function formatNextTrigger(a) {
  const t = new Date(nextTriggerTime(a));
  return `${DAYS_SHORT[t.getDay()]}, ${t.getDate()} ${MONTHS_SHORT[t.getMonth()]} · ${formatTimeOfDay(t.getHours(), t.getMinutes())}`;
}

const MathGenerator = {
  easy() {
    const a = randInt(2, 20), b = randInt(2, 20);
    return a >= b && Math.random() < 0.5
      ? { question: `${a} - ${b} = ?`, answer: a - b }
      : { question: `${a} + ${b} = ?`, answer: a + b };
  },
  medium() {
    if (Math.random() < 0.5) {
      const a = randInt(3, 12), b = randInt(3, 12);
      return { question: `${a} × ${b} = ?`, answer: a * b };
    }
    const a = randInt(15, 89), b = randInt(11, 79);
    return { question: `${a} + ${b} = ?`, answer: a + b };
  },
  hard() {
    switch (randInt(0, 2)) {
      case 0: {
        const a = randInt(4, 15), b = randInt(4, 12), c = randInt(5, 40);
        return { question: `${a} × ${b} + ${c} = ?`, answer: a * b + c };
      }
      case 1: {
        const a = randInt(4, 15), b = randInt(4, 12), c = randInt(5, 40);
        return a * b >= c
          ? { question: `${a} × ${b} - ${c} = ?`, answer: a * b - c }
          : { question: `${a} × ${b} + ${c} = ?`, answer: a * b + c };
      }
      default: {
        const a = randInt(3, 9), b = randInt(4, 15), c = randInt(3, 9);
        return { question: `(${a} + ${b}) × ${c} = ?`, answer: (a + b) * c };
      }
    }
  },
  generate(d) {
    return d === "OFF" ? { question: "", answer: 0 }
      : d === "EASY" ? this.easy()
      : d === "MEDIUM" ? this.medium()
      : this.hard();
  },
};

const store = {
  load() {
    try { return JSON.parse(localStorage.getItem("alarms") || "[]"); }
    catch { return []; }
  },
  save(alarms) { localStorage.setItem("alarms", JSON.stringify(alarms)); },
};

let alarms = store.load();
let route = { name: "list" };
let firedKeys = new Set();
let snoozes = {};
let rootEl = null;
let ringingEl = null;
let hubCtx = null;
let tickTimer = null;

function persist() { store.save(alarms); }

function render() {
  if (!rootEl) return;
  if (route.name === "list") renderList();
  else renderEdit(route.alarmId);
}

function renderList() {
  rootEl.innerHTML = `
    <div class="topbar">
      <button class="back" id="home-btn" title="К приложениям">⌂</button>
      <h1>Будильник</h1>
    </div>
    <div class="list">
      ${alarms.length === 0 ? `<div class="empty">Будильников пока нет.\nНажмите «Добавить»</div>` : ""}
      ${alarms.map((a) => `
        <div class="card ${a.enabled ? "" : "disabled"}" data-id="${a.id}">
          <div class="info">
            <div class="time">${formatTimeOfDay(a.hour, a.minute)}</div>
            <div class="sub">${daysLabel(a)}${a.label ? " · " + escapeHtml(a.label) : ""}</div>
            ${a.enabled ? `<div class="next">Сработает: ${formatNextTrigger(a)}</div>` : ""}
          </div>
          <label class="switch" data-toggle="${a.id}">
            <input type="checkbox" ${a.enabled ? "checked" : ""}>
            <span class="slider"></span>
          </label>
        </div>`).join("")}
    </div>
    <button class="fab" id="add-btn">＋ Добавить</button>
  `;
  document.getElementById("add-btn").onclick = () => {
    route = { name: "edit", alarmId: null };
    render();
  };
  document.getElementById("home-btn").onclick = () => hubCtx && hubCtx.back();
  rootEl.querySelectorAll(".card").forEach((card) => {
    card.onclick = (e) => {
      if (e.target.closest(".switch")) return;
      route = { name: "edit", alarmId: Number(card.dataset.id) };
      render();
    };
  });
  rootEl.querySelectorAll(".switch input").forEach((sw) => {
    sw.onchange = () => {
      const id = Number(sw.closest(".switch").dataset.toggle);
      const a = alarms.find((x) => x.id === id);
      a.enabled = sw.checked;
      if (!a.enabled) delete snoozes[id];
      persist();
      render();
    };
  });
}

function renderEdit(alarmId) {
  const isNew = alarmId === null;
  const initial = isNew ? newAlarm() : alarms.find((a) => a.id === alarmId);
  if (!initial) { route = { name: "list" }; render(); return; }
  const draft = { ...initial, ringtoneId: initial.ringtoneId || "" };
  const timeValue = `${pad2(draft.hour)}:${pad2(draft.minute)}`;

  rootEl.innerHTML = `
    <div class="topbar">
      <button class="back" id="back-btn">←</button>
      <h1>${isNew ? "Новый будильник" : "Будильник"}</h1>
      <button class="save" id="save-btn">Сохранить</button>
    </div>
    <div class="form">
      <div class="time-input">
        <input type="time" id="time-input" value="${timeValue}">
      </div>
      <div class="field">
        <label>Название</label>
        <input type="text" id="label-input" value="${escapeAttr(draft.label)}" maxlength="40">
      </div>
      <div class="section">
        <div class="title">Повторять</div>
        <div class="chips" id="days-chips">
          ${WEEK_ORDER.map((d) => `
            <button class="chip ${((draft.daysMask >> (d - 1)) & 1) ? "selected" : ""}" data-day="${d}">${DAY_NAMES[d]}</button>`).join("")}
        </div>
      </div>
      <div class="section">
        <div class="title">Мелодия</div>
        <div class="chips" id="ringtone-chips">
          ${RINGTONES.map((r) => `
            <button class="chip ${draft.ringtoneId === r.id ? "selected" : ""}" data-ringtone="${r.id}">${r.title}</button>`).join("")}
        </div>
        <div class="hint">Нажмите, чтобы выбрать и прослушать</div>
      </div>
      <div class="row">
        <div class="grow">Вибрация</div>
        <label class="switch">
          <input type="checkbox" id="vibrate-input" ${draft.vibrate ? "checked" : ""}>
          <span class="slider"></span>
        </label>
      </div>
      <div class="section slider-row">
        <div class="title" id="snooze-title">Отложить на ${draft.snoozeMinutes} мин</div>
        <input type="range" id="snooze-input" min="1" max="30" step="1" value="${draft.snoozeMinutes}">
      </div>
      <div class="section">
        <div class="title">Отключение с примером</div>
        <div class="chips" id="diff-chips">
          ${Object.entries(DIFFICULTY_LABELS).map(([k, v]) => `
            <button class="chip ${draft.mathDifficulty === k ? "selected" : ""}" data-diff="${k}">${v}</button>`).join("")}
        </div>
        <div class="hint">Чтобы отключить будильник, нужно решить математический пример</div>
      </div>
      <button class="btn text" id="test-btn">Проверить сигнал</button>
      ${isNew ? "" : `<button class="btn outlined" id="delete-btn">Удалить будильник</button>`}
    </div>
  `;

  document.getElementById("back-btn").onclick = () => { route = { name: "list" }; render(); };
  document.getElementById("time-input").oninput = (e) => {
    const [h, m] = e.target.value.split(":").map(Number);
    if (!isNaN(h) && !isNaN(m)) { draft.hour = h; draft.minute = m; }
  };
  document.getElementById("label-input").oninput = (e) => { draft.label = e.target.value; };
  document.getElementById("days-chips").querySelectorAll(".chip").forEach((chip) => {
    chip.onclick = () => {
      const d = Number(chip.dataset.day);
      draft.daysMask ^= 1 << (d - 1);
      chip.classList.toggle("selected");
    };
  });
  document.getElementById("vibrate-input").onchange = (e) => { draft.vibrate = e.target.checked; };
  const snoozeInput = document.getElementById("snooze-input");
  snoozeInput.oninput = () => {
    draft.snoozeMinutes = Number(snoozeInput.value);
    document.getElementById("snooze-title").textContent = `Отложить на ${draft.snoozeMinutes} мин`;
  };
  document.getElementById("diff-chips").querySelectorAll(".chip").forEach((chip) => {
    chip.onclick = () => {
      draft.mathDifficulty = chip.dataset.diff;
      document.getElementById("diff-chips").querySelectorAll(".chip").forEach((c) => c.classList.remove("selected"));
      chip.classList.add("selected");
    };
  });
  document.querySelectorAll("#ringtone-chips .chip").forEach((chip) => {
    chip.onclick = () => {
      draft.ringtoneId = chip.dataset.ringtone;
      document.querySelectorAll("#ringtone-chips .chip").forEach((c) => c.classList.remove("selected"));
      chip.classList.add("selected");
      previewMelody(chip.dataset.ringtone);
    };
  });
  document.getElementById("save-btn").onclick = () => {
    draft.label = draft.label.trim();
    draft.snoozeMinutes = Math.min(60, Math.max(1, draft.snoozeMinutes));
    const idx = alarms.findIndex((a) => a.id === draft.id);
    if (idx >= 0) alarms[idx] = draft; else alarms.push(draft);
    persist();
    route = { name: "list" };
    render();
  };
  const del = document.getElementById("delete-btn");
  if (del) del.onclick = () => {
    alarms = alarms.filter((a) => a.id !== initial.id);
    delete snoozes[initial.id];
    persist();
    route = { name: "list" };
    render();
  };
  document.getElementById("test-btn").onclick = () => { startRinging(draft, true); };
}

function escapeHtml(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, "&quot;"); }

let audioCtx = null;
let soundTimer = null;
let vibrateTimer = null;
let previewTimer = null;

function unlockAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
}

function note(when, dur, freq, opts = {}) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = opts.type || "square";
  osc.frequency.value = freq;
  const vol = opts.vol || 0.22;
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(vol, when + 0.015);
  if (opts.decay) {
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  } else {
    gain.gain.setValueAtTime(vol, Math.max(when + 0.015, when + dur - 0.03));
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  }
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(when);
  osc.stop(when + dur + 0.05);
}

const MELODIES = {
  classic: {
    ms: 1150,
    loop(t) {
      for (let i = 0; i < 4; i++) note(t + i * 0.22, 0.13, i % 2 ? 950 : 800);
    },
  },
  rise: {
    ms: 1400,
    loop(t) {
      [523.25, 659.25, 783.99, 1046.51].forEach((f, i) =>
        note(t + i * 0.2, 0.2, f, { type: "triangle", vol: 0.3 }));
    },
  },
  arpeggio: {
    ms: 1500,
    loop(t) {
      [440, 554.37, 659.25, 880, 1108.73, 880, 659.25, 554.37].forEach((f, i) =>
        note(t + i * 0.12, 0.11, f, { type: "triangle", vol: 0.24 }));
    },
  },
  bell: {
    ms: 2600,
    loop(t) {
      [0, 1.3].forEach((at) => {
        note(t + at, 1.1, 1318.51, { type: "sine", vol: 0.35, decay: true });
        note(t + at, 0.7, 1760, { type: "sine", vol: 0.14, decay: true });
      });
    },
  },
  phone: {
    ms: 2400,
    loop(t) {
      for (let i = 0; i < 24; i++) note(t + i * 0.04, 0.035, i % 2 ? 480 : 440, { type: "triangle", vol: 0.3 });
    },
  },
};

function startAlarmSound(ringtoneId) {
  unlockAudio();
  const melody = MELODIES[ringtoneId] || MELODIES.classic;
  const scheduleOnce = () => melody.loop(audioCtx.currentTime + 0.06);
  scheduleOnce();
  soundTimer = setInterval(scheduleOnce, melody.ms);
}

function previewMelody(id) {
  unlockAudio();
  const melody = MELODIES[id] || MELODIES.classic;
  melody.loop(audioCtx.currentTime + 0.05);
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(() => { previewTimer = null; }, melody.ms);
}

function stopAlarmSound() {
  if (soundTimer) { clearInterval(soundTimer); soundTimer = null; }
  if (vibrateTimer) { clearInterval(vibrateTimer); vibrateTimer = null; }
  if (previewTimer) { clearTimeout(previewTimer); previewTimer = null; }
  if (navigator.vibrate) navigator.vibrate(0);
}

function startVibrate() {
  if (!navigator.vibrate) return;
  const pattern = [400, 200, 400, 800];
  navigator.vibrate(pattern);
  vibrateTimer = setInterval(() => navigator.vibrate(pattern), 1800);
}

let ringing = null;

function startRinging(alarm, isTest = false) {
  ringing = {
    alarm,
    isTest,
    problem: MathGenerator.generate(alarm.mathDifficulty),
    wrong: false,
    answer: "",
  };
  ringingEl.classList.remove("hidden");
  drawRinging();
  startAlarmSound(alarm.ringtoneId);
  if (alarm.vibrate) startVibrate();
}

function drawRinging() {
  const { alarm, problem, wrong } = ringing;
  ringingEl.innerHTML = `
    <div class="ring-card">
      <div class="ring-time">${formatTimeOfDay(alarm.hour, alarm.minute)}</div>
      ${alarm.label ? `<div class="ring-label">${escapeHtml(alarm.label)}</div>` : ""}
      ${alarm.mathDifficulty !== "OFF" ? `
        <div class="math-box">
          <div class="caption">Решите пример, чтобы отключить</div>
          <div class="question">${problem.question}</div>
          <input type="text" id="answer-input" inputmode="numeric" autocomplete="off"
                 placeholder="Ответ" class="${wrong ? "wrong" : ""}" value="${ringing.answer}">
          ${wrong ? `<div class="wrong-msg">Неверно, попробуйте ещё раз</div>` : ""}
        </div>` : ""}
      <button class="btn primary" id="dismiss-btn">Отключить</button>
      <button class="btn text" id="snooze-btn">Отложить на ${alarm.snoozeMinutes} мин</button>
    </div>
  `;
  const input = document.getElementById("answer-input");
  if (input) {
    input.oninput = () => {
      ringing.wrong = false;
      ringing.answer = input.value.replace(/\D/g, "");
      input.value = ringing.answer;
    };
    input.onkeydown = (e) => { if (e.key === "Enter") tryDismiss(); };
    input.focus();
  }
  document.getElementById("dismiss-btn").onclick = tryDismiss;
  document.getElementById("snooze-btn").onclick = () => {
    const a = ringing.alarm;
    const wasTest = ringing.isTest;
    stopRinging();
    if (!wasTest) snoozes[a.id] = Date.now() + a.snoozeMinutes * 60000;
  };
  function tryDismiss() {
    const r = ringing;
    if (!r) return;
    if (r.alarm.mathDifficulty !== "OFF" && Number(r.answer) !== r.problem.answer) {
      ringing.wrong = true;
      ringing.answer = "";
      ringing.problem = MathGenerator.generate(r.alarm.mathDifficulty);
      drawRinging();
      return;
    }
    const a = r.alarm;
    const wasTest = r.isTest;
    stopRinging();
    if (!wasTest && !isRepeating(a)) {
      const stored = alarms.find((x) => x.id === a.id);
      if (stored) { stored.enabled = false; persist(); render(); }
    }
  }
}

function stopRinging() {
  stopAlarmSound();
  ringingEl.classList.add("hidden");
  ringingEl.innerHTML = "";
  ringing = null;
}

function tick() {
  if (ringing) return;
  const now = new Date();
  const hh = now.getHours(), mm = now.getMinutes();
  const epochMinute = Math.floor(Date.now() / 60000);
  for (const a of alarms) {
    if (!a.enabled) continue;
    if (snoozes[a.id] !== undefined && Date.now() >= snoozes[a.id]) {
      delete snoozes[a.id];
      startRinging(a);
      return;
    }
    if (a.hour === hh && a.minute === mm && (!isRepeating(a) || isScheduledOn(a, now.getDay()))) {
      const key = `${a.id}:${epochMinute}`;
      if (!firedKeys.has(key)) {
        firedKeys.add(key);
        delete snoozes[a.id];
        startRinging(a);
        return;
      }
    }
  }
  if (firedKeys.size > 200) firedKeys = new Set([...firedKeys].slice(-100));
}

export const alarmApp = {
  id: "alarm",
  title: "Будильник",
  description: "Повторяющиеся будильники, мелодии, отложка и отключение математической задачей",
  icon: "⏰",
  mount(root, ctx) {
    rootEl = root;
    hubCtx = ctx;
    ringingEl = document.createElement("div");
    ringingEl.className = "ringing hidden";
    document.body.appendChild(ringingEl);
    route = { name: "list" };
    render();
    tickTimer = setInterval(tick, 1000);
    return () => {
      stopRinging();
      stopAlarmSound();
      if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
      if (ringingEl && ringingEl.parentNode) ringingEl.parentNode.removeChild(ringingEl);
      ringingEl = null;
      rootEl = null;
      hubCtx = null;
    };
  },
};
