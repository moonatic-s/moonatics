# Moonatics

**Junior Astronaut Mission Trainer** — a browser game for ages 7–12 where you run a lunar outpost and
learn the trade-offs real mission planners face: every lever you turn costs power, and power is limited.

Built for the NASA Space Apps Challenge 2026, *Build a Junior Astronaut Mission Trainer*.

![Moonatics](public/apple-touch-icon.png)

## How it plays

You are the crew's life-support operator. Each mission is a loop:

1. **Observe** the real NASA reading.
2. **Adjust** the systems (air scrubbers, thermostat, water recycler).
3. **See the trade-offs** in the power budget and the forecast.
4. **Advance 6 hours** — time only moves when you press the button.
5. **See what changed**, then adjust again.

Each mission opens with a short, skippable training briefing (five animated scenes, about a minute) that explains
the readings, why every system costs power, and the difference between NASA data and the simulation.
It is narrated aloud with the browser's built-in voice (calmer and simpler for ages 7–9), and sound can be switched off.

Nothing runs on a timer, so there is no rush. Keeping the habitat stable takes real decisions:
only pressing *Advance* fails the level.

### Two ways to play

| | Explorer (ages 7–9) | Mission Specialist (ages 10–12) |
| --- | --- | --- |
| Readings | Plain words and lamps ("Fresh air", "Too dry") | Exact numbers and units (ppm, °C, %, kW) |
| Levers | Five big stops | Fine 0–100% sliders |
| Power budget | Energy cells | Stacked kW bar with solar limit |
| Explanations | Short sentences from the mission guide | NASA value shown next to your simulated value |

Every science term (CO₂, humidity, scrubbers…) has a **?** that explains it in place.

### Missions

| Mission | Status |
| --- | --- |
| 01 Life Support | Playable |
| 02 Food Production | Unlocks when Life Support is completed and opens its 3-screen briefing, one for Explorer (also at `/#greenhouse`) and one for Mission Specialist (`/#greenhouse-specialist`); it plays once, then sits behind a "watch again" button. Progress, seen briefings and each mission's resource result are saved in the browser (Mission 2 always starts from your last Life Support result), so Mission 2 never re-locks (`/#reset` clears it); the mission is playable for both ages: build the greenhouse (drag and drop), flip the two-position light switch, inspect leaves, roots and flowers, make discrete water decisions through dry air and a root-zone check, then harvest and see a report with a NASA VEG-05 note. It runs on the same engine as the rest of the game (no sliders) |
| 03 Solar Storm Protocol | Unlocks when the greenhouse is done. A 5-screen briefing (one component, both ages), then DETECT > PREPARE > SHELTER > PRIORITIZE > SURVIVE: drag shielding material around the crew shelter (what is available comes from your water and harvest in Missions 1-2), choose the solar array setting when the CME is observed, share limited emergency power between shelter systems, life support and the greenhouse, then watch the real CRaTER-D1D2 storm play back with one emergency reroute. Physical shielding blocks radiation; power only runs systems. NASA observed data and the MOONATICS simulation are always labelled apart |

## NASA data

The game replays curated real data, embedded in `src/game/data/`. **It is static, not live**, and the
game labels NASA values with a *NASA DATA* badge and player-adjusted values as *SIMULATED*.

| Dataset | Used for |
| --- | --- |
| NASA OSDR **RR-28** — ISS cabin telemetry | Mission 1: CO₂, temperature and humidity (a 48-hour window of the record) |
| NASA OSDR **OSD-766 / OSD-767** — VEG-05 dwarf tomato experiment | Mission 2: light spectrum, watering, crop stress |
| CCMC **DONKI** — M9.7 flare, 1,106 km/s CME and >100 MeV proton event, 7–9 June 2024 | Mission 3: storm phases |
| RadLab **CRaTER-D1D2** — lunar orbit absorbed dose rate | Mission 3: radiation dose |

Safe zones and pass marks are **training targets** chosen for gameplay. They are not official NASA limits.

## How it is built

- **React 19**, **TypeScript** (strict), **Vite**, **Tailwind CSS 4**, **Radix UI**, **Vitest**. A plain static single-page app.
- The game is a pure, timer-free simulation engine in `src/game/engine/`: every function takes a state and
  returns a new one, so the whole mission can be tested without a screen.
- Screens live in `src/components/game/` and only read the engine through `src/game/engine/adapter.ts`.
- All on-screen copy is in `src/game/content.ts`.

```
src/
  game/
    engine/        simulation (life support, food, radiation, mission flow) + README
    life-support/  guide, badges, forecast and explanation logic for Mission 1
    data/          curated NASA datasets
    content.ts     all game text
    state.tsx      shared game state
  components/game/ game screens (missions, briefings, art, sound)
  game/audio/      ambient music and interface sounds (Web Audio, no audio files)
  main.tsx         app entry
  test/            engine and screen tests
```

See [`src/game/engine/README.md`](src/game/engine/README.md) for the engine rules.

## Credits

Data courtesy of NASA OSDR, CCMC DONKI and RadLab. This is an educational project and is not
affiliated with or endorsed by NASA. Created By Emre Karakaş and Yiğit Ak

Fonts: Barlow and Chakra Petch (Google Fonts, loaded from the web; the game still works with fallback fonts offline).
Music and sound effects are generated live in the browser.

## License

[MIT](LICENSE). NASA data is public.
