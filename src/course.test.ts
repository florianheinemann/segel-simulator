import { describe, expect, it } from 'vitest';
import { Sim, defaultConfig, norm180 } from './sim';
import { Course } from './course';

describe('Kurs', () => {
  it('legt die Tonnen am Wind ausgerichtet aus', () => {
    const sim = new Sim({ ...defaultConfig(), twd: 90 });
    const c = new Course(sim);
    expect(c.marks).toHaveLength(4);
    // Wind aus Ost: Luvtonne liegt östlich (x+), peilt 090°
    expect(c.bearingTo(sim)).toBeCloseTo(90, 0);
    expect(c.distanceTo(sim)).toBeCloseTo(450, 0);
  });

  it('zählt die Tonnen der Reihe nach bis ins Ziel', () => {
    const sim = new Sim({ ...defaultConfig(), gusts: false, currentKn: 0 });
    const c = new Course(sim);
    const got: string[] = [];
    // Autopilot: hält auf die Tonne zu, kreuzt wenn sie zu hoch am Wind liegt
    let tack = 1;
    for (let i = 0; i < 30 * 60 * 25 && !c.done; i++) {
      const brg = c.bearingTo(sim);
      const twaToMark = norm180(sim.cfg.twd - brg);
      let target = brg;
      if (Math.abs(twaToMark) < 48) {
        if (Math.abs(twaToMark) > 30) tack = Math.sign(twaToMark);
        target = sim.cfg.twd - tack * 48;
      } else if (Math.abs(twaToMark) > 165) target = sim.cfg.twd - tack * 160;
      const err = norm180(target - sim.heading);
      sim.rudder = Math.max(-35, Math.min(35, err * 1.5 - sim.yawRate * 1.5));
      sim.step(1 / 30);
      if (sim.jibSide !== (sim.awa >= 0 ? 1 : -1)) sim.passJib();
      const r = c.update(sim, 1 / 30);
      if (r) got.push(r);
      sim.events.length = 0;
    }
    expect(got).toEqual(['mark', 'mark', 'mark', 'finish']);
    expect(c.distance).toBeGreaterThan(1600);
    console.log(`Kurs in ${(c.time / 60).toFixed(1)} min, ${c.distance.toFixed(0)} m`);
  });
});
