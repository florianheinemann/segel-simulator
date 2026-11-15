import './style.css';
import { Config, Level, MS2KN, RUDDER_MAX, SHEET, Sim, defaultConfig, levelPreset, pointOfSail } from './sim';
import { View } from './scene';
import { initPwa } from './pwa';
import { COMMANDS, Crew, Report, Voice } from './maneuver';

declare const __APP_VERSION__: string;
declare const __BUILD__: string;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const deg3 = (v: number) => String(Math.round(v) % 360).padStart(3, '0') + '°';

// ---- Einstellungen ----------------------------------------------------------
interface Prefs { cfg: Config; top: boolean; hint: boolean; cmds: boolean }
const STORE = 'segelsim.v1';
function loadPrefs(): Prefs {
  const p: Prefs = { cfg: defaultConfig(), top: true, hint: true, cmds: false };
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (s) Object.assign(p, s, { cfg: { ...p.cfg, ...s.cfg } });
  } catch { /* Standardwerte */ }
  return p;
}
const prefs = loadPrefs();
const savePrefs = () => { try { localStorage.setItem(STORE, JSON.stringify(prefs)); } catch { /* egal */ } };

const sim = new Sim(prefs.cfg);
const view = new View($<HTMLCanvasElement>('gl'), $<HTMLCanvasElement>('insVane'), $<HTMLCanvasElement>('insTell'));
let paused = false;
// Zeitlupe: 1 = Echtzeit
const SPEEDS = [1, 0.5, 0.25];
let speed = 1;
(window as unknown as Record<string, unknown>).__sim = sim;

// ---- Ruder ------------------------------------------------------------------
const wheel = $<HTMLInputElement>('wheel');
wheel.addEventListener('input', () => { sim.rudder = +wheel.value; });
const setRudder = (v: number) => {
  sim.rudder = Math.max(-RUDDER_MAX, Math.min(RUDDER_MAX, v));
  wheel.value = String(sim.rudder);
};
$('center').addEventListener('click', () => setRudder(0));
// Feinsteuerung: je Tipp 1° nach Bb/Stb, gedrückt halten wiederholt
document.querySelectorAll<HTMLButtonElement>('[data-nudge]').forEach((b) => {
  const dir = +b.dataset.nudge!;
  let timer = 0;
  const step = () => setRudder(Math.round(sim.rudder) + dir);
  const stop = () => { clearTimeout(timer); clearInterval(timer); b.classList.remove('on'); };
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    b.classList.add('on');
    step();
    timer = window.setTimeout(() => { timer = window.setInterval(step, 120); }, 450);
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, stop);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
});

// ---- Schoten (gedrückt halten) -------------------------------------------------
document.querySelectorAll<HTMLButtonElement>('[data-sheet]').forEach((b) => {
  const which = b.dataset.sheet as 'main' | 'jib';
  const dir = +b.dataset.dir!;
  const set = (v: number) => {
    if (which === 'main') sim.mainInput = v; else sim.jibInput = v;
    b.classList.toggle('on', v !== 0);
  };
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); set(dir); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => set(0));
  b.addEventListener('contextmenu', (e) => e.preventDefault());
});

// ---- Tastatur -----------------------------------------------------------------
const keys = new Set<string>();
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement && e.target !== wheel) return;
  const k = e.key.toLowerCase();
  if (k === ' ') { setPaused(!paused); e.preventDefault(); return; }
  if (['arrowleft', 'arrowright', 'q', 'a', 'w', 's'].includes(k)) { keys.add(k); e.preventDefault(); }
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
function applyKeys(dt: number) {
  if (keys.has('arrowleft')) setRudder(sim.rudder - 25 * dt);
  if (keys.has('arrowright')) setRudder(sim.rudder + 25 * dt);
  const kb = (tight: string, ease: string) => (keys.has(tight) ? 1 : keys.has(ease) ? -1 : null);
  const m = kb('q', 'a'), j = kb('w', 's');
  if (m !== null) sim.mainInput = m; else if (keyMain) sim.mainInput = 0;
  if (j !== null) sim.jibInput = j; else if (keyJib) sim.jibInput = 0;
  keyMain = m !== null; keyJib = j !== null;
}
let keyMain = false, keyJib = false;

// ---- Pause und Zeitlupe -------------------------------------------------------
function setPaused(p: boolean) {
  paused = p;
  const b = $('pauseBtn');
  b.textContent = p ? '▶' : '⏸';
  b.classList.toggle('on', p);
  document.body.classList.toggle('paused', p);
}
$('pauseBtn').addEventListener('click', () => setPaused(!paused));
$('speedBtn').addEventListener('click', () => {
  speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
  const b = $('speedBtn');
  b.textContent = speed === 1 ? '1×' : speed === 0.5 ? '½×' : '¼×';
  b.classList.toggle('on', speed !== 1);
});

// ---- Umsehen ------------------------------------------------------------------
const gl = $('gl');
let drag: { id: number; x: number; y: number } | null = null;
gl.addEventListener('pointerdown', (e) => { drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; view.recentering = false; gl.setPointerCapture(e.pointerId); });
gl.addEventListener('pointermove', (e) => {
  if (!drag || drag.id !== e.pointerId) return;
  view.lookYaw = Math.max(-2.6, Math.min(2.6, view.lookYaw + (e.clientX - drag.x) * 0.005));
  view.lookPitch = Math.max(-0.6, Math.min(1.3, view.lookPitch + (e.clientY - drag.y) * 0.005));
  drag.x = e.clientX; drag.y = e.clientY;
});
for (const ev of ['pointerup', 'pointercancel']) gl.addEventListener(ev, () => { drag = null; });
// Der Blick bleibt stehen, wo man ihn hingezogen hat – dieser Knopf schwenkt zurück nach voraus
const lookBtn = $('lookReset');
lookBtn.addEventListener('click', () => { view.recentering = true; });

$('tellInset').addEventListener('click', () => {
  view.tellTarget = view.tellTarget === 'jib' ? 'main' : 'jib';
  $('tellLabel').textContent = view.tellTarget === 'jib' ? 'Fock-Fäden ⇄' : 'Groß-Fäden ⇄';
});

// ---- Meldungen ----------------------------------------------------------------
let toastTimer = 0;
function toast(msg: string, kind: Voice = 'warn') {
  const t = $('toast');
  t.textContent = msg;
  t.className = `show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (t.className = kind), kind === 'warn' ? 3800 : 2400);
}
const bug = () => (sim.mainSide > 0 ? 'Steuerbordbug' : 'Backbordbug');
function handleEvents(dt: number) {
  const events = sim.events.splice(0);
  for (const e of events) {
    if (e === 'patenthalse') toast('Patenthalse! Der Baum schlägt unkontrolliert über.');
    else if (e === 'reset') toast('Küste voraus – zurück in die Reviermitte versetzt', 'info');
  }
  crew.update(dt, events);
}

// ---- Manöver: Kommandos, Crew, Auswertung ---------------------------------------
const crew = new Crew(sim);
crew.say = (voice, text) => toast(text, voice);
let reportTimer = 0;
crew.onReport = (r: Report) => {
  const el = $('report');
  el.className = r.ok ? 'ok' : 'bad';
  el.innerHTML = `<b>${r.title}</b><ul>${r.lines.map((l) => `<li>${l}</li>`).join('')}</ul><small>Tippen zum Schließen</small>`;
  el.hidden = false;
  clearTimeout(reportTimer);
  reportTimer = window.setTimeout(() => (el.hidden = true), 15000);
};
$('report').addEventListener('click', () => ($('report').hidden = true));
const cmds = $('cmds');
for (const c of COMMANDS) {
  const b = document.createElement('button');
  b.textContent = c.label;
  b.dataset.cmd = c.id;
  b.addEventListener('click', () => crew.command(c.id));
  cmds.appendChild(b);
}
const showCmds = (open: boolean) => {
  prefs.cmds = open;
  cmds.hidden = !open;
  $('cmdBtn').classList.toggle('on', open);
  savePrefs();
};
$('cmdBtn').addEventListener('click', () => showCmds(!!cmds.hidden));

function hintText(): string {
  const a = Math.abs(sim.awa), aj = sim.alphaJib, am = sim.alphaMain;
  if (sim.aws < 1) return 'Kaum Wind in den Segeln.';
  if (sim.byLee) return 'Wind fällt von der falschen Seite ein – Gefahr einer Patenthalse! Anluven oder bewusst halsen.';
  if (Math.abs(sim.heel) > 30) return 'Viel Krängung, das Boot wird luvgierig: Großschot fieren oder etwas anluven.';
  const tightJ = sim.jibSheet <= SHEET.jibMin + 1, tightM = sim.mainSheet <= SHEET.mainMin + 1;
  if (aj < 2 && (tightJ || sim.autoTrim)) return 'Segel killen – du bist zu hoch am Wind. Abfallen!';
  if (sim.autoTrim) {
    if (aj < 8) return 'Luv-Faden steigt: du bist an der Windkante. Einen Hauch abfallen.';
  } else {
    if (aj < 2) return 'Fock killt: Fockschot dichtholen (oder abfallen).';
    if (am < 2) return tightM ? 'Groß killt: abfallen.' : 'Groß killt: Großschot dichtholen (oder abfallen).';
    if (aj < 8) return 'Fock: Luv-Faden steigt – Fock dichter holen oder leicht abfallen.';
    if (aj > 24 && a < 140) return 'Fock: Lee-Faden flattert, die Strömung reißt ab – Fock fieren oder anluven.';
    if (am > 26 && a < 110) return 'Groß zu dicht: Achterliekfäden klappen weg – Großschot fieren.';
    if (am < 8) return 'Groß steht zu offen – etwas dichtholen.';
  }
  if (a > 160) return 'Fast platt vor dem Wind: Verklicker im Blick behalten, damit der Wind nicht von Lee einfällt.';
  if (a > 125) return 'Tiefer Kurs: Segel weit auf. Die Fäden sagen hier wenig – der Verklicker führt.';
  return 'Fäden liegen an – die Segel ziehen.';
}

// ---- Anzeige -------------------------------------------------------------------
const rot = (id: string, a: number, cx = 0, cy = 0) => $(id).setAttribute('transform', `rotate(${a.toFixed(1)} ${cx} ${cy})`);
function updateHud() {
  const side = sim.awa >= 0 ? 'Stb' : 'Bb';
  $('iHdg').textContent = deg3(sim.heading);
  $('iStw').textContent = (sim.u * MS2KN).toFixed(1);
  $('iAwa').textContent = `${Math.abs(sim.awa).toFixed(0)}° ${side}`;
  $('iAws').textContent = `${(sim.aws * MS2KN).toFixed(0)} kn`;
  $('iHeel').textContent = `${Math.abs(sim.heel).toFixed(0)}°`;
  $('iCog').textContent = deg3(sim.cog);
  $('iSog').textContent = `${(sim.sog * MS2KN).toFixed(1)} kn`;
  rot('iAwaArrow', sim.awa);
  // Marke „vorn“ am Rand der Verklicker-Lupe
  const vb = $('vaneBow').style;
  vb.left = `${50 + view.vaneBow.x * 36}%`;
  vb.top = `${50 + view.vaneBow.y * 36}%`;

  const r = sim.rudder;
  $('rudLbl').textContent = Math.abs(r) < 0.5 ? 'Ruder mittschiffs' : `Ruder ${Math.abs(r).toFixed(0)}° ${r > 0 ? 'Stb' : 'Bb'}`;
  $('barMain').style.width = `${((sim.mainSheet - SHEET.mainMin) / (SHEET.mainMax - SHEET.mainMin)) * 100}%`;
  $('barJib').style.width = `${((sim.jibSheet - SHEET.jibMin) / (SHEET.jibMax - SHEET.jibMin)) * 100}%`;

  if (prefs.top) {
    rot('tvAw', sim.awa);
    rot('tvTw', sim.twa);
    rot('tvBoom', -sim.boom, 0, -5);
    rot('tvJib', -sim.jib, 0, -23);
    rot('tvRud', -sim.rudder, 0, 20);
    $('tvCur').style.display = sim.cfg.currentKn > 0 ? '' : 'none';
    rot('tvCur', sim.cfg.currentSet - sim.heading + 180);
  }
  if (prefs.hint) {
    const pos = `${pointOfSail(sim.twa)} · ${bug()} (Wind von ${sim.mainSide > 0 ? 'Stb' : 'Bb'})`;
    $('hint').innerHTML = `<span class="pos">${pos}</span>${crew.nextStep() ?? hintText()}`;
  }
}

// ---- Menü ----------------------------------------------------------------------
const menu = $('menu');
function syncMenu() {
  const c = sim.cfg;
  document.querySelectorAll<HTMLButtonElement>('#levels button').forEach((b) => b.classList.toggle('on', +b.dataset.level! === c.level));
  $<HTMLInputElement>('sBft').value = String(c.bft);
  $<HTMLInputElement>('sTwd').value = String(c.twd);
  $<HTMLInputElement>('sCur').value = String(c.currentKn);
  $<HTMLInputElement>('sSet').value = String(c.currentSet);
  $<HTMLInputElement>('cGust').checked = c.gusts;
  $<HTMLInputElement>('cTop').checked = prefs.top;
  $<HTMLInputElement>('cHint').checked = prefs.hint;
  $('oBft').textContent = `${c.bft} Bft`;
  $('oTwd').textContent = deg3(c.twd);
  $('oCur').textContent = `${c.currentKn.toFixed(1)} kn`;
  $('oSet').textContent = deg3(c.currentSet);
  document.body.classList.toggle('auto', sim.autoTrim);
  $('topview').style.display = $('tvLegend').style.display = prefs.top ? '' : 'none';
  $('hint').style.display = prefs.hint ? '' : 'none';
  if (!prefs.hint) $('hint').textContent = '';
  savePrefs();
}
let pausedBeforeMenu = false;
const openMenu = (open: boolean) => {
  if (open) pausedBeforeMenu = paused;
  menu.hidden = !open;
  setPaused(open || pausedBeforeMenu);
};
$('menuBtn').addEventListener('click', () => openMenu(true));
$('closeMenu').addEventListener('click', () => openMenu(false));
$('restart').addEventListener('click', () => { sim.reset(); crew.reset(); setRudder(0); $('report').hidden = true; openMenu(false); });
document.querySelectorAll<HTMLButtonElement>('#levels button').forEach((b) =>
  b.addEventListener('click', () => { Object.assign(sim.cfg, levelPreset(+b.dataset.level! as Level)); syncMenu(); }));
const bind = (id: string, fn: (el: HTMLInputElement) => void) => $<HTMLInputElement>(id).addEventListener('input', (e) => { fn(e.target as HTMLInputElement); syncMenu(); });
bind('sBft', (el) => (sim.cfg.bft = +el.value));
bind('sTwd', (el) => { sim.cfg.twd = +el.value; sim.settleSails(); });
bind('sCur', (el) => (sim.cfg.currentKn = +el.value));
bind('sSet', (el) => (sim.cfg.currentSet = +el.value));
bind('cGust', (el) => (sim.cfg.gusts = el.checked));
bind('cTop', (el) => (prefs.top = el.checked));
bind('cHint', (el) => (prefs.hint = el.checked));
showCmds(prefs.cmds);
$('ver').textContent = `v${__APP_VERSION__} · Build ${__BUILD__.split('+')[1]}`;
syncMenu();

// ---- Hauptschleife ---------------------------------------------------------------
addEventListener('resize', () => view.resize());
view.resize();
let last = performance.now(), hudT = 0;
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000) * speed;
  last = now;
  if (!paused) {
    applyKeys(dt);
    sim.step(dt);
    handleEvents(dt);
    view.update(sim, dt);
    if ((hudT += dt) > 0.1) { hudT = 0; updateHud(); }
  }
  lookBtn.hidden = !view.lookedAway || view.recentering;
  view.render();
  requestAnimationFrame(frame);
}
view.update(sim, 0);
updateHud();
requestAnimationFrame((t) => {
  frame(t);
  // Ladebild ausblenden, sobald das erste Bild steht
  const boot = $('boot');
  boot.classList.add('gone');
  setTimeout(() => boot.remove(), 500);
});
initPwa();

