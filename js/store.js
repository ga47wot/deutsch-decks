/* store.js — localStorage persistence. All learning data stays on-device. */
"use strict";

const Store = (() => {
  const KEYS = {
    progress: "dd.progress.v1",
    settings: "dd.settings.v1",
    customDecks: "dd.customDecks.v1",
    newCount: "dd.newCount.v1",
    bookmarks: "dd.bookmarks.v1",
    practiceDone: "dd.practiceDone.v1",
    practiceSession: "dd.practiceSession.v1",
  };

  const DEFAULT_SETTINGS = {
    direction: "de-en",
    rate: 0.8,
    voiceURI: null,
    selectedDecks: [],
    newPerDay: 20,
    theme: "system",
    practiceLevel: 1,        // sentence practice: stage 1–6
    practiceThemes: [],      // sentence practice: selected theme ids
    speakAnswer: true,       // sentence practice: speak correct German on Check tap
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

  // ---- bookmarks: array of card ids ----
  let bookmarks = new Set(readJSON(KEYS.bookmarks, []));
  function getBookmarks() { return [...bookmarks]; }
  function isBookmarked(id) { return bookmarks.has(id); }
  function toggleBookmark(id) {
    if (bookmarks.has(id)) bookmarks.delete(id); else bookmarks.add(id);
    writeJSON(KEYS.bookmarks, [...bookmarks]);
    return bookmarks.has(id);
  }
  function setBookmarks(ids) {
    bookmarks = new Set(ids);
    writeJSON(KEYS.bookmarks, [...bookmarks]);
  }

  // ---- sentence practice: ids marked "mastered — don't show again" ----
  let practiceDone = new Set(readJSON(KEYS.practiceDone, []));
  function getPracticeDone() { return [...practiceDone]; }
  function isPracticeDone(id) { return practiceDone.has(id); }
  function setPracticeDone(ids) {
    practiceDone = new Set(ids);
    writeJSON(KEYS.practiceDone, [...practiceDone]);
  }
  function addPracticeDone(id) { practiceDone.add(id); writeJSON(KEYS.practiceDone, [...practiceDone]); }
  function removePracticeDone(ids) {
    for (const id of ids) practiceDone.delete(id);
    writeJSON(KEYS.practiceDone, [...practiceDone]);
  }

  // ---- sentence practice: the unfinished session, so a reload can resume it ----
  function getPracticeSession() { return readJSON(KEYS.practiceSession, null); }
  function savePracticeSession(s) { writeJSON(KEYS.practiceSession, s); }
  function clearPracticeSession() { localStorage.removeItem(KEYS.practiceSession); }

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
      bookmarks: [...bookmarks],
      practiceDone: [...practiceDone],
    };
  }

  function resetAll() {
    for (const k of Object.values(KEYS)) localStorage.removeItem(k);
    progress = {};
    settings = Object.assign({}, DEFAULT_SETTINGS);
    customDecks = {};
    bookmarks = new Set();
    practiceDone = new Set();
  }

  return {
    getRec, setRec, allProgress, replaceProgress, deleteRecs,
    getSettings, saveSettings,
    getCustomDecks, saveCustomDeck, deleteCustomDeck,
    getBookmarks, isBookmarked, toggleBookmark, setBookmarks,
    getPracticeDone, isPracticeDone, setPracticeDone, addPracticeDone, removePracticeDone,
    getPracticeSession, savePracticeSession, clearPracticeSession,
    newIntroducedToday, bumpNewIntroduced,
    exportAll, resetAll,
  };
})();
