import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findRecentExperienceById,
  MAX_RECENT_EXPERIENCES,
  loadRecentExperiences,
  saveRecentExperience,
} from './recent-experiences.js';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, value);
    },
    removeItem(key) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
  };
}

function buildExperience(id) {
  return {
    id: `id-${id}`,
    title: `Experience ${id}`,
    prompt: `Prompt ${id}`,
    createdAt: `2026-03-14T00:00:0${id}.000Z`,
    experience: {
      title: `Title ${id}`,
      description: `Description ${id}`,
      html: '<main>hi</main>',
      css: 'main{color:red;}',
      js: 'console.log("ok");',
    },
  };
}

test('saveRecentExperience enforces max history size', () => {
  const storage = createMemoryStorage();

  for (let i = 0; i < MAX_RECENT_EXPERIENCES + 2; i += 1) {
    saveRecentExperience(buildExperience(i), storage);
  }

  const all = loadRecentExperiences(storage);
  assert.equal(all.length, MAX_RECENT_EXPERIENCES);
  assert.equal(all[0].id, `id-${MAX_RECENT_EXPERIENCES + 1}`);
  assert.equal(all.at(-1)?.id, 'id-2');
});

test('findRecentExperienceById reopens a saved entry', () => {
  const storage = createMemoryStorage();
  saveRecentExperience(buildExperience(7), storage);

  const reopened = findRecentExperienceById('id-7', storage);
  assert.ok(reopened);
  assert.equal(reopened?.title, 'Experience 7');
  assert.equal(reopened?.experience.title, 'Title 7');
});
