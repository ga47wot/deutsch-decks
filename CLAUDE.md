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

- Catalogue: `data/A2.2_deck.json` (note: singular "deck"). Object with
  metadata and a `decks` array. Load only entries with `status === "created"`
  and non-null `file`. Resolve `file` relative to `data/A2.2_flashcards/`.
  Do not display `warnings` by default.
- Decks: `data/A2.2_flashcards/*_deck.json`, each a JSON **array** of cards.

### Card schema (actual, verified against all 425 cards)

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
- `dd.settings.v1` — direction, rate, voiceURI, selectedDecks, newPerDay
- `dd.customDecks.v1` — manually imported decks
- `dd.newCount.v1` — per-day new-card counter

Never change these shapes without a migration; progress is keyed by card `id`
and must survive deck re-imports.

## When changing anything

- Bump `CACHE_VERSION` in `sw.js` for ANY change to app files or deck data,
  or users will keep the old cached version.
- Keep tap targets ≥ 44px, dark mode the default, phone-first layout.

## Mandatory test checklist (run before calling any change done)

1. `python -m http.server 8080` in this folder; open http://localhost:8080.
2. All 10 decks appear in Decks tab with correct card counts.
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
