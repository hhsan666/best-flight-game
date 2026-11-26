// Pilot settings and best results, kept in this browser's localStorage when it is available
// (private windows and blocked storage simply start fresh each time).

const SETTINGS_KEY = 'skerrywind.settings.v1';
const PROGRESS_KEY = 'skerrywind.progress.v1';

export const DEFAULT_SETTINGS = { invertPitch: false, mouseSensitivity: 1, volume: 0.7, hudScale: 1, assist: true };

function read(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : { ...fallback };
  } catch {
    return { ...fallback };
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: keep playing without saving */
  }
}

export const loadSettings = () => read(SETTINGS_KEY, DEFAULT_SETTINGS);
export const saveSettings = (settings) => write(SETTINGS_KEY, settings);
export const loadProgress = () => read(PROGRESS_KEY, {});

const MEDAL_RANK = { gold: 3, silver: 2, bronze: 1 };

/** Keeps the best score and medal per mission; returns true when this run set a new best. */
export function recordResult(progress, missionId, card) {
  const best = progress[missionId];
  const better = !best || card.total > best.score;
  if (better) progress[missionId] = { score: card.total, medal: (MEDAL_RANK[card.medal] ?? 0) >= (MEDAL_RANK[best?.medal] ?? 0) ? card.medal : best.medal };
  write(PROGRESS_KEY, progress);
  return better;
}
