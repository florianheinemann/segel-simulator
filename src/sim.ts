// Physikmodell der Yacht – bewusst vereinfacht, aber mit den Zusammenhängen,
// die man am Ruder spürt: scheinbarer Wind, Trimm, Krängung, Luvgierigkeit,
// Abdrift und Strom. Keine Abhängigkeit zum Rendering (testbar).

export const DEG = Math.PI / 180;
export const MS2KN = 1 / 0.514444;

const BFT_MS = [0, 0.9, 2.4, 4.4, 6.7, 9.3, 12.3, 15.5, 19];
export function bftToMs(b: number): number {
  const i = Math.max(0, Math.min(7, Math.floor(b)));
  return BFT_MS[i] + (BFT_MS[i + 1] - BFT_MS[i]) * (b - i);
}
export const norm180 = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;
export const norm360 = (a: number) => ((a % 360) + 360) % 360;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const approach = (v: number, target: number, maxStep: number) =>
  v + clamp(target - v, -maxStep, maxStep);

export type Level = 1 | 2 | 3;

export interface Config {
  level: Level;
  bft: number;
  /** Richtung, aus der der wahre Wind kommt (Grad) */
  twd: number;
  currentKn: number;
  /** Richtung, in die der Strom setzt (Grad) */
  currentSet: number;
  gusts: boolean;
}

export function levelPreset(level: Level): Pick<Config, 'level' | 'currentKn' | 'gusts'> {
  return { level, currentKn: level === 3 ? 1 : 0, gusts: level === 3 };
}

export const defaultConfig = (): Config => ({
  ...levelPreset(1),
  bft: 4,
  twd: 0,
  currentSet: 90,
});

export const SHEET = { mainMin: 4, mainMax: 85, jibMin: 9, jibMax: 75 };
export const RUDDER_MAX = 35;
export const WORLD_RESET_RADIUS = 3500;

// Auftriebs-/Widerstandsbeiwert eines Segels über dem Anstellwinkel (Grad)
export function sailCoeffs(alpha: number): { cl: number; cd: number } {
  if (alpha <= 0) return { cl: 0, cd: 0.04 };
  let cl: number;
  if (alpha < 18) cl = (1.4 * alpha) / 18;
  else if (alpha < 30) cl = 1.4 - ((alpha - 18) / 12) * 0.5;
  else cl = 0.9 * Math.cos(((alpha - 30) / 60) * 90 * DEG);
  const s = Math.sin(alpha * DEG);
  return { cl, cd: 0.06 + 1.25 * s * s };
}

const AREA_MAIN = 38;
const AREA_JIB = 32;
const MASS = 9000;

export type SimEvent = 'patenthalse' | 'halse' | 'wende' | 'reset';

export class Sim {
  cfg: Config;
  t = 0;
  x = 0;
  z = 0;
  heading = 60;
  yawRate = 0;
  /** Fahrt durchs Wasser voraus (m/s) */
  u = 2;
  /** Quergeschwindigkeit durchs Wasser, + = nach Steuerbord (m/s) */
  vLat = 0;
  /** Krängung, + = nach Steuerbord (Grad) */
  heel = 0;
  rudder = 0;
  mainSheet = 40;
  jibSheet = 38;
  /** Baumwinkel, + = nach Steuerbord (Grad) */
  boom = -30;
  jib = -30;
  /** +1 = Segel steht für Wind von Steuerbord (also auf der Bb-Seite) */
  mainSide = 1;
  jibSide = 1;

  // Trimm-Eingaben: -1 fieren, +1 dichtholen
  mainInput = 0;
  jibInput = 0;

  // abgeleitete Größen
  awa = 0;
  aws = 0;
  twa = 0;
  tws = 0;
  alphaMain = 0;
  alphaJib = 0;
  jibShadow = 1;
  byLee = false;
  cog = 0;
  sog = 0;

  // Böen
  gustFactor = 1;
  windShift = 0;
  /** Sekunden bis zum Eintreffen der nächsten Bö (negativ = läuft) */
  gustEta = Infinity;
  private gT = -20;
  private gDur = 10;
  private gPeak = 0.35;
  private gShift = 0;

  events: SimEvent[] = [];

  constructor(cfg: Config = defaultConfig()) {
    this.cfg = cfg;
    this.reset();
  }

  get autoTrim() {
    return this.cfg.level === 1;
  }
  get weatherHelm() {
    return this.cfg.level === 1 ? 0.3 : 1;
  }

  reset() {
    this.x = this.z = 0;
    this.heading = norm360(this.cfg.twd - 60); // Halber-/Am-Wind, Wind von Stb
    this.u = 2;
    this.vLat = this.yawRate = this.heel = this.rudder = 0;
    this.mainSide = this.jibSide = 1;
    this.mainSheet = 40;
    this.jibSheet = 38;
    this.boom = this.jib = -35;
    this.gT = -20;
  }

  private updateGust(dt: number) {
    if (!this.cfg.gusts) {
      this.gustFactor = 1;
      this.windShift = 0;
      this.gustEta = Infinity;
      return;
    }
    this.gT += dt;
    if (this.gT > this.gDur + 6) {
      this.gT = -(20 + Math.random() * 25);
      this.gDur = 8 + Math.random() * 10;
      this.gPeak = 0.25 + Math.random() * 0.25;
      this.gShift = (Math.random() - 0.5) * 16;
    }
    const up = clamp(this.gT / 3, 0, 1);
    const down = clamp((this.gDur + 5 - this.gT) / 5, 0, 1);
    const ramp = Math.min(up, down);
    const smooth = ramp * ramp * (3 - 2 * ramp);
    this.gustFactor = 1 + this.gPeak * smooth;
    this.windShift = this.gShift * smooth;
    this.gustEta = -this.gT;
  }

  step(dt: number) {
    const c = this.cfg;
    this.t += dt;
    this.updateGust(dt);

    // --- Wind -------------------------------------------------------------
    const tws = bftToMs(c.bft) * this.gustFactor;
    const twd = c.twd + this.windShift;
    const h = this.heading * DEG;
    const fx = Math.sin(h), fz = -Math.cos(h); // voraus
    const rx = Math.cos(h), rz = Math.sin(h); // Steuerbord
    const wx = -tws * Math.sin(twd * DEG), wz = tws * Math.cos(twd * DEG);
    const cs = c.currentKn / MS2KN;
    const cx = cs * Math.sin(c.currentSet * DEG), cz = -cs * Math.cos(c.currentSet * DEG);
    const bx = this.u * fx + this.vLat * rx, bz = this.u * fz + this.vLat * rz;
    const ax = wx - cx - bx, az = wz - cz - bz;
    const af = -(ax * fx + az * fz), ar = -(ax * rx + az * rz);
    this.aws = Math.hypot(af, ar);
    this.awa = Math.atan2(ar, af) / DEG;
    this.tws = tws;
    this.twa = norm180(twd - this.heading);
    const absA = Math.abs(this.awa);
    const s = this.awa >= 0 ? 1 : -1;

    // --- Trimm ------------------------------------------------------------
    if (this.autoTrim) {
      this.mainSheet = approach(this.mainSheet, clamp(absA - 17, SHEET.mainMin, SHEET.mainMax), 25 * dt);
      this.jibSheet = approach(this.jibSheet, clamp(absA - 15, SHEET.jibMin, SHEET.jibMax), 25 * dt);
    } else {
      const rate = (i: number) => (i < 0 ? 30 : 16) * dt;
      this.mainSheet = clamp(this.mainSheet - this.mainInput * rate(this.mainInput), SHEET.mainMin, SHEET.mainMax);
      this.jibSheet = clamp(this.jibSheet - this.jibInput * rate(this.jibInput), SHEET.jibMin, SHEET.jibMax);
    }

    // --- Segelseiten (Wende / Halse) -----------------------------------------
    let gybed = false;
    if (this.mainSide !== s) {
      if (absA < 100) {
        this.mainSide = s;
        this.events.push('wende');
      } else if (180 - absA > 12 || this.mainSheet < 15) {
        this.mainSide = s;
        gybed = true;
        this.events.push(this.mainSheet > 30 && this.aws > 2.5 ? 'patenthalse' : 'halse');
      }
    }
    if (this.jibSide !== s && (absA < 100 || 180 - absA > 8 || gybed)) this.jibSide = s;
    this.byLee = this.mainSide !== s;

    const aM = this.mainSide === s ? absA : 180;
    const aJ = this.jibSide === s ? absA : 180;
    const boomMag = Math.min(this.mainSheet, aM);
    const jibMag = Math.min(this.jibSheet, aJ);
    this.alphaMain = aM - boomMag;
    this.alphaJib = aJ - jibMag;
    this.boom = approach(this.boom, -this.mainSide * boomMag, 140 * dt);
    this.jib = approach(this.jib, -this.jibSide * jibMag, 140 * dt);
    // Fock in der Abdeckung des Großsegels auf tiefen Kursen
    this.jibShadow = 1 - 0.75 * clamp((absA - 145) / 25, 0, 1);

    // --- Kräfte -------------------------------------------------------------
    const q = 0.6 * this.aws * this.aws;
    const cosH = Math.cos(this.heel * DEG);
    const k = cosH * cosH;
    const force = (alpha: number, a: number, area: number) => {
      const { cl, cd } = sailCoeffs(alpha);
      const sa = Math.sin(a * DEG), ca = Math.cos(a * DEG);
      return {
        drive: q * area * (cl * sa - cd * ca) * k,
        side: Math.max(0, q * area * (cl * ca + cd * sa) * k),
      };
    };
    const fm = force(this.alphaMain, aM, AREA_MAIN);
    const fj = force(this.alphaJib, aJ, AREA_JIB * this.jibShadow);
    // Seitenkräfte mit Vorzeichen (+ = nach Steuerbord)
    const sideM = -this.mainSide * fm.side;
    const sideJ = -this.jibSide * fj.side;
    const hullDrive = -q * 3 * Math.cos(this.awa * DEG);
    const hullSide = -q * 10 * Math.sin(this.awa * DEG);
    const drive = fm.drive + fj.drive + hullDrive;
    const side = sideM + sideJ + hullSide;

    const au = Math.abs(this.u);
    const heelDrag = 1 + Math.pow(this.heel / 40, 2);
    const resist =
      Math.sign(this.u) *
      ((40 * au + 150 * au * au) * heelDrag +
        4000 * Math.pow(Math.max(0, au - 3.4), 3) +
        60 * au * au * Math.pow(Math.abs(this.rudder) / RUDDER_MAX, 1.5));
    this.u += ((drive - resist) / MASS) * dt;

    // --- Krängung und Abdrift --------------------------------------------------
    const heelTarget = clamp(side / 185, -55, 55);
    this.heel += (heelTarget - this.heel) * Math.min(1, dt / 1.3);
    const vLatTarget = clamp(side / (4000 * (au + 0.7)), -1.3, 1.3);
    this.vLat += (vLatTarget - this.vLat) * Math.min(1, dt / 1.0);

    // --- Drehung: Ruder, Luvgierigkeit, Segelbalance -----------------------------
    const uf = clamp(this.u / 3, -0.4, 1.5);
    const wh = this.weatherHelm;
    let r = 22 * (this.rudder / RUDDER_MAX) * uf;
    // Krängung macht luvgierig (Bug dreht zum Wind)
    r += -Math.sign(this.heel) * 22 * (4.5 / 35) * Math.pow(Math.abs(this.heel) / 20, 1.5) * wh * Math.max(0, uf);
    // Groß drückt das Heck nach Lee (luvgierig), Fock den Bug (leegierig)
    r += (-sideM + 1.1 * sideJ) * (2.5 / 2000) * Math.max(wh, 0.3);
    // ohne Fahrt bläst der Wind den Bug weg
    r += -Math.sin(this.awa * DEG) * 2 * (this.aws / 7) * (1 - clamp(au / 2, 0, 1));
    this.yawRate += (r - this.yawRate) * Math.min(1, dt / 0.6);
    this.heading = norm360(this.heading + this.yawRate * dt);

    // --- Position über Grund ---------------------------------------------------
    const gx = this.u * fx + this.vLat * rx + cx;
    const gz = this.u * fz + this.vLat * rz + cz;
    this.x += gx * dt;
    this.z += gz * dt;
    this.sog = Math.hypot(gx, gz);
    this.cog = norm360(Math.atan2(gx, -gz) / DEG);

    if (Math.hypot(this.x, this.z) > WORLD_RESET_RADIUS) {
      this.x = this.z = 0;
      this.events.push('reset');
    }
  }
}

export function pointOfSail(twa: number): string {
  const a = Math.abs(twa);
  if (a < 35) return 'Im Wind';
  if (a < 65) return 'Am Wind';
  if (a < 110) return 'Halbwind';
  if (a < 160) return 'Raumschots';
  return 'Vor dem Wind';
}
