// Wende und Halse als Abfolge von Kommandos (nach SKS-Lehrbuch).
// Der Skipper gibt Kommandos, die Crew antwortet und führt die Arbeit aus.
// Unabhängig vom Rendering (testbar).
import { MS2KN, SHEET, Sim, SimEvent } from './sim';

export type Cmd =
  | 'klarWende' | 'ree' | 'ueberFock'
  | 'klarHalse' | 'fierSchoten' | 'holDicht' | 'rundAchtern' | 'fierGross'
  | 'abbruch';

export const COMMANDS: { id: Cmd; label: string }[] = [
  { id: 'klarWende', label: 'Klar zur Wende!' },
  { id: 'ree', label: 'Ree!' },
  { id: 'ueberFock', label: 'Über die Fock!' },
  { id: 'klarHalse', label: 'Klar zur Halse!' },
  { id: 'fierSchoten', label: 'Fier auf die Schoten!' },
  { id: 'holDicht', label: 'Hol dicht die Großschot!' },
  { id: 'rundAchtern', label: 'Rund achtern!' },
  { id: 'fierGross', label: 'Fier auf die Großschot!' },
  { id: 'abbruch', label: 'Manöver abbrechen' },
];

export type Voice = 'crew' | 'warn' | 'info';
export interface Report {
  kind: 'wende' | 'halse';
  ok: boolean;
  title: string;
  lines: string[];
}

interface Active {
  kind: 'wende' | 'halse';
  stage: 'klar' | 'ree' | 'dicht' | 'rund';
  /** Windseite beim Start (+1 = Wind von Stb) */
  s0: number;
  u0: number;
  uMin: number;
  t0: number;
  tStage: number;
  /** Zeitpunkt, zu dem das Groß übergegangen ist */
  tOver: number | null;
  tGo: number | null;
  jibBackTime: number;
  stallTime: number;
  hauling: boolean;
  eased: boolean;
  mistakes: string[];
}

const kn = (ms: number) => (ms * MS2KN).toFixed(1);

export class Crew {
  active: Active | null = null;
  say: (voice: Voice, text: string) => void = () => {};
  onReport: (r: Report) => void = () => {};
  private trimTimer = 0;
  private unannounced = false;

  constructor(private sim: Sim) {}

  reset() {
    this.active = null;
    this.trimTimer = 0;
    this.unannounced = false;
    this.sim.crewTrim = false;
    this.sim.crewMain = null;
  }

  private get side() {
    return this.sim.awa >= 0 ? 1 : -1;
  }
  private mistake(m: string) {
    if (this.active && !this.active.mistakes.includes(m)) this.active.mistakes.push(m);
  }
  private start(kind: 'wende' | 'halse') {
    const s = this.sim;
    this.active = {
      kind, stage: 'klar', s0: this.side, u0: s.u, uMin: s.u, t0: s.t, tStage: s.t,
      tOver: null, tGo: null, jibBackTime: 0, stallTime: 0, hauling: false, eased: false, mistakes: [],
    };
    this.say('crew', 'Crew: „Ist klar!“');
  }
  private stage(st: Active['stage']) {
    if (!this.active) return;
    this.active.stage = st;
    this.active.tStage = this.sim.t;
  }

  /** Kommando des Skippers */
  command(cmd: Cmd) {
    const s = this.sim, a = this.active;
    const twa = Math.abs(s.twa);
    switch (cmd) {
      case 'klarWende':
        if (a) return this.say('warn', `Es läuft schon eine ${a.kind === 'wende' ? 'Wende' : 'Halse'}.`);
        if (twa > 70) return this.say('warn', 'Wende jetzt nicht möglich: erst anluven auf Am-Wind-Kurs.');
        if (twa < 30) return this.say('warn', 'Wende jetzt nicht möglich: du stehst im Wind. Erst abfallen und Fahrt aufnehmen.');
        if (s.u * MS2KN < 2.5) return this.say('warn', 'Wende jetzt nicht möglich: zu wenig Fahrt. Erst Fahrt aufnehmen.');
        if (s.jibBack) return this.say('warn', 'Die Fock steht noch back – erst „Über die Fock!“.');
        return this.start('wende');

      case 'klarHalse':
        if (a) return this.say('warn', `Es läuft schon eine ${a.kind === 'wende' ? 'Wende' : 'Halse'}.`);
        if (twa < 120) return this.say('warn', 'Halse jetzt nicht möglich: erst abfallen auf Raumschotskurs.');
        if (s.byLee) return this.say('warn', 'Wind fällt schon von Lee ein – erst anluven, dann neu ansagen.');
        return this.start('halse');

      case 'ree':
        if (!a || a.kind !== 'wende') return this.say('crew', 'Crew: „Wir sind nicht klar zur Wende!“');
        if (a.stage !== 'klar') return;
        a.tGo = s.t;
        this.stage('ree');
        return;

      case 'ueberFock':
        if (s.jibSide === this.side) {
          if (a) this.mistake('„Über die Fock!“ zu früh – sie stand noch richtig.');
          return this.say('crew', 'Crew: „Die Fock steht doch richtig!“');
        }
        if (a?.kind === 'halse' && a.tOver === null) this.mistake('Fock vor dem Groß übergeholt.');
        s.passJib();
        return this.say('crew', 'Crew: „Fock ist über!“');

      case 'fierSchoten':
        this.trimTimer = a ? 90 : 5;
        return this.say('crew', 'Crew: „Schoten werden gefiert.“');

      case 'holDicht':
        if (!a || a.kind !== 'halse') return this.say('crew', 'Crew: „Wozu? Es ist keine Halse angesagt.“');
        if (a.tOver !== null) return this.say('crew', 'Crew: „Der Baum ist schon über.“');
        if (twa < 150) this.mistake('Großschot dichtgeholt, bevor das Boot fast vor dem Wind lag.');
        s.crewMain = { target: SHEET.mainMin + 2, hold: true };
        a.hauling = true;
        return this.say('crew', 'Crew holt die Großschot dicht …');

      case 'rundAchtern':
        if (!a || a.kind !== 'halse') return this.say('crew', 'Crew: „Wir sind nicht klar zur Halse!“');
        if (a.stage === 'rund') return;
        if (s.mainSheet > 15) {
          this.mistake('„Rund achtern!“, obwohl die Großschot nicht dicht war.');
          this.say('warn', 'Crew: „Die Großschot ist nicht dicht!“');
        }
        a.tGo = s.t;
        this.stage('rund');
        return;

      case 'fierGross':
        if (!a || a.kind !== 'halse') {
          s.crewMain = null;
          this.trimTimer = Math.max(this.trimTimer, 5);
          return this.say('crew', 'Crew: „Großschot wird gefiert.“');
        }
        if (a.tOver === null) {
          this.mistake('Großschot gefiert, bevor der Baum über war.');
          a.hauling = false;
        }
        s.crewMain = null;
        a.eased = true;
        this.trimTimer = Math.max(this.trimTimer, 6);
        return this.say('crew', 'Crew: „Großschot ist gefiert.“');

      case 'abbruch':
        if (!a) return;
        this.end();
        return this.say('info', 'Manöver abgebrochen.');
    }
  }

  private end() {
    this.active = null;
    this.sim.crewMain = null;
    this.trimTimer = Math.min(this.trimTimer, 4);
  }

  private finish(ok: boolean, failTitle?: string) {
    const a = this.active!, s = this.sim;
    const name = a.kind === 'wende' ? 'Wende' : 'Halse';
    const lines = [
      `Dauer: ${(s.t - (a.tGo ?? a.t0)).toFixed(0)} s`,
      `Fahrt: ${kn(a.u0)} kn → Minimum ${kn(Math.max(0, a.uMin))} kn → jetzt ${kn(s.u)} kn`,
    ];
    if (a.jibBackTime > 3) lines.push(`Die Fock stand ${a.jibBackTime.toFixed(0)} s back.`);
    lines.push(...a.mistakes);
    const clean = ok && a.mistakes.length === 0 && a.jibBackTime <= 3;
    this.onReport({
      kind: a.kind,
      ok: clean,
      title: !ok ? failTitle! : clean ? `${name} sauber gefahren` : `${name} geschafft – mit Abzügen`,
      lines,
    });
    this.end();
  }

  /** Nach jedem Simulationsschritt aufrufen; events = Ereignisse dieses Schritts */
  update(dt: number, events: SimEvent[]) {
    const s = this.sim, a = this.active;
    this.trimTimer = Math.max(0, this.trimTimer - dt);
    s.crewTrim = this.trimTimer > 0;
    const side = this.side;
    const over = events.includes('wende') || events.includes('halse') || events.includes('patenthalse');

    if (!a) {
      // Manöver ohne Ansage
      if (events.includes('wende')) this.unannounced = true;
      if (this.unannounced && s.jibBack) {
        this.say('warn', 'Wende ohne Ansage – die Fock steht back. „Über die Fock!“');
        this.unannounced = false;
      }
      if (!s.jibBack && !over) this.unannounced = false;
      return;
    }

    a.uMin = Math.min(a.uMin, s.u);
    if (s.jibBack) a.jibBackTime += dt;
    if (over && a.tOver === null) a.tOver = s.t;

    if (a.kind === 'wende') {
      if (events.includes('wende') && a.stage === 'klar') {
        this.mistake('Durch den Wind gesteuert, ohne „Ree!“ zu rufen.');
        a.tGo = s.t;
        this.stage('ree');
      }
      // Wende verhungert: Boot bleibt ohne Fahrt im Wind stehen
      if (a.stage === 'ree' && s.u < 0.4 && Math.abs(s.awa) < 35) a.stallTime += dt;
      else a.stallTime = 0;
      if (a.stallTime > 4) {
        a.mistakes.unshift('Das Boot ist ohne Fahrt im Wind stehen geblieben. Abfallen, Fahrt aufnehmen, neu ansetzen.');
        return this.finish(false, 'Wende verhungert');
      }
      if (a.stage === 'klar' && s.t - a.tStage > 60) {
        this.end();
        return this.say('info', 'Wende abgebrochen – es kam kein „Ree!“.');
      }
      const twa = Math.abs(s.twa);
      if (
        a.tOver !== null && side === -a.s0 && s.mainSide === side && s.jibSide === side &&
        s.t - a.tOver > 3 && twa > 32 && twa < 80 && Math.abs(s.yawRate) < 4
      ) this.finish(true);
      return;
    }

    // --- Halse ---
    if (a.hauling && s.mainSheet <= SHEET.mainMin + 3) {
      a.hauling = false;
      if (a.stage === 'klar') this.stage('dicht');
      this.say('crew', 'Crew: „Großschot ist dicht!“');
    }
    if (events.includes('patenthalse')) this.mistake('Patenthalse: der Baum kam unkontrolliert über.');
    if (over && a.stage !== 'rund') {
      this.mistake('Der Baum kam über, ohne dass „Rund achtern!“ gerufen wurde.');
      a.tGo = a.tGo ?? s.t;
      this.stage('rund');
    }
    if (a.tOver !== null && !a.eased && s.t - a.tOver > 20) {
      this.mistake('„Fier auf die Großschot!“ kam nicht – die Crew hat von selbst gefiert.');
      s.crewMain = null;
      a.eased = true;
      this.trimTimer = Math.max(this.trimTimer, 6);
    }
    if (a.tOver === null && s.t - a.tStage > 90) {
      this.end();
      return this.say('info', 'Halse abgebrochen – es ging nicht weiter.');
    }
    if (
      a.tOver !== null && a.eased && side === -a.s0 && s.mainSide === side && s.jibSide === side &&
      s.t - a.tOver > 3 && Math.abs(s.twa) > 100 && Math.abs(s.yawRate) < 4
    ) this.finish(true);
  }

  /** Lernhilfe: was als Nächstes zu tun ist */
  nextStep(): string | null {
    const s = this.sim, a = this.active;
    if (!a) return s.jibBack ? 'Die Fock steht back – Kommando „Über die Fock!“.' : null;
    const twa = Math.abs(s.twa);
    const crossed = this.side === -a.s0;
    if (a.kind === 'wende') {
      if (a.stage === 'klar') return 'Wende: „Ree!“ rufen und zügig anluven (Ruder nach Luv).';
      if (!crossed) return 'Wende: weiter durch den Wind drehen.';
      if (s.jibSide !== this.side) return 'Wende: Bug ist durch den Wind – „Über die Fock!“.';
      return 'Wende: auf den neuen Am-Wind-Kurs abfallen und das Ruder stützen.';
    }
    if (a.tOver === null) {
      if (a.hauling) return 'Halse: Crew holt die Großschot dicht – Kurs halten.';
      if (a.stage === 'klar')
        return twa < 150
          ? 'Halse: abfallen bis fast vor den Wind, dabei „Fier auf die Schoten!“.'
          : 'Halse: „Hol dicht die Großschot!“';
      if (a.stage === 'dicht') return 'Halse: „Rund achtern!“ und mit dem Heck durch den Wind steuern.';
      return 'Halse: weiter abfallen, bis der Baum überkommt.';
    }
    if (!a.eased) return 'Halse: Baum ist über – „Fier auf die Großschot!“ und Ruder stützen.';
    if (s.jibSide !== this.side) return 'Halse: „Über die Fock!“';
    return 'Halse: neuen Raumschotskurs steuern.';
  }
}
