# Termite Relay

A browser-based 2D platformer for **UST GameCraft 2026**. Play a termite courier:
collect pods across a level, carry them to the colony nest, and bank enough before the
60-second timer runs out.

## Participant

- **Name:** Aman Budgujar
- **Team:** Solo entry (no team)
- **Outside help:** None

## Description

A single-player, keyboard/touch collection-platformer with five levels. Each level is a
self-contained **60-second** round: gather pods (two at a time), return them to the nest
to bank points, and deliver at least the level's minimum before time runs out. Later
levels add hazards — beetles and wasps, sticky sap, falling stalactites, crosswinds,
slippery ash, a dark chamber with a light switch, teleport portals and swaying leaf
platforms.

Two modes:

- **Level Run** — play a single level. No leaderboard entry.
- **Full Relay** — all five levels back-to-back; miss a level's pod minimum and it
  restarts from Level 1. Completed relays are saved to a local Top-10 leaderboard,
  viewable from the menu's **Leaderboard** button and on the result screen.

## Objective and rules

- Deliver **pods** to the **nest** to score. You carry **2 at a time** (a Level 5
  pickup raises this to 3 for that run).
- Each level has a **pod-delivery minimum** (6–10). Meet it before the timer hits 0 to
  clear the level.
- The **60-second countdown** starts on Start, stays visible, and the game **stops at 0**
  — input after that can't change the score.
- Touching a beetle/wasp or a falling stalactite **stuns** you (~2s). It costs time, not
  points.
- **Pines** (optional, max 2 per level, Levels 2–5) each add **+5s** to the timer and
  score nothing — an optional detour. Level 1 has none.

## How to play

1. Enter your name and press **Start / Enter**.
2. Choose **Full Relay** or **Level Run**, then start the level.
3. Walk into pods to pick them up (up to two), then into the nest to bank them.
4. Bank the required pods before time runs out. At 0s the result screen shows your name,
   score and status, with **Replay** and **Menu**.

## Controls

| Action | Keys |
|--------|------|
| Move left / right | `A` / `D` or `←` / `→` |
| Jump (hold for higher) | `W` or `↑` |
| Confirm / Start / Replay | `Enter` |
| Back / End round / Menu | `Esc` |
| On-screen buttons | Mouse / touch tap |

On **touch devices**, on-screen ◀ ▶ ▲ controls appear during play, tapping the name
field opens the keyboard, and a **⛶ fullscreen** button (recommended — locks to
landscape) is available. On desktop, play is keyboard-driven.

## Scoring

- Starts at **0**, shown live in the HUD — Full Relay shows the running relay total;
  Level Run shows the level score.
- Each pod = **10 points**; a heavy pod (Level 3) = **20**. Points bank only on delivery
  to the nest.
- Deterministic and based on in-round actions; **frozen when the timer hits 0** and not
  editable through the UI.

## Accessibility

- Keyboard-first with a visible focus ring; canvas `aria-label` and an `aria-live`
  status region announce score, pickups, warnings and results.
- State is not colour-only (numeric score, "HURRY!" text, stun stars, pod icons).
- Mute toggle; fully playable without sound. Honours the OS **reduce-motion** setting.

## Technologies

HTML5, CSS3 and JavaScript (ES modules) — no frameworks or build step. Canvas 2D for
rendering, Web Audio API for sound effects, an HTML5 Audio background loop, SVG art, and
`localStorage` for the leaderboard. Runs from static files with no backend or network
calls.

## AI tool used

- **Tools:** Microsoft Copilot and GitHub Copilot.
- **Used for:** concept and level design, HTML/CSS/JS generation, debugging, playtesting,
  SVG artwork and documentation.
- **Validation:** all AI output was reviewed, tested and modified by the participant. No
  confidential information was entered into the tools; code and assets were checked for
  licensing and quality.

## Launch

The game uses ES modules, so serve it over HTTP (don't open `index.html` via `file://`):

```bash
# Python 3
python3 -m http.server 8000
# then open http://localhost:8000/index.html
```

```bash
# Node (if you have npx)
npx serve .
```

Click the canvas once to enable audio.

## Browsers tested

Verified on current **Google Chrome** and **Microsoft Edge** (both Chromium) with no
console errors. Best on desktop, or a phone in landscape.

## Known limitations

- **Mobile:** best in landscape — use the ⛶ fullscreen button; portrait is small.
- **Leaderboard** is local to the browser (`localStorage`), not shared/centralized; a
  **Clear** button (two-tap confirm) wipes it.
- **Audio** may not start until you interact with the page; the game is fine muted.

## Libraries and asset credits

- **Third-party libraries:** none.
- **Font:** "Lilita One" — Google Fonts, SIL Open Font License 1.1.
- **Images:** original SVGs generated with AI (Copilot), reviewed by the participant.
- **Background audio:** by DAN2008 on Freesound
  (<https://freesound.org/people/DAN2008/sounds/860680/>), CC0 1.0 (public domain).
- **Sound effects:** generated at runtime via Web Audio — no audio files.

## Project structure

```
index.html
css/styles.css
js/main.js          # game loop, levels, physics, scoring, HUD, input, screens
js/leaderboard.js   # local leaderboard: persistence + ranking
js/soundManager.js  # Web Audio sound effects
assets/             # fonts, images, sounds
README.md
```
