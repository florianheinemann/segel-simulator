import { describe, expect, it } from 'vitest';
import { Sim, defaultConfig, norm180 } from './sim';
import { Crew, Report, Voice } from './maneuver';

function setup(twa: number) {
  const sim = new Sim({ ...defaultConfig(), gusts: false, currentKn: 0 });
  sim.heading = sim.cfg.twd - twa;
  const crew = new Crew(sim);
  const said: [Voice, string][] = [];
  const reports: Report[] = [];
  crew.say = (v, t) => said.push([v, t]);
  crew.onReport = (r) => reports.push(r);
  let target = twa;
  const run = (seconds: number, each?: () => void) => {
    for (let i = 0; i < seconds * 30; i++) {
      const err = norm180(sim.cfg.twd - target - sim.heading);
      sim.rudder = Math.max(-35, Math.min(35, err * 1.5 - sim.yawRate * 1.5));
      sim.step(1 / 30);
      crew.update(1 / 30, sim.events.splice(0));
      each?.();
    }
  };
  run(60);
  return { sim, crew, said, reports, run, steer: (t: number) => (target = t) };
}

describe('Wende', () => {
  it('läuft mit den richtigen Kommandos sauber durch', () => {
    const t = setup(45);
    t.crew.command('klarWende');
    expect(t.said.at(-1)![1]).toContain('Ist klar');
    t.crew.command('ree');
    t.steer(-45);
    let passed = false;
    t.run(30, () => {
      if (t.sim.jibBack && !passed) { t.crew.command('ueberFock'); passed = true; }
    });
    expect(t.reports).toHaveLength(1);
    expect(t.reports[0].ok).toBe(true);
    expect(t.crew.active).toBeNull();
  });

  it('warnt, wenn der Kurs nicht passt', () => {
    const t = setup(110);
    t.crew.command('klarWende');
    expect(t.said.at(-1)![0]).toBe('warn');
    expect(t.crew.active).toBeNull();
  });

  it('merkt fehlendes „Ree!“ und eine back stehende Fock', () => {
    const t = setup(45);
    t.crew.command('klarWende');
    t.steer(-45);
    t.run(12);
    expect(t.sim.jibBack).toBe(true);
    t.crew.command('ueberFock');
    t.run(25);
    expect(t.reports).toHaveLength(1);
    expect(t.reports[0].ok).toBe(false);
    expect(t.reports[0].lines.join(' ')).toContain('Ree');
  });

  it('meldet eine Wende ohne Ansage', () => {
    const t = setup(45);
    t.steer(-45);
    t.run(12);
    expect(t.said.some(([v, m]) => v === 'warn' && m.includes('ohne Ansage'))).toBe(true);
  });
});

describe('Halse', () => {
  it('läuft mit den richtigen Kommandos sauber durch', () => {
    const t = setup(140);
    t.crew.command('klarHalse');
    t.crew.command('fierSchoten');
    t.steer(170);
    t.run(10);
    t.crew.command('holDicht');
    t.run(8);
    expect(t.sim.mainSheet).toBeLessThan(10);
    t.crew.command('rundAchtern');
    t.steer(-150);
    let eased = false, passed = false;
    t.run(30, () => {
      if (t.crew.active?.tOver != null && !eased) { t.crew.command('fierGross'); eased = true; }
      else if (eased && !passed && t.sim.t - t.crew.active!.tOver! > 2) { t.crew.command('ueberFock'); passed = true; }
    });
    expect(t.sim.events).not.toContain('patenthalse');
    expect(t.reports).toHaveLength(1);
    expect(t.reports[0].lines).toHaveLength(2);
    expect(t.reports[0].ok).toBe(true);
    expect(t.sim.mainSheet).toBeGreaterThan(40);
  });

  it('wertet eine Patenthalse als Fehler', () => {
    const t = setup(165);
    t.crew.command('klarHalse');
    t.crew.command('rundAchtern');
    t.steer(-150);
    let done = false;
    t.run(40, () => {
      if (t.crew.active?.tOver != null && !done) { t.crew.command('fierGross'); t.crew.command('ueberFock'); done = true; }
    });
    expect(t.reports).toHaveLength(1);
    expect(t.reports[0].ok).toBe(false);
    expect(t.reports[0].lines.join(' ')).toContain('Patenthalse');
  });
});

describe('Schoten selbst bedienen', () => {
  it('Halse: Crew sagt nur an, die Großschot holt und fiert man selbst', () => {
    const t = setup(165);
    t.sim.cfg.level = 2;
    t.sim.cfg.manualSheets = true;
    t.sim.mainSheet = 80;
    t.sim.jibSheet = 70;
    t.run(5);
    t.crew.command('klarHalse');
    t.crew.command('holDicht');
    t.run(3);
    expect(t.sim.mainSheet).toBeGreaterThan(70); // niemand holt für einen dicht
    t.sim.mainInput = 1;
    t.run(8);
    t.sim.mainInput = 0;
    expect(t.said.some(([, m]) => m.includes('Großschot ist dicht'))).toBe(true);
    t.crew.command('rundAchtern');
    t.steer(-150);
    let step = 0;
    t.run(40, () => {
      const a = t.crew.active;
      if (!a) return;
      if (a.tOver != null && step === 0) { t.crew.command('fierGross'); t.sim.mainInput = -1; step = 1; }
      if (step === 1 && t.sim.mainSheet > 70) { t.sim.mainInput = 0; t.crew.command('ueberFock'); step = 2; }
    });
    expect(t.reports).toHaveLength(1);
    expect(t.reports[0].ok).toBe(true);
  });

  it('Wende: nach „Über die Fock!“ ist die Schot los und muss dichtgeholt werden', () => {
    const t = setup(45);
    t.sim.cfg.level = 2;
    t.sim.cfg.manualSheets = true;
    t.sim.mainSheet = 8;
    t.sim.jibSheet = 14;
    t.run(20);
    t.crew.command('klarWende');
    t.crew.command('ree');
    t.steer(-45);
    let passed = false;
    t.run(15, () => {
      if (t.sim.jibBack && !passed) { t.crew.command('ueberFock'); passed = true; }
    });
    expect(t.sim.jibSheet).toBeGreaterThan(50);
  });
});
