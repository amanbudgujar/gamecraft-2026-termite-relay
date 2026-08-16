# Termite Relay

A browser-based 2D platformer built for **UST GameCraft 2026**. You play a termite
courier: collect pods across a side-scrolling level, carry them back to the colony
nest, and bank enough of them before the 60-second timer runs out.

> **⚠️ CONFIRM before submitting:** items marked `⚠️ CONFIRM` below must be filled in
> or verified by the participant. Do not submit with placeholder text.

---

## Participant / Team

| Field | Value |
|-------|-------|
| Participant or team name | Aman Budgujar |
| Team members | Solo entry (no team) |
| Outside development support | None |

---

## Brief description

Termite Relay is a single-player, keyboard-controlled collection/platformer game.
Each of its five levels is a self-contained **60-second** round: gather pods (two at a
time), return them to the nest to bank points, and deliver at least the level's
minimum before time expires. Levels layer in new hazards — patrolling beetles and
wasps, sticky sap, falling stalactites, crosswinds, slippery ash, a pitch-dark
chamber with a findable light switch, teleport portals and swaying leaf platforms.

Two modes are available:

- **Level Run** — practise any single level on its own. No leaderboard entry.
- **Full Relay** — play all five levels back-to-back. Miss a level's pod minimum and
  the relay restarts from Level 1. Completed relays are recorded on a local Top-10
  leaderboard, viewable any time from the **Leaderboard** button on the mode-select
  menu (and shown again on the Full Relay result screen).

---

## Objective and rules

- Collect **pods** and deliver them to the **colony nest** to bank points.
- You can carry **2 pods at once** (a one-time capacity boost in Level 5 raises this
  to 3 for the rest of that run).
- Each level has a **pod-delivery minimum** (6–10 depending on the level). Meet or
  beat it before the timer hits zero to clear the level.
- The **60-second countdown** starts only when you press Start, stays visible the
  whole round, and the game **stops automatically at 0** — input after that cannot
  change your score.
- Contact with a beetle or wasp, or a falling stalactite, **stuns** you for ~2
  seconds (followed by ~1 second of recovery immunity). It costs you time, not points.
- **Pines** (an optional pickup, at most 2 per level, and only on Levels 2–5) each add
  **+5 seconds** to that round's timer. They are entirely optional and score nothing —
  see "Timer behaviour" below.

---

## How to play

1. Enter your name on the welcome screen and press **Start / Enter**.
2. Choose **Full Relay** or **Level Run**.
3. Read the level instructions, then start the level.
4. Move to pods to pick them up; carry up to two; walk into the nest to bank them.
5. Bank the required number of pods before the timer reaches zero.
6. At 0 seconds the result screen shows your name, final score and completion status,
   with **Replay** and **Menu** options.

---

## Controls

| Action | Keys |
|--------|------|
| Move left / right | `A` / `D` or `←` / `→` |
| Jump (hold for a higher jump) | `W` or `↑` |
| Confirm / Start / Replay | `Enter` |
| End round / Back / Menu | `Esc` |
| Menu, level, Start, Replay, Mute buttons | Mouse / touch **click** (pointer) |

**Touch devices:** on-screen ◀ / ▶ / ▲ (jump) buttons appear automatically during
gameplay on touch-capable devices, and tapping the name field on the welcome screen
opens the device keyboard. All menus, level select and result buttons are tap-friendly.
On desktop the on-screen buttons are hidden and play is fully keyboard-driven.

A **⛶ fullscreen button** (top-right, touch devices only) fills the screen and, where
supported, locks to landscape — the recommended way to play on a phone. The canvas is
also sized to fit the viewport height so the bottom controls are always reachable.

---

## Scoring rules

- Scoring starts at **0** and is shown live in the HUD throughout the round.
- Each standard pod unit is worth **10 points**; a heavy pod (Level 3) counts as two
  units = **20 points**.
- Points are **banked only when pods are delivered to the nest** — carried-but-not-yet-
  delivered pods do not count.
- Scoring is deterministic and based purely on your in-round actions. The score is
  **frozen the instant the timer reaches zero** and cannot be edited through the UI.
- In **Full Relay**, per-level scores and completion times sum into a relay total used
  for the local leaderboard.

### Timer behaviour (transparency note for judges)

Every round's countdown **begins at 60 seconds** when Start is pressed, is visible for
the whole round, shows a warning state in the final 10 seconds, and **stops at 0**.
The optional **pine** pickups (max 2 per level, Levels 2–5 only) can each add +5
seconds *if the player chooses to collect them* — they are an opt-in risk/reward
detour, not a required part of the path, and they award no points. Level 1 has no
pines and is therefore a strict 60-second round.

---

## Accessibility

- **Keyboard-first:** full gameplay via keyboard; the canvas is focusable
  (`tabindex`) with a visible focus ring.
- **Screen-reader support:** the canvas has a descriptive `aria-label`, and an
  `aria-live` status region announces score, pickups, warnings and results.
- **Not colour-only:** state is conveyed with text/icons too (e.g. numeric SCORE,
  the "HURRY!" text at 10s, stun stars, pod icons), not colour alone.
- **Audio optional:** a Mute toggle is always visible and the game is fully playable
  with sound off.
- **Reduced motion:** when the OS "reduce motion" setting is on, decorative motion
  (particle bursts, stun screen-shake, floating score popups, idle cloud drift) is
  disabled while gameplay motion is preserved.
- **Touch input:** on-screen controls and soft-keyboard name entry on touch devices.

---

## Technologies used

- **HTML5**, **CSS3**, **JavaScript (ES modules)** — no frameworks.
- **Canvas 2D API** — all rendering (world, sprites, HUD, effects).
- **Web Audio API** (`AudioContext`) — procedurally generated sound effects
  (`js/soundManager.js`).
- **HTML5 Audio** — looping background track.
- **SVG** — image assets (characters, platforms, backgrounds, pods, pine).
- **Browser `localStorage`** — the local Full Relay Top-10 leaderboard.

No build step, bundler, server, backend or external network calls are required — the
game runs directly from static files.

---

## AI tool used

- **AI tools:** Microsoft Copilot and GitHub Copilot.
- **Purpose:** AI assistance was used for concept discussion, level/collision design,
  HTML/CSS/JavaScript generation, debugging, playtesting, SVG artwork generation and
  documentation.
- **Participant validation:** All AI-generated code and assets were reviewed, tested,
  modified and validated by the participant. No confidential, client, employee or
  personal information was entered into the AI tools. Generated code and dependencies
  were checked for licensing, security and quality.

---

## Launch instructions

Because the game uses JavaScript ES modules, most browsers require it to be served
over HTTP (opening `index.html` directly via `file://` will be blocked by module
CORS rules).

Run any static file server from the project folder, for example:

```bash
# Python 3
python3 -m http.server 8000
# then open http://localhost:8000/index.html
```

```bash
# Node (if you have npx)
npx serve .
```

Then open the served URL in a supported browser and click the game canvas once (a user
gesture is required before audio can start).

---

## Browsers tested

- **Google Chrome / Chromium (current) — verified.** Full playthrough of all five
  levels and both modes with no console errors.
- **Microsoft Edge — `⚠️ CONFIRM`.** Edge is Chromium-based and expected to behave
  identically; please run a confirmation pass before submitting.

Recommended display: desktop, landscape. The canvas has a fixed 1280×720 logical
resolution and scales responsively to fit the window width.

---

## Known limitations

- **Best played in landscape on mobile.** In portrait the 16:9 canvas is small; use
  the ⛶ fullscreen button (which also requests a landscape lock) for a full-size,
  thumb-reachable layout. Button sizes are tuned for landscape.
- **Mobile rendering resolution.** On touch devices the game renders into a 1280×720
  buffer (instead of the desktop 1920×1080) and scales up via CSS, to keep the frame
  rate smooth on phone GPUs. This is a deliberate quality/performance trade-off.
- **Leaderboard is device-specific** — stored in this browser's `localStorage`
  (`ust-gamecraft-2026-termite-courier-campaign-leaderboard-v1`). It is intentionally
  **not** a centralized/shared leaderboard. A **Clear** button on the Full Relay
  result screen wipes the local leaderboard (with a two-tap confirmation).
- **Audio autoplay** may be blocked until the player interacts with the page; the game
  is fully understandable with sound muted.

---

## Libraries and asset credits

- **Third-party libraries:** None. No external JavaScript libraries are used.
- **Font — "Lilita One"** (`assets/fonts/LilitaOne-Regular.ttf`): Google Fonts,
  licensed under the **SIL Open Font License 1.1**.
- **Image assets** (`assets/images/*.svg`): original SVG artwork generated with AI
  assistance (Microsoft Copilot / GitHub Copilot) and reviewed by the participant.
- **Background audio** (`assets/sounds/background-loop.wav`): by **DAN2008** on
  Freesound — <https://freesound.org/people/DAN2008/sounds/860680/>. Released under
  the **Creative Commons 0 (CC0 1.0) public-domain dedication**, so no attribution is
  required; credit is given here voluntarily.
- **Sound effects:** generated at runtime via the Web Audio API — no audio files.

---

## Project structure

```
.
├── index.html            # Entry point + canvas + accessibility labels + name-entry input
├── css/
│   └── styles.css         # Layout, canvas styling, focus indicator, helpers
├── js/
│   ├── main.js            # Game loop, levels, physics, scoring, HUD, input, screens
│   ├── leaderboard.js     # Local Full Relay leaderboard: persistence + ranking
│   └── soundManager.js    # Web Audio procedural sound effects
├── assets/
│   ├── fonts/             # Lilita One (OFL)
│   ├── images/            # SVG sprites and backgrounds
│   └── sounds/            # Background loop
└── README.md
```
