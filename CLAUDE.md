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

## Sentence practice (EN → DE, typed answers)

- Bank: `data/practice/index.json` — `{ version, stages: [{n, label, grammar}],
  themes: [{id, title, title_de, icon, file}] }` — plus one JSON **array** per
  theme in the same folder. Stages are the coarse, cumulative grammar
  progression 1–6 (A2.1 L1–5 … B1.1 L6–10); an item is offered when
  `item.stage <= settings.practiceLevel`.
- Item: `{ id, stage, en, cue?, de, alt?: [..], pattern, why, vocab?: [[de, en]] }`.
  `id` (`SP-<THEME>-###`) must be unique across the whole app — it is the
  progress key in `dd.progress.v1` (normal SRS record; not part of deck stats).
  `de` + `alt` are ALL accepted answers; every one must be natural, complete,
  grammatically correct German. `cue` disambiguates du/Sie etc.
- Checking is on-device only (`js/sentcheck.js`): the input is aligned against
  each accepted answer and differences are classified (word order,
  article/case, pronoun case, ending, spelling, different/missing/extra word).
  It is NOT a free grammar checker — never replace it with a network/AI call
  (privacy rule). The "My answer was also correct" override covers valid
  phrasings missing from `alt`; prefer adding common variants to `alt`.
- Speech: the correct German answer is spoken by the Check tap/Enter itself
  (a user gesture; `settings.speakAnswer`, default on). This is the only place
  speech starts without tapping a 🔊 button — keep it synchronous in that
  handler and never speak the English.
- Grading (in `commit()`): correct at the first go without a hint = Easy
  (stays away for days — do NOT send it through the 1 min/10 min flashcard
  learning steps, the user found the resulting repeats annoying); correct with
  a hint or on a re-queued pass = Good; almost = Hard; wrong = Again and
  re-queued at the end of the session (max 2×).
- A session only contains due + new sentences; known, not-yet-due sentences
  are repeated only when nothing is new or due ("Practise anyway").
- "✓ Mastered — don't show this again" puts the id in `dd.practiceDone.v1`;
  such sentences are excluded from the pool until "Bring back N mastered
  sentences" on the setup screen.
- The unfinished session is saved to `dd.practiceSession.v1` after every
  sentence, because phones drop a backgrounded page from memory; the setup
  screen then offers "Resume session". Cleared on finish / new session, and
  ignored after 24 h.
- "Ask Claude" on the feedback screen only copies a ready-made question
  (English, the learner's German, the reference answer, level) to the
  clipboard for the user to paste into the Claude app themself. The app sends
  nothing — do not turn it into a link with the text in the URL or an API call.
- New themes are picked up from the index by both `js/sentences.js` and the
  service worker's install step; bump `CACHE_VERSION`.

## Storage keys (localStorage)

- `dd.progress.v1` — `{ [cardId]: {st, step, ef, ivl, due, reps, lapses, last} }`
  (also holds sentence-practice records under `SP-…` ids)
- `dd.settings.v1` — direction, rate, voiceURI, selectedDecks, newPerDay, theme,
  practiceLevel (1–6), practiceThemes (ids; empty = all), speakAnswer
- `dd.customDecks.v1` — manually imported decks
- `dd.newCount.v1` — per-day new-card counter
- `dd.bookmarks.v1` — array of bookmarked card ids (included in export/import)
- `dd.practiceDone.v1` — array of sentence ids marked mastered (included in
  export/import, merged on import)
- `dd.practiceSession.v1` — `{t, ids, step, total, done, tally, requeues}` of
  the unfinished sentence session (transient; not exported)

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
   picker; rate slider 0.7–1.1; no autoplay of anything (only documented
   exception: the Check tap in sentence practice speaks the correct German).
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
15. Sentence practice (Home → ✍️): theme buttons toggle (last one can't be
    deselected); the level slider updates label, grammar list and count and
    persists; a session shows ≤ 12 sentences. A wrong answer shows the marked
    diff, issue list, pattern tip and speaks the correct German (not when
    "Speak the correct German answer…" is unticked); "Try again", "My answer was also
    correct" and "Next" work; "Ask Claude" copies the question to the
    clipboard (no network request); a missed sentence comes back at the end; ✕ End
    restores the tab bar; a sentence typed correctly without a hint is due in
    4 days, not minutes; reloading the page mid-session offers "Resume session"
    at the same sentence; "Mastered" hides a sentence and "Bring back" restores
    it; every accepted answer of every item checks as
    correct; works offline.
