/* decks.js — catalogue loading, deck fetching, validation, manual import. */
"use strict";

const Decks = (() => {
  const CATALOGUE_URL = "data/YGT_deck-index.json";
  // per-book deck directories (A2.1 folder name keeps its original spelling)
  const BOOK_DIRS = {
    A2_1: "data/A2.1_flaschcards/",
    A2_2: "data/A2.2_flashcards/",
  };

  let catalogueDecks = [];       // deck meta from data/A2.2_deck.json
  let catalogueError = null;
  const cardCache = new Map();   // deckId -> cards array

  /* ---------- validation ---------- */

  /* Validate an array of raw cards. Returns { cards, errors } where errors
   * name the file, array index and card id of every faulty entry. */
  function validateCards(raw, fileName) {
    const errors = [];
    const cards = [];
    if (!Array.isArray(raw)) {
      return { cards: [], errors: [`${fileName}: top level is not a JSON array of cards`] };
    }
    const seen = new Set();
    raw.forEach((c, i) => {
      const where = `${fileName} card #${i + 1}`;
      if (typeof c !== "object" || c === null) { errors.push(`${where}: not an object`); return; }
      const id = c.id;
      if (typeof id !== "string" || !id.trim()) { errors.push(`${where}: missing "id"`); return; }
      if (seen.has(id)) { errors.push(`${where} (${id}): duplicate id within file`); return; }
      seen.add(id);
      for (const f of ["de", "en"]) {
        if (typeof c[f] !== "string" || !c[f].trim()) {
          errors.push(`${where} (${id}): missing "${f}"`);
          return;
        }
      }
      cards.push(c);
    });
    return { cards, errors };
  }

  /* ---------- catalogue decks ---------- */

  async function loadCatalogue() {
    catalogueError = null;
    try {
      const res = await fetch(CATALOGUE_URL);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const cat = await res.json();
      if (!cat || !Array.isArray(cat.decks)) throw new Error("catalogue has no decks array");
      catalogueDecks = cat.decks
        .filter(d => d.status === "created" && d.file && BOOK_DIRS[d.book_id])
        .map(d => {
          const level = (d.book_id || "").replace("_", ".");   // A2_1 -> A2.1
          return {
            id: d.deck_id,
            title: level + " · " + (d.lesson || d.deck_id),
            level,
            dir: BOOK_DIRS[d.book_id],
            lessonNumber: d.lesson_number ?? null,
            lessonLabel: level + " · " + (d.lesson || ""),
            topics: Array.isArray(d.topics) ? d.topics : [],
            cardCount: d.card_count ?? null,
            file: d.file,
            book: d.book || "",
            source: "catalogue",
          };
        });
    } catch (e) {
      catalogueDecks = [];
      catalogueError = "Could not load the deck catalogue (" + e.message + "). " +
        "If this is your first visit, connect to the internet once so the decks can be cached for offline use.";
    }
  }

  function getCatalogueError() { return catalogueError; }

  /* ---------- registry (catalogue + custom) ---------- */

  function all() {
    const custom = Object.entries(Store.getCustomDecks()).map(([id, d]) => ({
      id,
      title: d.meta.title || id,
      level: "Imported",
      lessonNumber: d.meta.lessonNumber ?? null,
      lessonLabel: d.meta.lessonLabel || "Imported",
      topics: d.meta.topics || [],
      cardCount: d.cards.length,
      file: null,
      book: d.meta.book || "",
      source: "custom",
    }));
    return [...catalogueDecks, ...custom];
  }

  function byId(deckId) { return all().find(d => d.id === deckId) || null; }

  async function getCards(deckId) {
    if (cardCache.has(deckId)) return cardCache.get(deckId);
    const deck = byId(deckId);
    if (!deck) throw new Error("Unknown deck: " + deckId);

    let cards;
    if (deck.source === "custom") {
      cards = Store.getCustomDecks()[deckId].cards;
    } else {
      let raw;
      try {
        const res = await fetch(deck.dir + deck.file);
        if (!res.ok) throw new Error("HTTP " + res.status);
        raw = await res.json();
      } catch (e) {
        throw new Error(`Deck "${deck.title}" is not available offline (${e.message}). Connect once so it can be cached.`);
      }
      const { cards: valid, errors } = validateCards(raw, deck.file);
      if (errors.length) console.warn("deck validation:", errors);
      cards = valid;
    }
    // annotate with owning deck for stats / labels
    cards = cards.map(c => Object.assign({ _deckId: deckId, _lessonLabel: deck.lessonLabel }, c));
    cardCache.set(deckId, cards);
    return cards;
  }

  /* Load cards for several decks; returns { cards, failures } */
  async function getCardsMulti(deckIds) {
    const cards = [];
    const failures = [];
    for (const id of deckIds) {
      try { cards.push(...await getCards(id)); }
      catch (e) { failures.push(e.message); }
    }
    return { cards, failures };
  }

  /* ---------- manual import from a JSON file ---------- */

  /* Accepts either a top-level card array, or an object with a `cards` array.
   * Returns { deckId, meta, cards, errors } — caller decides whether to save. */
  function parseImportedDeck(text, fileName) {
    let raw;
    try { raw = JSON.parse(text); }
    catch (e) { return { errors: [`${fileName}: not valid JSON — ${e.message}`] }; }

    let arr = raw;
    let meta = {};
    if (!Array.isArray(raw) && raw && Array.isArray(raw.cards)) {
      arr = raw.cards;
      meta = { title: raw.title || raw.lesson, lessonLabel: raw.lesson, topics: raw.topics, book: raw.book };
    }
    const { cards, errors } = validateCards(arr, fileName);
    if (!cards.length) {
      return { errors: errors.length ? errors : [`${fileName}: no valid cards found`] };
    }
    const deckId = "custom:" + fileName.replace(/\.json$/i, "");
    const topics = meta.topics || [...new Set(cards.map(c => c.topic).filter(Boolean))];
    return {
      deckId,
      meta: {
        title: meta.title || fileName.replace(/\.json$/i, ""),
        lessonLabel: meta.lessonLabel || "Imported",
        topics,
        book: meta.book || "",
      },
      cards,
      errors, // non-fatal per-card errors; caller shows them
    };
  }

  function saveImportedDeck(deckId, meta, cards) {
    cardCache.delete(deckId);
    return Store.saveCustomDeck(deckId, meta, cards);
  }

  function removeCustomDeck(deckId) {
    cardCache.delete(deckId);
    Store.deleteCustomDeck(deckId);
  }

  return {
    loadCatalogue, getCatalogueError,
    all, byId, getCards, getCardsMulti,
    parseImportedDeck, saveImportedDeck, removeCustomDeck,
  };
})();
