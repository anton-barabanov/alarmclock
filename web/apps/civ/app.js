const TILE = { OCEAN: 0, GRASS: 1, PLAINS: 2, FOREST: 3, HILLS: 4, MOUNTAIN: 5 };

const TERRAIN = {
  0: { name: "Океан", color: "#1b3a5c", food: 1, prod: 0, passable: false, def: 0 },
  1: { name: "Луга", color: "#3e7a3a", food: 2, prod: 0, passable: true, def: 0 },
  2: { name: "Равнина", color: "#8a7f47", food: 1, prod: 1, passable: true, def: 0 },
  3: { name: "Лес", color: "#24522a", food: 1, prod: 2, passable: true, def: 25 },
  4: { name: "Холмы", color: "#6e5a35", food: 1, prod: 2, passable: true, def: 25 },
  5: { name: "Горы", color: "#5a5a5f", food: 0, prod: 1, passable: false, def: 0 },
};

const UNITS = {
  settler: { name: "Поселенец", letter: "П", atk: 0, def: 1, moves: 1, cost: 30, tech: null },
  scout: { name: "Разведчик", letter: "Р", atk: 1, def: 1, moves: 2, cost: 15, tech: null },
  warrior: { name: "Воин", letter: "В", atk: 2, def: 2, moves: 1, cost: 20, tech: null },
  archer: { name: "Лучник", letter: "Л", atk: 3, def: 4, moves: 1, cost: 35, tech: "archery" },
  swordsman: { name: "Мечник", letter: "М", atk: 5, def: 4, moves: 1, cost: 45, tech: "iron" },
};

const BUILDINGS = {
  granary: { name: "Амбар", cost: 40, tech: "pottery", desc: "+2 еды в городе" },
  library: { name: "Библиотека", cost: 50, tech: "writing", desc: "+50% науки в городе" },
  walls: { name: "Стены", cost: 40, tech: "masonry", desc: "+50% защиты города" },
  forge: { name: "Кузница", cost: 55, tech: "bronze", desc: "+2 производства в городе" },
};

const TECHS = {
  agriculture: { name: "Земледелие", cost: 18, req: [] },
  archery: { name: "Стрельба из лука", cost: 22, req: [] },
  pottery: { name: "Гончарное дело", cost: 26, req: ["agriculture"] },
  writing: { name: "Письменность", cost: 30, req: ["agriculture"] },
  masonry: { name: "Каменная кладка", cost: 34, req: ["archery"] },
  bronze: { name: "Обработка бронзы", cost: 44, req: ["pottery"] },
  wheel: { name: "Колесо", cost: 44, req: ["pottery"] },
  iron: { name: "Обработка железа", cost: 60, req: ["bronze"] },
  mathematics: { name: "Математика", cost: 60, req: ["writing"] },
  construction: { name: "Строительство", cost: 70, req: ["masonry", "wheel"] },
  currency: { name: "Деньги", cost: 70, req: ["mathematics"] },
  literature: { name: "Литература", cost: 80, req: ["writing", "currency"] },
};

const CITY_NAMES = [
  ["Рим", "Антиум", "Кумы", "Неаполь", "Равенна", "Арримин", "Арретий", "Медиолан"],
  ["Герговия", "Аварик", "Бибракте", "Аlesia", "Нуманция", "Оппид", "Лутеция", "Викс"],
];

const W = 26, H = 18, TS = 34;
const SAVE_KEY = "civ1_save";

let S = null;
let rootEl = null;
let hubCtx = null;
let visible = null;

const key = (x, y) => y * W + x;
const inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const dist = (a, b, c, d) => Math.max(Math.abs(a - c), Math.abs(b - d));

function neighbors(x, y) {
  const r = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      if (inMap(x + dx, y + dy)) r.push([x + dx, y + dy]);
    }
  return r;
}

function unitsAt(x, y) { return S.units.filter((u) => u.x === x && u.y === y); }
function cityAt(x, y) { return S.cities.find((c) => c.x === x && c.y === y) || null; }
function cityById(id) { return S.cities.find((c) => c.id === id) || null; }
function unitById(id) { return S.units.find((u) => u.id === id) || null; }

function makeNoise(gw, gh) {
  const g = new Float32Array((gw + 1) * (gh + 1));
  for (let i = 0; i < g.length; i++) g[i] = Math.random();
  return (u, v) => {
    const x = Math.min(gw - 0.001, Math.max(0, u));
    const y = Math.min(gh - 0.001, Math.max(0, v));
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = g[yi * (gw + 1) + xi], b = g[yi * (gw + 1) + xi + 1];
    const c = g[(yi + 1) * (gw + 1) + xi], d = g[(yi + 1) * (gw + 1) + xi + 1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

const isWaterTile = (t) => t === TILE.OCEAN;
const isLandTile = (t) => t !== TILE.OCEAN;

function floodComponents(map, isClass) {
  const seen = new Array(W * H).fill(false);
  const comps = [];
  for (let i = 0; i < W * H; i++) {
    if (seen[i] || !isClass(map[i])) continue;
    const cells = [];
    const stack = [i];
    seen[i] = true;
    let edge = false;
    while (stack.length) {
      const j = stack.pop();
      cells.push(j);
      const x = j % W, y = (j / W) | 0;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) edge = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!inMap(nx, ny)) continue;
        const k = key(nx, ny);
        if (!seen[k] && isClass(map[k])) { seen[k] = true; stack.push(k); }
      }
    }
    comps.push({ cells, edge });
  }
  return comps;
}

function cleanupBodies(map) {
  for (const c of floodComponents(map, isWaterTile))
    if (!c.edge && c.cells.length < 6)
      c.cells.forEach((j) => { map[j] = TILE.GRASS; });
  for (const c of floodComponents(map, isLandTile))
    if (c.cells.length < 3)
      c.cells.forEach((j) => { map[j] = TILE.OCEAN; });
}

function largestLandComponent(map) {
  let best = [];
  for (const c of floodComponents(map, isLandTile))
    if (c.cells.length > best.length) best = c.cells;
  return new Set(best);
}

function generateMap() {
  for (let attempt = 0; attempt < 8; attempt++) {
    const coarse = makeNoise(6, 4);
    const fine = makeNoise(13, 9);
    const elev = new Float32Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let e = coarse((x / W) * 5, (y / H) * 3) + 0.45 * fine((x / W) * 12, (y / H) * 8);
        const d = Math.min(x, y, W - 1 - x, H - 1 - y);
        if (d < 3) e -= (3 - d) * 0.28;
        elev[key(x, y)] = e;
      }
    const sorted = Float32Array.from(elev).sort();
    const thr = sorted[Math.floor(W * H * 0.52)];
    const map = new Array(W * H);
    for (let i = 0; i < W * H; i++) map[i] = elev[i] > thr ? TILE.GRASS : TILE.OCEAN;
    cleanupBodies(map);
    const comp = largestLandComponent(map);
    if (comp.size < 90) continue;
    for (let i = 0; i < W * H; i++)
      if (map[i] !== TILE.OCEAN && !comp.has(i)) map[i] = TILE.OCEAN;
    for (let i = 0; i < W * H; i++) {
      if (map[i] !== TILE.GRASS) continue;
      const r = Math.random();
      if (r < 0.2) map[i] = TILE.PLAINS;
    }
    for (let i = 0; i < W * H; i++) {
      if (map[i] !== TILE.GRASS && map[i] !== TILE.PLAINS) continue;
      const r = Math.random();
      if (r < 0.20) map[i] = TILE.FOREST;
      else if (r < 0.33) map[i] = TILE.HILLS;
      else if (r < 0.37) map[i] = TILE.MOUNTAIN;
    }
    return map;
  }
  return new Array(W * H).fill(TILE.GRASS);
}

function landScore(x, y) {
  let sc = 0;
  for (const [nx, ny] of neighbors(x, y)) {
    const t = S.map[key(nx, ny)];
    if (TERRAIN[t].passable) sc += t === TILE.GRASS ? 2 : 1;
  }
  return sc;
}

function findStarts() {
  const comp = largestLandComponent(S.map);
  const spots = [...comp].filter((i) => landScore(i % W, (i / W) | 0) >= 8);
  const pool = spots.length >= 2 ? spots : [...comp];
  let bestPair = null, bestD = -1;
  for (let i = 0; i < pool.length; i++)
    for (let j = i + 1; j < pool.length; j++) {
      const ax = pool[i] % W, ay = (pool[i] / W) | 0;
      const bx = pool[j] % W, by = (pool[j] / W) | 0;
      const d = dist(ax, ay, bx, by);
      if (d > bestD) { bestD = d; bestPair = [[ax, ay], [bx, by]]; }
    }
  return bestPair || [[3, 3], [W - 4, H - 4]];
}

function newGame() {
  S = {
    turn: 1,
    nextId: 1,
    map: null,
    players: [
      { name: "Рим", color: "#4a90d9", techs: [], researching: null, progress: 0 },
      { name: "Галлы", color: "#d9534f", techs: [], researching: null, progress: 0 },
    ],
    units: [],
    cities: [],
    explored: new Array(W * H).fill(0),
    log: ["Игра началась. Основайте город поселенцем."],
    over: null,
    sel: null,
  };
  S.map = generateMap();
  const [a, b] = findStarts();
  spawn("settler", 0, a[0], a[1]);
  spawn("warrior", 0, a[0], a[1]);
  spawn("settler", 1, b[0], b[1]);
  spawn("warrior", 1, b[0], b[1]);
  computeVision();
  save();
}

function spawn(type, owner, x, y) {
  const u = { id: S.nextId++, type, owner, x, y, moves: UNITS[type].moves };
  S.units.push(u);
  return u;
}

function computeVision() {
  visible = new Array(W * H).fill(0);
  for (const u of S.units) {
    if (u.owner !== 0) continue;
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++)
        if (inMap(u.x + dx, u.y + dy)) {
          visible[key(u.x + dx, u.y + dy)] = 1;
          S.explored[key(u.x + dx, u.y + dy)] = 1;
        }
  }
  for (const c of S.cities) {
    if (c.owner !== 0) continue;
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++)
        if (inMap(c.x + dx, c.y + dy)) {
          visible[key(c.x + dx, c.y + dy)] = 1;
          S.explored[key(c.x + dx, c.y + dy)] = 1;
        }
  }
}

function reachable(u) {
  const budget = u.moves;
  const res = new Map();
  const q = [[u.x, u.y, budget]];
  const seen = new Set([key(u.x, u.y)]);
  while (q.length) {
    const [x, y, m] = q.shift();
    if (m <= 0) continue;
    for (const [nx, ny] of neighbors(x, y)) {
      const k = key(nx, ny);
      if (seen.has(k)) continue;
      const t = S.map[k];
      if (!TERRAIN[t].passable) continue;
      const enemyHere = unitsAt(nx, ny).some((o) => o.owner !== u.owner) ||
        (cityAt(nx, ny) && cityAt(nx, ny).owner !== u.owner);
      if (enemyHere) { res.set(k, 0); continue; }
      seen.add(k);
      res.set(k, m - 1);
      q.push([nx, ny, m - 1]);
    }
  }
  res.delete(key(u.x, u.y));
  return res;
}

function moveUnit(u, x, y) {
  u.x = x;
  u.y = y;
  u.moves = 0;
  computeVision();
  const c = cityAt(x, y);
  if (c && c.owner !== u.owner && !unitsAt(x, y).some((o) => o.owner === c.owner)) {
    captureCity(c, u.owner);
  }
}

function captureCity(c, owner) {
  c.owner = owner;
  c.pop = Math.max(1, c.pop - 1);
  c.producing = null;
  c.prodStored = 0;
  if (owner === 0) addLog(`Вы захватили город ${c.name}!`);
  else addLog(`${S.players[1].name} захватили город ${c.name}!`);
  checkVictory();
}

function attack(att, x, y) {
  const defs = unitsAt(x, y).filter((u) => u.owner !== att.owner);
  const city = cityAt(x, y);
  const def = defs[0];
  if (!def) return;
  const A = UNITS[att.type].atk;
  let D = UNITS[def.type].def;
  const t = S.map[key(x, y)];
  D *= 1 + TERRAIN[t].def / 100;
  if (city) {
    D *= 1.25;
    if (city.buildings.includes("walls")) D *= 1.5;
  }
  const r = A / D;
  const p = Math.min(0.95, Math.max(0.05, r / (r + 1)));
  att.moves = 0;
  if (Math.random() < p) {
    S.units = S.units.filter((u) => u !== def);
    addLog(`${UNITS[att.type].name} уничтожил ${UNITS[def.type].name} (${Math.round(p * 100)}% шанс)`);
    if (!unitsAt(x, y).some((u) => u.owner === def.owner)) {
      if (city && city.owner !== att.owner) {
        moveUnit(att, x, y);
      } else if (!city) {
        moveUnit(att, x, y);
      }
    }
  } else {
    S.units = S.units.filter((u) => u !== att);
    if (S.sel === att.id) S.sel = null;
    addLog(`${UNITS[att.type].name} погиб при атаке на ${UNITS[def.type].name} (${Math.round((1 - p) * 100)}% шанс)`);
  }
  checkVictory();
}

function addLog(msg) {
  S.log.unshift(msg);
  if (S.log.length > 30) S.log.length = 30;
}

function foundCity(u) {
  const name = CITY_NAMES[u.owner].pop() || `Город ${S.nextId}`;
  const c = {
    id: S.nextId++,
    owner: u.owner,
    x: u.x,
    y: u.y,
    name,
    pop: 1,
    foodStored: 0,
    prodStored: 0,
    producing: null,
    buildings: [],
  };
  S.cities.push(c);
  S.units = S.units.filter((x) => x !== u);
  if (S.sel === u.id) S.sel = null;
  addLog(`${S.players[u.owner].name}: основан город ${name}`);
  computeVision();
}

function cityYields(c) {
  let food = 2, prod = 1;
  const cand = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = c.x + dx, ny = c.y + dy;
      if (!inMap(nx, ny)) continue;
      if (cityAt(nx, ny)) continue;
      const t = TERRAIN[S.map[key(nx, ny)]];
      cand.push([t.food, t.prod, t.food * 1.2 + t.prod]);
    }
  cand.sort((a, b) => b[2] - a[2]);
  for (let i = 0; i < Math.min(c.pop, cand.length); i++) {
    food += cand[i][0];
    prod += cand[i][1];
  }
  if (c.buildings.includes("granary")) food += 2;
  if (c.buildings.includes("forge")) prod += 2;
  let sci = 2 + Math.floor(c.pop / 2);
  if (c.buildings.includes("library")) sci = Math.round(sci * 1.5);
  return { food, prod, sci };
}

function techAvailable(p, id) {
  const t = TECHS[id];
  return !p.techs.includes(id) && t.req.every((r) => p.techs.includes(r));
}

function processEconomy() {
  for (const c of S.cities) {
    const p = S.players[c.owner];
    const y = cityYields(c);
    const surplus = y.food - c.pop * 2;
    c.foodStored = Math.max(0, c.foodStored + surplus);
    const need = 10 + c.pop * 5;
    if (c.foodStored >= need && c.pop < 10) {
      c.pop++;
      c.foodStored -= need;
      if (c.owner === 0) addLog(`${c.name} вырос до ${c.pop} населения`);
    }
    c.prodStored += y.prod;
    if (c.producing) {
      const def = c.producing.k === "unit" ? UNITS[c.producing.id] : BUILDINGS[c.producing.id];
      if (c.prodStored >= def.cost) {
        c.prodStored -= def.cost;
        if (c.producing.k === "unit") {
          spawn(c.producing.id, c.owner, c.x, c.y);
          if (c.owner === 0) addLog(`${c.name}: построен ${def.name}`);
        } else {
          c.buildings.push(c.producing.id);
          if (c.owner === 0) addLog(`${c.name}: построена ${def.name}`);
        }
        c.producing = null;
      }
    }
    if (!p.researching && c.owner === 1) {
      const avail = Object.keys(TECHS).filter((t) => techAvailable(p, t));
      if (avail.length) {
        avail.sort((a, b) => TECHS[a].cost - TECHS[b].cost);
        p.researching = avail[0];
        p.progress = 0;
      }
    }
    if (p.researching) {
      p.progress += y.sci;
      if (p.progress >= TECHS[p.researching].cost) {
        const done = p.researching;
        p.techs.push(done);
        p.researching = null;
        p.progress = 0;
        if (c.owner === 0) addLog(`Изучена технология: ${TECHS[done].name}`);
      }
    }
  }
  for (const u of S.units) u.moves = UNITS[u.type].moves;
}

function aiTurn() {
  const p = S.players[1];
  for (const c of S.cities.filter((x) => x.owner === 1)) {
    if (!c.producing) {
      const settlers = S.units.filter((u) => u.owner === 1 && u.type === "settler").length;
      const myCities = S.cities.filter((x) => x.owner === 1).length;
      if (settlers === 0 && myCities < 5 && Math.random() < 0.7) {
        c.producing = { k: "unit", id: "settler" };
      } else {
        const best = ["swordsman", "archer", "warrior"].find(
          (t) => !UNITS[t].tech || p.techs.includes(UNITS[t].tech)
        );
        c.producing = { k: "unit", id: best };
      }
    }
  }
  for (const u of [...S.units]) {
    if (u.owner !== 1 || !S.units.includes(u)) continue;
    if (u.type === "settler") {
      let spot = null;
      let bestSc = -1;
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          if (!TERRAIN[S.map[key(x, y)]].passable || cityAt(x, y)) continue;
          if (dist(u.x, u.y, x, y) > 12) continue;
          const near = S.cities.some((c) => dist(c.x, c.y, x, y) < 3);
          if (near) continue;
          const sc = landScore(x, y) + landScore(x, y) - dist(u.x, u.y, x, y);
          if (sc > bestSc) { bestSc = sc; spot = [x, y]; }
        }
      if (!spot) { u.moves = 0; continue; }
      if (u.x === spot[0] && u.y === spot[1]) { foundCity(u); continue; }
      stepToward(u, spot[0], spot[1]);
      if (u.x === spot[0] && u.y === spot[1]) foundCity(u);
      continue;
    }
    let target = null;
    let bestD = 99;
    for (const e of S.units.filter((x) => x.owner === 0)) {
      const d = dist(u.x, u.y, e.x, e.y);
      if (d < bestD && d <= 6) { bestD = d; target = [e.x, e.y]; }
    }
    for (const c of S.cities.filter((x) => x.owner === 0)) {
      const d = dist(u.x, u.y, c.x, c.y);
      if (d < bestD && d <= 6) { bestD = d; target = [c.x, c.y]; }
    }
    if (!target) {
      const home = S.cities.filter((c) => c.owner === 1)[0];
      if (home && dist(u.x, u.y, home.x, home.y) > 3) target = [home.x, home.y];
    }
    if (target) {
      while (u.moves > 0) {
        const adj = dist(u.x, u.y, target[0], target[1]) === 1;
        if (adj) {
          const enemies = unitsAt(target[0], target[1]).filter((x) => x.owner === 0);
          if (enemies.length) { attack(u, target[0], target[1]); break; }
          const t = S.map[key(target[0], target[1])];
          if (TERRAIN[t].passable) { moveUnit(u, target[0], target[1]); break; }
          break;
        }
        const before = u.x + "," + u.y;
        stepToward(u, target[0], target[1]);
        if (u.x + "," + u.y === before) break;
      }
    } else {
      u.moves = 0;
    }
  }
}

function stepToward(u, tx, ty) {
  const opts = neighbors(u.x, u.y).filter(([nx, ny]) => {
    const t = S.map[key(nx, ny)];
    if (!TERRAIN[t].passable) return false;
    if (unitsAt(nx, ny).some((o) => o.owner !== u.owner)) return false;
    const c = cityAt(nx, ny);
    if (c && c.owner !== u.owner) return false;
    return true;
  });
  if (!opts.length) { u.moves = 0; return; }
  opts.sort((a, b) => dist(a[0], a[1], tx, ty) - dist(b[0], b[1], tx, ty));
  const [nx, ny] = opts[0];
  u.moves = Math.max(0, u.moves - 1);
  u.x = nx;
  u.y = ny;
}

function playerAlive(idx) {
  return S.cities.some((c) => c.owner === idx) ||
    S.units.some((u) => u.owner === idx && u.type === "settler");
}

function checkVictory() {
  if (S.over) return;
  if (!playerAlive(1)) S.over = { winner: 0 };
  else if (!playerAlive(0)) S.over = { winner: 1 };
}

function endTurn() {
  if (S.over) return;
  aiTurn();
  processEconomy();
  S.turn++;
  computeVision();
  checkVictory();
  save();
  renderAll();
}

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch {}
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    S = JSON.parse(raw);
    return !!S && !!S.map;
  } catch { return false; }
}

let cv = null;
let ctx = null;
let reach = null;

function drawMap() {
  ctx.fillStyle = "#0d0d12";
  ctx.fillRect(0, 0, cv.width, cv.height);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = key(x, y);
      if (!S.explored[k]) continue;
      const t = S.map[k];
      ctx.fillStyle = TERRAIN[t].color;
      ctx.fillRect(x * TS, y * TS, TS - 1, TS - 1);
      if (t === TILE.FOREST) drawGlyph("🌲", x, y);
      if (t === TILE.MOUNTAIN) drawGlyph("⛰", x, y);
      if (t === TILE.HILLS) drawGlyph("⌃", x, y, 12);
      if (!visible[k]) {
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(x * TS, y * TS, TS - 1, TS - 1);
      }
    }
  for (const c of S.cities) {
    if (!S.explored[key(c.x, c.y)]) continue;
    ctx.fillStyle = S.players[c.owner].color;
    ctx.fillRect(c.x * TS + 3, c.y * TS + 3, TS - 8, TS - 8);
    ctx.strokeStyle = "#fff";
    ctx.strokeRect(c.x * TS + 3, c.y * TS + 3, TS - 8, TS - 8);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 10px sans-serif";
    ctx.fillText(String(c.pop), c.x * TS + TS - 11, c.y * TS + TS - 7);
  }
  for (const u of S.units) {
    if (u.owner !== 0 && !visible[key(u.x, u.y)]) continue;
    if (!S.explored[key(u.x, u.y)]) continue;
    const cx = u.x * TS + TS / 2;
    const cy = u.y * TS + TS / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.fillStyle = S.players[u.owner].color;
    ctx.fill();
    ctx.strokeStyle = u.moves > 0 && u.owner === 0 ? "#ffe14d" : "#000";
    ctx.lineWidth = u.moves > 0 && u.owner === 0 ? 2 : 1;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(UNITS[u.type].letter, cx, cy + 4);
    ctx.textAlign = "left";
  }
  if (reach) {
    for (const [k] of reach) {
      const x = k % W, y = Math.floor(k / W);
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.fillRect(x * TS + TS / 2 - 3, y * TS + TS / 2 - 3, 6, 6);
    }
  }
  const sel = S.sel ? unitById(S.sel) : null;
  if (sel) {
    ctx.strokeStyle = "#ffe14d";
    ctx.lineWidth = 2;
    ctx.strokeRect(sel.x * TS + 1, sel.y * TS + 1, TS - 3, TS - 3);
  }
}

function drawGlyph(g, x, y, size) {
  ctx.font = `${size || TS - 6}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(g, x * TS + TS / 2, y * TS + TS - 6);
  ctx.textAlign = "left";
}

function onCanvasClick(e) {
  if (S.over) { renderAll(); return; }
  const r = cv.getBoundingClientRect();
  const scale = cv.width / r.width;
  const x = Math.floor(((e.clientX - r.left) * scale) / TS);
  const y = Math.floor(((e.clientY - r.top) * scale) / TS);
  if (!inMap(x, y) || !S.explored[key(x, y)]) return;
  const sel = S.sel ? unitById(S.sel) : null;
  if (sel && sel.owner === 0) {
    if (sel.x === x && sel.y === y) { S.sel = null; reach = null; renderAll(); return; }
    if (reach && reach.has(key(x, y))) {
      const enemies = unitsAt(x, y).some((u) => u.owner !== 0) ||
        (cityAt(x, y) && cityAt(x, y).owner !== 0);
      if (enemies) attack(sel, x, y);
      else moveUnit(sel, x, y);
      if (S.sel && !unitById(S.sel)) { S.sel = null; reach = null; }
      else if (S.sel) {
        const u2 = unitById(S.sel);
        reach = u2 && u2.moves > 0 ? reachable(u2) : null;
      }
      save();
      renderAll();
      return;
    }
  }
  const mine = unitsAt(x, y).filter((u) => u.owner === 0);
  if (mine.length) {
    S.sel = mine[0].id;
    reach = mine[0].moves > 0 ? reachable(mine[0]) : null;
  } else {
    S.sel = null;
    reach = null;
    const c = cityAt(x, y);
    if (c && c.owner === 0 && visible[key(x, y)]) showCity(c);
  }
  renderAll();
}

function sciTotal() {
  return S.cities.filter((c) => c.owner === 0).reduce((a, c) => a + cityYields(c).sci, 0);
}

function renderTopbar() {
  const p = S.players[0];
  const res = p.researching ? TECHS[p.researching] : null;
  const pct = res ? Math.min(100, Math.round((p.progress / res.cost) * 100)) : 0;
  const el = document.getElementById("civ-top");
  if (!el) return;
  el.innerHTML = `
    <button class="back" id="civ-home">⌂</button>
    <h1>Цивилизация · ход ${S.turn}</h1>
    <div class="civ-sci">
      ${res ? `🔬 ${res.name} ${pct}%` : "🔬 выберите технологию"}
      <div class="civ-sci-bar"><div style="width:${pct}%"></div></div>
    </div>
    <button class="civ-tech-btn" id="civ-tech">Технологии</button>
    <button class="civ-end" id="civ-end">Конец хода</button>
  `;
  document.getElementById("civ-home").onclick = () => hubCtx && hubCtx.back();
  document.getElementById("civ-tech").onclick = showTech;
  document.getElementById("civ-end").onclick = endTurn;
}

function renderPanel() {
  const el = document.getElementById("civ-panel");
  if (!el) return;
  const sel = S.sel ? unitById(S.sel) : null;
  let body = `<div class="civ-hint">Кликните юнит, затем клетку. 🏛 — города, ⛰ — горы.</div>`;
  if (sel) {
    const u = UNITS[sel.type];
    const t = TERRAIN[S.map[key(sel.x, sel.y)]];
    body = `
      <div class="civ-unit">
        <b>${u.name}</b> · ⚔${u.atk} 🛡${u.def} · ходов: ${sel.moves}
        <span class="civ-terr">${t.name}${t.def ? ` (+${t.def}% защ.)` : ""}</span>
      </div>`;
    if (sel.type === "settler" && !cityAt(sel.x, sel.y) && TERRAIN[S.map[key(sel.x, sel.y)]].passable) {
      body += `<button class="btn primary" id="civ-found">Основать город</button>`;
    }
    const ownCity = cityAt(sel.x, sel.y);
    if (ownCity && ownCity.owner === 0) {
      body += `<button class="btn text" id="civ-city">🏛 Открыть город</button>`;
    }
    if (sel.moves > 0) {
      body += `<button class="btn text" id="civ-skip">Пропустить ход</button>`;
    }
  }
  const myCities = S.cities.filter((c) => c.owner === 0);
  if (myCities.some((c) => !c.producing)) {
    body += `<div class="civ-warn">⚠ В городе не выбрано производство — кликните город</div>`;
  }
  el.innerHTML = body + `
    <div class="civ-log">${S.log.slice(0, 5).map((l) => `<div>${escapeHtml(l)}</div>`).join("")}</div>
  `;
  const f = document.getElementById("civ-found");
  if (f) f.onclick = () => {
    const u = unitById(S.sel);
    if (u) { foundCity(u); save(); renderAll(); }
  };
  const sk = document.getElementById("civ-skip");
  if (sk) sk.onclick = () => {
    const u = unitById(S.sel);
    if (u) { u.moves = 0; reach = null; save(); renderAll(); }
  };
  const cb = document.getElementById("civ-city");
  if (cb) cb.onclick = () => {
    const u = unitById(S.sel);
    const c = u && cityAt(u.x, u.y);
    if (c) showCity(c);
  };
}

function renderAll() {
  renderTopbar();
  renderPanel();
  drawMap();
  renderOver();
}

function renderOver() {
  let el = document.getElementById("civ-over");
  if (!S.over) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement("div");
    el.id = "civ-over";
    el.className = "civ-modal";
    rootEl.appendChild(el);
  }
  const win = S.over.winner === 0;
  el.innerHTML = `
    <div class="civ-dialog">
      <h2>${win ? "🏆 Победа!" : "💀 Поражение"}</h2>
      <p>${win ? "Вы захватили все города противника." : "Противник уничтожил вашу цивилизацию."}</p>
      <button class="btn primary" id="civ-restart">Новая игра</button>
    </div>
  `;
  document.getElementById("civ-restart").onclick = () => { newGame(); renderAll(); };
}

function showCity(c) {
  closeModal();
  const y = cityYields(c);
  const p = S.players[0];
  const unitOpts = Object.entries(UNITS)
    .filter(([, d]) => !d.tech || p.techs.includes(d.tech))
    .map(([id, d]) => ({ k: "unit", id, name: d.name, cost: d.cost, info: `⚔${d.atk} 🛡${d.def}` }));
  const bldOpts = Object.entries(BUILDINGS)
    .filter(([id, d]) => (!d.tech || p.techs.includes(d.tech)) && !c.buildings.includes(id))
    .map(([id, d]) => ({ k: "building", id, name: d.name, cost: d.cost, info: d.desc }));
  const opts = [...unitOpts, ...bldOpts];
  const cur = c.producing
    ? (c.producing.k === "unit" ? UNITS[c.producing.id] : BUILDINGS[c.producing.id])
    : null;
  const m = document.createElement("div");
  m.className = "civ-modal";
  m.id = "civ-modal";
  m.innerHTML = `
    <div class="civ-dialog civ-city">
      <h2>🏛 ${c.name} <span class="civ-pop">население ${c.pop}</span></h2>
      <div class="civ-yields">🌾 ${y.food} (еда) · 🔨 ${y.prod} (произв.) · 🔬 ${y.sci} (наука)</div>
      <div class="civ-growth">Рост: ${c.foodStored}/${10 + c.pop * 5} еды</div>
      ${cur ? `<div class="civ-growth">Производит: ${cur.name} (${c.prodStored}/${cur.cost})</div>` : `<div class="civ-warn">Не выбрано производство!</div>`}
      ${c.buildings.length ? `<div class="civ-yields">Постройки: ${c.buildings.map((b) => BUILDINGS[b].name).join(", ")}</div>` : ""}
      <h3>Производить:</h3>
      <div class="civ-prod-list">
        ${opts.map((o) => `
          <button class="civ-prod ${c.producing && c.producing.id === o.id && c.producing.k === o.k ? "sel" : ""}"
                  data-k="${o.k}" data-id="${o.id}">
            <b>${o.name}</b><span>${o.info}</span><span>🔨 ${o.cost}</span>
          </button>`).join("")}
      </div>
      <button class="btn text" id="civ-close">Закрыть</button>
    </div>
  `;
  rootEl.appendChild(m);
  document.getElementById("civ-close").onclick = closeModal;
  m.querySelectorAll(".civ-prod").forEach((b) => {
    b.onclick = () => {
      c.producing = { k: b.dataset.k, id: b.dataset.id };
      save();
      showCity(c);
      renderAll();
    };
  });
}

function showTech() {
  closeModal();
  const p = S.players[0];
  const m = document.createElement("div");
  m.className = "civ-modal";
  m.id = "civ-modal";
  m.innerHTML = `
    <div class="civ-dialog civ-techs">
      <h2>🔬 Технологии</h2>
      <div class="civ-yields">Наука: ${sciTotal()} в ход${p.researching ? ` · изучается: ${TECHS[p.researching].name}` : ""}</div>
      <div class="civ-prod-list">
        ${Object.entries(TECHS).map(([id, t]) => {
          const done = p.techs.includes(id);
          const can = techAvailable(p, id);
          const active = p.researching === id;
          const req = t.req.length ? `нужно: ${t.req.map((r) => TECHS[r].name).join(", ")}` : "стартовая";
          return `<button class="civ-prod ${done ? "done" : ""} ${active ? "sel" : ""}" data-tech="${id}" ${(!can && !done) ? "disabled" : ""}>
            <b>${t.name}</b><span>${done ? "изучено" : req}</span><span>🔬 ${t.cost}</span>
          </button>`;
        }).join("")}
      </div>
      <button class="btn text" id="civ-close">Закрыть</button>
    </div>
  `;
  rootEl.appendChild(m);
  document.getElementById("civ-close").onclick = closeModal;
  m.querySelectorAll(".civ-prod[data-tech]").forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.tech;
      if (p.techs.includes(id)) return;
      if (!techAvailable(p, id)) return;
      if (p.researching !== id) { p.researching = id; p.progress = 0; }
      save();
      showTech();
      renderAll();
    };
  });
}

function closeModal() {
  const m = document.getElementById("civ-modal");
  if (m) m.remove();
}

function showStart() {
  const m = document.createElement("div");
  m.className = "civ-modal";
  m.id = "civ-start";
  m.innerHTML = `
    <div class="civ-dialog">
      <h2>🏛 Цивилизация</h2>
      <p>Пошаговая 4X-стратегия: расширяйтесь, изучайте технологии, захватите все города галлов.</p>
      <button class="btn primary" id="civ-continue">Продолжить игру</button>
      <button class="btn text" id="civ-new">Новая игра</button>
    </div>
  `;
  rootEl.appendChild(m);
  document.getElementById("civ-continue").onclick = () => { m.remove(); renderAll(); };
  document.getElementById("civ-new").onclick = () => { m.remove(); newGame(); renderAll(); };
}

function escapeHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

export function debugApi() {
  return {
    get S() { return S; },
    newGame,
    endTurn,
    foundCity,
    attack,
    spawn,
    save,
    load,
    computeVision,
    processEconomy,
    techAvailable,
    cityYields,
    reachable,
  };
}

export const civApp = {
  id: "civ",
  title: "Цивилизация",
  description: "Пошаговая 4X-стратегия в духе Civilization: города, технологии, война с ИИ",
  icon: "🏛️",
  mount(root, nav) {
    rootEl = root;
    hubCtx = nav;
    const hadSave = load();
    root.innerHTML = `
      <div class="topbar" id="civ-top"></div>
      <div class="civ-map-wrap"><canvas id="civ-canvas" width="${W * TS}" height="${H * TS}"></canvas></div>
      <div id="civ-panel" class="civ-panel"></div>
    `;
    cv = document.getElementById("civ-canvas");
    ctx = cv.getContext("2d");
    cv.addEventListener("click", onCanvasClick);
    cv.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      S.sel = null;
      reach = null;
      renderAll();
    });
    if (!hadSave) newGame();
    computeVision();
    renderAll();
    if (hadSave && !S.over) showStart();
    return () => {
      closeModal();
      const ov = document.getElementById("civ-over");
      if (ov) ov.remove();
      const st = document.getElementById("civ-start");
      if (st) st.remove();
      rootEl = null;
      hubCtx = null;
      cv = null;
      ctx = null;
      reach = null;
    };
  },
};
