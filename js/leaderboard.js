// Local "Full Relay" leaderboard persistence and ranking.
//
// This module is self-contained: it owns the storage key and ranking rules and
// exposes small pure-ish functions. Game-specific values it needs (the name
// length limit and the lowest valid level) are passed in by the caller so this
// module has no dependency back on the main game module.

export const CAMPAIGN_STORAGE_KEY =
  "ust-gamecraft-2026-termite-courier-campaign-leaderboard-v1";
export const LEADERBOARD_LIMIT = 10;

export function formatCompletionTime(seconds) {
  return `${Math.max(0, seconds).toFixed(1)}s`;
}

function isValidEntry(entry, maxNameLength, minLevel) {
  return (
    entry &&
    typeof entry === "object" &&
    typeof entry.name === "string" &&
    entry.name.trim().length > 0 &&
    entry.name.length <= maxNameLength &&
    Number.isInteger(entry.score) &&
    entry.score >= 0 &&
    Number.isFinite(entry.completionSeconds) &&
    entry.completionSeconds >= 0 &&
    Number.isInteger(entry.finalLevel) &&
    entry.finalLevel >= minLevel &&
    Number.isFinite(entry.timestamp)
  );
}

function normaliseEntry(entry, maxNameLength, minLevel) {
  if (!isValidEntry(entry, maxNameLength, minLevel)) {
    return null;
  }
  return {
    name: entry.name.trim().slice(0, maxNameLength),
    score: entry.score,
    completionSeconds: entry.completionSeconds,
    finalLevel: entry.finalLevel,
    outcome: entry.outcome === "completed" ? "completed" : "failed",
    timestamp: entry.timestamp
  };
}

export function sortCampaignEntries(entries) {
  return [...entries].sort(
    (first, second) =>
      second.score - first.score ||
      first.completionSeconds - second.completionSeconds ||
      second.timestamp - first.timestamp
  );
}

// `config` is { maxNameLength, minLevel }.
export function loadCampaignLeaderboard(config) {
  try {
    const raw = localStorage.getItem(CAMPAIGN_STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(data)) {
      return [];
    }
    return data
      .map((entry) => normaliseEntry(entry, config.maxNameLength, config.minLevel))
      .filter(Boolean);
  } catch {
    return [];
  }
}

// Appends `entry`, re-ranks, trims to the top LEADERBOARD_LIMIT and persists.
// Returns the stored top entries. `config` is { maxNameLength, minLevel }.
export function saveCampaignEntry(entry, config) {
  const entries = loadCampaignLeaderboard(config);
  entries.push(entry);
  const topEntries = sortCampaignEntries(entries).slice(0, LEADERBOARD_LIMIT);
  try {
    localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(topEntries));
  } catch {
    // The completed run remains playable if persistent storage is unavailable.
  }
  return topEntries;
}

export function campaignPersonalBest(entries, playerName) {
  const key = playerName.toLocaleLowerCase();
  return entries
    .filter((entry) => entry.name.toLocaleLowerCase() === key)
    .reduce((best, entry) => Math.max(best, entry.score), 0);
}

export function clearCampaignLeaderboard() {
  try {
    localStorage.removeItem(CAMPAIGN_STORAGE_KEY);
  } catch {
    // Nothing else to do if storage is unavailable.
  }
}
