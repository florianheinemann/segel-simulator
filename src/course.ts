// Kursmodus: ein Viereck aus Tonnen, ausgerichtet am Wind. Der Reihe nach
// anzusteuern – dabei kommen Kreuzen (Wenden), Halbwind (Kurs halten) und ein
// Vorwindschenkel (Halsen) vor. Unabhängig vom Rendering.
import { DEG, Sim, norm360 } from './sim';

export interface Mark {
  x: number;
  z: number;
  name: string;
  /** Was dieser Schenkel übt */
  leg: string;
}

export const MARK_RADIUS = 40;
const LEG_UP = 450;
const LEG_SIDE = 350;

export class Course {
  marks: Mark[] = [];
  /** Index der nächsten Tonne; = marks.length, wenn der Kurs beendet ist */
  idx = 0;
  time = 0;
  distance = 0;
  private px = 0;
  private pz = 0;

  constructor(sim: Sim) {
    const twd = sim.cfg.twd * DEG;
    const ux = Math.sin(twd), uz = -Math.cos(twd); // nach Luv
    const rx = Math.cos(twd), rz = Math.sin(twd); // quer dazu
    const at = (up: number, side: number) => ({ x: sim.x + ux * up + rx * side, z: sim.z + uz * up + rz * side });
    this.marks = [
      { ...at(LEG_UP, 0), name: 'Luvtonne', leg: 'liegt genau in Luv – aufkreuzen mit Wenden' },
      { ...at(LEG_UP, LEG_SIDE), name: 'Tonne 2', leg: 'Halbwind – Kurs halten, Versatz ausgleichen' },
      { ...at(0, LEG_SIDE), name: 'Leetonne', leg: 'liegt genau in Lee – raumschots mit Halse' },
      { ...at(0, 0), name: 'Ziel', leg: 'Halbwind zurück zum Start' },
    ];
    this.px = sim.x;
    this.pz = sim.z;
  }

  get done() {
    return this.idx >= this.marks.length;
  }
  get next(): Mark | null {
    return this.marks[this.idx] ?? null;
  }
  distanceTo(sim: Sim): number {
    const m = this.next;
    return m ? Math.hypot(m.x - sim.x, m.z - sim.z) : 0;
  }
  /** rechtweisende Peilung zur nächsten Tonne */
  bearingTo(sim: Sim): number {
    const m = this.next;
    return m ? norm360(Math.atan2(m.x - sim.x, -(m.z - sim.z)) / DEG) : 0;
  }

  /** liefert 'mark', wenn eine Tonne erreicht wurde, 'finish' am Ziel */
  update(sim: Sim, dt: number): 'mark' | 'finish' | null {
    if (this.done) return null;
    this.time += dt;
    this.distance += Math.hypot(sim.x - this.px, sim.z - this.pz);
    this.px = sim.x;
    this.pz = sim.z;
    if (this.distanceTo(sim) > MARK_RADIUS) return null;
    this.idx++;
    return this.done ? 'finish' : 'mark';
  }
}
