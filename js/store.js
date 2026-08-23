/* store.js — localStorage persistence. All learning data stays on-device. */
"use strict";

const Store = (() => {
  const KEYS = {
    progress: "dd.progress.v1",
    settings: "dd.settings.v1",
    customDecks: "dd.customDecks.v1",
    newCount: "dd.newCount.v1",
  };

  const DEFAULT_SETTINGS = {
    direction: "de-en",
    rate: 0.8,
    voiceURI: null,
    selectedDecks: [],
    newPerDay: 20,
    theme: "system",
  };

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      console.warn("store: corrupt entry for", key, e);
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      alert("Could not save data (storage full or blocked): " + e.message);
      return false;
    }
  }

  // ---- progress: { [cardId]: rec } ----
  let progress = readJSON(KEYS.progress, {});

  function getRec(id) { return progress[id] || null; }
  function setRec(id, rec) { progress[id] = rec; writeJSON(KEYS.progress, progress); }
  function allProgress() { return progress; }
  function replaceProgress(map) { progress = map; writeJSON(KEYS.progress, progress); }
  function deleteRecs(ids) {
    for (const id of ids) delete progress[id];
    writeJSON(KEYS.progress, progress);
  }

  // ---- settings ----
  let settings = Object.assign({}, DEFAULT_SETTINGS, readJSON(KEYS.settings, {}));
  function getSettings() { return settings; }
  function saveSettings(patch) {
    Object.assign(settings, patch);
    writeJSON(KEYS.settings, settings);
  }

  // ---- custom (manually imported) decks: { [deckId]: {meta, cards} } ----
  let customDecks = readJSON(KEYS.customDecks, {});
  function getCustomDecks() { return customDecks; }
  function saveCustomDeck(deckId, meta, cards) {
    customDecks[deckId] = { meta, cards };
    return writeJSON(KEYS.customDecks, customDecks);
  }
  function deleteCustomDeck(deckId) {
    delete customDecks[deckId];
    writeJSON(KEYS.customDecks, customDecks);
  }

  // ---- daily new-card counter ----
  function todayStr() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function newIntroducedToday() {
    const rec = readJSON(KEYS.newCount, null);
    return rec && rec.date === todayStr() ? rec.count : 0;
  }
  function bumpNewIntroduced() {
    const count = newIntroducedToday() + 1;
    writeJSON(KEYS.newCount, { date: todayStr(), count });
  }

  // ---- backup ----
  function exportAll() {
    return {
      app: "deutsch-decks",
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      progress,
      settings,
      customDecks,
    };
  }

  function resetAll() {
    for (const k of Object.values(KEYS)) localStorage.removeItem(k);
    progress = {};
    settings = Object.assign({}, DEFAULT_SETTINGS);
    customDecks = {};
  }

  return {
    getRec, setRec, allProgress, replaceProgress, deleteRecs,
    getSettings, saveSettings,
    getCustomDecks, saveCustomDeck, deleteCustomDeck,
    newIntroducedToday, bumpNewIntroduced,
    exportAll, resetAll,
  };
})();
