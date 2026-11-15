import { describe, expect, it } from 'vitest';
import { createLifeSupportState, projectedPowerUse, stepLifeSupport } from '@/game/life-support/simulation';
import { mockLifeSupportTelemetry, statusOf } from '@/game/life-support/telemetry';
const rec = mockLifeSupportTelemetry[0]!;
const base = createLifeSupportState(rec, { power: 100, water: 100, crewSafety: 100 });
describe('Life Support prototype', () => {
  it('raising filtration raises projected power use', () => expect(projectedPowerUse({ filtrationLevel: 3, climateLevel: 0, humiditySupportLevel: 0 })).toBeGreaterThan(projectedPowerUse({ filtrationLevel: 1, climateLevel: 0, humiditySupportLevel: 0 })));
  it('high system intensity drains power', () => { let s = { ...base, power: 80 }; for (let i = 0; i < 5; i++) s = stepLifeSupport(s, { filtrationLevel: 3, climateLevel: 3, humiditySupportLevel: 3 }, rec); expect(s.power).toBeLessThan(80); });
  it('more filtration lowers CO2', () => { const lo = stepLifeSupport(base, { filtrationLevel: 0, climateLevel: 1, humiditySupportLevel: 1 }, rec); const hi = stepLifeSupport(base, { filtrationLevel: 3, climateLevel: 1, humiditySupportLevel: 1 }, rec); expect(hi.co2).toBeLessThan(lo.co2); });
  it('rates 2580 ppm CO2 as watch', () => expect(statusOf('co2', 2580)).toBe('watch'));
  it('rates 23.4 °C as good', () => expect(statusOf('temperature', 23.4)).toBe('good'));
});
