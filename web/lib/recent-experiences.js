export const RECENT_EXPERIENCES_STORAGE_KEY = 'monti_recent_experiences_v1';
export const MAX_RECENT_EXPERIENCES = 10;

/**
 * @typedef {{
 *   id: string;
 *   title: string;
 *   prompt: string;
 *   createdAt: string;
 *   experience: {
 *     title: string;
 *     description: string;
 *     html: string;
 *     css: string;
 *     js: string;
 *   };
 * }} RecentExperience
 */

/**
 * @param {Storage | undefined | null} storage
 * @returns {RecentExperience[]}
 */
export function loadRecentExperiences(storage = getBrowserStorage()) {
  if (!storage) {
    return [];
  }

  const raw = storage.getItem(RECENT_EXPERIENCES_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return normalizeRecentExperiences(parsed);
  } catch {
    return [];
  }
}

/**
 * @param {RecentExperience} item
 * @param {Storage | undefined | null} storage
 * @returns {RecentExperience[]}
 */
export function saveRecentExperience(item, storage = getBrowserStorage()) {
  if (!storage) {
    return [];
  }

  const current = loadRecentExperiences(storage);
  const deduped = current.filter((existing) => existing.id !== item.id);
  const next = [item, ...deduped].slice(0, MAX_RECENT_EXPERIENCES);
  storage.setItem(RECENT_EXPERIENCES_STORAGE_KEY, JSON.stringify(next));
  return next;
}

/**
 * @param {string} id
 * @param {Storage | undefined | null} storage
 * @returns {RecentExperience | null}
 */
export function findRecentExperienceById(id, storage = getBrowserStorage()) {
  return loadRecentExperiences(storage).find((item) => item.id === id) ?? null;
}

/**
 * @param {unknown} value
 * @returns {RecentExperience[]}
 */
function normalizeRecentExperiences(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => isValidRecentExperience(item))
    .slice(0, MAX_RECENT_EXPERIENCES);
}

/**
 * @param {unknown} value
 * @returns {value is RecentExperience}
 */
function isValidRecentExperience(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = /** @type {Record<string, unknown>} */ (value);
  const experience = candidate.experience;

  if (!experience || typeof experience !== 'object') {
    return false;
  }

  const payload = /** @type {Record<string, unknown>} */ (experience);

  return (
    typeof candidate.id === 'string' &&
    candidate.id.length > 0 &&
    typeof candidate.title === 'string' &&
    candidate.title.length > 0 &&
    typeof candidate.prompt === 'string' &&
    candidate.prompt.length > 0 &&
    typeof candidate.createdAt === 'string' &&
    candidate.createdAt.length > 0 &&
    typeof payload.title === 'string' &&
    typeof payload.description === 'string' &&
    typeof payload.html === 'string' &&
    typeof payload.css === 'string' &&
    typeof payload.js === 'string'
  );
}

/**
 * @returns {Storage | undefined}
 */
function getBrowserStorage() {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return undefined;
  }

  return window.localStorage;
}
