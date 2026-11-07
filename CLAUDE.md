# Deutsch Decks — project notes

Static offline-first PWA (plain HTML/CSS/JS, no build step) for German A2.2
flashcards. App root is this folder; deck data lives in `data/`.

## Privacy rule (non-negotiable)

No backend, no accounts, no API keys, no cloud TTS, no analytics, no tracking,
no network calls except fetching the app's own static files. All learning data
stays in `localStorage` on the device. German audio uses only the on-device Web
Speech API (`lang="de-DE"`), started only by a user tap; English is never
spoken automatically. Do not add any dependency or feature that violates this.

## Data files

- Catalogue: `data/YGT_deck-index.json` — master index across all YGT books.
  Object with a `books` array (A2.1/A2.2/B1.1 complete, B1.2 pending) and a
  `decks` array. Load only deck entries with `status === "created"`, non-null
  `file`, and a `book_id` with a known directory. Resolve `file` relative to
  the per-book directory:
  - `A2_1` → `data/A2.1_flaschcards/` (folder name spelling is intentional —
    keep the typo, it's referenced everywhere)
  - `A2_2` → `data/A2.2_flashcards/`
  - `B1_1` → `data/B1.1_flashcards/`
  New books need a new entry in `BOOK_DIRS` in BOTH `js/decks.js` and `sw.js`.
  Do not display `warnings` by default. (`data/A2.2_deck.json` is the old
  A2.2-only catalogue, kept for reference; the app no longer reads it.)
- Decks: `*_deck.json` in the per-book folders, each a JSON **array** of cards.

### Card schema (actual, verified against all 1,343 cards: 399 A2.1 + 425 A2.2 + 519 B1.1)

```json
{
  "id": "A22-L1-001",        // unique across ALL decks; the progress key
  "book": "A2.2 YGT Kurs- und Arbeitsbuch",
  "cefr": "A2",
  "lesson": 1,               // plain number (NOT "Lektion 1"; label comes from catalogue)
  "page": 7,                 // may be null
  "de": "der Abflug",        // German, includes article for nouns
  "article": "der",          // "" for non-nouns
  "plural": "¨e",            // marker as printed; "" when not applicable
  "en": "departure",
  "type": "word",            // "word" | "phrase"
  "topic": "Reisevokabular",
  "en_source": "book",
  "s1_de": "…", "s1_en": "…", // example sentence 1 + gloss
  "s2_de": "…", "s2_en": "…", // example sentence 2 + gloss
  "sent_source": "claude"
}
```

Cards do **not** contain `lesson_number` or `source_file` (those exist only on
catalogue entries). ~200 cards have empty `article`/`plural` (phrases/verbs) —
the UI must tolerate empty strings. Required for the app: `id`, `de`, `en`;
everything else is optional and displayed when present.

## Storage keys (localStorage)

- `dd.progress.v1` — `{ [cardId]: {st, step, ef, ivl, due, reps, lapses, last} }`
- `dd.settings.v1` — direction, rate, voiceURI, selectedDecks, newPerDay, theme
- `dd.customDecks.v1` — manually imported decks
- `dd.newCount.v1` — per-day new-card counter
- `dd.bookmarks.v1` — array of bookmarked card ids (included in export/import)

Never change these shapes without a migration; progress is keyed by card `id`
and must survive deck re-imports.

## When changing anything

- Bump `CACHE_VERSION` in `sw.js` for ANY change to app files or deck data,
  or users will keep the old cached version.
- The SW precaches with `cache: "reload"` requests on purpose — without it a
  new cache version can be filled from the browser's HTTP cache with stale
  files and users get a mixed old/new build. Keep it.
- Keep tap targets ≥ 44px, dark mode the default, phone-first layout.

## Mandatory test checklist (run before calling any change done)

1. `python -m http.server 8080` in this folder; open http://localhost:8080.
2. All 30 decks appear in Decks tab with correct card counts; the
   A2.1/A2.2/B1.1 level tabs filter the list and Select all only affects the
   visible level.
3. Review session: flip, all four grades work, due preview labels shown,
   progress persists across a reload.
4. Cram session: runs, changes NO scheduling data.
5. Browse: search "Abflug" (German) and "departure" (English) both hit;
   lesson and topic filters work.
6. Direction switch: EN→DE shows English front, German back.
7. TTS: speaker buttons on `de`, `s1_de`, `s2_de`; German voices only in the
   picker; rate slider 0.7–1.1; no autoplay of anything.
8. Export progress downloads JSON; re-import shows preview and asks before
   overwriting.
9. Offline: load once, DevTools → Network → Offline, reload — app and decks
   still work.
10. After bumping `CACHE_VERSION`: "New version available — refresh" banner
    appears and the refresh button swaps to the new version.
11. Theme select (Settings → Appearance): Dark, Light, and System each apply
    immediately and persist across reload.
12. Grammar tab: four case sub-tabs render tables + spoken examples; the
    memory-sentence generator switches correctly across gender × article type.
13. Bookmarks: ☆ on the study card and in Browse toggles; "Bookmarked only"
    filters Browse; Home → "Review bookmarks" crams exactly those cards;
    bookmarks survive export/import.
14. Progress tab: per-level "N / 10 lessons complete" bars; a deck shows
    ✓ Complete only when it has 0 unseen AND 0 due cards.
