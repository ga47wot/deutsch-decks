# Deutsch Decks

A mobile-first, fully offline PWA for studying German A2.2 vocabulary flashcards
with an SM-2-style spaced-repetition schedule. Plain HTML/CSS/JS — no framework,
no build step, no backend, no accounts, no analytics. All learning data lives in
your browser's `localStorage`, on your device only.

## Local development

Any static file server works. From this folder:

```bash
python -m http.server 8080
```

Then open <http://localhost:8080>.

Notes:
- Opening `index.html` directly via `file://` will **not** work (`fetch` of the
  deck JSON and the service worker both require http/https).
- The service worker caches aggressively. While developing, use your browser
  DevTools → Application → Service Workers → "Update on reload", or bump
  `CACHE_VERSION` in [sw.js](sw.js) to force a refresh.

## Folder layout

```
Flashcards/
├── index.html            app shell (single page)
├── css/app.css
├── js/                   store, srs, tts, decks, study, grammar, browse,
│                         sentcheck, sentences, app
├── sw.js                 service worker (offline cache)
├── manifest.webmanifest  PWA manifest
├── icons/
└── data/
    ├── YGT_deck-index.json       master deck catalogue (see below)
    ├── A2.1_flaschcards/         A2.1 decks, one JSON array of cards per lesson
    ├── A2.2_flashcards/          A2.2 decks
    ├── B1.1_flashcards/          B1.1 decks
    └── practice/                 sentence-practice bank (index.json + one file per theme)
```

## Sentence practice (EN → DE)

Home → **Sentence practice**: pick everyday themes, set the level you have
reached (six stages from A2.1 Lektion 1–5 to B1.1 Lektion 6–10), and translate
up to 12 English sentences per session by typing the German. The app compares
your sentence with the accepted answers **on the device** and points out word
order, article/case, ending and spelling differences, shows the grammar pattern
behind the sentence, and reads the correct German aloud when you tap Check
(switchable). It is a comparison with known-good sentences, not a free grammar
checker — if your sentence was right but phrased differently, tap
"My answer was also correct". For a real second opinion, **Ask Claude** copies
a ready-made question (the English, your German, the reference answer) to the
clipboard so you can paste it into the Claude app; the app itself sends nothing.

To add a theme: create `data/practice/<theme>.json` (item schema in
[CLAUDE.md](CLAUDE.md), ids unique across the whole app), list it in
`data/practice/index.json`, and bump `CACHE_VERSION`.

## Adding a new chapter deck

Static hosting cannot list directory contents, so decks are discovered through
the master catalogue `data/YGT_deck-index.json`:

1. Put the new deck file in the book's folder (e.g. `data/A2.2_flashcards/`) —
   a JSON **array** of card objects (schema in [CLAUDE.md](CLAUDE.md)).
   Card `id`s must be unique across **all** decks of all books.
2. Add an entry to the `decks` array in `data/YGT_deck-index.json`:

   ```json
   {
     "deck_id": "A2_2_L11",
     "book_id": "A2_2",
     "file": "A2_2_Lektion_11_deck.json",
     "lesson": "Lektion 11",
     "lesson_number": 11,
     "topics": ["…"],
     "card_count": 40,
     "status": "created"
   }
   ```

   Only entries with `status: "created"`, a non-null `file`, and a known
   `book_id` are loaded.
3. For a **new book** (e.g. B1.1): create its folder under `data/` and add the
   folder mapping to `BOOK_DIRS` in both [js/decks.js](js/decks.js) and
   [sw.js](sw.js); the level tab in the Decks screen appears automatically.
4. Bump `CACHE_VERSION` in [sw.js](sw.js) (e.g. `dd-v1.1.1`) so the service
   worker re-caches the data and users get the "New version available" banner.

Alternatively, on the phone itself: **Decks → Import deck…** and pick a deck
JSON file from the Files app. Imported decks are stored in `localStorage` and
work offline immediately without touching the catalogue.

## Deploying to GitHub Pages

1. Create a GitHub repository and push this folder's contents to it
   (the folder itself is the site root — `index.html` at the top level).
2. Repository → Settings → Pages → Source: *Deploy from a branch*,
   branch `main`, folder `/ (root)`.
3. Wait for the Pages build, then open
   `https://<username>.github.io/<repo>/` — the app registers its service
   worker with a relative scope, so serving from a subpath works.

After the first successful online load, the app and all catalogued decks are
cached and the site works with no connection.

> This folder lives in Google Drive. Don't try to serve it from Drive directly —
> copy/push it to a real static host (GitHub Pages, Netlify, a local server).

## Installing on your phone

**iPhone (Safari):**
1. Open the app URL in Safari (not Chrome — iOS only installs PWAs from Safari).
2. Tap the Share button → **Add to Home Screen** → **Add**.
3. Launch it from the home-screen icon once while online so everything caches.

**Android (Chrome):**
1. Open the app URL in Chrome.
2. Tap ⋮ menu → **Add to Home screen** (or accept the install prompt) → **Install**.
3. Launch it once while online so everything caches.

## German voice setup & troubleshooting

Audio uses the phone's built-in text-to-speech (Web Speech API) — nothing is
sent anywhere. A German (`de-*`) voice must be installed on the device:

- **iOS:** Settings → Accessibility → Spoken Content → Voices → German.
  Download a voice (e.g. *Anna*). Higher-quality variants are listed under the
  voice name.
- **Android:** Settings → System → Languages → Text-to-speech output (varies by
  vendor) → Google Speech Services → Install voice data → German.

In the app: **Settings → German audio** to pick the voice and speed (0.7–1.1×,
default 0.8×). Use *Test voice* to check it.

Troubleshooting:
- *Voice list is empty:* voices load asynchronously — reopen Settings after a
  few seconds; make sure a German voice is installed (see above).
- *No sound on iOS:* check the silent-mode switch and volume; audio only ever
  starts from a tap, which iOS requires.
- *Wrong language or robotic voice:* pick a different `de-*` voice in Settings;
  install a higher-quality voice in the OS settings.

## Backing up / restoring progress

- **Settings → Export progress (JSON)** downloads a full backup (study
  progress, settings, imported decks). Store it wherever you like — it is a
  plain JSON file.
- **Settings → Import progress…** shows a preview (how many cards, how many
  would be overwritten) and asks for confirmation before changing anything.
  Progress for cards not in the backup is kept.
- Progress is keyed by card `id`, so re-downloading or re-importing a deck
  never resets your schedule.
- **Reset** (per-deck or everything) also lives in Settings, each behind a
  confirmation dialog.

⚠️ `localStorage` is per-browser and per-site. Clearing the browser's site data
deletes your progress — export a backup first.
