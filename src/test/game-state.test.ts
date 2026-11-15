import { describe, expect, it } from 'vitest';
import { ageRanges, canOpenMission, initialResources } from '@/game/state';

describe('Moonatics foundation rules', () => {
  it('starts Power at 100', () => expect(initialResources.power).toBe(100));
  it('starts Water at 100', () => expect(initialResources.water).toBe(100));
  it('starts Food at 50', () => expect(initialResources.food).toBe(50));
  it('starts Crew Safety at 100', () => expect(initialResources.crewSafety).toBe(100));
  it('opens Life Support initially', () => expect(canOpenMission(0)).toBe(true));
  it('keeps Food Production locked initially', () => expect(canOpenMission(1)).toBe(false));
  it('keeps Radiation Shielding locked initially', () => expect(canOpenMission(2)).toBe(false));
  it('assigns Explorer ages 7–9', () => expect(ageRanges.explorer).toEqual([7, 9]));
  it('assigns Specialist ages 10–12', () => expect(ageRanges.specialist).toEqual([10, 12]));
});