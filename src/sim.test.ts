import { describe, expect, it } from 'vitest';
import { Sim, defaultConfig, levelPreset, MS2KN, norm180 } from './sim';

function run(sim: Sim, seconds: number, hold?: (s: Sim) => void) {
  for (let i = 0; i < seconds * 30; i++) {
    hold?.(sim);
    sim.step(1 / 30);
  }
}
// einfacher Autopilot: hält einen Winkel zum wahren Wind
const holdTwa = (twa: number) => (s: Sim) => {
  const err = norm180(s.cfg.twd - twa - s.heading);
  s.rudder = Math.max(-35, Math.min(35, err * 1.5 - s.yawRate * 1.5));
};
function settled(twa: number, bft = 4, level: 1 | 2 | 3 = 1) {
  const sim = new Sim({ ...defaultConfig(), ...levelPreset(level), bft, gusts: false, currentKn: 0 });
  sim.heading = sim.cfg.twd - twa;
  const hold = holdTwa(twa);
  run(sim, 120, (s) => {
    hold(s);
    // ab Stufe 2 trimmt niemand automatisch – hier sauber getrimmt halten
    s.mainSheet = Math.max(4, Math.min(85, Math.abs(s.awa) - 17));
    s.jibSheet = Math.max(9, Math.min(75, Math.abs(s.awa) - 15));
  });
  return sim;
}

describe('Sim', () => {
  it('liefert plausible Fahrt bei 4 Bft', () => {
    const polar = [45, 60, 90, 120, 150, 175].map((a) => {
      const s = settled(a);
      return `${a}°: ${(s.u * MS2KN).toFixed(1)} kn, AWA ${s.awa.toFixed(0)}°, Krängung ${s.heel.toFixed(0)}°, Ruder ${s.rudder.toFixed(1)}°`;
    });
    console.log(polar.join('\n'));
    const kn = (a: number) => settled(a).u * MS2KN;
    expect(kn(45)).toBeGreaterThan(4.5);
    expect(kn(45)).toBeLessThan(6.5);
    expect(kn(90)).toBeGreaterThan(6);
    expect(kn(90)).toBeLessThan(8.2);
    expect(kn(175)).toBeGreaterThan(4);
  });

  it('krängt nach Lee und der scheinbare Wind fällt vorlicher ein', () => {
    const s = settled(50);
    expect(s.awa).toBeGreaterThan(0); // Wind von Stb
    expect(s.heel).toBeLessThan(-8); // Krängung nach Bb
    expect(Math.abs(s.awa)).toBeLessThan(Math.abs(s.twa));
  });

  it('bleibt im Wind stehen', () => {
    const s = settled(0);
    expect(Math.abs(s.u * MS2KN)).toBeLessThan(1.5);
  });

  it('ist ab Stufe 2 luvgierig (Gegenruder nötig)', () => {
    const s = settled(50, 5, 2);
    // Wind von Stb: Luv = Stb, also Ruder nach Bb (negativ) nötig
    expect(s.rudder).toBeLessThan(-1.5);
  });

  it('Strom versetzt: KüG weicht vom Kompasskurs ab', () => {
    const sim = new Sim({ ...defaultConfig(), ...levelPreset(3), gusts: false, currentKn: 2, currentSet: 0 });
    run(sim, 60, holdTwa(90));
    expect(Math.abs(norm180(sim.cog - sim.heading))).toBeGreaterThan(5);
  });

  it('meldet eine Patenthalse bei gefiertem Groß', () => {
    const sim = settled(170);
    sim.events.length = 0;
    run(sim, 30, holdTwa(-150));
    expect(sim.events).toContain('patenthalse');
  });

  it('Wende gelingt aus voller Fahrt und endet auf dem neuen Bug', () => {
    const sim = settled(45);
    sim.events.length = 0;
    const hold = holdTwa(-45);
    run(sim, 25, (b) => {
      hold(b);
      if (b.jibBack) b.passJib(); // Crew holt die Fock über
    });
    expect(sim.events).toContain('wende');
    expect(sim.awa).toBeLessThan(0);
    expect(sim.heel).toBeGreaterThan(5);
    expect(sim.u * MS2KN).toBeGreaterThan(3);
  });

  it('Fock steht back, wenn sie nach der Wende nicht übergeholt wird', () => {
    const sim = settled(45);
    run(sim, 12, holdTwa(-45));
    expect(sim.jibBack).toBe(true);
    const slow = sim.u;
    sim.passJib();
    run(sim, 20, holdTwa(-45));
    expect(sim.jibBack).toBe(false);
    expect(sim.u).toBeGreaterThan(slow);
  });

  it('Reffen nimmt bei viel Wind Krängung und Ruderdruck heraus', () => {
    const run6 = (reef: number) => {
      const sim = new Sim({ ...defaultConfig(), ...levelPreset(2), bft: 6, reef, gusts: false, currentKn: 0 });
      sim.heading = sim.cfg.twd - 50;
      const hold = holdTwa(50);
      run(sim, 120, (s) => {
        hold(s);
        s.mainSheet = Math.max(4, Math.abs(s.awa) - 17);
        s.jibSheet = Math.max(9, Math.abs(s.awa) - 15);
      });
      return sim;
    };
    const full = run6(0), reefed = run6(2);
    console.log(`6 Bft ungerefft: ${full.heel.toFixed(0)}° / ${(full.u * MS2KN).toFixed(1)} kn / Ruder ${full.rudder.toFixed(1)}°; 2. Reff: ${reefed.heel.toFixed(0)}° / ${(reefed.u * MS2KN).toFixed(1)} kn / Ruder ${reefed.rudder.toFixed(1)}°`);
    expect(Math.abs(reefed.heel)).toBeLessThan(Math.abs(full.heel) - 8);
    expect(Math.abs(reefed.rudder)).toBeLessThan(Math.abs(full.rudder));
    expect(reefed.u).toBeGreaterThan(full.u * 0.9);
  });
});
