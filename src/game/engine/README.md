# Moonatics simulation engine

TypeScript engine for the 3-act lunar outpost (Life Support, Greenhouse, Solar Storm). It is pure and
immutable: every function takes a `GameState` and returns a new one, with no timers (Pause / Step only).

```ts
import { createGameState, updateLifeSupportControls, stepMission, toHudResources } from '@/game/engine';

let state = createGameState({ ageBand: '7-9' });
state = updateLifeSupportControls(state, { airFiltration: 70 });
state = stepMission(state);
const hud = toHudResources(state); // { power, water, food, crewSafety }, all 0-100
```

## Files

| File | Role |
| --- | --- |
| `types.ts` | All state and dataset types |
| `life-support.ts` | Act 1 cabin CO2, temperature, humidity, battery and water |
| `food.ts` | Act 2 VEG-05 tomato crop (Day 1 to 100), light spectrum and watering |
| `radiation.ts` | Act 3 storm phases, SEP power allocator, CRaTER dose integration |
| `mission.ts` | Global state, act sequencing, failure and retry, age-adapted telemetry, debrief |
| `adapter.ts` | UI vocabulary: Explorer/Specialist, 0-3 levels, four HUD bars |
| `../data/*.json` | Curated NASA data (static, not live) |

## Rules the engine enforces

- Acts only move forward one at a time. Act 1 needs all 8 checkpoints played with the habitat stable on at least 6
  of them, Act 2 needs Day 100, and Act 3 needs the end of the CRaTER window. Pressing Step alone fails Act 1.
- Act 1 replays 48 hours of real RR-28 data (8 steps of 6 hours). Every lever starts at 50% = "no change", so the
  habitat begins exactly as NASA observed it. `forecastNextStep` previews the next step using the real step.
- Controls only work in their own act. Storm phases are strictly sequential.
- Bad input (`NaN`, `null`, junk strings) keeps the current value.
- Each act stops at the end of its real data. Nothing wraps around or adds phantom dose.
- Failure limits are checked on Step and act changes only, so dragging a slider never ends the game.
  `retryAct` restores the start of the failed act.

## Data sources (curated, embedded, not live)

- OSDR RR-28 ISS cabin telemetry (CO2, temperature, relative humidity)
- OSDR OSD-766 and OSD-767 VEG-05 dwarf tomato experiment
- CCMC DONKI M9.7 flare, 1,106 km/s CME and >100 MeV SEP, 7 to 9 June 2024
- RadLab CRaTER-D1D2 absorbed dose rate

Failure thresholds and score cut-offs are game-balance values, not NASA limits.

## Act 3: shielding vs power

- **Physical shielding** (`controls.act3.shelter`, 8 positions) is the only thing that sets `shieldAttenuationFactor`. Water containers shield best, then supply packs, then equipment. What is available comes from Acts 1-2 (`computeShelterInventory`: water kept, tomatoes harvested).
- **Electrical power** (`sepPowerAlloc`, in blocks) runs shelter systems, life support and the greenhouse. It never changes attenuation.
- **CME**: nothing is damaged when it is observed. Keeping the arrays deployed adds two power blocks and wears them a little as the CRaTER window plays.
- **Reroute**: `rerouteStormPower` moves one block, once, while the storm plays. The plan is locked when playback starts.
- CRaTER-D1D2 stays the external radiation source; crew exposure is a simulation derived from the shelter.
