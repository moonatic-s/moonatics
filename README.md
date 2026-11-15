# Moonatics

**Junior Astronaut Mission Trainer** — a browser game for ages 7–12 where you run a lunar outpost and
learn the trade-offs real mission planners face: every lever you turn costs power, and power is limited.

Built for the NASA Space Apps Challenge 2026, *Build a Junior Astronaut Mission Trainer*.

> **Play it:** after you publish (see [Publish on GitHub Pages](#publish-on-github-pages)) the game lives at
> `https://YOUR-NAME.github.io/YOUR-REPO/`. Add that link here.

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

## Story, progress and replay

- **A cast.** CAPCOM Luna (mission control, speaks over a short radio crackle) and Nova (the crew astronaut the child looks after, who reacts to what happens) say everything the game says. Luna also drops space-weather notes in Missions 1 and 2, so the storm in Mission 3 is the payoff of something the child already heard about.
- **Learning from play, not tests.** What the child *did* (did they fill the shelter, spend the power on purpose, keep water for shielding?) becomes six skills shown as up to three dots. Each mission ends with one question from mission control (a choice, or a sorting question in Mission 3) taken from a pool of at least four, so playing again asks something new. Everyone answers; a wrong answer gets the explanation and the answer, and nothing is ever taken away. A quick recall question from its own pool opens the next mission.
- **Collecting.** Mission patches, science cards (true, sourced facts that unlock from doing the thing they explain) and personal bests live in the **Crew log**. There are no leaderboards and no timers.
- **A living outpost.** The mission map shows the base as the child left it: lit windows, a glowing greenhouse, solar arrays open or folded.
- **Finishing.** After Mission 3 the child sees *Congratulations, training complete!*, an epilogue that replays their own decisions as cause and effect, what they learned, how thriftily they ran the outpost, and an invitation to play again for better results. Patches, cards and best results stay.
- **Tighter resources.** Mission Specialist plays the same rules with tighter numbers (more water used, one fewer storm power block, a lower dose limit). Costs are shown before a choice, an outpost ledger tracks water, power, supplies and food, and one supply drop from Earth per training helps now at a small efficiency cost.

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

## Run it

You need a recent Node.js (22 or newer) and npm.

```sh
npm install
npm run dev        # http://localhost:8080
npm test           # unit and screen tests (Vitest)
npm run typecheck  # TypeScript, strict
npm run build      # production build into dist/
npm run preview    # serve the production build locally
```

On Windows PowerShell, if `npm` is blocked, use `npm.cmd` instead.

## Publish on GitHub Pages

The game is a static website (no server, no accounts, nothing stored outside the player's browser), so GitHub
Pages can host it for free. The workflow in `.github/workflows/deploy.yml` runs the tests, builds, and publishes.

1. Create a repository on GitHub and push this project to its `main` branch.
2. In the repository open **Settings > Pages** and set **Source** to **GitHub Actions**.
3. Push again (or open **Actions > Test and deploy to GitHub Pages > Run workflow**).
4. After a minute the game is live at `https://YOUR-NAME.github.io/YOUR-REPO/`.

The build uses relative asset paths, so it works under any repository name with no extra settings.

Useful links while playing or presenting: `/#reset` clears saved progress, `/#greenhouse` and `/#storm` open
Mission 2 and Mission 3 directly.

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
affiliated with or endorsed by NASA.

Fonts: Barlow and Chakra Petch (Google Fonts, loaded from the web; the game still works with fallback fonts offline).
Music and sound effects are generated live in the browser.

## License

[MIT](LICENSE). NASA data is public.
