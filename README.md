# 🌙 MOONATICS

### Junior Astronaut Mission Trainer

**MOONATICS** is an interactive educational web game for children aged **7–12**, created for the **NASA Space Apps Challenge 2026 — Build a Junior Astronaut Mission Trainer**.

Players take responsibility for a lunar outpost and complete three connected missions inspired by real NASA data:

**keep the habitat stable, grow food in space, and protect the crew during a solar radiation event.**

Instead of memorizing facts, players learn by **observing systems, making decisions, seeing consequences, and managing limited resources**.

🚀 **Live Demo:**  
https://moonatic-s.github.io/moonatics/

---

## 🎮 The Mission

You are a junior astronaut helping operate a lunar outpost.

Your training consists of three connected missions:

### 🌬️ Mission 1 — Life Support

**MONITOR → ADJUST → ADVANCE**

Keep the habitat environment stable while managing limited power.

Players monitor:

- CO₂
- temperature
- humidity

and operate:

- air scrubbers
- climate control
- water recovery

The environmental baseline comes from NASA **RR-28 environmental telemetry**.

Time does not move automatically. Players decide when to **Advance 6 Hours**, observe the result, and adjust their strategy.

Mission 1 covers a **48-hour training window**.

---

### 🌱 Mission 2 — Space Greenhouse

**INSPECT → CARE → GROW**

Grow **Red Robin tomatoes** inside the lunar greenhouse.

Players:

- set up the greenhouse
- inspect leaves, roots, flowers, and fruit
- manage water using discrete decisions
- choose a light recipe
- respond to dry and wet root-zone conditions
- guide the plant through growth stages
- harvest ripe tomatoes

The mission is inspired by NASA's **VEG-05** experiment aboard the International Space Station.

Two real experimental light recipes are represented:

- 🔴 **Red-rich:** 90% red / 10% blue
- 🟣 **Blue-rich:** 50% red / 50% blue

Unlike Mission 1, the greenhouse does not rely on continuous sliders. It uses **drag-and-drop setup, plant inspection, discrete care decisions, and a two-position light switch**.

---

### ☀️ Mission 3 — Solar Storm Protocol

**DETECT → PREPARE → PRIORITIZE → SURVIVE**

A solar event threatens the lunar outpost.

Players must:

- respond to an early space-weather warning
- prepare and reinforce the crew storm shelter
- configure the solar arrays
- distribute limited emergency power
- keep Life Support and the greenhouse operating
- perform one emergency power reroute
- watch the radiation event unfold

The mission combines space-weather observations from **NASA CCMC DONKI** with lunar-orbit radiation measurements from **CRaTER-D1D2**.

Physical shielding and electrical power are deliberately treated as different systems:

> **Shielding reduces radiation exposure. Power keeps systems operating.**

Mission 3 also connects the previous missions. Resources and outcomes from Life Support and the greenhouse can affect how prepared the outpost is for the storm.

---

## 🧠 Learning Through Decisions

MOONATICS follows a simple learning loop:

> **Observe → Decide → Act → See What Changes**

The game is designed around exploration rather than punishment.

There are:

- no countdown timers
- no leaderboards
- no pressure to respond immediately
- opportunities to replay missions and improve decisions

Players can take time to understand what is happening before acting.

Each mission begins with a short animated briefing that introduces only the concepts needed for that mission.

---

## 👩‍🚀 Two Age Modes

MOONATICS supports two age-adapted ways to play.

| | 🧭 Explorer | 🔬 Mission Specialist |
|---|---|---|
| Ages | 7–9 | 10–12 |
| Language | Short and simple | More scientific |
| Readings | Visual states and plain-language feedback | Numerical values and units |
| Guidance | More contextual support | More independent decisions |
| Resources | Easier training conditions | Tighter resource constraints |
| Science | Core concepts | Additional terminology and NASA context |

Both modes use the same mission structure and simulation foundation.

The main difference is **how information and difficulty are presented**, not a completely different game.

---

## 🎓 Briefings and Guidance

Briefings are designed to reduce cognitive overload.

Instead of displaying several concepts at the same time, they generally follow:

> **Show → Pause → Explain → Continue**

They include:

- animated visual explanations
- age-adapted text
- optional narration using the browser's built-in speech system
- sound controls
- skip and replay options

The briefing itself does not alter the player's mission state.

---

## 👩‍🚀 Meet the Crew

MOONATICS uses recurring characters to connect the three missions.

### CAPCOM Luna

Mission control guides the player, explains important events, and provides feedback.

### Nova

The astronaut at the lunar outpost reacts to the player's decisions and gives the mission a human context.

Together, they help turn technical systems into a connected mission story.

---

## 🛰️ NASA Data

MOONATICS uses curated NASA datasets embedded directly in the application.

The data is **static, not live**.

| Source | Used in |
|---|---|
| **NASA OSDR RR-28** | Mission 1 — CO₂, temperature, and humidity |
| **NASA OSDR OSD-766 / OSD-767 — VEG-05** | Mission 2 — tomato growth, lighting, watering, and plant stress |
| **NASA CCMC DONKI** | Mission 3 — solar flare, CME, and Solar Energetic Particle event |
| **NASA RadLab / CRaTER-D1D2** | Mission 3 — lunar-orbit absorbed radiation dose rate |

The Mission 3 scenario uses a real June 2024 space-weather sequence including:

- an **M9.7 solar flare**
- a **1,106 km/s CME observation**
- a **>100 MeV Solar Energetic Particle event**
- CRaTER-D1D2 lunar-orbit radiation measurements

---

## 🔬 NASA Data vs. MOONATICS Simulation

A central design principle of MOONATICS is keeping real observations separate from educational simulation.

### NASA DATA

Represents measurements, experimental observations, or event information derived from NASA datasets.

### SIMULATED

Represents consequences produced by the MOONATICS training model after player decisions.

For example:

```text
NASA radiation measurement
          ↓
MOONATICS simulation
          ↓
Shelter exposure estimate
          ↓
Outpost consequences
```

Gameplay thresholds, resource costs, pass conditions, and simulated crew exposure are **training-model parameters**.

They should not be interpreted as official NASA operational or medical safety limits.

---

## 🔗 Connected Mission System

The three missions are not isolated mini-games.

```text
LIFE SUPPORT
      ↓
SPACE GREENHOUSE
      ↓
SOLAR STORM PROTOCOL
```

Mission results and resources can carry forward.

For example:

- water conserved earlier can contribute to storm-shelter preparation
- greenhouse outcomes can affect available supplies
- remaining energy affects emergency power availability

This introduces a core systems-thinking idea:

> **A decision in one system can affect what is possible later.**

---

## 🏅 Progress, Replay, and Crew Log

Player progress is stored locally in the browser.

The game includes:

- mission patches
- science cards
- personal bests
- mission results
- learning feedback
- replayable missions
- a Crew Log
- a final training-complete sequence

There are no online accounts or public leaderboards.

Progress remains on the player's device.

---

## 🛠️ Technology

MOONATICS is a static browser application built with:

- **React 19** — interface and game components
- **TypeScript 5.8** — typed application and simulation logic
- **Vite 8** — development and production builds
- **Tailwind CSS 4** — styling and responsive design
- **Radix UI** — accessible interface primitives
- **Lucide React** — interface icons
- **Vitest** — unit and screen testing
- **React Testing Library** — component testing
- **GitHub Actions** — automated testing and deployment
- **GitHub Pages** — public hosting

No backend server or user account system is required.

---

## 🧩 Architecture

The simulation is separated from the visual interface.

```text
NASA DATA
    ↓
SIMULATION ENGINE
    ↓
SHARED GAME STATE
    ↓
AGE-ADAPTED UI
```

The main project structure is:

```text
src/
├── game/
│   ├── engine/
│   │   ├── life-support.ts
│   │   ├── food.ts
│   │   ├── radiation.ts
│   │   ├── mission.ts
│   │   ├── difficulty.ts
│   │   └── adapter.ts
│   │
│   ├── data/
│   │   ├── life-support.json
│   │   ├── food.json
│   │   └── radiation.json
│   │
│   ├── audio/
│   ├── content.ts
│   └── state.tsx
│
├── components/
│   └── game/
│       ├── life-support-briefing.tsx
│       ├── life-support-sim.tsx
│       ├── greenhouse-briefing.tsx
│       ├── greenhouse-game.tsx
│       ├── storm-briefing.tsx
│       ├── storm-game.tsx
│       ├── storm-playback.tsx
│       └── ...
│
└── test/
```

The simulation engine is designed independently from the screen components, making mission behavior easier to test and maintain.

See [`src/game/engine/README.md`](src/game/engine/README.md) for additional engine details.

---

## 🔊 Audio and Accessibility

MOONATICS includes browser-generated audio and narration.

Features include:

- ambient habitat audio
- interface sound effects
- briefing narration
- sound on/off controls
- reduced-motion support
- keyboard-accessible briefing navigation
- accessible Radix UI primitives

Audio is generated in the browser, so no external audio-file service is required.

---

## 💻 Run Locally

Requirements:

- **Node.js 22+**
- **npm**

Clone the repository and install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The local development server runs at:

```text
http://localhost:8080
```

### Available Commands

```bash
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
npm run preview
```

Production builds are generated in:

```text
dist/
```

---

## 🌐 Deployment

MOONATICS is deployed as a static web application using **GitHub Pages**.

The deployment workflow is located at:

```text
.github/workflows/deploy.yml
```

On every push to the `main` branch, GitHub Actions:

1. checks out the repository
2. installs dependencies with `npm ci`
3. runs the test suite
4. creates the production build
5. uploads the `dist/` directory
6. deploys it to GitHub Pages

### Live App

🌐 https://moonatic-s.github.io/moonatics/

The Vite build uses relative asset paths, allowing the application to run correctly from the repository subpath.

---

## 🔧 Presentation / Development Shortcuts

Useful routes while testing or presenting the project:

```text
/#reset
```

Clears locally stored mission progress.

```text
/#greenhouse
```

Opens the Space Greenhouse section directly.

```text
/#storm
```

Opens the Solar Storm section directly.

---

## 🌍 Why MOONATICS?

Future space exploration depends on interconnected systems.

Air, water, food, energy, environmental control, and crew safety cannot be managed independently.

MOONATICS turns these relationships into an interactive learning experience where young players explore:

- systems thinking
- resource management
- cause and effect
- environmental control
- space biology
- plant growth in space
- space weather
- radiation protection
- decision-making under constraints

The goal is not simply to tell children how lunar missions work.

It is to let them **make the decisions themselves**.

---

## 🏆 NASA Space Apps Challenge 2026

Created for the:

**Build a Junior Astronaut Mission Trainer**

challenge at the **NASA International Space Apps Challenge 2026**.

### Team Moonatics

🌙 **MOONATICS** Emre Karakaş & Yiğit Ak

---

## 📚 Data Credits

Data used in MOONATICS comes from:

- **NASA Open Science Data Repository (OSDR)**
- **NASA CCMC DONKI**
- **NASA RadLab**
- **CRaTER**

---

## ⚠️ Disclaimer

MOONATICS is an educational project created for the NASA Space Apps Challenge.

It is **not an official NASA product** and is not affiliated with or endorsed by NASA.

NASA observations are used as source material for an educational training simulation.

---

## 📄 License

This project is released under the [MIT License](LICENSE).

NASA datasets remain subject to their original public-data terms.
