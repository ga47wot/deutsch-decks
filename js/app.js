/* app.js — navigation, deck picker, stats, settings, backup, service worker. */
"use strict";

const App = (() => {
  const VERSION = "1.4.3";
  const $ = (id) => document.getElementById(id);

  /* ================= modal ================= */

  let modalResolve = null;

  function modal(title, bodyNode, { okLabel = "OK", cancelLabel = "Cancel", danger = false, hideCancel = false } = {}) {
    return new Promise((resolve) => {
      modalResolve = resolve;
      $("modal-title").textContent = title;
      const body = $("modal-body");
      body.innerHTML = "";
      if (typeof bodyNode === "string") body.textContent = bodyNode;
      else if (bodyNode) body.appendChild(bodyNode);
      const ok = $("modal-ok");
      ok.textContent = okLabel;
      ok.classList.toggle("btn-danger", danger);
      ok.classList.toggle("btn-primary", !danger);
      $("modal-cancel").hidden = hideCancel;
      $("modal-cancel").textContent = cancelLabel;
      $("modal").hidden = false;
    });
  }

  function closeModal(result) {
    $("modal").hidden = true;
    if (modalResolve) { modalResolve(result); modalResolve = null; }
  }

  function info(title, text) { return modal(title, text, { hideCancel: true }); }

  /* ================= notices ================= */

  let noticeTimer = null;
  function showNotice(text) {
    const el = $("offline-note");
    el.textContent = text;
    el.hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { el.hidden = true; }, 8000);
    if (currentScreen !== "home") switchScreen("home");
  }

  /* ================= theme ================= */

  const darkMedia = window.matchMedia("(prefers-color-scheme: dark)");

  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === "dark" || theme === "light") root.dataset.theme = theme;
    else delete root.dataset.theme;
    const dark = theme === "dark" || (theme !== "light" && darkMedia.matches);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? "#0f1115" : "#f4f5f8";
  }

  darkMedia.addEventListener?.("change", () => applyTheme(Store.getSettings().theme));

  /* ================= navigation ================= */

  let currentScreen = "home";

  function switchScreen(name) {
    if (currentScreen === "study" && name !== "study") Study.exit();
    currentScreen = name;
    for (const s of document.querySelectorAll(".screen")) s.hidden = true;
    $("screen-" + name).hidden = false;
    for (const t of document.querySelectorAll(".tab")) {
      t.classList.toggle("active", t.dataset.screen === name);
    }
    document.querySelector(".tab-bar").hidden = (name === "study");
    const titles = { home: "Deutsch Decks", study: "Study", decks: "Decks", browse: "Browse", grammar: "Grammar", stats: "Progress", settings: "Settings" };
    $("header-title").textContent = titles[name] || "Deutsch Decks";

    if (name === "home") renderHome();
    if (name === "decks") renderDecks();
    if (name === "browse") Browse.show();
    if (name === "grammar") Grammar.show();
    if (name === "stats") renderStats();
    if (name === "settings") renderSettings();
  }

  /* ================= stats helpers ================= */

  function deckStats(cards) {
    const now = Date.now();
    const s = { total: cards.length, unseen: 0, due: 0, learning: 0, young: 0, mature: 0, difficult: 0 };
    for (const c of cards) {
      const rec = Store.getRec(c.id);
      const b = SRS.bucket(rec);
      s[b] += 1;
      if (rec && SRS.isDueToday(rec, now)) s.due += 1;
      if (SRS.isDifficult(rec)) s.difficult += 1;
    }
    return s;
  }

  async function selectedStats() {
    const sel = Store.getSettings().selectedDecks;
    const { cards, failures } = await Decks.getCardsMulti(sel);
    return { stats: deckStats(cards), failures };
  }

  async function updateDueBadge() {
    try {
      const { stats } = await selectedStats();
      const badge = $("header-due");
      const newAllowance = Math.max(0, (Store.getSettings().newPerDay || 20) - Store.newIntroducedToday());
      const n = stats.due + Math.min(stats.unseen, newAllowance);
      badge.textContent = n + " due";
      badge.hidden = n === 0;
    } catch { /* ignore */ }
  }

  /* ================= home ================= */

  async function renderHome() {
    const sel = Store.getSettings().selectedDecks;
    const names = sel.map(id => Decks.byId(id)?.title || id);
    $("home-selection").textContent = names.length
      ? names.join(", ")
      : "No decks selected — pick some in the Decks tab.";
    $("direction-select").value = Store.getSettings().direction;
    const bmCount = Store.getBookmarks().length;
    $("btn-bookmarks").textContent = "★ Review bookmarks (" + bmCount + ")";
    $("btn-bookmarks").disabled = bmCount === 0;

    const row = $("home-stats");
    row.innerHTML = "";
    if (!sel.length) return;
    const { stats } = await selectedStats();
    const newAllowance = Math.max(0, (Store.getSettings().newPerDay || 20) - Store.newIntroducedToday());
    const chips = [
      ["Due", stats.due], ["New today", Math.min(stats.unseen, newAllowance)],
      ["Unseen", stats.unseen], ["Learning", stats.learning],
      ["Mature", stats.mature], ["Total", stats.total],
    ];
    for (const [label, n] of chips) {
      const c = document.createElement("span");
      c.className = "stat-chip";
      c.innerHTML = "";
      const b = document.createElement("b");
      b.textContent = n;
      c.appendChild(b);
      c.appendChild(document.createTextNode(" " + label));
      row.appendChild(c);
    }
    updateDueBadge();
  }

  /* ================= decks ================= */

  let levelFilter = "";   // "" = all levels

  function visibleDecks() {
    return Decks.all().filter(d => !levelFilter || d.level === levelFilter);
  }

  function renderLevelTabs() {
    const host = $("level-tabs");
    host.innerHTML = "";
    const levels = [...new Set(Decks.all().map(d => d.level).filter(Boolean))];
    if (levels.every(l => l === levels[0]) && levels.length < 2) { host.hidden = true; return; }
    host.hidden = false;
    for (const [label, value] of [["All", ""], ...levels.map(l => [l, l])]) {
      const b = document.createElement("button");
      b.className = "level-tab" + (levelFilter === value ? " active" : "");
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(levelFilter === value));
      b.textContent = label;
      b.addEventListener("click", () => { levelFilter = value; renderDecks(); });
      host.appendChild(b);
    }
  }

  async function renderDecks() {
    renderLevelTabs();
    const list = $("deck-list");
    list.innerHTML = "";
    const err = Decks.getCatalogueError();
    if (err) showNotice(err);
    const sel = new Set(Store.getSettings().selectedDecks);

    for (const deck of visibleDecks()) {
      const li = document.createElement("li");
      const item = document.createElement("label");
      item.className = "deck-item" + (sel.has(deck.id) ? " selected" : "");

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = sel.has(deck.id);
      cb.addEventListener("change", () => {
        const s = new Set(Store.getSettings().selectedDecks);
        if (cb.checked) s.add(deck.id); else s.delete(deck.id);
        Store.saveSettings({ selectedDecks: [...s] });
        item.classList.toggle("selected", cb.checked);
        updateDueBadge();
      });

      const inf = document.createElement("div");
      inf.className = "deck-info";
      const title = document.createElement("div");
      title.className = "deck-title";
      title.textContent = deck.title + (deck.source === "custom" ? " (imported)" : "");
      const meta = document.createElement("div");
      meta.className = "deck-meta";
      meta.textContent = (deck.cardCount ?? "?") + " cards";
      const topics = document.createElement("div");
      topics.className = "chip-row deck-topics";
      for (const t of deck.topics.slice(0, 4)) {
        const c = document.createElement("span");
        c.className = "chip";
        c.textContent = t;
        topics.appendChild(c);
      }
      const due = document.createElement("div");
      due.className = "deck-due muted";
      inf.append(title, meta, topics, due);

      Decks.getCards(deck.id).then(cards => {
        const s = deckStats(cards);
        due.textContent = `${s.due} due · ${s.unseen} unseen · ${s.difficult} difficult`;
      }).catch(() => { due.textContent = "not cached — open online once"; });

      item.append(cb, inf);

      if (deck.source === "custom") {
        const del = document.createElement("button");
        del.className = "btn btn-small btn-danger";
        del.textContent = "🗑";
        del.setAttribute("aria-label", "Delete imported deck " + deck.title);
        del.addEventListener("click", async (e) => {
          e.preventDefault();
          const yes = await modal("Delete imported deck?",
            `"${deck.title}" will be removed. Its study progress stays saved and returns if you re-import the deck.`,
            { okLabel: "Delete", danger: true });
          if (yes) {
            Decks.removeCustomDeck(deck.id);
            const s2 = new Set(Store.getSettings().selectedDecks);
            s2.delete(deck.id);
            Store.saveSettings({ selectedDecks: [...s2] });
            Browse.invalidate();
            renderDecks();
          }
        });
        item.appendChild(del);
      }

      li.appendChild(item);
      list.appendChild(li);
    }
  }

  /* Select/deselect the decks currently visible under the level filter,
   * leaving decks of other levels untouched. */
  function selectAll(on) {
    const visible = new Set(visibleDecks().map(d => d.id));
    const sel = new Set(Store.getSettings().selectedDecks);
    for (const id of visible) { if (on) sel.add(id); else sel.delete(id); }
    Store.saveSettings({ selectedDecks: [...sel] });
    renderDecks();
    updateDueBadge();
  }

  /* ---- manual deck import ---- */

  async function importDeckFile(file) {
    const text = await file.text();
    const parsed = Decks.parseImportedDeck(text, file.name);

    if (!parsed.deckId) {
      const box = document.createElement("div");
      const p = document.createElement("p");
      p.textContent = "This file could not be imported:";
      const ul = document.createElement("ul");
      for (const e of parsed.errors.slice(0, 10)) {
        const li = document.createElement("li"); li.textContent = e; ul.appendChild(li);
      }
      box.append(p, ul);
      await modal("Import failed", box, { hideCancel: true });
      return;
    }

    const box = document.createElement("div");
    const p = document.createElement("p");
    p.textContent = `"${parsed.meta.title}" — ${parsed.cards.length} valid cards.`;
    box.appendChild(p);
    if (parsed.errors.length) {
      const warn = document.createElement("p");
      warn.textContent = `${parsed.errors.length} faulty card(s) will be skipped:`;
      const ul = document.createElement("ul");
      for (const e of parsed.errors.slice(0, 8)) {
        const li = document.createElement("li"); li.textContent = e; ul.appendChild(li);
      }
      box.append(warn, ul);
    }
    if (Store.getCustomDecks()[parsed.deckId]) {
      const w = document.createElement("p");
      w.textContent = "A deck with this name is already imported and will be replaced. Study progress is kept per card and is not overwritten.";
      box.appendChild(w);
    }

    const yes = await modal("Import deck?", box, { okLabel: "Import" });
    if (!yes) return;
    if (Decks.saveImportedDeck(parsed.deckId, parsed.meta, parsed.cards)) {
      Browse.invalidate();
      renderDecks();
    }
  }

  /* ================= bookmarks ================= */

  function refreshBookmarkBtn() {
    const btn = $("btn-bookmark");
    const card = Study.currentCard();
    const on = !!card && Store.isBookmarked(card.id);
    btn.hidden = !card;
    btn.textContent = on ? "★" : "☆";
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-pressed", String(on));
  }

  function toggleCurrentBookmark() {
    const card = Study.currentCard();
    if (!card) return;
    Store.toggleBookmark(card.id);
    refreshBookmarkBtn();
  }

  async function bookmarkedCards() {
    const ids = new Set(Store.getBookmarks());
    if (!ids.size) return [];
    const { cards } = await Decks.getCardsMulti(Decks.all().map(d => d.id));
    return cards.filter(c => ids.has(c.id));
  }

  async function startBookmarkReview() {
    const cards = await bookmarkedCards();
    if (!cards.length) { showNotice("No bookmarked cards yet. Tap ☆ on a card while studying or browsing."); return; }
    if (await Study.start("cram", cards)) switchScreen("study");
  }

  /* ================= progress + stats screen ================= */

  /* A lesson counts as complete when every card has been studied at least
   * once and nothing is due today. */
  async function renderProgress() {
    const host = $("progress-overview");
    host.innerHTML = "";
    const decks = Decks.all().filter(d => d.source === "catalogue");
    const byLevel = new Map();
    for (const d of decks) {
      if (!byLevel.has(d.level)) byLevel.set(d.level, []);
      byLevel.get(d.level).push(d);
    }

    for (const [level, list] of byLevel) {
      const rows = [];
      let complete = 0;
      for (const d of list) {
        let s = null;
        try { s = deckStats(await Decks.getCards(d.id)); } catch { /* uncached */ }
        const done = !!s && s.total > 0 && s.unseen === 0 && s.due === 0;
        if (done) complete += 1;
        rows.push({ d, s, done });
      }

      const card = document.createElement("div");
      card.className = "card-panel";
      const h = document.createElement("h2");
      h.textContent = `${level} — ${complete} / ${list.length} lessons complete`;
      card.appendChild(h);
      const wrap = document.createElement("div");
      wrap.className = "progress-wrap prog-level-bar";
      const bar = document.createElement("div");
      bar.className = "progress-bar";
      bar.style.width = Math.round((complete / list.length) * 100) + "%";
      wrap.appendChild(bar);
      card.appendChild(wrap);

      for (const { d, s, done } of rows) {
        const row = document.createElement("div");
        row.className = "prog-row";
        const title = document.createElement("span");
        title.textContent = d.lessonLabel.replace(level + " · ", "");
        const pw = document.createElement("div");
        pw.className = "progress-wrap";
        const pb = document.createElement("div");
        pb.className = "progress-bar";
        const studiedPct = s && s.total ? Math.round(((s.total - s.unseen) / s.total) * 100) : 0;
        pb.style.width = studiedPct + "%";
        pw.appendChild(pb);
        pw.setAttribute("aria-label", studiedPct + "% of cards studied");
        const status = document.createElement("span");
        status.className = "prog-status" + (done ? " done" : "");
        status.textContent = !s ? "not cached"
          : done ? "✓ Complete"
          : s.due > 0 ? `${s.due} due`
          : `${s.unseen} unseen`;
        row.append(title, pw, status);
        card.appendChild(row);
      }
      host.appendChild(card);
    }

    const legend = document.createElement("p");
    legend.className = "muted";
    legend.textContent = "Bar = share of the lesson's cards you've studied at least once. ✓ Complete = every card studied and nothing due today; it reopens when reviews come due again.";
    host.appendChild(legend);
  }

  async function renderStats() {
    await renderProgress();
    const host = $("stats-tables");
    host.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "card-panel stats-scroll";
    const table = document.createElement("table");
    table.className = "stats-table";
    table.innerHTML = "<thead><tr><th>Deck</th><th>Total</th><th>Unseen</th><th>Due</th><th>Learning</th><th>Mature</th><th>Difficult</th></tr></thead>";
    const tbody = document.createElement("tbody");
    const totals = { total: 0, unseen: 0, due: 0, learning: 0, mature: 0, difficult: 0 };

    for (const deck of Decks.all()) {
      const tr = document.createElement("tr");
      let s;
      try { s = deckStats(await Decks.getCards(deck.id)); }
      catch { s = null; }
      const cells = s
        ? [deck.title, s.total, s.unseen, s.due, s.learning, s.mature, s.difficult]
        : [deck.title, "—", "—", "—", "—", "—", "—"];
      if (s) for (const k of Object.keys(totals)) totals[k] += s[k];
      for (const c of cells) {
        const td = document.createElement("td"); td.textContent = c; tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    const tr = document.createElement("tr");
    for (const c of ["All", totals.total, totals.unseen, totals.due, totals.learning, totals.mature, totals.difficult]) {
      const td = document.createElement("td");
      td.textContent = c;
      td.style.fontWeight = "700";
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
    table.appendChild(tbody);
    wrap.appendChild(table);
    host.appendChild(wrap);

    const legend = document.createElement("p");
    legend.className = "muted";
    legend.style.marginTop = "10px";
    legend.textContent = "Learning = in learning/relearning steps. Mature = interval ≥ 21 days. Difficult = 3+ lapses or persistently low ease.";
    host.appendChild(legend);
  }

  /* ================= settings ================= */

  function renderVoices() {
    const sel = $("voice-select");
    sel.innerHTML = "";
    const voices = TTS.getGermanVoices();
    const note = $("voice-note");
    if (!TTS.supported()) {
      note.textContent = "Speech synthesis is not supported in this browser.";
      sel.disabled = true;
      return;
    }
    if (!voices.length) {
      sel.add(new Option("No German voice found", ""));
      sel.disabled = true;
      note.textContent = "No German (de-*) voice is installed. See README → German voice setup.";
      return;
    }
    sel.disabled = false;
    const st = TTS.getStatus();
    let diag = "";
    if (st.attempted) {
      diag = st.started
        ? " Last test: speech started. If you heard nothing, check the ring/silent switch and media volume."
        : " Last test: speech did NOT start" + (st.error ? " (error: " + st.error + ")" : "") + ".";
    }
    note.textContent = voices.length + " German voice(s) available." + diag;
    const current = Store.getSettings().voiceURI;
    for (const v of voices) {
      const opt = new Option(v.name + " (" + v.lang + ")", v.voiceURI);
      sel.add(opt);
    }
    if (current && voices.some(v => v.voiceURI === current)) sel.value = current;
  }

  function renderSettings() {
    renderVoices();
    const s = Store.getSettings();
    $("theme-select").value = s.theme || "system";
    $("rate-slider").value = s.rate;
    $("rate-value").textContent = s.rate.toFixed(2).replace(/0$/, "");
    const rs = $("reset-deck-select");
    rs.innerHTML = "";
    for (const d of Decks.all()) rs.add(new Option(d.title, d.id));
    $("about-version").textContent = "Version " + VERSION + " · " + Decks.all().length + " decks loaded";
  }

  /* ---- backup ---- */

  function exportProgress() {
    const data = Store.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const d = new Date();
    a.download = "deutsch-decks-backup-" + d.toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  async function importProgressFile(file) {
    let data;
    try { data = JSON.parse(await file.text()); }
    catch (e) { await info("Import failed", "Not valid JSON: " + e.message); return; }
    if (!data || data.app !== "deutsch-decks" || typeof data.progress !== "object") {
      await info("Import failed", "This file is not a Deutsch Decks backup (missing app marker or progress data).");
      return;
    }

    const incoming = data.progress || {};
    const existing = Store.allProgress();
    const ids = Object.keys(incoming);
    const overlapping = ids.filter(id => existing[id]);

    const box = document.createElement("div");
    const lines = [
      `Backup from: ${data.exportedAt || "unknown date"}`,
      `Cards with progress in backup: ${ids.length}`,
      `Will overwrite existing progress on: ${overlapping.length} card(s)`,
      `Existing progress on other cards is kept.`,
    ];
    for (const t of lines) {
      const p = document.createElement("p"); p.textContent = t; box.appendChild(p);
    }
    if (data.customDecks && Object.keys(data.customDecks).length) {
      const p = document.createElement("p");
      p.textContent = `Also restores ${Object.keys(data.customDecks).length} imported deck(s).`;
      box.appendChild(p);
    }
    if (Array.isArray(data.bookmarks) && data.bookmarks.length) {
      const p = document.createElement("p");
      p.textContent = `Adds ${data.bookmarks.length} bookmark(s) to your existing ones.`;
      box.appendChild(p);
    }

    const yes = await modal("Import progress?", box, { okLabel: "Import", danger: overlapping.length > 0 });
    if (!yes) return;

    const merged = Object.assign({}, existing, incoming);
    Store.replaceProgress(merged);
    if (Array.isArray(data.bookmarks)) {
      Store.setBookmarks([...new Set([...Store.getBookmarks(), ...data.bookmarks.filter(id => typeof id === "string")])]);
    }
    if (data.customDecks) {
      for (const [id, d] of Object.entries(data.customDecks)) {
        if (d && d.meta && Array.isArray(d.cards)) Decks.saveImportedDeck(id, d.meta, d.cards);
      }
    }
    Browse.invalidate();
    await info("Done", "Progress imported.");
    updateDueBadge();
  }

  async function resetDeck() {
    const deckId = $("reset-deck-select").value;
    const deck = Decks.byId(deckId);
    if (!deck) return;
    let cards;
    try { cards = await Decks.getCards(deckId); }
    catch (e) { await info("Unavailable", e.message); return; }
    const withProgress = cards.filter(c => Store.getRec(c.id)).length;
    const yes = await modal("Reset deck progress?",
      `This deletes study progress for ${withProgress} card(s) in "${deck.title}". The deck itself is kept. This cannot be undone.`,
      { okLabel: "Reset", danger: true });
    if (!yes) return;
    Store.deleteRecs(cards.map(c => c.id));
    updateDueBadge();
    await info("Done", "Deck progress reset.");
  }

  async function resetAllData() {
    const yes = await modal("Reset ALL data?",
      "This deletes all study progress, settings, and imported decks on this device. Export a backup first if unsure. This cannot be undone.",
      { okLabel: "Delete everything", danger: true });
    if (!yes) return;
    Store.resetAll();
    Browse.invalidate();
    await info("Done", "All data was reset.");
    location.reload();
  }

  /* ================= service worker ================= */

  function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("sw.js").then((reg) => {
      function watch(worker) {
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateBanner(reg);
          }
        });
      }
      if (reg.waiting && navigator.serviceWorker.controller) showUpdateBanner(reg);
      if (reg.installing) watch(reg.installing);
      reg.addEventListener("updatefound", () => { if (reg.installing) watch(reg.installing); });
    }).catch(e => console.warn("SW registration failed:", e));

    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
  }

  function showUpdateBanner(reg) {
    const banner = $("update-banner");
    banner.hidden = false;
    $("update-refresh").onclick = () => {
      if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
      else location.reload();
    };
  }

  /* ================= wiring ================= */

  function wire() {
    for (const t of document.querySelectorAll(".tab")) {
      t.addEventListener("click", () => switchScreen(t.dataset.screen));
    }

    $("direction-select").addEventListener("change", (e) => {
      Store.saveSettings({ direction: e.target.value });
    });

    $("btn-review").addEventListener("click", async () => {
      if (!Store.getSettings().selectedDecks.length) { showNotice("Select at least one deck first (Decks tab)."); return; }
      if (await Study.start("review")) switchScreen("study");
    });
    $("btn-cram").addEventListener("click", async () => {
      if (!Store.getSettings().selectedDecks.length) { showNotice("Select at least one deck first (Decks tab)."); return; }
      if (await Study.start("cram")) switchScreen("study");
    });

    $("btn-bookmarks").addEventListener("click", startBookmarkReview);
    $("btn-bookmark").addEventListener("click", toggleCurrentBookmark);

    $("btn-flip").addEventListener("click", () => Study.flip());
    $("study-card").addEventListener("click", () => { if (!Study.isFlipped()) Study.flip(); });
    for (const b of document.querySelectorAll("#grade-buttons .grade")) {
      b.addEventListener("click", () => Study.gradeCurrent(Number(b.dataset.grade)));
    }
    $("study-exit").addEventListener("click", () => switchScreen("home"));
    $("btn-study-home").addEventListener("click", () => switchScreen("home"));

    $("btn-select-all").addEventListener("click", () => selectAll(true));
    $("btn-select-none").addEventListener("click", () => selectAll(false));
    $("btn-import-deck").addEventListener("click", () => $("deck-file-input").click());
    $("deck-file-input").addEventListener("change", (e) => {
      const f = e.target.files[0];
      e.target.value = "";
      if (f) importDeckFile(f);
    });

    Browse.init();

    $("theme-select").addEventListener("change", (e) => {
      Store.saveSettings({ theme: e.target.value });
      applyTheme(e.target.value);
    });
    $("voice-select").addEventListener("change", (e) => Store.saveSettings({ voiceURI: e.target.value || null }));
    $("rate-slider").addEventListener("input", (e) => {
      const rate = Number(e.target.value);
      Store.saveSettings({ rate });
      $("rate-value").textContent = rate.toFixed(2).replace(/0$/, "");
    });
    $("btn-test-voice").addEventListener("click", () => {
      TTS.speak("Guten Tag! Ich bin deine deutsche Stimme.", $("btn-test-voice"));
      setTimeout(renderVoices, 3500);   // surface start/error status after the attempt (incl. retry)
    });
    document.addEventListener("dd-voices-changed", () => {
      if (currentScreen === "settings") renderVoices();
    });

    $("btn-export").addEventListener("click", exportProgress);
    $("btn-import-progress").addEventListener("click", () => $("progress-file-input").click());
    $("progress-file-input").addEventListener("change", (e) => {
      const f = e.target.files[0];
      e.target.value = "";
      if (f) importProgressFile(f);
    });
    $("btn-reset-deck").addEventListener("click", resetDeck);
    $("btn-reset-all").addEventListener("click", resetAllData);

    $("modal-ok").addEventListener("click", () => closeModal(true));
    $("modal-cancel").addEventListener("click", () => closeModal(false));
    $("modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(false); });

    // keyboard support on desktop: space = flip, 1-4 = grade
    document.addEventListener("keydown", (e) => {
      if (currentScreen !== "study" || e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
      if (e.code === "Space") { e.preventDefault(); Study.flip(); }
      if (["1", "2", "3", "4"].includes(e.key)) Study.gradeCurrent(Number(e.key) - 1);
      if (e.key === "b") toggleCurrentBookmark();
    });
  }

  /* ================= boot ================= */

  async function init() {
    applyTheme(Store.getSettings().theme);
    wire();
    registerSW();
    await Decks.loadCatalogue();
    const err = Decks.getCatalogueError();
    if (err) showNotice(err);
    // first run: preselect all catalogue decks so the app is usable immediately
    const s = Store.getSettings();
    if (!s.selectedDecks.length && !localStorage.getItem("dd.touched")) {
      Store.saveSettings({ selectedDecks: Decks.all().filter(d => d.source === "catalogue").map(d => d.id) });
      localStorage.setItem("dd.touched", "1");
    }
    switchScreen("home");
    updateDueBadge();
  }

  document.addEventListener("DOMContentLoaded", init);

  return { showNotice, updateDueBadge, modal, info, refreshBookmarkBtn };
})();
