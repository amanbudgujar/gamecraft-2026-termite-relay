import { sounds } from "./soundManager.js";
import {
  LEADERBOARD_LIMIT,
  formatCompletionTime,
  sortCampaignEntries,
  loadCampaignLeaderboard as loadCampaignLeaderboardFromStore,
  saveCampaignEntry,
  campaignPersonalBest as campaignPersonalBestFor,
  clearCampaignLeaderboard
} from "./leaderboard.js";

const canvas = document.getElementById("game");
const context = canvas.getContext("2d");
const status = document.getElementById("game-status");
const nameInput = document.getElementById("name-input");
const fullscreenButton = document.getElementById("fullscreen-btn");
// Logical rectangle of the canvas-drawn name box on the welcome screen; the
// overlay <input> is positioned over this so a mobile keyboard caret lines up.
const NAME_BOX = { x: 315, y: 430, w: 650, h: 64 };

const WIDTH = 1280;
const HEIGHT = 720;
// Touch/phone devices display the canvas much smaller than its authored
// 1920x1080 backing store, so that big a buffer just wastes GPU fill every
// frame and tanks the frame rate. Render into a 1280x720 buffer there (scaled
// up by CSS) — ~56% fewer pixels per frame — while desktops keep full detail.
// This must run before RENDER_SCALE is derived from canvas.width.
const isTouchDevice =
  typeof window !== "undefined" &&
  ("ontouchstart" in window || (navigator.maxTouchPoints || 0) > 0);
if (isTouchDevice) {
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
}
const RENDER_SCALE = canvas.width / WIDTH;
const LEVEL_DURATION = 60;
const PINE_TIME_BONUS = 5;
const LEVEL_TWO_PINE_COUNT = 2;
const SEED_VALUE = 10;
const NAME_MAX_LENGTH = 20;
const STUN_DURATION = 2;
const RECOVERY_IMMUNITY_DURATION = 1;
const MAX_JUMP_HOLD = 0.24;
const STALACTITE_LANDED_MS = 900;
const STALACTITE_FADE_MS = 250;
const GAME_MODES = Object.freeze({ LEVEL: "level", CAMPAIGN: "campaign" });
const LEVEL_ORDER = [1, 2, 3, 4, 5];
// Passed to the leaderboard module so it can validate stored entries without
// depending on this file.
const LEADERBOARD_CONFIG = { maxNameLength: NAME_MAX_LENGTH, minLevel: LEVEL_ORDER[0] };
const LEVEL_RUN_ORDER = [1, 2, 3, 4, 5];
const CARRY_CAPACITY = 2;
const ICE_RESPONSIVENESS = 5;
const PORTAL_TRIGGER_INSET = 18;
const POD_COLOR = "#ed3d4f";
const ACTIVE_OUTLINE_WIDTH = 1.25;
const BACKGROUND_AUDIO_PATH = "./assets/sounds/background-loop.wav";
const POD_SPRITE_PATH = "./assets/images/pod.svg";
const POD_PAIR_SPRITE_PATH = "./assets/images/pod-pair.svg";
const PINE_SPRITE_PATH = "./assets/images/pine.svg";
const SPRITE_PATHS = Object.freeze({
  mountains: "./assets/images/bg-mountains.svg",
  foliage: "./assets/images/bg-foliage.svg",
  beetle: "./assets/images/pest-beetle.svg",
  platform: "./assets/images/platform-tile.svg",
  nest: "./assets/images/pod-nest.svg",
  termite: "./assets/images/termite.svg",
  leafPlatformA: "./assets/images/leaf-platform.svg",
  leafPlatformB: "./assets/images/leaf-platform-clean.svg",
  leafPlatformMoving: "./assets/images/leaf-platform-dew-alt.svg"
});

const backgroundAudio = new Audio(BACKGROUND_AUDIO_PATH);
backgroundAudio.loop = true;
backgroundAudio.preload = "auto";
backgroundAudio.volume = 0.35;
const podSprite = new Image();
podSprite.src = POD_SPRITE_PATH;
const podPairSprite = new Image();
podPairSprite.src = POD_PAIR_SPRITE_PATH;
const pineSprite = new Image();
pineSprite.src = PINE_SPRITE_PATH;
const sprites = Object.fromEntries(
  Object.entries(SPRITE_PATHS).map(([name, path]) => {
    const image = new Image();
    image.src = path;
    return [name, image];
  })
);

const STATES = Object.freeze({
  WELCOME: "welcome",
  MENU: "menu",
  INSTRUCTIONS: "instructions",
  PLAYING: "playing",
  GAME_OVER: "game-over"
});

const LEVELS = {
  1: {
    id: 1,
    title: "SUNMEADOW RELAY",
    theme: "meadow",
    podLabel: "Seed",
    introMessage: "Collect seed pods, two at a time, and return them to the colony nest.",
    flavorText: "Explore the meadow. The clock starts when you begin.",
    instructionLines: [],
    instructionsLayout: { startY: 235, lineHeight: 56, valueFontSize: 22, flavorFontSize: 21 },
    hudPodIconSize: 26,
    hudPodIconSpacing: 24,
    duration: LEVEL_DURATION,
    minPods: 6,
    worldWidth: 3200,
    worldHeight: HEIGHT,
    groundY: 588,
    spawnX: 130,
    nest: { x: 90, y: 456, width: 84, height: 132 },
    platforms: [
      { x: 970, y: 496, width: 170, height: 24 },
      { x: 1205, y: 434, width: 180, height: 24 },
      { x: 1460, y: 356, width: 190, height: 24 },
      { x: 1870, y: 405, width: 150, height: 24 },
      { x: 2090, y: 500, width: 110, height: 24 },
      { x: 2280, y: 420, width: 190, height: 24 }
    ],
    lowCeilings: [],
    seeds: [
      { x: 420, y: 560, collected: false },
      { x: 760, y: 560, collected: false },
      { x: 1285, y: 400, collected: false },
      { x: 1555, y: 322, collected: false },
      { x: 2140, y: 466, collected: false },
      { x: 2385, y: 386, collected: false }
    ],
    pines: [],
    sapZones: [],
    windZones: [],
    slipZones: [],
    switches: [],
    darkZones: [],
    lightsSwitchId: null,
    visionRadius: null,
    portals: [],
    capacityBoosts: [],
    stalactites: [],
    relayRequired: 0,
    relayShortcuts: [],
    pests: [
      {
        x: 790,
        startX: 790,
        y: 542,
        width: 52,
        height: 46,
        direction: 1,
        startDirection: 1,
        speed: 92,
        minX: 720,
        maxX: 890
      },
      {
        x: 1960,
        startX: 1960,
        y: 542,
        width: 52,
        height: 46,
        direction: -1,
        startDirection: -1,
        speed: 108,
        minX: 1870,
        maxX: 2070
      }
    ]
  },
  2: {
    id: 2,
    title: "DEEP CAVERN TUNNELS",
    theme: "cave",
    podLabel: "Red",
    introMessage: "Deliver at least 8 of 10 red pods. Pines add five seconds without entering your pouch.",
    flavorText: "Sticky sap slows your walk and stops you from jumping. Watch for falling-rock dust and shadows.",
    instructionLines: [
      ["PINES", "Two Pines add +5 seconds each; they do not score"]
    ],
    instructionsLayout: { startY: 208, lineHeight: 47, valueFontSize: 20, flavorFontSize: 18 },
    hudPodIconSize: 21,
    hudPodIconSpacing: 18,
    duration: LEVEL_DURATION,
    minPods: 8,
    worldWidth: 5000,
    worldHeight: HEIGHT,
    groundY: 604,
    spawnX: 2320,
    nest: { x: 2410, y: 472, width: 90, height: 132 },
    platforms: [
      { x: 1040, y: 530, width: 240, height: 24 },
      { x: 3100, y: 530, width: 240, height: 24 },
      { x: 2660, y: 530, width: 180, height: 24 }
    ],
    lowCeilings: [
      { x: 720, y: 448, width: 250, height: 22 },
      { x: 1320, y: 454, width: 260, height: 24 },
      { x: 3400, y: 450, width: 300, height: 24 },
      { x: 3970, y: 446, width: 250, height: 24 }
    ],
    seeds: [
      { x: 250, y: 576, collected: false },
      { x: 600, y: 576, collected: false },
      { x: 1150, y: 466, collected: false },
      { x: 1650, y: 576, collected: false },
      { x: 2050, y: 576, collected: false },
      { x: 2850, y: 576, collected: false },
      { x: 3250, y: 466, collected: false },
      { x: 3750, y: 576, collected: false },
      { x: 4250, y: 576, collected: false },
      { x: 4750, y: 576, collected: false }
    ],
    pines: [
      { x: 390, y: 566, collected: false, name: "PINE" },
      { x: 4600, y: 566, collected: false, name: "PINE" }
    ],
    sapZones: [
      { x: 350, width: 150 },
      { x: 1880, width: 150 },
      { x: 3150, width: 185 },
      { x: 3800, width: 155 }
    ],
    windZones: [],
    stalactites: [
      { x: 760, y: 156, width: 48, height: 104, state: "idle", triggeredAt: 0 },
      { x: 1760, y: 142, width: 54, height: 116, state: "idle", triggeredAt: 0 },
      { x: 2150, y: 150, width: 50, height: 108, state: "idle", triggeredAt: 0 },
      { x: 3650, y: 138, width: 56, height: 122, state: "idle", triggeredAt: 0 },
      { x: 4150, y: 158, width: 46, height: 102, state: "idle", triggeredAt: 0 }
    ],
    slipZones: [],
    switches: [],
    darkZones: [],
    lightsSwitchId: null,
    visionRadius: null,
    portals: [],
    capacityBoosts: [],
    relayRequired: 0,
    relayShortcuts: [],
    pests: []
  },
  3: {
    id: 3,
    title: "HIGH CANOPY ASCENT",
    theme: "canopy",
    podLabel: "Red",
    introMessage: "Climb the canopy and deliver at least 10 of 12 red pods. Two are extra-heavy — worth double, fully optional.",
    flavorText: "Ride swaying leaf platforms and watch for crosswinds mid-air.",
    instructionLines: [
      ["PINES", "Two Pines add +5 seconds each; they do not score"],
      ["WIND", "Crosswinds push you sideways while airborne"],
      ["LEAVES", "Some platforms sway side to side — ride them, don't fight them"],
      ["WASPS", "Contact stuns like a beetle; wasps only patrol, they don't dive"]
    ],
    instructionsLayout: { startY: 195, lineHeight: 38, valueFontSize: 18, flavorFontSize: 16 },
    hudPodIconSize: 13,
    hudPodIconSpacing: 12,
    duration: LEVEL_DURATION,
    minPods: 10,
    worldWidth: 1400,
    worldHeight: 1950,
    groundY: 1800,
    spawnX: 200,
    nest: { x: 140, y: 1680, width: 90, height: 130 },
    platforms: [
      { x: 340, y: 1700, width: 190, height: 24 },
      { x: 560, y: 1600, width: 180, height: 24 },
      { x: 760, y: 1500, width: 190, height: 24 },
      { x: 520, y: 1400, width: 170, height: 24 },
      { x: 300, y: 1300, width: 190, height: 24 },
      { x: 300, y: 1200, width: 190, height: 24, moveAxis: "x", moveRange: 260, moveSpeed: 75 },
      { x: 780, y: 1100, width: 200, height: 24 },
      { x: 560, y: 1000, width: 185, height: 24 },
      { x: 320, y: 900, width: 195, height: 24 },
      { x: 300, y: 800, width: 185, height: 24 },
      { x: 300, y: 700, width: 190, height: 24, moveAxis: "x", moveRange: 260, moveSpeed: 80 },
      { x: 580, y: 600, width: 200, height: 24 },
      { x: 350, y: 500, width: 190, height: 24 },
      { x: 600, y: 400, width: 180, height: 24 },
      { x: 380, y: 300, width: 195, height: 24 },
      { x: 550, y: 200, width: 220, height: 24 },
      { x: 1080, y: 1120, width: 140, height: 24 },
      { x: 1080, y: 1020, width: 140, height: 24 }
    ],
    lowCeilings: [],
    seeds: [
      { x: 400, y: 1670, collected: false },
      { x: 610, y: 1570, collected: false },
      { x: 820, y: 1470, collected: false },
      { x: 570, y: 1370, collected: false },
      { x: 360, y: 1270, collected: false },
      { x: 840, y: 1070, collected: false },
      { x: 610, y: 970, collected: false },
      { x: 640, y: 570, collected: false },
      { x: 650, y: 370, collected: false },
      { x: 610, y: 170, collected: false },
      { x: 1150, y: 1090, collected: false, weight: 2 },
      { x: 1150, y: 990, collected: false }
    ],
    pines: [
      { x: 260, y: 1270, collected: false, name: "PINE" },
      { x: 310, y: 470, collected: false, name: "PINE" }
    ],
    sapZones: [],
    windZones: [
      { x: 350, width: 300, y: 820, height: 200, force: 90, direction: -1 },
      { x: 940, width: 200, y: 970, height: 220, force: 120, direction: -1 }
    ],
    slipZones: [],
    switches: [],
    darkZones: [],
    lightsSwitchId: null,
    visionRadius: null,
    portals: [],
    capacityBoosts: [],
    stalactites: [],
    relayRequired: 0,
    relayShortcuts: [],
    pests: [
      {
        x: 420,
        startX: 420,
        y: 950,
        baseY: 950,
        width: 46,
        height: 30,
        direction: 1,
        startDirection: 1,
        speed: 100,
        minX: 420,
        maxX: 700,
        flying: true,
        bobAmplitude: 40,
        bobSpeed: 2.2,
        phase: 0
      },
      {
        x: 350,
        startX: 350,
        y: 450,
        baseY: 450,
        width: 46,
        height: 30,
        direction: -1,
        startDirection: -1,
        speed: 110,
        minX: 350,
        maxX: 650,
        flying: true,
        bobAmplitude: 50,
        bobSpeed: 1.8,
        phase: 1.6
      }
    ]
  },
  4: {
    id: 4,
    title: "SUNKEN RUINS",
    theme: "ruins",
    podLabel: "Relic",
    introMessage:
      "Deliver at least 9 of 12 relic pods. Detour onto a switch pedestal to unseal the vault pods elsewhere.",
    flavorText: "Torches gutter in the deep chambers. Glowing switch pedestals mark optional detours off the main path.",
    instructionLines: [
      ["SWITCHES", "Step onto a glowing switch pedestal to unseal its vault pods elsewhere — optional, not on the main path"],
      ["SILT", "Murky silt slows your walk and stops you from jumping"],
      ["PORTALS", "A near-nest portal and a far portal shuttle you back and forth; a mid portal returns to the nest"]
    ],
    instructionsLayout: { startY: 205, lineHeight: 42, valueFontSize: 19, flavorFontSize: 17 },
    hudPodIconSize: 16,
    hudPodIconSpacing: 14,
    duration: LEVEL_DURATION,
    minPods: 9,
    // Extended past the old 4300 edge to give a short runway to the right
    // of the far portal's exit, so the optional pine shelf can be reached
    // with a normal running jump instead of a frame-perfect hop.
    worldWidth: 4500,
    worldHeight: HEIGHT,
    groundY: 604,
    spawnX: 130,
    nest: { x: 90, y: 472, width: 90, height: 132 },
    platforms: [
      { x: 1150, y: 530, width: 130, height: 24 },
      { x: 1300, y: 520, width: 180, height: 24 },
      { x: 2100, y: 530, width: 200, height: 24 },
      { x: 2850, y: 530, width: 130, height: 24 },
      // Optional detour shelf for the bonus pine, out past the far
      // portal's exit near the (extended) right edge. This keeps the
      // pine's pickup box off the portal's ground-level teleport trigger
      // — the two used to sit on top of each other, so grabbing the pine
      // re-warped you instead — while leaving the portal reachable at
      // ground level for anyone skipping the climb.
      //
      // Two engine constraints dictate the placement: (1) a platform can't
      // sit directly above a standing spot — a straight-up jump always
      // clips its underside before clearing it, so you must approach from
      // the side while already rising; (2) the portal re-triggers if you
      // walk back into it (see updatePortals), so the shelf can't sit on
      // the portal side. It therefore sits to the right of the exit, with
      // a short ground runway (world width was widened for it) so it's
      // reachable by simply continuing forward and doing an ordinary
      // running jump. A slim 6px collision depth (the drawn shelf is
      // taller — sprite height is computed separately) keeps its underside
      // from eating jumps launched just short of the edge.
      { x: 4270, y: 520, width: 150, height: 6 }
    ],
    lowCeilings: [
      { x: 800, y: 448, width: 240, height: 22 },
      { x: 3150, y: 450, width: 260, height: 24 }
    ],
    seeds: [
      { x: 350, y: 576, collected: false },
      { x: 650, y: 576, collected: false },
      { x: 1080, y: 576, collected: false },
      { x: 1350, y: 486, collected: false, vaultId: "vaultA" },
      { x: 1600, y: 576, collected: false },
      { x: 1950, y: 576, collected: false },
      { x: 2180, y: 496, collected: false },
      { x: 2400, y: 576, collected: false },
      { x: 2750, y: 576, collected: false },
      { x: 3500, y: 576, collected: false, vaultId: "vaultB" },
      { x: 3700, y: 576, collected: false, vaultId: "vaultB" },
      { x: 3950, y: 576, collected: false }
    ],
    pines: [
      { x: 500, y: 566, collected: false, name: "PINE" },
      { x: 4345, y: 486, collected: false, name: "PINE" }
    ],
    sapZones: [
      { x: 450, width: 150 },
      { x: 2500, width: 160 },
      { x: 3400, width: 150 }
    ],
    windZones: [],
    slipZones: [],
    switches: [
      { x: 1190, y: 512, width: 50, height: 18, vaultId: "vaultA", triggered: false, openedAt: 0 },
      { x: 2890, y: 512, width: 50, height: 18, vaultId: "vaultB", triggered: false, openedAt: 0 }
    ],
    darkZones: [],
    lightsSwitchId: null,
    visionRadius: null,
    portals: [
      { x: 700, y: 536, width: 60, height: 68, cooldownUntil: 0, linkTo: 2 },
      { x: 2280, y: 536, width: 60, height: 68, cooldownUntil: 0 },
      { x: 4020, y: 536, width: 60, height: 68, cooldownUntil: 0, linkTo: 0 }
    ],
    capacityBoosts: [],
    stalactites: [
      { x: 1750, y: 150, width: 50, height: 108, state: "idle", triggeredAt: 0 },
      { x: 3800, y: 145, width: 52, height: 112, state: "idle", triggeredAt: 0 }
    ],
    relayRequired: 0,
    relayShortcuts: [],
    pests: [
      {
        x: 3300,
        startX: 3300,
        y: 558,
        width: 52,
        height: 46,
        direction: 1,
        startDirection: 1,
        speed: 95,
        minX: 3300,
        maxX: 3700
      }
    ]
  },
  5: {
    id: 5,
    title: "EMBER DEPTHS",
    theme: "ember",
    podLabel: "Ember",
    introMessage:
      "Deliver at least 9 of 12 ember pods. The chamber is pitch dark — find the light switch to see clearly.",
    flavorText: "Only a small glow surrounds you here. Thermals, sliding ash, and drifting magma-rock wait in the dark.",
    instructionLines: [
      ["DARK", "This whole chamber is dark — only the area around you is lit"],
      ["LIGHTS", "Find the light switch to illuminate the rest of the climb"],
      ["THERMALS", "Heat zones push you sideways while airborne — ride or fight them"],
      ["ASH", "Long stretches of loose ash make your steps slide"],
      ["PORTAL", "Step into the glowing portal to return to the nest instantly"],
      ["BOOST", "Grab the glowing +1 for a permanent third carry slot this run"]
    ],
    instructionsLayout: { startY: 172, lineHeight: 30, valueFontSize: 16, flavorFontSize: 14 },
    hudPodIconSize: 16,
    hudPodIconSpacing: 14,
    duration: LEVEL_DURATION,
    minPods: 9,
    worldWidth: 4300,
    worldHeight: 2200,
    groundY: 2000,
    spawnX: 160,
    nest: { x: 90, y: 1868, width: 90, height: 132 },
    platforms: [
      { x: 650, y: 1910, width: 160, height: 24 },
      { x: 850, y: 1820, width: 150, height: 24 },
      { x: 1050, y: 1730, width: 160, height: 24 },
      { x: 1250, y: 1640, width: 150, height: 24 },
      { x: 1450, y: 1550, width: 160, height: 24 },
      { x: 1650, y: 1460, width: 650, height: 24 },
      { x: 2150, y: 1370, width: 150, height: 24 },
      { x: 2350, y: 1280, width: 150, height: 24, moveAxis: "x", moveRange: 160, moveSpeed: 90 },
      { x: 2550, y: 1190, width: 150, height: 24 },
      { x: 2750, y: 1100, width: 150, height: 24, moveAxis: "x", moveRange: 160, moveSpeed: 95 },
      { x: 2950, y: 1010, width: 150, height: 24 },
      { x: 3150, y: 920, width: 150, height: 24 },
      { x: 3350, y: 830, width: 600, height: 24 }
    ],
    lowCeilings: [],
    // Consecutive-jump platforms drift steadily rightward rather than
    // ping-ponging between two fixed columns: any platform two rows above a
    // takeoff point must never share x-range with it, or an ascending player
    // can clip its underside (killing vy) before ever reaching the height
    // needed to land on the *intended*, one-row-up target. Verified via a
    // headless collision-log replay of every jump in both shafts — do not
    // reintroduce a repeating two-column zigzag here without re-checking that.
    seeds: [
      { x: 350, y: 1972, collected: false },
      { x: 650, y: 1972, collected: false },
      { x: 925, y: 1786, collected: false },
      { x: 1325, y: 1606, collected: false },
      { x: 1750, y: 1426, collected: false },
      { x: 1975, y: 1426, collected: false },
      { x: 2200, y: 1426, collected: false },
      { x: 2425, y: 1246, collected: false },
      { x: 2825, y: 1066, collected: false },
      { x: 3450, y: 796, collected: false },
      { x: 3650, y: 796, collected: false },
      { x: 3850, y: 796, collected: false }
    ],
    pines: [
      { x: 500, y: 1962, collected: false, name: "PINE" },
      { x: 3900, y: 792, collected: false, name: "PINE" }
    ],
    sapZones: [],
    windZones: [
      { x: 2300, width: 300, y: 1160, height: 160, force: 90, direction: 1 },
      { x: 2900, width: 300, y: 890, height: 140, force: 90, direction: -1 }
    ],
    slipZones: [
      { x: 450, width: 180, y: 2000 },
      { x: 1750, width: 300, y: 1460 },
      { x: 3450, width: 280, y: 830 }
    ],
    switches: [{ x: 2100, y: 1442, width: 64, height: 18, vaultId: "lights", triggered: false, openedAt: 0 }],
    darkZones: [{ x: 0, width: 4300, y: 0, height: 2200 }],
    lightsSwitchId: "lights",
    visionRadius: 140,
    portals: [{ x: 3800, y: 770, width: 60, height: 60, cooldownUntil: 0 }],
    capacityBoosts: [{ x: 3400, y: 796, collected: false }],
    stalactites: [],
    relayRequired: 0,
    relayShortcuts: [],
    pests: [
      {
        x: 380,
        startX: 380,
        y: 1954,
        width: 52,
        height: 46,
        direction: 1,
        startDirection: 1,
        speed: 100,
        minX: 380,
        maxX: 620
      },
      {
        x: 1750,
        startX: 1750,
        y: 1410,
        baseY: 1410,
        width: 46,
        height: 30,
        direction: 1,
        startDirection: 1,
        speed: 110,
        minX: 1750,
        maxX: 2050,
        flying: true,
        bobAmplitude: 35,
        bobSpeed: 2.2,
        phase: 0
      },
      {
        x: 3850,
        startX: 3850,
        y: 780,
        baseY: 780,
        width: 46,
        height: 30,
        direction: -1,
        startDirection: -1,
        speed: 100,
        minX: 3450,
        maxX: 3850,
        flying: true,
        bobAmplitude: 40,
        bobSpeed: 2.3,
        phase: 1.2
      }
    ]
  }
};

Object.values(LEVELS).forEach((level) => {
  level.seeds.forEach((seed) => {
    seed.weight = seed.weight ?? 1;
  });
  level.totalPodValue = level.seeds.reduce((sum, seed) => sum + seed.weight, 0);
});

const input = {
  held: new Set(),
  pressed: new Set()
};

// On-screen touch controls. They feed the exact same input.held / input.pressed
// sets the keyboard does, so all downstream movement/jump logic is untouched.
// Shown only when the device reports touch support (or once a touch is seen),
// so desktop keyboard play is visually unchanged.
const TOUCH_BUTTONS = [
  { id: "left", key: "a", x: 40, y: 556, w: 116, h: 116 },
  { id: "right", key: "d", x: 176, y: 556, w: 116, h: 116 },
  { id: "jump", key: "w", x: 1124, y: 556, w: 116, h: 116 }
];
const touchCapable =
  typeof window !== "undefined" &&
  ("ontouchstart" in window || (navigator.maxTouchPoints || 0) > 0);
let touchControlsActive = touchCapable;
// pointerId -> button id currently pressed by that pointer (null = captured but
// slid off every button, so it can slide back on without a fresh press).
const activeTouchPointers = new Map();

function pressTouchKey(key) {
  if (!input.held.has(key)) {
    input.pressed.add(key);
  }
  input.held.add(key);
}

function releaseTouchKey(key) {
  // Only release if no other active touch pointer is still holding this key.
  for (const heldId of activeTouchPointers.values()) {
    const other = TOUCH_BUTTONS.find((button) => button.id === heldId);
    if (other && other.key === key) {
      return;
    }
  }
  input.held.delete(key);
}

function touchButtonAt(point) {
  return TOUCH_BUTTONS.find((button) => inside(point, button.x, button.y, button.w, button.h)) || null;
}

let state = STATES.WELCOME;
let selectedLevelId = 1;
let currentLevelId = 1;
let activeLevel = LEVELS[currentLevelId];
let worldWidth = activeLevel.worldWidth;
let worldHeight = activeLevel.worldHeight;
let groundY = activeLevel.groundY;
let mailbox = activeLevel.nest;
let upperPlatforms = activeLevel.platforms;
let lowCeilings = activeLevel.lowCeilings;
let seeds = activeLevel.seeds;
let pines = activeLevel.pines;
let pests = activeLevel.pests;
let playerName = "";
let nameDraft = "";
let message = "";
let cameraX = 0;
let cameraY = 0;
let startTime = 0;
let elapsedBeforePause = 0;
let lastFrame = performance.now();
let gameOverRecorded = false;
let score = 0;
let remaining = activeLevel.duration;
let completionSeconds = activeLevel.duration;
let pulse = 0;
let lastWarningSecond = null;
let soundMuted = false;
// Honour the OS "reduce motion" setting: gameplay motion (player, pests,
// platforms, pods) is unaffected, but decorative motion — particle bursts,
// stun screen-shake, floating score popups and idle cloud drift — is dialled
// down for players sensitive to motion.
const reducedMotionQuery =
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;
let reducedMotion = reducedMotionQuery ? reducedMotionQuery.matches : false;
if (reducedMotionQuery) {
  reducedMotionQuery.addEventListener("change", (event) => {
    reducedMotion = event.matches;
  });
}
let deliveredPods = 0;
let timeBonus = 0;
let relayActive = false;
let runCompleted = false;
let gameMode = GAME_MODES.LEVEL;
let menuStep = "mode";
let campaignScore = 0;
let campaignTimeTotal = 0;
let campaignFinalLevel = LEVEL_ORDER[0];
let campaignOutcome = null;
// Timestamp until which a tapped "clear leaderboard" is awaiting a confirm tap.
let leaderboardClearConfirmUntil = 0;
// Small clear pill on the game-over screen and on the standalone leaderboard
// screen respectively; plus the buttons that open/close the leaderboard view.
const CLEAR_LEADERBOARD_BUTTON = { x: 938, y: 266, w: 154, h: 34 };
const LEADERBOARD_CLEAR_BUTTON = { x: 938, y: 150, w: 154, h: 34 };
const LEADERBOARD_BACK_BUTTON = { x: 470, y: 578, w: 340, h: 52 };
const MENU_LEADERBOARD_BUTTON = { x: 380, y: 566, w: 520, h: 52 };

const player = {
  x: 130,
  y: groundY - 62,
  width: 54,
  height: 62,
  vx: 0,
  vy: 0,
  grounded: true,
  carrying: 0,
  carriedValue: 0,
  stunnedUntil: 0,
  immuneUntil: 0,
  stunActive: false,
  facing: 1,
  coyoteUntil: 0,
  jumpHoldUntil: 0,
  fullPouchNoticeUntil: 0,
  standingPlatform: null,
  capacityBoosted: false
};

const meadowPlants = [
  { x: 130, height: 34, color: "#8d61bd" },
  { x: 286, height: 52, color: "#5496c7" },
  { x: 495, height: 26, color: "#d16c9d" },
  { x: 674, height: 46, color: "#9b70c8" },
  { x: 861, height: 31, color: "#5ba4c8" },
  { x: 1092, height: 57, color: "#c970a7" },
  { x: 1287, height: 35, color: "#8b68c7" },
  { x: 1485, height: 49, color: "#4d9fc2" },
  { x: 1741, height: 29, color: "#d375a2" },
  { x: 1928, height: 55, color: "#7b66b5" },
  { x: 2153, height: 39, color: "#4f9ec4" },
  { x: 2329, height: 25, color: "#bc6394" },
  { x: 2566, height: 51, color: "#9066b6" },
  { x: 2784, height: 36, color: "#5c9cc1" },
  { x: 3008, height: 58, color: "#c96c9d" }
];
const scorePopups = [];
const particles = [];

class ScorePopup {
  constructor(text, x, y, color = "#fff4d2") {
    this.text = text;
    this.x = x;
    this.y = y;
    this.color = color;
    this.age = 0;
    this.duration = 0.8;
  }

  update(delta) {
    this.age += delta;
    this.y -= (reducedMotion ? 0 : 46) * delta;
  }

  get active() {
    return this.age < this.duration;
  }

  draw() {
    context.globalAlpha = 1 - this.age / this.duration;
    drawText(this.text, worldX(this.x), worldY(this.y), 18, this.color, "center");
    context.globalAlpha = 1;
  }
}

function setStatus(nextMessage) {
  status.textContent = nextMessage;
}

function spawnPopup(text, x, y, color) {
  scorePopups.push(new ScorePopup(text, x, y, color));
}

function emitParticles(x, y, count, color, speed, gravity = 260) {
  if (reducedMotion) {
    // Decorative burst — skipped entirely under reduced motion. Score popups
    // and status text still convey the same events.
    return;
  }
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count + Math.random() * 0.35;
    const particleSpeed = speed * (0.55 + Math.random() * 0.65);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * particleSpeed,
      vy: Math.sin(angle) * particleSpeed - speed * 0.35,
      size: 3 + Math.random() * 4,
      color,
      gravity,
      age: 0,
      duration: 0.42 + Math.random() * 0.34
    });
  }
}

function updateEffects(delta) {
  for (const popup of scorePopups) {
    popup.update(delta);
  }
  for (let index = scorePopups.length - 1; index >= 0; index -= 1) {
    if (!scorePopups[index].active) {
      scorePopups.splice(index, 1);
    }
  }
  for (const particle of particles) {
    particle.age += delta;
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vy += particle.gravity * delta;
  }
  for (let index = particles.length - 1; index >= 0; index -= 1) {
    if (particles[index].age >= particles[index].duration) {
      particles.splice(index, 1);
    }
  }
}

function selectLevel(levelId) {
  const nextLevel = LEVELS[levelId] || LEVELS[1];
  selectedLevelId = nextLevel.id;
  currentLevelId = nextLevel.id;
  activeLevel = nextLevel;
  worldWidth = activeLevel.worldWidth;
  worldHeight = activeLevel.worldHeight;
  groundY = activeLevel.groundY;
  mailbox = activeLevel.nest;
  upperPlatforms = activeLevel.platforms;
  lowCeilings = activeLevel.lowCeilings;
  seeds = activeLevel.seeds;
  pines = activeLevel.pines;
  pests = activeLevel.pests;
}

function resetRun() {
  score = 0;
  deliveredPods = 0;
  timeBonus = 0;
  relayActive = false;
  runCompleted = false;
  remaining = activeLevel.duration;
  completionSeconds = activeLevel.duration;
  lastWarningSecond = null;
  gameOverRecorded = false;
  message = activeLevel.introMessage;
  player.x = activeLevel.spawnX;
  player.y = groundY - player.height;
  player.vx = 0;
  player.vy = 0;
  player.grounded = true;
  player.carrying = 0;
  player.carriedValue = 0;
  player.standingPlatform = null;
  player.stunnedUntil = 0;
  player.immuneUntil = 0;
  player.stunActive = false;
  player.facing = 1;
  player.coyoteUntil = 0;
  player.jumpHoldUntil = 0;
  player.fullPouchNoticeUntil = 0;
  player.capacityBoosted = false;
  activeLevel.switches.forEach((sw) => {
    sw.triggered = false;
    sw.openedAt = 0;
  });
  activeLevel.capacityBoosts.forEach((boost) => {
    boost.collected = false;
  });
  activeLevel.portals.forEach((portal) => {
    portal.cooldownUntil = 0;
  });
  pests.forEach((currentPest) => {
    currentPest.x = currentPest.startX;
    currentPest.direction = currentPest.startDirection;
    if (currentPest.flying) {
      currentPest.y = currentPest.baseY;
      currentPest.phase = 0;
    }
  });
  upperPlatforms.forEach((platform) => {
    if (platform.moveAxis) {
      platform.startX ??= platform.x;
      platform.x = platform.startX;
      platform.direction = 1;
      platform.frameDeltaX = 0;
    }
  });
  seeds.forEach((seed) => {
    seed.collected = false;
  });
  pines.forEach((pine) => {
    pine.collected = false;
  });
  activeLevel.stalactites.forEach((stalactite) => {
    stalactite.startY ??= stalactite.y;
    stalactite.y = stalactite.startY;
    stalactite.state = "idle";
    stalactite.triggeredAt = 0;
    stalactite.landedAt = 0;
  });
  scorePopups.length = 0;
  particles.length = 0;
  cameraX = Math.max(0, Math.min(worldWidth - WIDTH, player.x - WIDTH * 0.38));
  cameraY = Math.max(0, Math.min(worldHeight - HEIGHT, player.y - HEIGHT * 0.62));
}

function startRun(levelId = selectedLevelId) {
  selectLevel(levelId);
  resetRun();
  sounds.init();
  backgroundAudio.muted = soundMuted;
  state = STATES.PLAYING;
  startTime = performance.now();
  elapsedBeforePause = 0;
  backgroundAudio.play().catch(() => {
    setStatus("Background audio could not start.");
  });
  setStatus(`Level ${currentLevelId} started. You have ${activeLevel.duration} seconds.`);
  canvas.focus();
}

function toggleSound() {
  sounds.init();
  soundMuted = sounds.toggleMute();
  backgroundAudio.muted = soundMuted;
  setStatus(soundMuted ? "Sound muted." : "Sound enabled.");
}

function changeScreen(nextState) {
  state = nextState;
  message = "";
  canvas.focus();
}

function goToMenu() {
  state = STATES.MENU;
  menuStep = "mode";
  message = "";
  canvas.focus();
}

function startCampaign() {
  gameMode = GAME_MODES.CAMPAIGN;
  campaignScore = 0;
  campaignTimeTotal = 0;
  campaignFinalLevel = LEVEL_ORDER[0];
  campaignOutcome = null;
  selectLevel(LEVEL_ORDER[0]);
  changeScreen(STATES.INSTRUCTIONS);
  setStatus(`Full Relay selected. Level ${LEVEL_ORDER[0]} instructions are shown.`);
}

function startLevelMode(levelId) {
  gameMode = GAME_MODES.LEVEL;
  selectLevel(levelId);
  changeScreen(STATES.INSTRUCTIONS);
  setStatus(`Level ${levelId} selected. Instructions are shown.`);
}

function restartCampaign() {
  gameMode = GAME_MODES.CAMPAIGN;
  campaignScore = 0;
  campaignTimeTotal = 0;
  campaignFinalLevel = LEVEL_ORDER[0];
  campaignOutcome = null;
  startRun(LEVEL_ORDER[0]);
}

function normaliseName(value) {
  return value.trim().slice(0, NAME_MAX_LENGTH);
}

function isOverlapping(first, second) {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

function playerBox() {
  return {
    x: player.x,
    y: player.y,
    width: player.width,
    height: player.height
  };
}

function isOnRelayShortcut(moving = 0) {
  if (activeLevel.relayRequired === 0 || !relayActive || player.y + player.height < groundY - 8) {
    return false;
  }
  const centerX = player.x + player.width / 2;
  return activeLevel.relayShortcuts.some(
    (shortcut) =>
      centerX >= shortcut.x &&
      centerX <= shortcut.x + shortcut.width &&
      (moving === 0 || moving === shortcut.direction)
  );
}

function isPlayerInSap(moving = 0) {
  if (isOnRelayShortcut(moving)) {
    return false;
  }
  const centerX = player.x + player.width / 2;
  return activeLevel.sapZones.some(
    (sap) =>
      centerX >= sap.x &&
      centerX <= sap.x + sap.width &&
      player.y + player.height >= groundY - 28
  );
}

function isPlayerOnIce() {
  const centerX = player.x + player.width / 2;
  const feetY = player.y + player.height;
  return activeLevel.slipZones.some(
    (zone) => centerX >= zone.x && centerX <= zone.x + zone.width && Math.abs(feetY - zone.y) <= 30
  );
}

function isVaultOpen(vaultId) {
  return activeLevel.switches.some((sw) => sw.vaultId === vaultId && sw.triggered);
}

function isPlayerInDarkZone() {
  if (activeLevel.lightsSwitchId && isVaultOpen(activeLevel.lightsSwitchId)) {
    return false;
  }
  const centerX = player.x + player.width / 2;
  const centerY = player.y + player.height / 2;
  return activeLevel.darkZones.some(
    (zone) => centerX >= zone.x && centerX <= zone.x + zone.width && centerY >= zone.y && centerY <= zone.y + zone.height
  );
}

function effectiveCarryCapacity() {
  return CARRY_CAPACITY + (player.capacityBoosted ? 1 : 0);
}

function windForceOnPlayer() {
  const centerX = player.x + player.width / 2;
  const centerY = player.y + player.height / 2;
  const zone = activeLevel.windZones.find(
    (wind) =>
      centerX >= wind.x &&
      centerX <= wind.x + wind.width &&
      centerY >= wind.y &&
      centerY <= wind.y + wind.height
  );
  return zone ? zone.force * zone.direction : 0;
}

function updateMovingPlatforms(delta) {
  for (const platform of upperPlatforms) {
    if (!platform.moveAxis) {
      continue;
    }
    platform.direction ??= 1;
    platform.startX ??= platform.x;
    const previousX = platform.x;
    platform.x += platform.direction * platform.moveSpeed * delta;
    const min = platform.startX;
    const max = min + platform.moveRange;
    if (platform.x <= min || platform.x >= max) {
      platform.x = Math.max(min, Math.min(max, platform.x));
      platform.direction *= -1;
    }
    platform.frameDeltaX = platform.x - previousX;
  }
}

function movePlayer(delta) {
  const currentTime = performance.now();
  const stunned = currentTime < player.stunnedUntil;
  const movingLeft = input.held.has("arrowleft") || input.held.has("a");
  const movingRight = input.held.has("arrowright") || input.held.has("d");
  const moving = stunned ? 0 : Number(movingRight) - Number(movingLeft);

  const stuckInSap = isPlayerInSap(moving);
  const movementScale = stuckInSap ? 0.52 : isOnRelayShortcut(moving) ? 1.36 : 1;
  const targetVx = moving * 270 * movementScale;
  if (isPlayerOnIce()) {
    player.vx += (targetVx - player.vx) * Math.min(1, ICE_RESPONSIVENESS * delta);
  } else {
    player.vx = targetVx;
  }
  if (moving !== 0) {
    player.facing = moving;
  }

  const windPush = player.grounded ? 0 : windForceOnPlayer();
  player.x = Math.max(
    0,
    Math.min(worldWidth - player.width, player.x + (player.vx + windPush) * delta)
  );

  const jumpPressed =
    input.pressed.has("arrowup") ||
    input.pressed.has("w");
  if (!stunned && !stuckInSap && jumpPressed && (player.grounded || currentTime <= player.coyoteUntil)) {
    player.vy = -460;
    player.grounded = false;
    player.coyoteUntil = 0;
    player.jumpHoldUntil = currentTime + MAX_JUMP_HOLD * 1000;
    sounds.playJump();
    emitParticles(player.x + player.width / 2, player.y + player.height, 7, "#9c5a3a", 72);
  }
}

function resolveVerticalCollision(previousY) {
  const wasGrounded = player.grounded;
  player.grounded = false;
  player.standingPlatform = null;
  const floors = [
    { x: 0, y: groundY, width: worldWidth, height: 200 },
    ...upperPlatforms,
    ...lowCeilings
  ];

  const standingHeadY = groundY - player.height;
  for (const floor of floors) {
    // A ceiling positioned close enough to the ground that its underside
    // would extend past a standing player's own head height can never
    // register a "crossed the underside" event (the player's head already
    // starts past that line at rest), letting jumps sail straight through
    // and land on top from below. Cap the collidable depth to just above
    // standing clearance so it's always geometrically reachable — this only
    // affects genuinely low platforms; anything with normal clearance keeps
    // its full authored depth unchanged.
    const desiredDepth = floor.undersideHeight ?? floor.height;
    const undersideDepth = Math.max(4, Math.min(desiredDepth, standingHeadY - floor.y - 2));
    const overlapsHorizontally =
      player.x + player.width > floor.x && player.x < floor.x + floor.width;
    const crossedUnderside =
      previousY >= floor.y + undersideDepth &&
      player.y <= floor.y + undersideDepth &&
      player.vy < 0;
    const crossedTop =
      previousY + player.height <= floor.y &&
      player.y + player.height >= floor.y &&
      player.vy >= 0;
    if (overlapsHorizontally && crossedUnderside) {
      player.y = floor.y + undersideDepth;
      player.vy = 0;
      player.jumpHoldUntil = 0;
      break;
    }
    if (overlapsHorizontally && crossedTop) {
      player.y = floor.y - player.height;
      player.vy = 0;
      player.grounded = true;
      player.standingPlatform = floor.moveAxis ? floor : null;
      player.coyoteUntil = performance.now() + 100;
      break;
    }
  }

  if (player.y > groundY + 300) {
    player.x = activeLevel.spawnX;
    player.y = groundY - player.height;
    player.vy = 0;
    message = "Back at the colony nest. Keep moving!";
  }
  if (wasGrounded && !player.grounded) {
    player.coyoteUntil = performance.now() + 100;
  }
}

function hitPlayer(now, knockback = 42) {
  if (now < player.stunnedUntil || now < player.immuneUntil) {
    return;
  }
  player.stunnedUntil = now + STUN_DURATION * 1000;
  player.stunActive = true;
  player.x = Math.max(0, Math.min(worldWidth - player.width, player.x - knockback));
  sounds.playBeetleHit();
  emitParticles(player.x + player.width / 2, player.y + player.height / 2, 14, "#a93445", 165, 360);
}

function updateStalactites(delta, now) {
  const playerCenter = player.x + player.width / 2;
  for (const stalactite of activeLevel.stalactites) {
    const stalactiteCenter = stalactite.x + stalactite.width / 2;
    if (stalactite.state === "idle" && Math.abs(playerCenter - stalactiteCenter) < 170) {
      stalactite.state = "warning";
      stalactite.triggeredAt = now;
    } else if (stalactite.state === "warning" && now - stalactite.triggeredAt >= 650) {
      stalactite.state = "falling";
    }

    if (stalactite.state === "falling") {
      stalactite.y += 760 * delta;
      const stalactiteBox = {
        x: stalactite.x + 7,
        y: stalactite.y,
        width: stalactite.width - 14,
        height: stalactite.height
      };
      if (!isOnRelayShortcut() && isOverlapping(playerBox(), stalactiteBox)) {
        hitPlayer(now, 54);
      }
      if (stalactite.y + stalactite.height >= groundY) {
        stalactite.y = groundY - stalactite.height;
        stalactite.state = "landed";
        stalactite.landedAt = now;
        emitParticles(stalactiteCenter, groundY - 8, 12, "#9a7966", 115, 330);
      }
    } else if (stalactite.state === "landed" && now - stalactite.landedAt >= STALACTITE_LANDED_MS) {
      stalactite.state = "idle";
      stalactite.y = stalactite.startY;
      stalactite.triggeredAt = 0;
    }
  }
}

function updateSwitches(delta, now) {
  for (const sw of activeLevel.switches) {
    if (!sw.triggered) {
      const switchBox = { x: sw.x, y: sw.y, width: sw.width, height: sw.height };
      if (isOverlapping(playerBox(), switchBox)) {
        sw.triggered = true;
        sw.openedAt = now;
        sounds.playPodPickup();
        const isLightsSwitch = sw.vaultId === activeLevel.lightsSwitchId;
        setStatus(
          isLightsSwitch
            ? "The lights flicker on — you can see the whole chamber now."
            : "Switch triggered — a sealed vault has opened."
        );
        spawnPopup(isLightsSwitch ? "LIGHTS ON!" : "VAULT OPEN!", sw.x + sw.width / 2, sw.y - 30, "#bfffe0");
        emitParticles(sw.x + sw.width / 2, sw.y, 16, "#7ff4e2", 140, 90);
      }
    } else if (sw.timedCloseMs && now - sw.openedAt >= sw.timedCloseMs) {
      sw.triggered = false;
    }
  }
}

function updatePortals(now) {
  for (const portal of activeLevel.portals) {
    if (now < (portal.cooldownUntil || 0)) {
      continue;
    }
    // The trigger hitbox is deliberately smaller than the drawn portal (and
    // stays centered on it) so grazing the glow's outer edge doesn't fire it
    // — the carrier has to walk into the middle.
    const triggerWidth = Math.max(6, portal.width - PORTAL_TRIGGER_INSET * 2);
    const triggerHeight = Math.max(6, portal.height - PORTAL_TRIGGER_INSET * 2);
    const portalBox = {
      x: portal.x + (portal.width - triggerWidth) / 2,
      y: portal.y + (portal.height - triggerHeight) / 2,
      width: triggerWidth,
      height: triggerHeight
    };
    if (isOverlapping(playerBox(), portalBox)) {
      portal.cooldownUntil = now + 600;
      const linkedPortal = portal.linkTo !== undefined ? activeLevel.portals[portal.linkTo] : null;
      let targetX;
      if (linkedPortal) {
        // Exit on whichever side of the *destination* portal matches the
        // carrier's current direction of travel (player.facing), not a
        // fixed offset — landing on the wrong side of a paired portal while
        // still holding the same movement key walked the carrier straight
        // back into it, creating a portal-to-portal ping-pong loop. Exiting
        // on the far side (relative to travel direction) means continuing
        // to hold that same key always moves away from the portal just
        // arrived at; reversing direction to walk back through is still a
        // deliberate, legitimate use of the pair, not a loop.
        const exitBuffer = 15;
        targetX =
          player.facing >= 0
            ? linkedPortal.x + linkedPortal.width + exitBuffer
            : linkedPortal.x - player.width - exitBuffer;
      } else {
        targetX = mailbox.x + mailbox.width + 50;
      }
      const landingX = Math.max(0, Math.min(worldWidth - player.width, targetX));
      player.x = landingX;
      player.y = groundY - player.height;
      player.vx = 0;
      player.vy = 0;
      player.grounded = true;
      sounds.playPortalWarp();
      setStatus(
        linkedPortal
          ? "Portal activated — whisked across the chamber."
          : "Portal activated — whisked back to the colony nest."
      );
      spawnPopup("WHOOSH!", portal.x + portal.width / 2, portal.y - 20, "#bfe0ff");
      emitParticles(portal.x + portal.width / 2, portal.y + portal.height / 2, 20, "#8fd6ff", 160, 60);
      emitParticles(landingX + player.width / 2, groundY - 40, 16, "#8fd6ff", 140, 90);
    }
  }
}

function activateRelay() {
  relayActive = true;
  const nestX = mailbox.x + mailbox.width / 2;
  const nestY = mailbox.y + 28;
  spawnPopup("RELAY ONLINE", nestX, mailbox.y - 42, "#a9f4eb");
  emitParticles(nestX, nestY, 28, "#7ff4e2", 165, 110);
  emitParticles(nestX, nestY, 16, "#fff0a8", 130, 90);
  setStatus("Six pods banked. The central nest relay opened the safer return shortcut.");
}

function updateWorld(delta) {
  const now = performance.now();
  updateEffects(delta);
  remaining = Math.max(0, activeLevel.duration + timeBonus - (now - startTime) / 1000);
  if (remaining <= 0) {
    finishRun();
    return;
  }
  const warningSecond = Math.ceil(remaining);
  if (remaining <= 10 && warningSecond !== lastWarningSecond) {
    sounds.playTimerWarning();
    lastWarningSecond = warningSecond;
  }
  if (player.stunActive && now >= player.stunnedUntil) {
    player.stunActive = false;
    player.immuneUntil = now + RECOVERY_IMMUNITY_DURATION * 1000;
    sounds.playRecoveryImmunity();
  }

  pests.forEach((currentPest) => {
    currentPest.x += currentPest.direction * currentPest.speed * delta;
    if (currentPest.x <= currentPest.minX || currentPest.x >= currentPest.maxX) {
      currentPest.x = Math.max(currentPest.minX, Math.min(currentPest.maxX, currentPest.x));
      currentPest.direction *= -1;
    }
    if (currentPest.flying) {
      currentPest.phase += currentPest.bobSpeed * delta;
      currentPest.y = currentPest.baseY + Math.sin(currentPest.phase) * currentPest.bobAmplitude;
    }
  });

  updateMovingPlatforms(delta);
  if (player.standingPlatform) {
    player.x = Math.max(
      0,
      Math.min(worldWidth - player.width, player.x + player.standingPlatform.frameDeltaX)
    );
  }

  movePlayer(delta);
  const previousY = player.y;
  const holdingJump =
    (input.held.has("arrowup") || input.held.has("w")) &&
    now < player.jumpHoldUntil &&
    player.vy < 0;
  player.vy += (holdingJump ? 650 : 2000) * delta;
  player.y += player.vy * delta;
  resolveVerticalCollision(previousY);
  updateStalactites(delta, now);
  updateSwitches(delta, now);
  updatePortals(now);

  for (const boost of activeLevel.capacityBoosts) {
    if (boost.collected) {
      continue;
    }
    const boostBox = { x: boost.x - 18, y: boost.y - 18, width: 36, height: 36 };
    if (isOverlapping(playerBox(), boostBox)) {
      boost.collected = true;
      player.capacityBoosted = true;
      sounds.playPodPickup();
      spawnPopup("CARRY +1!", boost.x, boost.y - 28, "#8dffb0");
      emitParticles(boost.x, boost.y, 16, "#8dffb0", 130, 100);
      setStatus("Capacity boosted for the rest of the run! Your pouch can now hold three pods.");
    }
  }

  for (const pine of pines) {
    if (pine.collected) {
      continue;
    }
    const pineBox = { x: pine.x - 18, y: pine.y - 22, width: 36, height: 44 };
    if (isOverlapping(playerBox(), pineBox)) {
      pine.collected = true;
      timeBonus += PINE_TIME_BONUS;
      remaining = Math.max(0, activeLevel.duration + timeBonus - (now - startTime) / 1000);
      lastWarningSecond = null;
      sounds.playPodPickup();
      spawnPopup("+5 SEC", pine.x, pine.y - 28, "#d5ffd1");
      emitParticles(pine.x, pine.y, 14, "#b5ef91", 125, 120);
      setStatus("Pine collected. Five seconds added to this Level 2 timer.");
    }
  }

  for (const seed of seeds) {
    if (seed.collected) {
      continue;
    }
    if (seed.vaultId && !isVaultOpen(seed.vaultId)) {
      continue;
    }
    const seedBox = { x: seed.x - 17, y: seed.y - 17, width: 34, height: 34 };
    if (isOverlapping(playerBox(), seedBox)) {
      if (player.carrying < effectiveCarryCapacity()) {
        seed.collected = true;
        player.carrying += 1;
        player.carriedValue += seed.weight;
        message =
          player.carrying === effectiveCarryCapacity()
            ? "Carrier pouch full. Return to the colony nest!"
            : `${activeLevel.podLabel} pod collected. Find one more or return to the colony nest.`;
        setStatus(message);
        sounds.playPodPickup();
        spawnPopup(`+${seed.weight * SEED_VALUE} PTS`, seed.x, seed.y - 24, seed.weight > 1 ? "#ffd35c" : "#fff0b7");
        emitParticles(seed.x, seed.y, 12, seed.weight > 1 ? "#ffd35c" : POD_COLOR, 125, 130);
      } else if (now >= player.fullPouchNoticeUntil) {
        player.fullPouchNoticeUntil = now + 1000;
        message = "Carrier pouch full. This seed pod stays here until you deliver.";
        setStatus(message);
        spawnPopup("FULL POUCH!", seed.x, seed.y - 24, "#ffd4da");
      }
    }
  }

  const nestBox = { x: mailbox.x, y: mailbox.y, width: mailbox.width, height: mailbox.height };
  if (player.carrying > 0 && isOverlapping(playerBox(), nestBox)) {
    const bankedPods = player.carrying;
    const bankedValue = player.carriedValue;
    score += bankedValue * SEED_VALUE;
    deliveredPods += bankedValue;
    message = `${bankedPods} pod${bankedPods > 1 ? "s" : ""} delivered!`;
    setStatus(message);
    player.carrying = 0;
    player.carriedValue = 0;
    sounds.playDepotDelivery(bankedPods === effectiveCarryCapacity());
    spawnPopup(
      `+${bankedValue * SEED_VALUE} PTS!`,
      mailbox.x + mailbox.width / 2,
      mailbox.y - 30,
      "#fff0b7"
    );
    spawnPopup("POD DELIVERED!", mailbox.x + mailbox.width / 2, mailbox.y - 52, "#ffd4da");
    const nestX = mailbox.x + mailbox.width / 2;
    const nestY = mailbox.y + 26;
    emitParticles(nestX, nestY, 20, POD_COLOR, 150, 110);
    emitParticles(nestX, nestY, 14, "#ffe479", 175, 95);
    emitParticles(nestX, nestY, 10, "#fff6c9", 125, 75);
    if (activeLevel.relayRequired > 0 && !relayActive && deliveredPods >= activeLevel.relayRequired) {
      activateRelay();
    }
    if (deliveredPods === activeLevel.totalPodValue) {
      finishRun();
      return;
    }
  }

  const collidingPest = pests.find((currentPest) => isOverlapping(playerBox(), currentPest));
  if (collidingPest) {
    hitPlayer(now);
  }

  cameraX = Math.max(0, Math.min(worldWidth - WIDTH, player.x - WIDTH * 0.38));
  cameraY = Math.max(0, Math.min(worldHeight - HEIGHT, player.y - HEIGHT * 0.62));
}

// Thin wrappers over the leaderboard module that inject this game's config and
// current player. Persistence, validation and ranking live in leaderboard.js.
function loadCampaignLeaderboard() {
  return loadCampaignLeaderboardFromStore(LEADERBOARD_CONFIG);
}

function saveCampaignScore() {
  return saveCampaignEntry(
    {
      name: playerName,
      score: campaignScore,
      completionSeconds: campaignTimeTotal,
      finalLevel: campaignFinalLevel,
      outcome: campaignOutcome,
      timestamp: Date.now()
    },
    LEADERBOARD_CONFIG
  );
}

function campaignPersonalBest(entries) {
  return campaignPersonalBestFor(entries, playerName);
}

// Two-tap confirm so the local leaderboard can't be wiped by a stray tap.
function handleClearLeaderboardTap() {
  const now = performance.now();
  if (now < leaderboardClearConfirmUntil) {
    leaderboardClearConfirmUntil = 0;
    clearCampaignLeaderboard();
    setStatus("Local leaderboard cleared.");
  } else {
    leaderboardClearConfirmUntil = now + 3000;
    setStatus("Tap clear again to confirm wiping the local leaderboard.");
  }
}

function finishRun() {
  if (gameOverRecorded) {
    return;
  }
  gameOverRecorded = true;
  runCompleted = deliveredPods >= activeLevel.minPods;
  completionSeconds = Number(
    Math.max(0, (performance.now() - startTime) / 1000).toFixed(1)
  );
  remaining = 0;
  if (runCompleted) {
    sounds.playLevelComplete();
  } else {
    sounds.playTimeUp();
  }

  if (gameMode === GAME_MODES.CAMPAIGN) {
    campaignScore += score;
    campaignTimeTotal = Number((campaignTimeTotal + completionSeconds).toFixed(1));
    campaignFinalLevel = currentLevelId;
    const levelIndex = LEVEL_ORDER.indexOf(currentLevelId);
    const isLastLevel = levelIndex === LEVEL_ORDER.length - 1;

    if (runCompleted && !isLastLevel) {
      const nextLevelId = LEVEL_ORDER[levelIndex + 1];
      selectLevel(nextLevelId);
      changeScreen(STATES.INSTRUCTIONS);
      setStatus(`Level ${nextLevelId - 1} cleared with ${deliveredPods} pods. Level ${nextLevelId} instructions are shown.`);
      return;
    }

    campaignOutcome = runCompleted ? "completed" : "failed";
    saveCampaignScore();
    state = STATES.GAME_OVER;
    message = campaignOutcome === "completed"
      ? `Full Relay complete! Total score ${campaignScore} in ${formatCompletionTime(campaignTimeTotal)}.`
      : `Run ended at Level ${campaignFinalLevel}. Total score ${campaignScore}. Restart from Level ${LEVEL_ORDER[0]} to try again.`;
    setStatus(message);
    return;
  }

  state = STATES.GAME_OVER;
  message = `Level ${currentLevelId} run time: ${formatCompletionTime(completionSeconds)}. Score: ${score}.`;
  setStatus(message);
}

function drawRoundedRect(x, y, width, height, radius, fill, stroke) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  if (fill) {
    context.fillStyle = fill;
    context.fill();
  }
  if (stroke) {
    context.strokeStyle = stroke;
    context.lineWidth = 4;
    context.stroke();
  }
}

function drawText(text, x, y, size, color = "#17313b", align = "left") {
  context.fillStyle = color;
  context.font = `400 ${size}px "Lilita One", system-ui, sans-serif`;
  context.textAlign = align;
  context.textBaseline = "middle";
  context.fillText(text, x, y);
}

function drawTextFit(text, x, y, size, maxWidth, color) {
  let fittedSize = size;
  context.font = `400 ${fittedSize}px "Lilita One", system-ui, sans-serif`;
  while (context.measureText(text).width > maxWidth && fittedSize > 14) {
    fittedSize -= 1;
    context.font = `400 ${fittedSize}px "Lilita One", system-ui, sans-serif`;
  }
  context.fillStyle = color;
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText(text, x, y);
}

function drawPodSprite(x, y, size, alpha = 1) {
  context.save();
  context.globalAlpha = alpha;
  if (podSprite.complete && podSprite.naturalWidth > 0) {
    context.drawImage(podSprite, x - size / 2, y - size / 2, size, size);
  } else {
    context.fillStyle = POD_COLOR;
    context.beginPath();
    context.ellipse(x, y, size * 0.3, size * 0.38, 0.3, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawPodPairSprite(x, y, size, alpha = 1) {
  context.save();
  context.globalAlpha = alpha;
  if (podPairSprite.complete && podPairSprite.naturalWidth > 0) {
    const aspect = podPairSprite.naturalHeight / podPairSprite.naturalWidth;
    const width = size * 1.6;
    context.drawImage(podPairSprite, x - width / 2, y - (width * aspect) / 2, width, width * aspect);
  } else {
    drawPodSprite(x - size * 0.32, y + size * 0.06, size * 0.72, alpha);
    drawPodSprite(x + size * 0.32, y - size * 0.06, size * 0.72, alpha);
  }
  context.restore();
}

function drawPineSprite(x, y, size, alpha = 1) {
  context.save();
  context.globalAlpha = alpha;
  if (pineSprite.complete && pineSprite.naturalWidth > 0) {
    context.drawImage(pineSprite, x - size / 2, y - size / 2, size, size);
  } else {
    context.fillStyle = "rgba(188, 255, 161, 0.22)";
    context.beginPath();
    context.arc(x, y, size / 2, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#4c8f54";
    context.beginPath();
    context.ellipse(x, y + size * 0.06, size * 0.19, size * 0.28, 0, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawPouchPod(x, y, size) {
  context.save();
  context.translate(x, y);
  context.rotate(0.2);
  context.fillStyle = "#b5172b";
  context.beginPath();
  context.ellipse(0, 2, size * 0.27, size * 0.38, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#1a0407";
  context.lineWidth = 1.25;
  context.stroke();
  context.fillStyle = "#ff8ea0";
  context.beginPath();
  context.ellipse(-size * 0.09, -size * 0.08, size * 0.07, size * 0.13, -0.3, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#58351c";
  context.lineWidth = 1.5;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(0, -size * 0.34);
  context.quadraticCurveTo(size * 0.1, -size * 0.48, size * 0.22, -size * 0.52);
  context.stroke();
  context.restore();
}

function drawSprite(sprite, x, y, width, height, alpha = 1) {
  if (!(sprite.complete && sprite.naturalWidth > 0)) {
    return false;
  }
  context.save();
  context.globalAlpha = alpha;
  context.drawImage(sprite, x, y, width, height);
  context.restore();
  return true;
}

function drawCloud(x, y, scale) {
  context.fillStyle = "rgba(255,255,255,0.8)";
  context.beginPath();
  context.arc(x, y, 26 * scale, 0, Math.PI * 2);
  context.arc(x + 32 * scale, y - 12 * scale, 34 * scale, 0, Math.PI * 2);
  context.arc(x + 70 * scale, y, 24 * scale, 0, Math.PI * 2);
  context.fill();
}

function drawBackdrop() {
  const now = performance.now();
  const sky = context.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, "#1689cf");
  sky.addColorStop(0.55, "#4fdbc6");
  sky.addColorStop(1, "#d8f05f");
  context.fillStyle = sky;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.fillStyle = "rgba(255, 231, 123, 0.88)";
  context.beginPath();
  context.arc(WIDTH - 160, 130, 66, 0, Math.PI * 2);
  context.fill();
  // Idle cloud drift is decorative; freeze it (but keep camera parallax) under
  // reduced motion.
  const driftTime = reducedMotion ? 0 : now;
  drawCloud(120 - cameraX * 0.08 + Math.sin(driftTime / 5000) * 38, 130 + Math.sin(driftTime / 1700) * 8, 1);
  drawCloud(650 - cameraX * 0.05 + Math.sin(driftTime / 6200 + 1) * 54, 95 + Math.sin(driftTime / 2200 + 1) * 11, 0.72);
  drawCloud(1080 - cameraX * 0.1 + Math.sin(driftTime / 4600 + 2) * 30, 185 + Math.sin(driftTime / 1900 + 2) * 9, 0.62);

  const mountainOffset = -((cameraX * 0.15) % 500);
  if (sprites.mountains.complete && sprites.mountains.naturalWidth > 0) {
    drawSprite(sprites.mountains, mountainOffset, 235, 500, 250, 0.18);
    drawSprite(sprites.mountains, mountainOffset + 500, 235, 500, 250, 0.18);
    drawSprite(sprites.mountains, mountainOffset + 1000, 235, 500, 250, 0.18);
  }
  context.fillStyle = "#387f94";
  for (let x = -240; x < WIDTH + 300; x += 240) {
    const ridge = x - cameraX * 0.15;
    context.beginPath();
    context.moveTo(ridge, 440);
    context.lineTo(ridge + 150, 245);
    context.lineTo(ridge + 310, 440);
    context.closePath();
    context.fill();
  }
  context.fillStyle = "#4fb85b";
  for (let x = -180; x < WIDTH + 240; x += 130) {
    const hill = x - cameraX * 0.45;
    context.beginPath();
    context.arc(hill + 30, 440, 115, Math.PI, 0);
    context.arc(hill + 115, 446, 102, Math.PI, 0);
    context.fill();
  }
  const foliageOffset = -((cameraX * 0.45) % 500);
  if (sprites.foliage.complete && sprites.foliage.naturalWidth > 0) {
    drawSprite(sprites.foliage, foliageOffset, 330, 500, 250, 0.22);
    drawSprite(sprites.foliage, foliageOffset + 500, 330, 500, 250, 0.22);
    drawSprite(sprites.foliage, foliageOffset + 1000, 330, 500, 250, 0.22);
  }
  for (let index = 0; index < 9; index += 1) {
    const x = ((index * 219 - cameraX * 0.45) % (WIDTH + 180)) - 90;
    const y = 390 + (index % 3) * 22;
    context.fillStyle = "#216c55";
    context.fillRect(x - 7, y, 14, 90);
    context.beginPath();
    context.arc(x, y - 18, 38, 0, Math.PI * 2);
    context.arc(x - 30, y + 5, 28, 0, Math.PI * 2);
    context.arc(x + 28, y + 8, 30, 0, Math.PI * 2);
    context.fill();
  }
}

function worldX(x) {
  return Math.round(x - cameraX);
}

function worldY(y) {
  return Math.round(y - cameraY);
}

function drawGround() {
  const soil = context.createLinearGradient(0, groundY, 0, HEIGHT);
  soil.addColorStop(0, "#aa4f32");
  soil.addColorStop(1, "#553025");
  context.fillStyle = soil;
  context.fillRect(0, groundY, WIDTH, HEIGHT - groundY);
  context.fillStyle = "#39c45b";
  context.fillRect(0, groundY - 16, WIDTH, 20);
  meadowPlants.forEach((plant) => {
    const x = worldX(plant.x);
    if (x < -35 || x > WIDTH + 35) {
      return;
    }
    context.strokeStyle = "#347846";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(x, groundY - 17);
    context.quadraticCurveTo(x - 6, groundY - plant.height / 2, x + 3, groundY - plant.height);
    context.stroke();
    context.fillStyle = plant.color;
    for (let petal = 0; petal < 5; petal += 1) {
      const angle = (Math.PI * 2 * petal) / 5;
      context.beginPath();
      context.ellipse(
        x + 3 + Math.cos(angle) * 7,
        groundY - plant.height + Math.sin(angle) * 7,
        5,
        9,
        angle,
        0,
        Math.PI * 2
      );
      context.fill();
    }
    context.fillStyle = "#6a4c4c";
    context.beginPath();
    context.arc(x + 3, groundY - plant.height, 4, 0, Math.PI * 2);
    context.fill();
  });
}

function drawCaveBackdrop() {
  const cave = context.createLinearGradient(0, 0, 0, HEIGHT);
  cave.addColorStop(0, "#11182a");
  cave.addColorStop(0.52, "#253554");
  cave.addColorStop(1, "#4d413f");
  context.fillStyle = cave;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  for (let index = -1; index < 10; index += 1) {
    const baseX = index * 190 - (cameraX * 0.16) % 190;
    const depth = 92 + ((index * 47) % 76);
    context.fillStyle = index % 2 ? "#1b2741" : "#202e4b";
    context.beginPath();
    context.moveTo(baseX, 0);
    context.lineTo(baseX + 55, depth);
    context.lineTo(baseX + 104, 42);
    context.lineTo(baseX + 168, depth + 35);
    context.lineTo(baseX + 212, 0);
    context.closePath();
    context.fill();
  }

  for (let index = -1; index < 9; index += 1) {
    const x = index * 230 - (cameraX * 0.38) % 230 + 80;
    const height = 140 + ((index * 61) % 95);
    context.fillStyle = index % 2 ? "#334969" : "#2b405f";
    context.beginPath();
    context.moveTo(x - 68, groundY);
    context.lineTo(x - 24, groundY - height);
    context.lineTo(x + 4, groundY - height - 46);
    context.lineTo(x + 64, groundY);
    context.closePath();
    context.fill();
  }

  for (let index = 0; index < 8; index += 1) {
    const x = index * 212 - (cameraX * 0.6) % 212 + 35;
    const y = 300 + ((index * 41) % 105);
    context.fillStyle = index % 2 ? "rgba(102, 221, 203, 0.16)" : "rgba(164, 117, 229, 0.14)";
    context.beginPath();
    context.moveTo(x, y - 32);
    context.lineTo(x + 20, y + 34);
    context.lineTo(x - 18, y + 21);
    context.closePath();
    context.fill();
  }
}

function drawCaveGround() {
  const floor = context.createLinearGradient(0, groundY, 0, HEIGHT);
  floor.addColorStop(0, "#71584e");
  floor.addColorStop(1, "#322a35");
  context.fillStyle = floor;
  context.fillRect(0, groundY, WIDTH, HEIGHT - groundY);
  context.fillStyle = "#a48772";
  context.fillRect(0, groundY - 8, WIDTH, 12);
  context.strokeStyle = "#d1b58c";
  context.lineWidth = 2;
  for (let x = -40; x < WIDTH + 60; x += 86) {
    const offset = ((Math.floor((x + cameraX) / 86) * 19) % 20) - 10;
    context.beginPath();
    context.moveTo(x + offset, groundY - 7);
    context.lineTo(x + 28 + offset, groundY - 12);
    context.lineTo(x + 48 + offset, groundY - 7);
    context.stroke();
  }
}

function drawPlatform(platform, hanging = false) {
  const x = worldX(platform.x);
  if (x + platform.width < 0 || x > WIDTH) {
    return;
  }
  const spriteHeight = Math.max(58, (platform.width / 240) * 90);
  if (drawSprite(sprites.platform, x, platform.y - spriteHeight * 0.24, platform.width, spriteHeight)) {
    return;
  }
  drawRoundedRect(x, platform.y, platform.width, platform.height, 10, "#8b4b2d", "#1b2025");
  context.fillStyle = "#6fd560";
  context.fillRect(x, platform.y - 9, platform.width, 13);
  context.strokeStyle = "#bff06c";
  context.lineWidth = 2;
  context.lineCap = "round";
  for (let tuftX = x + 9; tuftX < x + platform.width - 5; tuftX += 12) {
    const tuftHeight = 5 + ((Math.floor(tuftX + platform.x) * 17) % 9);
    context.beginPath();
    context.moveTo(tuftX, platform.y - 5);
    context.quadraticCurveTo(tuftX - 3, platform.y - tuftHeight, tuftX - 5, platform.y - tuftHeight - 3);
    context.moveTo(tuftX + 3, platform.y - 5);
    context.quadraticCurveTo(tuftX + 6, platform.y - tuftHeight + 2, tuftX + 8, platform.y - tuftHeight - 1);
    context.stroke();
  }
}

function drawCaveShelf(platform, hanging = false) {
  const x = worldX(platform.x);
  if (x + platform.width < 0 || x > WIDTH) {
    return;
  }
  const edgeY = hanging ? platform.y + platform.height : platform.y;
  const bodyY = hanging ? platform.y - 34 : platform.y + 6;
  const bodyHeight = hanging ? platform.height + 34 : Math.max(platform.height + 24, 40);
  drawRoundedRect(x, bodyY, platform.width, bodyHeight, 8, "#66515a", "#182033");
  context.fillStyle = hanging ? "#a58b85" : "#b59c89";
  context.fillRect(x + 5, edgeY - (hanging ? 3 : 2), platform.width - 10, 6);
  context.strokeStyle = "#3f3442";
  context.lineWidth = 3;
  for (let vein = 18; vein < platform.width - 8; vein += 34) {
    context.beginPath();
    context.moveTo(x + vein, bodyY + 9);
    context.lineTo(x + vein + 8, bodyY + bodyHeight - 7);
    context.stroke();
  }
}

function drawRelayShortcuts() {
  if (!relayActive) {
    return;
  }
  activeLevel.relayShortcuts.forEach((shortcut) => {
    const x = worldX(shortcut.x);
    if (x + shortcut.width < 0 || x > WIDTH) {
      return;
    }
    context.save();
    context.globalAlpha = 0.76;
    const glow = context.createLinearGradient(x, groundY - 34, x, groundY);
    glow.addColorStop(0, "rgba(111, 250, 222, 0)");
    glow.addColorStop(1, "rgba(111, 250, 222, 0.72)");
    context.fillStyle = glow;
    context.fillRect(x, groundY - 34, shortcut.width, 30);
    context.strokeStyle = "#b9fff0";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(x, groundY - 13);
    context.lineTo(x + shortcut.width, groundY - 13);
    context.stroke();
    context.restore();
    const labelX = Math.max(80, Math.min(WIDTH - 80, x + shortcut.width / 2));
    drawText("RELAY RETURN", labelX, groundY - 47, 15, "#b9fff0", "center");
  });
}

function drawSapZones() {
  const palette = getTheme().sapPalette || { pool: "#795927", blob: "#cda84d" };
  activeLevel.sapZones.forEach((sap) => {
    const x = worldX(sap.x);
    if (x + sap.width < 0 || x > WIDTH) {
      return;
    }
    context.fillStyle = palette.pool;
    context.beginPath();
    context.ellipse(x + sap.width / 2, groundY - 8, sap.width / 2, 15, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = palette.blob;
    for (let blob = 0; blob < 4; blob += 1) {
      context.beginPath();
      context.ellipse(x + 24 + blob * ((sap.width - 48) / 3), groundY - 11, 13, 5, 0, 0, Math.PI * 2);
      context.fill();
    }
  });
}

function drawSlipZones() {
  activeLevel.slipZones.forEach((zone) => {
    const x = worldX(zone.x);
    const surfaceY = worldY(zone.y);
    if (x + zone.width < 0 || x > WIDTH || surfaceY < -40 || surfaceY > HEIGHT + 40) {
      return;
    }
    context.fillStyle = "rgba(120, 130, 140, 0.55)";
    context.beginPath();
    context.ellipse(x + zone.width / 2, surfaceY - 6, zone.width / 2, 13, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(230, 236, 240, 0.7)";
    context.lineWidth = 2;
    context.setLineDash([10, 6]);
    context.beginPath();
    context.moveTo(x, surfaceY - 14);
    context.lineTo(x + zone.width, surfaceY - 14);
    context.stroke();
    context.setLineDash([]);
    drawText("LOOSE ASH", x + zone.width / 2, surfaceY - 24, 13, "#e7ecef", "center");
  });
}

function drawVaultSwitchPedestal(sw, x, y) {
  const now = performance.now();
  const on = sw.triggered;
  const cx = x + sw.width / 2;
  drawRoundedRect(x, y, sw.width, sw.height, 4, "#4d5f52", "#232f28");
  const stemHeight = 10;
  context.fillStyle = "#5a6d5f";
  context.fillRect(cx - 4, y - stemHeight, 8, stemHeight);
  const gemY = y - stemHeight - 7;
  const pulse = on ? 0.85 + Math.sin(now / 180) * 0.15 : 1;
  const gemRadius = 7 * pulse;
  if (on) {
    const glow = context.createRadialGradient(cx, gemY, 1, cx, gemY, 20);
    glow.addColorStop(0, "rgba(127, 244, 226, 0.85)");
    glow.addColorStop(1, "rgba(127, 244, 226, 0)");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(cx, gemY, 20, 0, Math.PI * 2);
    context.fill();
  }
  // Off = a dull, dark, uncut-looking stone; on = a bright cyan gem — the
  // same "unlit vs lit" visual language the light switch uses, just with a
  // different silhouette (pedestal + gem) so the two switch types never
  // read as the same object at a glance.
  context.fillStyle = on ? "#7ff4e2" : "#3a4640";
  context.beginPath();
  context.moveTo(cx, gemY - gemRadius);
  context.lineTo(cx + gemRadius, gemY);
  context.lineTo(cx, gemY + gemRadius);
  context.lineTo(cx - gemRadius, gemY);
  context.closePath();
  context.fill();
  context.strokeStyle = on ? "#d7fff5" : "#20281f";
  context.lineWidth = 2;
  context.stroke();
  drawText(on ? "VAULT OPEN" : "VAULT SWITCH", cx, y - stemHeight - 24, 11, on ? "#d7fff5" : "#c8d6c8", "center");
}

function drawLightSwitchTorch(sw, x, y) {
  const now = performance.now();
  const on = sw.triggered;
  const cx = x + sw.width / 2;
  drawRoundedRect(cx - 6, y - 4, 12, sw.height + 4, 3, "#4a3626", "#241a12");
  const headY = y - 6;
  if (on) {
    const flicker = 0.85 + Math.sin(now / 90) * 0.15;
    const glow = context.createRadialGradient(cx, headY - 10, 2, cx, headY - 10, 26 * flicker);
    glow.addColorStop(0, "rgba(255, 214, 150, 0.9)");
    glow.addColorStop(1, "rgba(255, 150, 70, 0)");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(cx, headY - 10, 26 * flicker, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#ffb347";
    context.beginPath();
    context.moveTo(cx, headY - 24 * flicker);
    context.quadraticCurveTo(cx + 7, headY - 10, cx, headY + 2);
    context.quadraticCurveTo(cx - 7, headY - 10, cx, headY - 24 * flicker);
    context.fill();
  } else {
    context.fillStyle = "#5a5650";
    context.beginPath();
    context.arc(cx, headY - 8, 7, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#2c2a26";
    context.lineWidth = 2;
    context.stroke();
  }
  context.strokeStyle = on ? "#ffdca6" : "#3a352d";
  context.lineWidth = 2;
  context.beginPath();
  context.ellipse(cx, headY, 9, 6, 0, 0, Math.PI * 2);
  context.stroke();
  drawText(on ? "LIGHTS ON" : "LIGHT SWITCH", cx, y - 26, 11, on ? "#ffe6ad" : "#c9c2b3", "center");
}

function drawSwitches() {
  // Switches are visible by default now, at full contrast, whether the
  // player is nearby or not — an earlier version camouflaged them until the
  // carrier got close, which read as buggy/invisible rather than a fair
  // puzzle. Placement (an optional side platform, not proximity) is what
  // makes them a deliberate detour now, per explicit request.
  activeLevel.switches.forEach((sw) => {
    const x = worldX(sw.x);
    const y = worldY(sw.y);
    if (x + sw.width < -40 || x > WIDTH + 40) {
      return;
    }
    if (sw.vaultId === activeLevel.lightsSwitchId) {
      drawLightSwitchTorch(sw, x, y);
    } else {
      drawVaultSwitchPedestal(sw, x, y);
    }
  });
}

function drawCapacityBoosts() {
  const now = performance.now();
  activeLevel.capacityBoosts.forEach((boost) => {
    if (boost.collected) {
      return;
    }
    const x = worldX(boost.x);
    const y = worldY(boost.y) + Math.sin(now / 240 + boost.x) * 4;
    if (x < -40 || x > WIDTH + 40) {
      return;
    }
    const glow = context.createRadialGradient(x, y, 4, x, y, 34);
    glow.addColorStop(0, "rgba(141, 255, 176, 0.75)");
    glow.addColorStop(1, "rgba(141, 255, 176, 0)");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(x, y, 34, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#3fae6f";
    context.beginPath();
    context.arc(x, y, 16, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#e9fff0";
    context.lineWidth = 2;
    context.stroke();
    drawText("+1", x, y + 1, 14, "#eafff2", "center");
  });
}

function drawPortals() {
  const now = performance.now();
  activeLevel.portals.forEach((portal) => {
    const x = worldX(portal.x);
    const y = worldY(portal.y);
    if (x + portal.width < -60 || x > WIDTH + 60 || y + portal.height < -60 || y > HEIGHT + 60) {
      return;
    }
    const cx = x + portal.width / 2;
    const cy = y + portal.height / 2;
    const pulse = 1 + Math.sin(now / 260) * 0.08;
    const glow = context.createRadialGradient(cx, cy, 4, cx, cy, portal.width * 0.75 * pulse);
    glow.addColorStop(0, "rgba(180, 230, 255, 0.9)");
    glow.addColorStop(0.5, "rgba(110, 170, 255, 0.55)");
    glow.addColorStop(1, "rgba(80, 120, 255, 0)");
    context.fillStyle = glow;
    context.beginPath();
    context.ellipse(cx, cy, (portal.width / 2) * pulse, (portal.height / 2) * pulse, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(230, 245, 255, 0.85)";
    context.lineWidth = 3;
    context.setLineDash([10, 6]);
    context.lineDashOffset = -now / 12;
    context.beginPath();
    context.ellipse(cx, cy, (portal.width / 2) * 0.7, (portal.height / 2) * 0.7, 0, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    context.lineDashOffset = 0;
    drawText(portal.linkTo !== undefined ? "PORTAL" : "NEST PORTAL", cx, y - 14, 13, "#d8f0ff", "center");
  });
}

function drawVisionMask() {
  if (!activeLevel.darkZones.length || !isPlayerInDarkZone()) {
    return;
  }
  const px = worldX(player.x + player.width / 2);
  const py = worldY(player.y + player.height / 2 - 6);
  const radius = activeLevel.visionRadius ?? 190;

  context.save();
  // A single radial-gradient wash, fully transparent at the player and
  // thickening to near-opaque well past `radius`, rather than a hard-edged
  // "hole" cut into a flat overlay — this is what gives the gradual
  // Pokemon-cave-style blend into darkness instead of a painted disc.
  const fog = context.createRadialGradient(px, py, radius * 0.1, px, py, radius * 1.6);
  fog.addColorStop(0, "rgba(4, 5, 9, 0)");
  fog.addColorStop(0.2, "rgba(4, 5, 9, 0.4)");
  fog.addColorStop(0.38, "rgba(3, 4, 7, 0.78)");
  fog.addColorStop(0.55, "rgba(2, 3, 6, 0.94)");
  fog.addColorStop(1, "rgba(1, 2, 4, 0.995)");
  context.fillStyle = fog;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  // A soft warm torch-glow around the player, additively blended so it only
  // ever brightens (never erases/repaints) whatever is already on screen.
  context.globalCompositeOperation = "lighter";
  const glow = context.createRadialGradient(px, py, 0, px, py, radius * 0.85);
  glow.addColorStop(0, "rgba(255, 214, 150, 0.22)");
  glow.addColorStop(0.5, "rgba(255, 180, 110, 0.08)");
  glow.addColorStop(1, "rgba(255, 180, 110, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.globalCompositeOperation = "source-over";
  context.restore();
}

function drawStalactite(stalactite) {
  const x = worldX(stalactite.x);
  if (x + stalactite.width < -70 || x > WIDTH + 70) {
    return;
  }
  if (stalactite.state === "landed") {
    const elapsed = performance.now() - stalactite.landedAt;
    const fadeStart = STALACTITE_LANDED_MS - STALACTITE_FADE_MS;
    if (elapsed >= fadeStart) {
      const alpha = Math.max(0, 1 - (elapsed - fadeStart) / STALACTITE_FADE_MS);
      if (alpha <= 0) {
        return;
      }
      context.save();
      context.globalAlpha = alpha;
      drawStalactiteShape(stalactite, x);
      context.restore();
      return;
    }
  }
  drawStalactiteShape(stalactite, x);
}

function drawStalactiteShape(stalactite, x) {
  const warning = stalactite.state === "warning";
  const shadeX = x + stalactite.width / 2;
  if (warning) {
    const flicker = 0.42 + Math.sin(performance.now() / 70) * 0.18;
    context.fillStyle = `rgba(19, 15, 26, ${flicker})`;
    context.beginPath();
    context.ellipse(shadeX, groundY - 5, stalactite.width * 0.84, 7, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#d1c1a8";
    for (let dust = 0; dust < 4; dust += 1) {
      context.beginPath();
      context.arc(shadeX - 17 + dust * 11, groundY - 20 - (dust % 2) * 6, 2.5, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.fillStyle = warning ? "#c2a999" : "#867079";
  context.beginPath();
  context.moveTo(x, stalactite.y);
  context.lineTo(x + stalactite.width, stalactite.y);
  context.lineTo(x + stalactite.width * 0.63, stalactite.y + stalactite.height);
  context.lineTo(x + stalactite.width * 0.36, stalactite.y + stalactite.height);
  context.closePath();
  context.fill();
  context.strokeStyle = "#282338";
  context.lineWidth = ACTIVE_OUTLINE_WIDTH;
  context.stroke();
  context.strokeStyle = "#d5c0b6";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(x + stalactite.width * 0.35, stalactite.y + 10);
  context.lineTo(x + stalactite.width * 0.5, stalactite.y + stalactite.height - 15);
  context.stroke();
}

function drawPine(pine) {
  if (pine.collected) {
    return;
  }
  const x = worldX(pine.x);
  const y = worldY(pine.y);
  const bob = Math.sin(performance.now() / 260 + pine.x) * 3;
  drawPineSprite(x, y + bob, 64);
  drawText("PINE +5s", x, y - 31 + bob, 14, "#d9ffc3", "center");
}

function drawNestTermites(nestX, baseY) {
  // Mini versions of the player character, not a generic blob — same color
  // palette and recognizable features (segmented body, round head, big
  // eyes, cheeks, curved antennae, thin legs) as drawPlayer(), just smaller
  // and with the head/eyes proportionally oversized for a "baby" read.
  const now = performance.now();
  const offsets = [-22, 20];
  offsets.forEach((offsetX, index) => {
    const wob = Math.sin(now / 500 + index * 2.1) * 3;
    const bob = Math.sin(now / 650 + index * 1.3) * 2;
    const facing = index === 0 ? 1 : -1;
    context.save();
    context.translate(nestX + offsetX + wob, baseY + bob);
    context.scale(facing, 1);

    context.fillStyle = "#72442e";
    context.beginPath();
    context.ellipse(2, 6, 8, 9, 0.1, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#171b20";
    context.lineWidth = 1;
    context.stroke();

    context.fillStyle = "#bd7a53";
    context.beginPath();
    context.ellipse(-3, -4, 9.5, 9, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    const blink = 0.85 + Math.sin(now / 900 + index) * 0.15;
    context.fillStyle = "#fff4df";
    context.beginPath();
    context.ellipse(-6.5, -5.5, 3.6, 4.2 * blink, 0, 0, Math.PI * 2);
    context.ellipse(-0.5, -5.5, 3.6, 4.2 * blink, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#33241e";
    context.beginPath();
    context.arc(-6, -5.5, 1.5, 0, Math.PI * 2);
    context.arc(0, -5.5, 1.5, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#edb08c";
    context.beginPath();
    context.arc(-8.5, -1.5, 1.6, 0, Math.PI * 2);
    context.arc(2, -1.5, 1.6, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = "#3a2a24";
    context.lineWidth = 1;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(-6, -12);
    context.quadraticCurveTo(-10, -18, -14, -17);
    context.moveTo(-1, -12);
    context.quadraticCurveTo(3, -18, 7, -16);
    context.stroke();

    context.lineWidth = 1.25;
    context.beginPath();
    context.moveTo(-2, 10);
    context.lineTo(-9, 13);
    context.moveTo(3, 12);
    context.lineTo(-3, 16);
    context.moveTo(7, 11);
    context.lineTo(13, 14);
    context.stroke();

    context.restore();
  });
}

function drawColonyNest() {
  // One shared nest visual for every level/theme, per explicit request (the
  // Ember Depths version specifically) — do not fork this back into
  // per-theme bespoke art without being asked again. worldY() is used
  // throughout rather than raw groundY so this stays correct on the
  // vertical-camera levels (3 and 5) as well as the flat ones, where it's
  // simply a no-op.
  const x = worldX(mailbox.x);
  const groundScreenY = worldY(groundY);
  const nestX = x + mailbox.width / 2;
  const nestY = groundScreenY - 20;
  const glow = context.createRadialGradient(nestX, nestY - 50, 8, nestX, nestY - 50, 110);
  glow.addColorStop(0, "rgba(255, 170, 90, 0.6)");
  glow.addColorStop(1, "rgba(180, 60, 20, 0)");
  context.fillStyle = glow;
  context.fillRect(nestX - 170, nestY - 210, 340, 250);
  if (!drawSprite(sprites.nest, x - 35, groundScreenY - 132, 160, 128)) {
    drawRoundedRect(x - 18, groundScreenY - 108, 128, 100, 14, "#2b1712", "#160b08");
    context.fillStyle = "#ff7a34";
    context.fillRect(x - 6, groundScreenY - 100, 104, 8);
    context.fillStyle = "#3a1c10";
    context.beginPath();
    context.arc(nestX, groundScreenY - 30, 24, Math.PI, 0);
    context.lineTo(nestX + 24, groundScreenY);
    context.lineTo(nestX - 24, groundScreenY);
    context.fill();
  }
  drawNestTermites(nestX, groundScreenY - 6);
}

function lerpColor(from, to, t) {
  const a = parseInt(from.slice(1), 16);
  const b = parseInt(to.slice(1), 16);
  const clamped = Math.max(0, Math.min(1, t));
  const r = Math.round(((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * clamped);
  const g = Math.round(((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * clamped);
  const bl = Math.round((a & 255) + ((b & 255) - (a & 255)) * clamped);
  return `rgb(${r}, ${g}, ${bl})`;
}

function drawCanopyBackdrop() {
  const climb = Math.max(0, Math.min(1, cameraY / Math.max(1, worldHeight - HEIGHT)));
  const sky = context.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, lerpColor("#bfe8ff", "#16232f", climb));
  sky.addColorStop(0.55, lerpColor("#8fd6a0", "#1f3a2c", climb));
  sky.addColorStop(1, lerpColor("#4f9a5c", "#12261c", climb));
  context.fillStyle = sky;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.fillStyle = `rgba(20, 60, 40, ${(0.22 + climb * 0.2).toFixed(2)})`;
  for (let index = -1; index < 8; index += 1) {
    const bx = index * 260 - (cameraX * 0.15) % 260;
    const by = (((index * 137 - cameraY * 0.15) % 420) + 420) % 420 - 60;
    context.beginPath();
    context.ellipse(bx + 130, by, 150, 46, 0, 0, Math.PI * 2);
    context.fill();
  }

  context.fillStyle = "rgba(53, 128, 74, 0.5)";
  for (let index = -1; index < 10; index += 1) {
    const bx = index * 190 - (cameraX * 0.45) % 190;
    const by = (((index * 233 - cameraY * 0.45) % 340) + 340) % 340 - 40;
    context.beginPath();
    context.arc(bx + 40, by + 30, 46, 0, Math.PI * 2);
    context.arc(bx + 90, by + 10, 36, 0, Math.PI * 2);
    context.fill();
  }

  context.strokeStyle = "rgba(35, 90, 55, 0.35)";
  context.lineWidth = 10;
  context.lineCap = "round";
  for (let index = 0; index < 5; index += 1) {
    const vx = ((index * 260 - cameraX) % (WIDTH + 200) + WIDTH + 200) % (WIDTH + 200) - 100;
    context.beginPath();
    context.moveTo(vx, -20);
    context.quadraticCurveTo(vx + 30, HEIGHT * 0.4, vx - 10, HEIGHT + 20);
    context.stroke();
  }
}

function drawCanopyGround() {
  const groundScreenY = worldY(groundY);
  if (groundScreenY > HEIGHT || groundScreenY + 260 < 0) {
    return;
  }
  const floor = context.createLinearGradient(0, groundScreenY, 0, groundScreenY + 220);
  floor.addColorStop(0, "#5a3f2a");
  floor.addColorStop(1, "#2c1f16");
  context.fillStyle = floor;
  context.fillRect(0, groundScreenY, WIDTH, Math.max(220, HEIGHT - groundScreenY));
  context.fillStyle = "#6f8f4a";
  context.fillRect(0, groundScreenY - 14, WIDTH, 18);
  context.strokeStyle = "#4a3120";
  context.lineWidth = 3;
  for (let x = -30; x < WIDTH + 60; x += 96) {
    const offset = ((Math.floor((x + cameraX) / 96) * 23) % 24) - 12;
    context.beginPath();
    context.moveTo(x + offset, groundScreenY - 6);
    context.lineTo(x + 34 + offset, groundScreenY + 6);
    context.stroke();
  }
}

function pickLeafPlatformSprite(platform) {
  if (platform.moveAxis) {
    return sprites.leafPlatformMoving;
  }
  const variantIndex = Math.floor((platform.x + platform.y) / 97) % 2;
  return variantIndex === 0 ? sprites.leafPlatformA : sprites.leafPlatformB;
}

function drawLeafPlatform(platform, hanging = false) {
  const x = worldX(platform.x);
  const y = worldY(platform.y);
  if (x + platform.width < 0 || x > WIDTH || y + platform.height < -60 || y > HEIGHT + 60) {
    return;
  }
  const sway = platform.moveAxis ? Math.sin(performance.now() / 480) * 2 : 0;
  const drawY = y + sway;

  // Leaf SVGs are authored on a 260x85 viewBox with the walkable top edge
  // (the "Top Landing Collision Line" path) sitting ~30% down from the top —
  // offset the sprite up by that fraction so the drawn leaf surface lines up
  // with the actual collision line at drawY.
  const spriteHeight = Math.max(48, (platform.width / 260) * 85);
  const spriteY = drawY - spriteHeight * 0.3;
  const drew = drawSprite(pickLeafPlatformSprite(platform), x, spriteY, platform.width, spriteHeight);

  if (!drew) {
    drawRoundedRect(x, drawY, platform.width, platform.height, 14, "#3f8f52", "#1f4a2c");
    context.fillStyle = "#6fd97e";
    context.fillRect(x + 6, drawY - 6, platform.width - 12, 8);
    context.strokeStyle = "#2f6b46";
    context.lineWidth = 2;
    for (let vein = 14; vein < platform.width - 8; vein += 26) {
      context.beginPath();
      context.moveTo(x + vein, drawY + 4);
      context.quadraticCurveTo(x + vein + 6, drawY + platform.height / 2, x + vein - 4, drawY + platform.height - 4);
      context.stroke();
    }
  }

  if (platform.moveAxis) {
    context.fillStyle = "rgba(255, 244, 190, 0.65)";
    context.beginPath();
    context.arc(x + platform.width / 2, drawY - 12, 3, 0, Math.PI * 2);
    context.fill();
  }
}

function drawWindZones() {
  const now = performance.now();
  activeLevel.windZones.forEach((wind) => {
    const x = worldX(wind.x);
    const y = worldY(wind.y);
    if (x + wind.width < 0 || x > WIDTH || y + wind.height < 0 || y > HEIGHT) {
      return;
    }
    const emberTheme = activeLevel.theme === "ember";
    const tint = emberTheme ? "#ff7a3c" : wind.direction > 0 ? "#e0a940" : "#4f8fc4";
    const chevronColor = emberTheme ? "#ffd9a6" : wind.direction > 0 ? "#fff3c4" : "#e2f0ff";
    context.save();
    context.fillStyle = emberTheme
      ? "rgba(255, 140, 80, 0.22)"
      : wind.direction > 0
      ? "rgba(255, 244, 200, 0.24)"
      : "rgba(190, 224, 255, 0.24)";
    context.fillRect(x, y, wind.width, wind.height);
    context.strokeStyle = tint;
    context.lineWidth = 3;
    context.setLineDash([9, 7]);
    context.strokeRect(x, y, wind.width, wind.height);
    context.setLineDash([]);

    context.strokeStyle = chevronColor;
    context.lineWidth = 4;
    context.lineCap = "round";
    context.lineJoin = "round";
    const spacing = 46;
    const rows = Math.max(3, Math.floor(wind.height / spacing));
    const scrollSpan = 70;
    const scroll = ((now / 5) % scrollSpan + scrollSpan) % scrollSpan;
    const tip = wind.direction > 0 ? 1 : -1;
    for (let row = 0; row < rows; row += 1) {
      const rowY = y + spacing * 0.6 + row * spacing;
      for (let cx = x - scrollSpan; cx < x + wind.width + scrollSpan; cx += scrollSpan) {
        const chevronX = wind.direction > 0 ? cx + scroll : cx + scrollSpan - scroll;
        if (chevronX < x - 16 || chevronX > x + wind.width + 16) {
          continue;
        }
        context.globalAlpha = 0.85;
        context.beginPath();
        context.moveTo(chevronX - 13 * tip, rowY - 11);
        context.lineTo(chevronX + 13 * tip, rowY);
        context.lineTo(chevronX - 13 * tip, rowY + 11);
        context.stroke();
      }
    }
    context.globalAlpha = 1;
    const labelX = Math.max(60, Math.min(WIDTH - 60, x + wind.width / 2));
    const label = emberTheme ? (wind.direction > 0 ? "HEAT →" : "← HEAT") : wind.direction > 0 ? "WIND →" : "← WIND";
    const labelColor = emberTheme ? "#ffb066" : wind.direction > 0 ? "#8a6420" : "#245478";
    drawText(label, labelX, y + 16, 15, labelColor, "center");
    context.restore();
  });
}

function drawWasp(pest) {
  const x = worldX(pest.x);
  const y = worldY(pest.y);
  const now = performance.now();
  const wingFlap = Math.sin(now / 35) * 10;
  context.save();
  context.translate(x + 23, y + 15);
  if (pest.direction < 0) {
    context.scale(-1, 1);
  }
  context.fillStyle = "rgba(255, 255, 255, 0.55)";
  context.beginPath();
  context.ellipse(-2, -10 - wingFlap * 0.2, 14, 6, -0.3, 0, Math.PI * 2);
  context.ellipse(6, -10 + wingFlap * 0.2, 14, 6, 0.3, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#f4c93d";
  context.beginPath();
  context.ellipse(0, 0, 15, 9, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#1c1710";
  context.lineWidth = 2.5;
  for (let stripe = -8; stripe <= 8; stripe += 6) {
    context.beginPath();
    context.moveTo(stripe, -8);
    context.lineTo(stripe, 8);
    context.stroke();
  }
  context.lineWidth = ACTIVE_OUTLINE_WIDTH;
  context.beginPath();
  context.ellipse(0, 0, 15, 9, 0, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = "#241c10";
  context.beginPath();
  context.ellipse(15, -1, 6, 5, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ffb53d";
  context.beginPath();
  context.arc(17, -2, 1.6, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#2a1e10";
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(-4, 6);
  context.lineTo(-6, 13);
  context.moveTo(2, 7);
  context.lineTo(1, 14);
  context.moveTo(8, 6);
  context.lineTo(10, 13);
  context.stroke();
  context.restore();
}

function drawEmberSprite(pest) {
  const x = worldX(pest.x);
  const y = worldY(pest.y);
  const now = performance.now();
  const flicker = Math.sin(now / 40) * 8;
  context.save();
  context.translate(x + 23, y + 15);
  if (pest.direction < 0) {
    context.scale(-1, 1);
  }
  context.fillStyle = "rgba(255, 180, 90, 0.5)";
  context.beginPath();
  context.ellipse(-2, -8 - flicker * 0.2, 13, 6, -0.3, 0, Math.PI * 2);
  context.ellipse(6, -8 + flicker * 0.2, 13, 6, 0.3, 0, Math.PI * 2);
  context.fill();
  const core = context.createRadialGradient(0, 0, 2, 0, 0, 16);
  core.addColorStop(0, "#fff3c4");
  core.addColorStop(0.45, "#ff9a3d");
  core.addColorStop(1, "#c9351d");
  context.fillStyle = core;
  context.beginPath();
  context.ellipse(0, 0, 15, 10, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#4c140a";
  context.lineWidth = ACTIVE_OUTLINE_WIDTH;
  context.stroke();
  context.fillStyle = "#2a0d06";
  context.beginPath();
  context.ellipse(15, -1, 5, 4, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawSeed(seed) {
  if (seed.collected) {
    return;
  }
  const x = worldX(seed.x);
  const now = performance.now();
  if (seed.vaultId && !isVaultOpen(seed.vaultId)) {
    // A sealed vault pod: a caged gem, not the pod itself — clearly a
    // different, locked object (not just a dim/near-invisible copy of the
    // real pod) so its own "off" state reads at a glance, the same way a
    // switch's off state does. Once its switch triggers, drawSeed falls
    // through to the normal pod sprite below instead — the "on" state.
    const glowY = worldY(seed.y);
    const pulse = 0.75 + Math.sin(now / 300) * 0.15;
    context.save();
    context.translate(x, glowY);
    const glow = context.createRadialGradient(0, 0, 1, 0, 0, 22 * pulse);
    glow.addColorStop(0, "rgba(120, 170, 220, 0.4)");
    glow.addColorStop(1, "rgba(120, 170, 220, 0)");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(0, 0, 22 * pulse, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#26313a";
    context.beginPath();
    context.moveTo(0, -13);
    context.lineTo(11, 0);
    context.lineTo(0, 13);
    context.lineTo(-11, 0);
    context.closePath();
    context.fill();
    context.strokeStyle = "rgba(150, 200, 240, 0.75)";
    context.lineWidth = 1.5;
    context.stroke();
    context.strokeStyle = "rgba(40, 50, 60, 0.9)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-14, -14);
    context.lineTo(14, 14);
    context.moveTo(14, -14);
    context.lineTo(-14, 14);
    context.stroke();
    context.restore();
    return;
  }
  const bob = Math.sin(now / 280 + seed.x) * 4;
  if (seed.weight > 1) {
    drawPodPairSprite(x, worldY(seed.y) + bob, 58);
  } else {
    drawPodSprite(x, worldY(seed.y) + bob, 58);
  }
}

function drawPest(currentPest) {
  const x = worldX(currentPest.x);
  const now = performance.now();
  const eyePulse = 0.75 + (Math.sin(now / 180) + 1) * 0.125;
  context.save();
  context.translate(x + 26, worldY(currentPest.y) + 30);
  if (currentPest.direction < 0) {
    context.scale(-1, 1);
  }

  context.strokeStyle = "#251116";
  context.lineWidth = 3;
  context.lineCap = "round";
  context.beginPath();
  for (const [baseX, baseY, direction] of [[-16, 7, 1], [-4, 11, -1], [12, 9, 1]]) {
    const swing = Math.sin(now / 80 + currentPest.x * 0.07) * 4 * direction;
    context.moveTo(baseX, baseY);
    context.lineTo(baseX - 10, 13 + swing);
    context.lineTo(baseX - 18, 18);
    context.moveTo(baseX + 7, baseY);
    context.lineTo(baseX + 17, 13 - swing);
    context.lineTo(baseX + 25, 18);
  }
  context.stroke();

  context.fillStyle = "#751f2a";
  context.beginPath();
  context.ellipse(2, 1, 28, 19, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#2a0c10";
  context.lineWidth = ACTIVE_OUTLINE_WIDTH;
  context.stroke();
  context.strokeStyle = "#3b1017";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(2, -17);
  context.lineTo(2, 19);
  context.stroke();
  context.fillStyle = "#bd4b54";
  context.beginPath();
  context.ellipse(-8, -5, 9, 7, -0.45, 0, Math.PI * 2);
  context.ellipse(12, -5, 9, 7, 0.45, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#5a1720";
  context.beginPath();
  context.ellipse(-23, -8, 13, 11, -0.15, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#2a0c10";
  context.lineWidth = 2;
  context.stroke();
  context.globalAlpha = eyePulse;
  context.fillStyle = "#ffb53d";
  context.beginPath();
  context.arc(-27, -10, 3.5, 0, Math.PI * 2);
  context.arc(-19, -10, 3.5, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
  context.fillStyle = "#250b0f";
  context.beginPath();
  context.arc(-27, -10, 1.4, 0, Math.PI * 2);
  context.arc(-19, -10, 1.4, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawPlayer() {
  const x = worldX(player.x);
  const y = worldY(player.y);
  const now = performance.now();
  const stunRemaining = Math.max(0, player.stunnedUntil - now);
  const stunned = stunRemaining > 0;
  const immunityRemaining = Math.max(0, player.immuneUntil - now);
  const recovering = immunityRemaining > 0;
  const recoveryOpacity = recovering
    ? 0.3 + (1 - immunityRemaining / (RECOVERY_IMMUNITY_DURATION * 1000)) * 0.7
    : 1;
  const walk = player.grounded ? Math.sin(performance.now() / 75) * Math.min(Math.abs(player.vx) / 90, 1) : 0;
  context.fillStyle = "rgba(38, 31, 27, 0.22)";
  context.beginPath();
  context.ellipse(x + player.width / 2, y + player.height + 3, 31, 7, 0, 0, Math.PI * 2);
  context.fill();
  context.save();
  context.globalAlpha = recoveryOpacity;
  const shake = stunned && !reducedMotion ? Math.sin(now / 34) * 7 : 0;
  const bob = player.grounded ? Math.abs(walk) * 3 : 0;
  context.translate(x + player.width / 2 + shake, y + player.height / 2 - bob);
  if (stunned && !reducedMotion) {
    context.rotate(Math.sin(now / 70) * 0.15);
  }
  if (player.facing < 0) {
    context.scale(-1, 1);
  }
  context.fillStyle = stunned ? "#776d62" : "#72442e";
  context.beginPath();
  context.ellipse(-9, 9, 18, 24, 0.12, 0, Math.PI * 2);
  context.ellipse(8, 11, 17, 22, -0.15, 0, Math.PI * 2);
  context.ellipse(22, 10, 14, 19, -0.2, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#171b20";
  context.lineWidth = ACTIVE_OUTLINE_WIDTH;
  context.stroke();
  context.fillStyle = stunned ? "#969087" : "#bd7a53";
  context.beginPath();
  context.ellipse(-7, -15, 20, 19, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  const blink = stunned ? 0.28 : 0.82 + Math.sin(now / 970) * 0.18;
  context.fillStyle = "#fff4df";
  context.beginPath();
  context.ellipse(-14, -19, 7, 9 * blink, 0, 0, Math.PI * 2);
  context.ellipse(-1, -19, 7, 9 * blink, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#33241e";
  context.beginPath();
  context.arc(-12, -18, 3, 0, Math.PI * 2);
  context.arc(1, -18, 3, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#edb08c";
  context.beginPath();
  context.arc(-18, -8, 4, 0, Math.PI * 2);
  context.arc(5, -8, 4, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#3a2a24";
  context.lineWidth = 2;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(-13, -31);
  context.quadraticCurveTo(-22, -47, -31, -44);
  context.moveTo(-1, -32);
  context.quadraticCurveTo(9, -49, 20, -43);
  context.stroke();
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(-2, 2);
  context.lineTo(-26, 11 + walk * 8);
  context.moveTo(7, 10);
  context.lineTo(-18, 25 - walk * 8);
  context.moveTo(19, 10);
  context.lineTo(40, 23 + walk * 8);
  context.moveTo(-8, 25);
  context.lineTo(-4 + walk * 7, 37);
  context.moveTo(12, 26);
  context.lineTo(10 - walk * 7, 38);
  context.stroke();
  // A permanent capacity boost visibly enlarges the carrier's pouch (not
  // just a bigger HUD number) so the upgrade reads at a glance mid-run.
  const pouchScale = player.capacityBoosted ? 1.35 : 1;
  context.fillStyle = stunned ? "#868275" : "#63a55b";
  context.beginPath();
  context.ellipse(25, -1, 11 * pouchScale, 17 * pouchScale, -0.5, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = player.capacityBoosted ? "#ffd75e" : "#171b20";
  context.lineWidth = player.capacityBoosted ? ACTIVE_OUTLINE_WIDTH + 1 : ACTIVE_OUTLINE_WIDTH;
  context.stroke();
  context.strokeStyle = "#2f6538";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(19, 10);
  context.lineTo(30 + (pouchScale - 1) * 14, -12 - (pouchScale - 1) * 14);
  context.stroke();
  if (player.carrying > 0) {
    for (let podIndex = 0; podIndex < player.carrying; podIndex += 1) {
      drawPouchPod(25 + podIndex * 7 * pouchScale, -12 + podIndex * 16 * pouchScale, 19);
    }
  }
  context.restore();
  if (stunned) {
    // Stars stay visible as a stun cue (not colour-only); their orbit is
    // frozen under reduced motion.
    const starAngle = reducedMotion ? 0 : now / 140;
    for (let index = 0; index < 3; index += 1) {
      const angle = starAngle + (Math.PI * 2 * index) / 3;
      const starX = x + player.width / 2 + Math.cos(angle) * 38;
      const starY = y - 14 + Math.sin(angle) * 15;
      drawText("✦", starX, starY, 22, "#f9dd57", "center");
    }
  }
}

function drawEffects() {
  for (const particle of particles) {
    const opacity = 1 - particle.age / particle.duration;
    context.globalAlpha = opacity;
    context.fillStyle = particle.color;
    context.beginPath();
    context.arc(worldX(particle.x), worldY(particle.y), particle.size, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
  scorePopups.forEach((popup) => popup.draw());
}

function drawHud() {
  drawRoundedRect(28, 24, WIDTH - 56, 76, 18, "rgba(16, 42, 48, 0.86)");
  const uppercaseName = (playerName || "PLAYER").toUpperCase();
  const levelProgress =
    gameMode === GAME_MODES.CAMPAIGN
      ? ` (${LEVEL_ORDER.indexOf(currentLevelId) + 1}/${LEVEL_ORDER.length})`
      : "";
  const headerText = `TERMITE RELAY • LEVEL ${currentLevelId}${levelProgress}`;
  drawTextFit(headerText, 52, 62, 22, 255, "#f5e6ad");
  drawTextFit(`PLAYER: ${uppercaseName}`, 318, 62, 17, 180, "#d9f7d8");
  drawText("PODS", 520, 62, 17, "#ffffff");
  const podSize = activeLevel.hudPodIconSize;
  const podSpacing = activeLevel.hudPodIconSpacing;
  let podSlot = 0;
  for (const seed of seeds) {
    for (let unit = 0; unit < seed.weight; unit += 1) {
      const podX = 584 + podSlot * podSpacing;
      drawPodSprite(podX, 62, podSize, seed.collected ? 1 : 0.25);
      podSlot += 1;
    }
  }
  drawText("CARRY", 770, 62, 15, "#ffffff");
  drawPodSprite(835, 62, 24);
  const capacity = effectiveCarryCapacity();
  const capacityBoosted = capacity > CARRY_CAPACITY;
  drawText(`×${capacity}`, 850, 62, 18, capacityBoosted ? "#8dffb0" : "#fff4d2");
  const timerColor = remaining <= 10 ? "#ffbc66" : "#d9f7d8";
  drawText(`${remaining.toFixed(1)}s`, WIDTH - 65, 62, 34, timerColor, "right");
  // Always-visible live score readout. The pod icons above show collection
  // progress; this is the actual point total (frozen the moment the timer
  // hits zero), required to be visible throughout play.
  drawRoundedRect(34, 112, 168, 38, 12, "rgba(20, 68, 65, 0.78)", "#f4cf6a");
  drawText("SCORE", 48, 131, 15, "#ffe9a8", "left");
  drawText(String(score), 188, 131, 22, "#fff6b5", "right");
  if (Math.abs(player.x - (mailbox.x + mailbox.width / 2)) > 260) {
    const direction = mailbox.x + mailbox.width / 2 < player.x ? "<" : ">";
    const distance = Math.ceil(Math.abs(player.x - (mailbox.x + mailbox.width / 2)) / 10) * 10;
    drawRoundedRect(218, 112, 220, 38, 12, "rgba(20, 68, 65, 0.78)", "#78ddae");
    drawText(`NEST ${direction} ${distance}m`, 328, 131, 17, "#fff6b5", "center");
  }
  if (activeLevel.relayRequired > 0) {
    const relayLabel = relayActive
      ? "RELAY OPEN • SAFE RETURN"
      : `RELAY ${Math.min(deliveredPods, activeLevel.relayRequired)}/${activeLevel.relayRequired}`;
    drawRoundedRect(440, 112, 400, 38, 12, relayActive ? "rgba(33, 111, 108, 0.86)" : "rgba(45, 55, 82, 0.86)", "#8fded2");
    drawText(relayLabel, 640, 131, 17, "#d5fff2", "center");
  }
  drawRoundedRect(1052, 112, 190, 38, 12, soundMuted ? "rgba(90, 54, 58, 0.86)" : "rgba(20, 68, 65, 0.78)", "#78ddae");
  drawText(soundMuted ? "SOUND OFF" : "SOUND ON", 1147, 131, 17, "#fff6b5", "center");
  drawMenuButton(945, 42, 130, 40);
  if (remaining <= 10) {
    drawText("HURRY! TIME IS RUNNING OUT", WIDTH / 2, 171, 20, "#ffe0aa", "center");
  }
}

function drawTouchControls() {
  if (!touchControlsActive) {
    return;
  }
  const pressedIds = new Set(activeTouchPointers.values());
  context.save();
  for (const button of TOUCH_BUTTONS) {
    const pressed = pressedIds.has(button.id);
    context.globalAlpha = pressed ? 0.62 : 0.34;
    drawRoundedRect(
      button.x,
      button.y,
      button.w,
      button.h,
      22,
      pressed ? "rgba(120, 221, 174, 0.92)" : "rgba(16, 42, 48, 0.82)",
      "rgba(255, 255, 255, 0.65)"
    );
    context.globalAlpha = pressed ? 1 : 0.85;
    context.fillStyle = "#ffffff";
    const cx = button.x + button.w / 2;
    const cy = button.y + button.h / 2;
    const s = 24;
    context.beginPath();
    if (button.id === "left") {
      context.moveTo(cx + s * 0.5, cy - s);
      context.lineTo(cx - s * 0.7, cy);
      context.lineTo(cx + s * 0.5, cy + s);
    } else if (button.id === "right") {
      context.moveTo(cx - s * 0.5, cy - s);
      context.lineTo(cx + s * 0.7, cy);
      context.lineTo(cx - s * 0.5, cy + s);
    } else {
      context.moveTo(cx, cy - s * 0.7);
      context.lineTo(cx - s, cy + s * 0.5);
      context.lineTo(cx + s, cy + s * 0.5);
    }
    context.closePath();
    context.fill();
  }
  context.restore();
}

function drawRuinsBackdrop() {
  const ruin = context.createLinearGradient(0, 0, 0, HEIGHT);
  ruin.addColorStop(0, "#0d211f");
  ruin.addColorStop(0.52, "#1c3d38");
  ruin.addColorStop(1, "#33544a");
  context.fillStyle = ruin;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.fillStyle = "rgba(20, 60, 52, 0.55)";
  for (let index = -1; index < 8; index += 1) {
    const x = index * 230 - (cameraX * 0.2) % 230 + 60;
    context.fillRect(x, 120, 30, 300);
    context.beginPath();
    context.ellipse(x + 15, 120, 24, 14, 0, 0, Math.PI * 2);
    context.fill();
  }

  context.fillStyle = "rgba(40, 90, 78, 0.4)";
  for (let index = -1; index < 9; index += 1) {
    const x = index * 240 - (cameraX * 0.4) % 240 + 90;
    const height = 130 + ((index * 53) % 90);
    context.beginPath();
    context.moveTo(x - 60, groundY);
    context.lineTo(x - 20, groundY - height);
    context.lineTo(x + 20, groundY - height);
    context.lineTo(x + 60, groundY);
    context.closePath();
    context.fill();
  }

  for (let index = 0; index < 10; index += 1) {
    const x = index * 190 - (cameraX * 0.6) % 190 + 40;
    const y = 260 + ((index * 37) % 130);
    context.fillStyle = index % 2 ? "rgba(120, 200, 180, 0.12)" : "rgba(90, 160, 220, 0.1)";
    context.beginPath();
    context.arc(x, y, 3 + (index % 3), 0, Math.PI * 2);
    context.fill();
  }
}

function drawRuinsGround() {
  const floor = context.createLinearGradient(0, groundY, 0, HEIGHT);
  floor.addColorStop(0, "#3d5347");
  floor.addColorStop(1, "#1c2a22");
  context.fillStyle = floor;
  context.fillRect(0, groundY, WIDTH, HEIGHT - groundY);
  context.fillStyle = "#5f8567";
  context.fillRect(0, groundY - 8, WIDTH, 12);
  context.strokeStyle = "#243329";
  context.lineWidth = 2;
  for (let x = -40; x < WIDTH + 60; x += 92) {
    const offset = ((Math.floor((x + cameraX) / 92) * 21) % 22) - 11;
    context.beginPath();
    context.moveTo(x + offset, groundY - 6);
    context.lineTo(x + 30 + offset, groundY - 11);
    context.lineTo(x + 52 + offset, groundY - 6);
    context.stroke();
  }
}

function drawRuinsShelf(platform, hanging = false) {
  const x = worldX(platform.x);
  if (x + platform.width < 0 || x > WIDTH) {
    return;
  }
  const edgeY = hanging ? platform.y + platform.height : platform.y;
  const bodyY = hanging ? platform.y - 32 : platform.y + 6;
  const bodyHeight = hanging ? platform.height + 32 : Math.max(platform.height + 22, 38);
  drawRoundedRect(x, bodyY, platform.width, bodyHeight, 6, "#4d5f52", "#232f28");
  context.fillStyle = "#7a9a7c";
  context.fillRect(x + 5, edgeY - (hanging ? 3 : 2), platform.width - 10, 6);
  context.strokeStyle = "#3a4c3e";
  context.lineWidth = 2;
  for (let block = 20; block < platform.width - 8; block += 40) {
    context.beginPath();
    context.moveTo(x + block, bodyY + 6);
    context.lineTo(x + block, bodyY + bodyHeight - 6);
    context.stroke();
  }
  context.fillStyle = "rgba(90, 140, 100, 0.35)";
  for (let moss = 10; moss < platform.width - 10; moss += 34) {
    context.beginPath();
    context.arc(x + moss, edgeY - (hanging ? 6 : 4), 5, 0, Math.PI * 2);
    context.fill();
  }
}

function drawEmberBackdrop() {
  const climb = Math.max(0, Math.min(1, cameraY / Math.max(1, worldHeight - HEIGHT)));
  const sky = context.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, lerpColor("#160a08", "#05030a", climb));
  sky.addColorStop(0.5, lerpColor("#3a1610", "#1c0d16", climb));
  sky.addColorStop(1, lerpColor("#6e2612", "#3a1a1c", climb));
  context.fillStyle = sky;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.fillStyle = `rgba(255, 130, 60, ${(0.35 * (1 - climb * 0.6)).toFixed(2)})`;
  context.beginPath();
  context.arc(WIDTH - 200, 150 - cameraY * 0.1, 70, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "rgba(60, 20, 14, 0.7)";
  for (let index = -1; index < 8; index += 1) {
    const bx = index * 260 - (cameraX * 0.18) % 260;
    const by = (((index * 149 - cameraY * 0.18) % 420) + 420) % 420 - 60;
    const height = 160 + ((index * 61) % 120);
    context.beginPath();
    context.moveTo(bx, by + height);
    context.lineTo(bx + 130, by);
    context.lineTo(bx + 260, by + height);
    context.closePath();
    context.fill();
  }

  const now = performance.now();
  context.fillStyle = "rgba(255, 150, 70, 0.5)";
  for (let index = 0; index < 14; index += 1) {
    const baseX = index * 173 - (cameraX * 0.35) % 1180;
    const rise = (now / 20 + index * 90) % 500;
    context.beginPath();
    context.arc(baseX, HEIGHT - rise, 2 + (index % 3), 0, Math.PI * 2);
    context.fill();
  }
}

function drawEmberGround() {
  const groundScreenY = worldY(groundY);
  if (groundScreenY > HEIGHT || groundScreenY + 260 < 0) {
    return;
  }
  const floor = context.createLinearGradient(0, groundScreenY, 0, groundScreenY + 220);
  floor.addColorStop(0, "#241210");
  floor.addColorStop(1, "#0f0806");
  context.fillStyle = floor;
  context.fillRect(0, groundScreenY, WIDTH, Math.max(220, HEIGHT - groundScreenY));
  context.fillStyle = "#ff7a34";
  context.fillRect(0, groundScreenY - 6, WIDTH, 8);
  context.strokeStyle = "rgba(255, 138, 60, 0.55)";
  context.lineWidth = 2;
  for (let x = -30; x < WIDTH + 60; x += 96) {
    const offset = ((Math.floor((x + cameraX) / 96) * 23) % 24) - 12;
    context.beginPath();
    context.moveTo(x + offset, groundScreenY - 4);
    context.lineTo(x + 34 + offset, groundScreenY + 8);
    context.stroke();
  }
}

function drawEmberPlatform(platform, hanging = false) {
  const x = worldX(platform.x);
  const y = worldY(platform.y);
  if (x + platform.width < 0 || x > WIDTH || y + platform.height < -60 || y > HEIGHT + 60) {
    return;
  }
  const edgeY = hanging ? y + platform.height : y;
  const bodyY = hanging ? y - 30 : y + 6;
  const bodyHeight = hanging ? platform.height + 30 : Math.max(platform.height + 22, 38);
  drawRoundedRect(x, bodyY, platform.width, bodyHeight, 6, "#2b1712", "#160b08");
  context.fillStyle = "#ff7a34";
  context.fillRect(x + 5, edgeY - (hanging ? 3 : 2), platform.width - 10, 5);
  context.strokeStyle = "rgba(255, 138, 60, 0.6)";
  context.lineWidth = 2;
  for (let crack = 16; crack < platform.width - 8; crack += 30) {
    context.beginPath();
    context.moveTo(x + crack, bodyY + 8);
    context.lineTo(x + crack + 7, bodyY + bodyHeight - 6);
    context.stroke();
  }
  if (platform.moveAxis) {
    context.fillStyle = "rgba(255, 210, 150, 0.7)";
    context.beginPath();
    context.arc(x + platform.width / 2, edgeY - 10, 3, 0, Math.PI * 2);
    context.fill();
  }
}

const THEMES = Object.freeze({
  meadow: {
    drawBackdrop,
    drawGround,
    drawPlatform,
    drawNest: drawColonyNest,
    drawMenuBackground: () => {
      drawBackdrop();
    },
    decorColors: ["#559550", "#79a958"]
  },
  cave: {
    drawBackdrop: drawCaveBackdrop,
    drawGround: drawCaveGround,
    drawPlatform: drawCaveShelf,
    drawNest: drawColonyNest,
    drawMenuBackground: () => {
      drawCaveBackdrop();
      drawCaveGround();
    },
    decorColors: ["#5b4f77", "#49617c"]
  },
  canopy: {
    drawBackdrop: drawCanopyBackdrop,
    drawGround: drawCanopyGround,
    drawPlatform: drawLeafPlatform,
    drawNest: drawColonyNest,
    drawMenuBackground: () => {
      drawCanopyBackdrop();
      drawCanopyGround();
    },
    decorColors: ["#3f8f52", "#2f6b46"]
  },
  ruins: {
    drawBackdrop: drawRuinsBackdrop,
    drawGround: drawRuinsGround,
    drawPlatform: drawRuinsShelf,
    drawNest: drawColonyNest,
    drawMenuBackground: () => {
      drawRuinsBackdrop();
      drawRuinsGround();
    },
    sapPalette: { pool: "#2c4a44", blob: "#3f7a6e" },
    decorColors: ["#3f7a6e", "#2c5c52"]
  },
  ember: {
    drawBackdrop: drawEmberBackdrop,
    drawGround: drawEmberGround,
    drawPlatform: drawEmberPlatform,
    drawNest: drawColonyNest,
    drawMenuBackground: () => {
      drawEmberBackdrop();
      drawEmberGround();
    },
    decorColors: ["#c9542f", "#8a2f1f"]
  }
});

function getTheme() {
  return THEMES[activeLevel.theme];
}

function drawWorld() {
  const theme = getTheme();
  theme.drawBackdrop();
  theme.drawGround();
  if (activeLevel.relayShortcuts.length) {
    drawRelayShortcuts();
  }
  upperPlatforms.forEach((platform) => theme.drawPlatform(platform));
  lowCeilings.forEach((ceiling) => theme.drawPlatform(ceiling, true));
  if (activeLevel.sapZones.length) {
    drawSapZones();
  }
  if (activeLevel.windZones.length) {
    drawWindZones();
  }
  if (activeLevel.slipZones.length) {
    drawSlipZones();
  }
  if (activeLevel.switches.length) {
    drawSwitches();
  }
  theme.drawNest();
  seeds.forEach(drawSeed);
  pines.forEach(drawPine);
  if (activeLevel.capacityBoosts.length) {
    drawCapacityBoosts();
  }
  if (activeLevel.portals.length) {
    drawPortals();
  }
  activeLevel.stalactites.forEach(drawStalactite);
  pests.forEach((pest) =>
    pest.flying ? (activeLevel.theme === "ember" ? drawEmberSprite(pest) : drawWasp(pest)) : drawPest(pest)
  );
  drawEffects();
  drawPlayer();
  drawVisionMask();
  drawHud();
  drawTouchControls();
}

function drawButton(label, x, y, width, height, highlighted = false) {
  drawRoundedRect(
    x,
    y,
    width,
    height,
    18,
    highlighted ? "#f3bd50" : "#386b50",
    highlighted ? "#fff2ad" : "#84bd8b"
  );
  drawText(label, x + width / 2, y + height / 2, 25, highlighted ? "#24302a" : "#f3f7e9", "center");
}

function drawMenuButton(x, y, width, height) {
  drawRoundedRect(x, y, width, height, 12, "rgba(20, 68, 65, 0.78)", "#78ddae");
  drawText("MENU", x + width / 2, y + height / 2, 16, "#fff6b5", "center");
}

function drawMenuBackground() {
  const theme = getTheme();
  theme.drawMenuBackground();
  context.fillStyle = "rgba(10, 40, 43, 0.58)";
  context.fillRect(0, 0, WIDTH, HEIGHT);
  for (let index = 0; index < 14; index += 1) {
    const x = 60 + ((index * 173) % 1180);
    const y = 150 + ((index * 97) % 470);
    context.fillStyle = theme.decorColors[index % 2];
    context.beginPath();
    context.arc(x, y, 42 + (index % 3) * 12, 0, Math.PI * 2);
    context.fill();
  }
}

function drawWelcome() {
  drawMenuBackground();
  drawRoundedRect(170, 100, 940, 525, 36, "rgba(255, 247, 215, 0.96)", "#eabf55");
  drawText("TERMITE", WIDTH / 2, 196, 67, "#305d3d", "center");
  drawText("RELAY", WIDTH / 2, 268, 72, "#d06c36", "center");
  drawText("Two cave levels • pick a single level or run the Full Relay", WIDTH / 2, 326, 24, "#40504a", "center");
  drawText("TYPE YOUR NAME", WIDTH / 2, 404, 18, "#607065", "center");
  drawRoundedRect(315, 430, 650, 64, 14, "#fdfcf3", "#77986d");
  drawText(nameDraft || "Your name", WIDTH / 2, 462, 31, nameDraft ? "#1e3a31" : "#93a099", "center");
  if (pulse % 1000 < 500) {
    const textWidth = context.measureText(nameDraft || "Your name").width;
    context.fillStyle = "#315d45";
    context.fillRect(WIDTH / 2 + textWidth / 2 + 8, 442, 3, 37);
  }
  drawButton("CONTINUE", 470, 528, 340, 68, true);
  drawText("Press Enter to continue", WIDTH / 2, 646, 17, "#f3f1da", "center");
}

function levelSelectLayout() {
  const count = LEVEL_RUN_ORDER.length;
  const compact = count > 3;
  const startY = compact ? 270 : 288;
  const spacing = compact ? 66 : 96;
  return {
    startY,
    spacing,
    buttonWidth: 680,
    buttonHeight: compact ? 58 : 72,
    panelHeight: compact ? 600 : 525,
    backY: compact ? startY + count * spacing + 14 : 560
  };
}

function drawMenu() {
  drawMenuBackground();
  if (menuStep === "leaderboard") {
    drawLeaderboardScreen();
    return;
  }
  const panelHeight = menuStep === "levelSelect" ? levelSelectLayout().panelHeight : 560;
  drawRoundedRect(170, 100, 940, panelHeight, 36, "rgba(255, 247, 215, 0.96)", "#eabf55");
  drawText("CHOOSE YOUR RUN", WIDTH / 2, 158, 44, "#305d3d", "center");
  drawText(`WELCOME, ${(playerName || "PLAYER").toUpperCase()}`, WIDTH / 2, 204, 19, "#607065", "center");

  if (menuStep === "mode") {
    drawButton("FULL RELAY", 380, 274, 520, 84, true);
    drawText(
      "Play every level back-to-back. Miss a level's pod minimum and the relay restarts from Level 1.",
      WIDTH / 2,
      382,
      16,
      "#4a5b4c",
      "center"
    );
    drawButton("LEVEL RUN", 380, 424, 520, 84);
    drawText("Practice a single level on its own. No leaderboard entry.", WIDTH / 2, 532, 16, "#4a5b4c", "center");
    drawButton("LEADERBOARD", MENU_LEADERBOARD_BUTTON.x, MENU_LEADERBOARD_BUTTON.y, MENU_LEADERBOARD_BUTTON.w, MENU_LEADERBOARD_BUTTON.h);
  } else {
    drawText("SELECT A LEVEL", WIDTH / 2, 250, 24, "#c45b34", "center");
    const layout = levelSelectLayout();
    LEVEL_RUN_ORDER.forEach((levelId, index) => {
      const y = layout.startY + index * layout.spacing;
      drawButton(`LEVEL ${levelId} — ${LEVELS[levelId].title}`, 300, y, layout.buttonWidth, layout.buttonHeight, true);
    });
    drawButton("BACK", 470, layout.backY, 340, 58);
  }
}

function drawInstructions() {
  drawMenuBackground();
  drawRoundedRect(135, 72, 1010, 580, 32, "rgba(255, 247, 215, 0.97)", "#eabf55");
  drawText(`LEVEL ${currentLevelId}: ${activeLevel.title}`, WIDTH / 2, 122, 42, "#315d45", "center");
  const modeLabel =
    gameMode === GAME_MODES.CAMPAIGN
      ? `FULL RELAY • LEVEL ${LEVEL_ORDER.indexOf(currentLevelId) + 1} OF ${LEVEL_ORDER.length}`
      : "LEVEL RUN";
  drawText(modeLabel, WIDTH / 2, 156, 17, "#8a6a2e", "center");
  if (gameMode === GAME_MODES.CAMPAIGN && campaignScore > 0) {
    drawText(
      `Relay total so far: ${campaignScore} pts • ${formatCompletionTime(campaignTimeTotal)}`,
      WIDTH / 2,
      180,
      15,
      "#4a5b4c",
      "center"
    );
  }
  const layout = activeLevel.instructionsLayout;
  const lines = [
    ["MOVE", "A / D or Left / Right"],
    ["JUMP", "Tap or hold W / Up"],
    ["GOAL", `Deliver at least ${activeLevel.minPods} of ${activeLevel.totalPodValue} ${activeLevel.podLabel.toLowerCase()} pods to the nest`],
    ...activeLevel.instructionLines,
    ["CAPACITY", "Carry up to two pods at once"]
  ];
  lines.forEach(([label, value], index) => {
    const y = layout.startY + index * layout.lineHeight;
    drawText(label, 270, y, 20, "#c45b34", "right");
    drawText(value, 305, y, layout.valueFontSize, "#2d4738");
  });
  drawText(activeLevel.flavorText, WIDTH / 2, 500, layout.flavorFontSize, "#4a5b4c", "center");
  drawButton(`START LEVEL ${currentLevelId}`, 410, 570, 460, 62, true);
  drawMenuButton(985, 10, 150, 38);
}

// Shared Full Relay leaderboard table, used by both the game-over screen and
// the standalone leaderboard screen. `headerY` is the y of the column headers.
function drawLeaderboardTable(entries, headerY, limit) {
  drawText("SCORE", 780, headerY, 15, "#69746a", "right");
  drawText("TIME", 920, headerY, 15, "#69746a", "right");
  drawText("LVL", 1000, headerY, 15, "#69746a", "right");
  const sorted = sortCampaignEntries(entries);
  const rowStart = headerY + 29;
  sorted.slice(0, limit).forEach((entry, index) => {
    const y = rowStart + index * 30;
    drawText(`${index + 1}.`, 330, y, 19, "#57715d", "right");
    drawText(entry.name, 358, y, 19, "#2d4738");
    drawText(String(entry.score), 780, y, 19, "#315d45", "right");
    drawText(formatCompletionTime(entry.completionSeconds), 920, y, 19, "#4d5e52", "right");
    drawText(
      entry.outcome === "completed" ? `${entry.finalLevel}✓` : String(entry.finalLevel),
      1000,
      y,
      19,
      "#4d5e52",
      "right"
    );
  });
  if (sorted.length === 0) {
    drawText("No Full Relay runs recorded yet.", WIDTH / 2, rowStart + 38, 20, "#69746a", "center");
  }
}

// The two-tap "clear leaderboard" pill; label reflects the pending confirm.
function drawClearButton(button) {
  const confirming = performance.now() < leaderboardClearConfirmUntil;
  drawRoundedRect(
    button.x,
    button.y,
    button.w,
    button.h,
    10,
    confirming ? "rgba(169, 52, 69, 0.92)" : "rgba(120, 105, 70, 0.5)",
    confirming ? "#ffd4da" : "#b89a5a"
  );
  drawText(
    confirming ? "CONFIRM?" : "CLEAR",
    button.x + button.w / 2,
    button.y + button.h / 2,
    15,
    "#fff3d6",
    "center"
  );
}

function drawLeaderboardScreen() {
  drawRoundedRect(170, 90, 940, 560, 34, "rgba(255, 247, 215, 0.97)", "#eabf55");
  drawText("LEADERBOARD", WIDTH / 2, 138, 42, "#305d3d", "center");
  drawText("FULL RELAY — LOCAL TOP 10", WIDTH / 2, 180, 20, "#c45b34", "center");
  const entries = loadCampaignLeaderboard();
  if (playerName) {
    drawText(`Your best total score: ${campaignPersonalBest(entries)}`, WIDTH / 2, 208, 17, "#4d5e52", "center");
  }
  drawLeaderboardTable(entries, 238, LEADERBOARD_LIMIT);
  if (entries.length > 0) {
    drawClearButton(LEADERBOARD_CLEAR_BUTTON);
  }
  drawButton("BACK", LEADERBOARD_BACK_BUTTON.x, LEADERBOARD_BACK_BUTTON.y, LEADERBOARD_BACK_BUTTON.w, LEADERBOARD_BACK_BUTTON.h, true);
}

function drawGameOver() {
  drawMenuBackground();
  drawRoundedRect(160, 55, 960, 615, 34, "rgba(255, 247, 215, 0.97)", "#eabf55");

  if (gameMode === GAME_MODES.CAMPAIGN) {
    const completed = campaignOutcome === "completed";
    drawText(
      completed ? "FULL RELAY COMPLETE!" : `RUN ENDED — LEVEL ${campaignFinalLevel} REACHED`,
      WIDTH / 2,
      112,
      completed ? 44 : 36,
      "#c95e34",
      "center"
    );
    drawText(
      `${playerName} — total score ${campaignScore} in ${formatCompletionTime(campaignTimeTotal)}`,
      WIDTH / 2,
      168,
      26,
      "#315d45",
      "center"
    );
    if (!completed) {
      drawText(
        `Level ${campaignFinalLevel} needed ${LEVELS[campaignFinalLevel].minPods} pods delivered to continue.`,
        WIDTH / 2,
        202,
        18,
        "#8a4b34",
        "center"
      );
    }
    const entries = loadCampaignLeaderboard();
    const best = campaignPersonalBest(entries);
    drawText(`Personal best total score: ${best}`, WIDTH / 2, completed ? 210 : 234, 19, "#4d5e52", "center");
    drawText("FULL RELAY — LOCAL TOP 10", WIDTH / 2, 284, 22, "#c45b34", "center");
    drawLeaderboardTable(entries, 313, 8);
    if (entries.length > 0) {
      drawClearButton(CLEAR_LEADERBOARD_BUTTON);
    }
    drawButton("RESTART RELAY", 308, 587, 280, 58, true);
    drawButton("MENU", 692, 587, 280, 58);
  } else {
    drawText(runCompleted ? `LEVEL ${currentLevelId} COMPLETE!` : "TIME'S UP!", WIDTH / 2, 148, 48, "#c95e34", "center");
    drawText(
      `${playerName} scored ${score} in ${formatCompletionTime(completionSeconds)}`,
      WIDTH / 2,
      216,
      28,
      "#315d45",
      "center"
    );
    drawText(
      `${deliveredPods}/${activeLevel.totalPodValue} pods delivered • needed ${activeLevel.minPods} to pass`,
      WIDTH / 2,
      262,
      19,
      "#4d5e52",
      "center"
    );
    drawText("Level Run mode — no leaderboard entry for solo practice.", WIDTH / 2, 308, 17, "#7d7c68", "center");
    drawButton("REPLAY", 308, 587, 280, 58, true);
    drawButton("MENU", 692, 587, 280, 58);
  }
}

function draw() {
  context.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
  context.clearRect(0, 0, WIDTH, HEIGHT);
  if (state === STATES.WELCOME) {
    drawWelcome();
  } else if (state === STATES.MENU) {
    drawMenu();
  } else if (state === STATES.INSTRUCTIONS) {
    drawInstructions();
  } else if (state === STATES.PLAYING) {
    drawWorld();
  } else {
    drawGameOver();
  }
}

function getCanvasPosition(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - bounds.left) / bounds.width) * WIDTH,
    y: ((event.clientY - bounds.top) / bounds.height) * HEIGHT
  };
}

function inside(point, x, y, width, height) {
  return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
}

function handleActivate() {
  if (state === STATES.WELCOME) {
    const validName = normaliseName(nameDraft);
    if (!validName) {
      message = "Enter a name before continuing.";
      setStatus(message);
      return;
    }
    playerName = validName;
    nameDraft = validName;
    goToMenu();
    setStatus(`Welcome ${playerName}. Choose Full Relay or Level Run.`);
  } else if (state === STATES.INSTRUCTIONS) {
    startRun();
  } else if (state === STATES.GAME_OVER) {
    if (gameMode === GAME_MODES.CAMPAIGN) {
      restartCampaign();
    } else {
      startRun();
    }
  }
}

function returnToWelcome() {
  selectLevel(1);
  changeScreen(STATES.WELCOME);
}

function keyIsGameplayControl(key) {
  return ["arrowleft", "arrowright", "arrowup", "arrowdown", " ", "alt", "a", "d", "w", "s"].includes(key);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  // When the mobile name-entry input is focused, let it handle typing
  // natively (including spaces) — don't preventDefault or double-process.
  const nameInputFocused = document.activeElement === nameInput;
  if (
    !nameInputFocused &&
    (keyIsGameplayControl(key) || key === "enter" || key === "escape" || key === "backspace")
  ) {
    event.preventDefault();
  }

  if (state === STATES.WELCOME) {
    if (nameInputFocused) {
      return;
    }
    if (key === "enter") {
      handleActivate();
      return;
    }
    if (key === "backspace") {
      nameDraft = nameDraft.slice(0, -1);
      return;
    }
    if (event.key.length === 1 && nameDraft.length < NAME_MAX_LENGTH) {
      nameDraft += event.key;
    }
    return;
  }

  if (state === STATES.MENU) {
    if (key === "escape") {
      if (menuStep === "levelSelect" || menuStep === "leaderboard") {
        menuStep = "mode";
      } else {
        returnToWelcome();
      }
    }
    return;
  }

  if (state === STATES.INSTRUCTIONS) {
    if (key === "enter") {
      handleActivate();
    } else if (key === "escape") {
      goToMenu();
    }
    return;
  }

  if (state === STATES.GAME_OVER) {
    if (key === "enter" || key === "r") {
      handleActivate();
    } else if (key === "escape") {
      goToMenu();
    }
    return;
  }

  if (state === STATES.PLAYING && key === "escape") {
    finishRun();
    return;
  }

  if (!input.held.has(key)) {
    input.pressed.add(key);
  }
  input.held.add(key);
});

window.addEventListener("keyup", (event) => {
  input.held.delete(event.key.toLowerCase());
});

function positionNameInput() {
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width / WIDTH;
  const scaleY = rect.height / HEIGHT;
  nameInput.style.left = `${rect.left + NAME_BOX.x * scaleX}px`;
  nameInput.style.top = `${rect.top + NAME_BOX.y * scaleY}px`;
  nameInput.style.width = `${NAME_BOX.w * scaleX}px`;
  nameInput.style.height = `${NAME_BOX.h * scaleY}px`;
}

function showNameInput() {
  nameInput.value = nameDraft;
  nameInput.style.display = "block";
  positionNameInput();
}

function hideNameInput() {
  nameInput.style.display = "none";
  if (document.activeElement === nameInput) {
    nameInput.blur();
  }
}

// Keep the canvas-drawn name in sync with whatever the soft keyboard types.
nameInput.addEventListener("input", () => {
  if (state === STATES.WELCOME) {
    nameDraft = nameInput.value.slice(0, NAME_MAX_LENGTH);
  }
});
nameInput.addEventListener("focus", () => {
  nameInput.value = nameDraft;
});
nameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleActivate();
  }
});
window.addEventListener("resize", () => {
  if (state === STATES.WELCOME && nameInput.style.display === "block") {
    positionNameInput();
  }
});

function isFullscreen() {
  return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
}

function updateFullscreenButton() {
  // ⛶ = enter, ⤢ = exit.
  fullscreenButton.textContent = isFullscreen() ? "⤢" : "⛶";
}

async function toggleFullscreen() {
  try {
    if (!isFullscreen()) {
      const root = document.documentElement;
      if (root.requestFullscreen) {
        await root.requestFullscreen();
      } else if (root.webkitRequestFullscreen) {
        root.webkitRequestFullscreen();
      }
      // Best-effort landscape lock; harmless if unsupported or rejected.
      if (screen.orientation && screen.orientation.lock) {
        try {
          await screen.orientation.lock("landscape");
        } catch {
          // Orientation lock isn't available on all browsers/devices.
        }
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  } catch {
    // Fullscreen can be blocked by the browser; nothing else to do.
  }
  updateFullscreenButton();
}

if (isTouchDevice) {
  fullscreenButton.style.display = "flex";
}
fullscreenButton.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", updateFullscreenButton);
document.addEventListener("webkitfullscreenchange", updateFullscreenButton);

function isPointOverClickable(point) {
  if (state === STATES.WELCOME) {
    return inside(point, 470, 528, 340, 68);
  }
  if (state === STATES.MENU) {
    if (menuStep === "mode") {
      return (
        inside(point, 380, 274, 520, 84) ||
        inside(point, 380, 424, 520, 84) ||
        inside(point, MENU_LEADERBOARD_BUTTON.x, MENU_LEADERBOARD_BUTTON.y, MENU_LEADERBOARD_BUTTON.w, MENU_LEADERBOARD_BUTTON.h)
      );
    }
    if (menuStep === "leaderboard") {
      const overClear =
        loadCampaignLeaderboard().length > 0 &&
        inside(point, LEADERBOARD_CLEAR_BUTTON.x, LEADERBOARD_CLEAR_BUTTON.y, LEADERBOARD_CLEAR_BUTTON.w, LEADERBOARD_CLEAR_BUTTON.h);
      return (
        overClear ||
        inside(point, LEADERBOARD_BACK_BUTTON.x, LEADERBOARD_BACK_BUTTON.y, LEADERBOARD_BACK_BUTTON.w, LEADERBOARD_BACK_BUTTON.h)
      );
    }
    const layout = levelSelectLayout();
    return (
      LEVEL_RUN_ORDER.some((levelId, index) =>
        inside(point, 300, layout.startY + index * layout.spacing, layout.buttonWidth, layout.buttonHeight)
      ) || inside(point, 470, layout.backY, 340, 58)
    );
  }
  if (state === STATES.INSTRUCTIONS) {
    return inside(point, 410, 570, 460, 62) || inside(point, 985, 10, 150, 38);
  }
  if (state === STATES.PLAYING) {
    return inside(point, 1052, 112, 190, 38) || inside(point, 945, 42, 130, 40);
  }
  if (state === STATES.GAME_OVER) {
    const clearButton = CLEAR_LEADERBOARD_BUTTON;
    const overClear =
      gameMode === GAME_MODES.CAMPAIGN &&
      inside(point, clearButton.x, clearButton.y, clearButton.w, clearButton.h);
    return overClear || inside(point, 308, 587, 280, 58) || inside(point, 692, 587, 280, 58);
  }
  return false;
}

function endTouchPointer(event) {
  if (!activeTouchPointers.has(event.pointerId)) {
    return;
  }
  const buttonId = activeTouchPointers.get(event.pointerId);
  activeTouchPointers.delete(event.pointerId);
  const button = TOUCH_BUTTONS.find((candidate) => candidate.id === buttonId);
  if (button) {
    releaseTouchKey(button.key);
  }
  if (canvas.hasPointerCapture && canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
}

canvas.addEventListener("pointermove", (event) => {
  const point = getCanvasPosition(event);
  // A touch pointer that started on a control can slide between buttons
  // (e.g. left <-> right) or slide off entirely, updating the held key.
  if (state === STATES.PLAYING && activeTouchPointers.has(event.pointerId)) {
    const previousId = activeTouchPointers.get(event.pointerId);
    const nextButton = touchButtonAt(point);
    const nextId = nextButton ? nextButton.id : null;
    if (nextId !== previousId) {
      const previousButton = TOUCH_BUTTONS.find((candidate) => candidate.id === previousId);
      activeTouchPointers.set(event.pointerId, nextId);
      if (previousButton) {
        releaseTouchKey(previousButton.key);
      }
      if (nextButton) {
        pressTouchKey(nextButton.key);
      }
    }
    return;
  }
  canvas.style.cursor = isPointOverClickable(point) ? "pointer" : "default";
});

canvas.addEventListener("pointerup", endTouchPointer);
canvas.addEventListener("pointercancel", endTouchPointer);

canvas.addEventListener("pointerleave", () => {
  canvas.style.cursor = "default";
});

canvas.addEventListener("pointerdown", (event) => {
  canvas.focus();
  const point = getCanvasPosition(event);
  if (event.pointerType === "touch") {
    touchControlsActive = true;
  }
  if (state === STATES.PLAYING) {
    const touchButton = touchControlsActive ? touchButtonAt(point) : null;
    if (touchButton) {
      activeTouchPointers.set(event.pointerId, touchButton.id);
      pressTouchKey(touchButton.key);
      if (canvas.setPointerCapture) {
        try {
          canvas.setPointerCapture(event.pointerId);
        } catch {
          // Pointer capture is best-effort; ignore if unsupported.
        }
      }
      return;
    }
    if (inside(point, 1052, 112, 190, 38)) {
      toggleSound();
    } else if (inside(point, 945, 42, 130, 40)) {
      goToMenu();
    }
  } else if (state === STATES.WELCOME && inside(point, 470, 528, 340, 68)) {
    handleActivate();
  } else if (state === STATES.WELCOME && inside(point, NAME_BOX.x, NAME_BOX.y, NAME_BOX.w, NAME_BOX.h)) {
    // Tapping the name box focuses the overlay input, which summons the
    // on-screen keyboard on touch devices (focus must happen in this gesture).
    showNameInput();
    nameInput.focus();
  } else if (state === STATES.MENU) {
    if (menuStep === "mode") {
      if (inside(point, 380, 274, 520, 84)) {
        startCampaign();
      } else if (inside(point, 380, 424, 520, 84)) {
        menuStep = "levelSelect";
      } else if (inside(point, MENU_LEADERBOARD_BUTTON.x, MENU_LEADERBOARD_BUTTON.y, MENU_LEADERBOARD_BUTTON.w, MENU_LEADERBOARD_BUTTON.h)) {
        menuStep = "leaderboard";
      }
    } else if (menuStep === "leaderboard") {
      if (
        loadCampaignLeaderboard().length > 0 &&
        inside(point, LEADERBOARD_CLEAR_BUTTON.x, LEADERBOARD_CLEAR_BUTTON.y, LEADERBOARD_CLEAR_BUTTON.w, LEADERBOARD_CLEAR_BUTTON.h)
      ) {
        handleClearLeaderboardTap();
      } else if (inside(point, LEADERBOARD_BACK_BUTTON.x, LEADERBOARD_BACK_BUTTON.y, LEADERBOARD_BACK_BUTTON.w, LEADERBOARD_BACK_BUTTON.h)) {
        menuStep = "mode";
      }
    } else {
      const layout = levelSelectLayout();
      const pickedLevel = LEVEL_RUN_ORDER.find((levelId, index) =>
        inside(point, 300, layout.startY + index * layout.spacing, layout.buttonWidth, layout.buttonHeight)
      );
      if (pickedLevel) {
        startLevelMode(pickedLevel);
      } else if (inside(point, 470, layout.backY, 340, 58)) {
        menuStep = "mode";
      }
    }
  } else if (state === STATES.INSTRUCTIONS) {
    if (inside(point, 410, 570, 460, 62)) {
      startRun();
    } else if (inside(point, 985, 10, 150, 38)) {
      goToMenu();
    }
  } else if (state === STATES.GAME_OVER) {
    const clearButton = CLEAR_LEADERBOARD_BUTTON;
    if (
      gameMode === GAME_MODES.CAMPAIGN &&
      loadCampaignLeaderboard().length > 0 &&
      inside(point, clearButton.x, clearButton.y, clearButton.w, clearButton.h)
    ) {
      handleClearLeaderboardTap();
    } else if (inside(point, 308, 587, 280, 58)) {
      if (gameMode === GAME_MODES.CAMPAIGN) {
        restartCampaign();
      } else {
        startRun();
      }
    } else if (inside(point, 692, 587, 280, 58)) {
      goToMenu();
    }
  }
});

function gameLoop(now) {
  const delta = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  pulse = now;
  if (state === STATES.PLAYING) {
    updateWorld(delta);
  }
  draw();
  // Keep the mobile name-entry overlay shown only on the welcome screen.
  if (state === STATES.WELCOME) {
    if (nameInput.style.display !== "block") {
      showNameInput();
    }
  } else if (nameInput.style.display === "block") {
    hideNameInput();
  }
  // Hide the fullscreen button during play so it can't overlap the HUD;
  // fullscreen itself persists across screens. It stays available on the
  // welcome/menu/instructions/result screens.
  if (isTouchDevice) {
    fullscreenButton.style.display = state === STATES.PLAYING ? "none" : "flex";
  }
  input.pressed.clear();
  requestAnimationFrame(gameLoop);
}

canvas.focus();
setStatus("Termite Relay ready. Type a player name, then press Enter.");
requestAnimationFrame(gameLoop);
