/* sentences.js — sentence practice (English → German, typed answers).
 * Static sentence bank from data/practice/, filtered by theme and by the
 * level the learner has reached (cumulative stages 1–6). Answers are checked
 * on-device by SentCheck; the correct German is spoken via the Web Speech API
 * as a direct result of the Check tap (can be switched off). Progress uses
 * the normal SRS records under the items' unique "SP-…" ids.
 */
"use strict";

const Sentences = (() => {
  const DIR = "data/practice/";
  const SESSION_SIZE = 12;
  const MAX_REQUEUE = 2;

  let bank = null;            // { stages: [...], themes: [{id, title, title_de, icon, items}] }
  let queue = [];
  let total = 0, done = 0, step = 0;
  let tally = { correct: 0, almost: 0, wrong: 0 };
  let current = null;         // item being answered
  let state = null;           // per-item: { firstVerdict, hint, requeues, lastInput }
  const requeues = {};

  const $ = (id) => document.getElementById(id);
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function tabBar(hidden) { document.querySelector(".tab-bar").hidden = hidden; }

  // ---------- data ----------
  async function load() {
    if (bank) return bank;
    const res = await fetch(DIR + "index.json");
    if (!res.ok) throw new Error("index " + res.status);
    const idx = await res.json();
    const themes = await Promise.all(idx.themes.map(async (t) => {
      let items = [];
      try {
        const r = await fetch(DIR + t.file);
        if (r.ok) items = (await r.json()).filter(it => it && it.id && it.en && it.de);
      } catch (e) { /* theme stays empty */ }
      return Object.assign({}, t, { items: items.map(it => Object.assign({ theme: t.id }, it)) });
    }));
    bank = { stages: idx.stages, themes };
    return bank;
  }

  function level() {
    const n = Number(Store.getSettings().practiceLevel) || 1;
    return Math.min(bank.stages.length, Math.max(1, n));
  }
  function selectedThemes() {
    const saved = Store.getSettings().practiceThemes || [];
    const valid = saved.filter(id => bank.themes.some(t => t.id === id));
    return valid.length ? valid : bank.themes.map(t => t.id);
  }
  function pool() {
    const lv = level(), sel = new Set(selectedThemes());
    const out = [];
    for (const t of bank.themes) {
      if (!sel.has(t.id)) continue;
      for (const it of t.items) if (it.stage <= lv && !Store.isPracticeDone(it.id)) out.push(it);
    }
    return out;
  }
  /* sentences of the current selection that were marked "mastered" */
  function masteredInSelection() {
    const lv = level(), sel = new Set(selectedThemes());
    const out = [];
    for (const t of bank.themes) {
      if (!sel.has(t.id)) continue;
      for (const it of t.items) if (it.stage <= lv && Store.isPracticeDone(it.id)) out.push(it);
    }
    return out;
  }

  /* An unfinished session saved by save(): phones drop a backgrounded page
   * from memory, and without this the learner would start over on return. */
  const SESSION_MAX_AGE = 24 * 60 * 60 * 1000;
  function savedSession() {
    const s = Store.getPracticeSession();
    if (!s || !Array.isArray(s.ids) || !bank) return null;
    if (Date.now() - (s.t || 0) > SESSION_MAX_AGE) { Store.clearPracticeSession(); return null; }
    const byId = {};
    for (const t of bank.themes) for (const it of t.items) byId[it.id] = it;
    const items = s.ids.map(id => byId[id]).filter(it => it && !Store.isPracticeDone(it.id));
    if (!items.length) { Store.clearPracticeSession(); return null; }
    return { items, s };
  }
  function save() {
    if (!current) return;
    Store.savePracticeSession({
      t: Date.now(), ids: [current.id].concat(queue.map(it => it.id)),
      step, total, done, tally, requeues,
    });
  }

  // ---------- setup screen ----------
  async function show() {
    exit();
    $("practice-setup").hidden = false;
    $("practice-session").hidden = true;
    try {
      await load();
    } catch (e) {
      $("practice-themes").textContent = "";
      $("practice-count").textContent = "Could not load the sentence bank. Open the app once while online so it can be saved for offline use.";
      $("btn-practice-start").disabled = true;
      return;
    }
    $("practice-level").max = String(bank.stages.length);
    $("practice-level").value = String(level());
    $("practice-speak").checked = Store.getSettings().speakAnswer !== false;
    renderSetup();
  }

  function renderSetup() {
    const lv = level(), sel = new Set(selectedThemes());

    const box = $("practice-themes");
    box.textContent = "";
    for (const t of bank.themes) {
      const n = t.items.filter(it => it.stage <= lv).length;
      const b = el("button", "theme-btn" + (sel.has(t.id) ? " selected" : ""));
      b.type = "button";
      b.setAttribute("aria-pressed", sel.has(t.id) ? "true" : "false");
      b.append(el("span", "theme-icon", t.icon || "💬"));
      const txt = el("span", "theme-text");
      txt.append(el("strong", "", t.title), el("span", "muted", (t.title_de ? t.title_de + " · " : "") + n + " sentences"));
      b.append(txt);
      b.addEventListener("click", () => {
        const cur = new Set(selectedThemes());
        if (cur.has(t.id)) { if (cur.size > 1) cur.delete(t.id); } else cur.add(t.id);
        Store.saveSettings({ practiceThemes: [...cur] });
        renderSetup();
      });
      box.append(b);
    }

    const st = bank.stages[lv - 1];
    $("practice-level-label").textContent = st.label;
    const gl = $("practice-grammar");
    gl.textContent = "";
    for (const s of bank.stages.slice(0, lv)) {
      const li = el("li", s.n === lv ? "current" : "");
      li.append(el("strong", "", s.label + ": "), document.createTextNode(s.grammar));
      gl.append(li);
    }

    const items = pool(), now = Date.now();
    let due = 0, fresh = 0;
    for (const it of items) {
      const rec = Store.getRec(it.id);
      if (!rec) fresh++; else if (SRS.isDueNow(rec, now)) due++;
    }
    const mastered = masteredInSelection().length;
    let msg = items.length + " sentences at this level · " + fresh + " new · " + due + " due for review";
    if (mastered) msg += " · " + mastered + " mastered (hidden)";
    msg += ". A session has up to " + SESSION_SIZE + ".";
    if (items.length && !fresh && !due) msg += " Nothing is new or due right now — a session would repeat sentences you already got right.";
    if (!items.length && mastered) msg = "You have marked all " + mastered + " sentences at this level as mastered. Raise the level, add a theme, or bring them back.";
    $("practice-count").textContent = msg;

    const bRestore = $("btn-practice-restore");
    bRestore.hidden = mastered === 0;
    bRestore.textContent = "↺ Bring back " + mastered + " mastered sentence" + (mastered === 1 ? "" : "s");

    const saved = savedSession();
    const bResume = $("btn-practice-resume"), bStart = $("btn-practice-start");
    bResume.hidden = !saved;
    if (saved) bResume.textContent = "▶ Resume session (" + saved.items.length + " sentence" + (saved.items.length === 1 ? "" : "s") + " left)";
    bStart.classList.toggle("btn-primary", !saved);
    bStart.textContent = saved ? "Start a new session" : (items.length && !fresh && !due ? "Practise anyway" : "Start practice");
    bStart.disabled = items.length === 0;
  }

  // ---------- session ----------
  function buildQueue() {
    const lv = level(), now = Date.now();
    const due = [], fresh = [], seen = [];
    for (const it of pool()) {
      const rec = Store.getRec(it.id);
      if (!rec) fresh.push(it); else if (SRS.isDueNow(rec, now)) due.push(it); else seen.push(it);
    }
    shuffle(due);
    // new sentences: favour the learner's current stages, keep some easier ones mixed in
    const top = shuffle(fresh.filter(it => it.stage >= lv - 1));
    const rest = shuffle(fresh.filter(it => it.stage < lv - 1));
    const mixed = [];
    while (top.length || rest.length) mixed.push(...top.splice(0, 2), ...rest.splice(0, 1));
    const fresh2 = due.concat(mixed);
    if (fresh2.length) return fresh2.slice(0, SESSION_SIZE);
    // nothing new or due: only then repeat known sentences, longest-unseen first
    seen.sort((a, b) => Store.getRec(a.id).last - Store.getRec(b.id).last);
    return seen.slice(0, SESSION_SIZE);
  }

  function start() {
    if (!bank) return;
    queue = buildQueue();
    if (!queue.length) return;
    Store.clearPracticeSession();
    total = queue.length; done = 0; step = 0;
    tally = { correct: 0, almost: 0, wrong: 0 };
    for (const k of Object.keys(requeues)) delete requeues[k];
    begin();
  }

  function resume() {
    const saved = bank && savedSession();
    if (!saved) { if (bank) renderSetup(); return; }
    const s = saved.s;
    queue = saved.items;
    step = Math.max(0, (Number(s.step) || 1) - 1);
    total = Number(s.total) || queue.length;
    done = Number(s.done) || 0;
    tally = Object.assign({ correct: 0, almost: 0, wrong: 0 }, s.tally);
    for (const k of Object.keys(requeues)) delete requeues[k];
    Object.assign(requeues, s.requeues);
    begin();
  }

  function begin() {
    $("practice-setup").hidden = true;
    $("practice-session").hidden = false;
    $("practice-done").hidden = true;
    $("practice-card").hidden = false;
    tabBar(true);
    next();
  }

  function updateProgress() {
    // missed sentences are re-queued, so the session length grows with them
    const len = step + queue.length;
    $("practice-progress").style.width = (len ? Math.round((step - 1) / len * 100) : 0) + "%";
    $("practice-pos").textContent = step + " / " + len;
  }

  function next() {
    TTS.stop();
    if (!queue.length) { finish(); return; }
    current = queue.shift();
    step += 1;
    state = { firstVerdict: null, hint: 0, lastInput: "" };
    save();
    updateProgress();
    renderQuestion();
  }

  function themeOf(item) { return bank.themes.find(t => t.id === item.theme) || {}; }

  function renderQuestion() {
    const card = $("practice-card");
    card.textContent = "";
    const t = themeOf(current);
    const chips = el("div", "chip-row");
    chips.append(el("span", "chip", (t.icon ? t.icon + " " : "") + (t.title || "")));
    chips.append(el("span", "chip", bank.stages[current.stage - 1] ? bank.stages[current.stage - 1].label : ""));
    if (current.cue) chips.append(el("span", "chip chip-cue", current.cue));
    card.append(chips);

    card.append(el("p", "muted practice-lead", "Say it in German:"));
    card.append(el("p", "practice-en", current.en));

    const ta = el("textarea", "input practice-input");
    ta.id = "practice-input";
    ta.rows = 3;
    ta.lang = "de";
    ta.placeholder = "Type the German sentence…";
    ta.setAttribute("autocomplete", "off");
    ta.setAttribute("autocorrect", "off");
    ta.setAttribute("autocapitalize", "sentences");
    ta.spellcheck = false;
    ta.value = state.lastInput;
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); check(); }
    });
    card.append(ta);

    const keys = el("div", "umlaut-row");
    for (const ch of ["ä", "ö", "ü", "ß", "Ä", "Ö", "Ü"]) {
      const k = el("button", "btn umlaut-key", ch);
      k.type = "button";
      k.setAttribute("aria-label", "Insert " + ch);
      k.addEventListener("click", () => {
        const s = ta.selectionStart ?? ta.value.length, e = ta.selectionEnd ?? ta.value.length;
        ta.value = ta.value.slice(0, s) + ch + ta.value.slice(e);
        ta.focus();
        ta.setSelectionRange(s + 1, s + 1);
      });
      keys.append(k);
    }
    card.append(keys);

    const hintBox = el("div", "practice-hint");
    hintBox.id = "practice-hint";
    hintBox.hidden = true;
    card.append(hintBox);

    const row = el("div", "practice-actions");
    const bHint = el("button", "btn", "💡 Hint");
    bHint.type = "button";
    bHint.addEventListener("click", () => showHint(hintBox, bHint));
    const bCheck = el("button", "btn btn-primary", "Check");
    bCheck.type = "button";
    bCheck.addEventListener("click", check);
    row.append(bHint, bCheck);
    card.append(row);
    // known already: retire the sentence without typing it
    const bKnown = el("button", "btn btn-small override-btn", "✓ Mastered — skip, don't show this again");
    bKnown.type = "button";
    bKnown.addEventListener("click", skipMastered);
    card.append(bKnown);
    if (state.hint) { state.hint -= 1; showHint(hintBox, bHint); }
  }

  function showHint(box, btn) {
    state.hint = Math.min(3, state.hint + 1);
    box.textContent = "";
    box.hidden = false;
    box.append(el("p", "", "Pattern: " + current.pattern));
    if (current.vocab && current.vocab.length) {
      box.append(el("p", "muted", current.vocab.map(v => v[0] + " = " + v[1]).join(" · ")));
    }
    const words = SentCheck.tokenize(current.de);
    if (state.hint >= 2) box.append(el("p", "", "Starts with “" + words[0].raw + " …” · " + words.length + " words"));
    if (state.hint >= 3) {
      box.append(el("p", "hint-letters", words.map(w => w.raw[0] + "_".repeat(Math.max(1, w.raw.length - 1))).join("  ")));
      btn.disabled = true;
    }
  }

  function marked(tokens, classes) {
    const p = el("p", "diff-line");
    tokens.forEach((t, i) => {
      if (i) p.append(" ");
      p.append(el("span", "w-" + classes[i], t.disp));
    });
    return p;
  }

  function check() {
    const ta = $("practice-input");
    if (!ta) return;
    const r = SentCheck.check(ta.value, current);
    if (r.verdict === "empty") { ta.focus(); return; }
    state.lastInput = ta.value;
    if (!state.firstVerdict) state.firstVerdict = r.verdict;
    ta.blur();

    const card = $("practice-card");
    card.textContent = "";
    card.append(el("p", "muted practice-lead", current.en));

    const banner = { correct: ["verdict v-ok", "✓ Correct"], almost: ["verdict v-almost", "≈ Almost — only spelling"], wrong: ["verdict v-bad", "✗ Not quite yet"] }[r.verdict];
    card.append(el("div", banner[0], banner[1]));

    if (r.verdict !== "correct") {
      card.append(el("p", "diff-label muted", "Your answer"));
      card.append(marked(r.inTok, r.inCls));
    }
    card.append(el("p", "diff-label muted", r.verdict === "correct" ? "Your answer is right" : "Correct answer"));
    const line = el("div", "example answer-line");
    const speakBtn = TTS.button(r.best, "correct answer");
    line.append(speakBtn, marked(r.ansTok, r.ansCls));
    card.append(line);

    if (r.messages.length || r.notes.length) {
      const ul = el("ul", "issue-list");
      for (const m of r.messages) ul.append(el("li", "", m));
      for (const n of r.notes) ul.append(el("li", "soft", n));
      card.append(ul);
    }

    const tip = el("div", "g-tip");
    tip.append(el("strong", "", current.pattern), el("p", "", current.why));
    card.append(tip);

    const others = [current.de].concat(current.alt || []).filter(a => a !== r.best);
    if (others.length) {
      const also = el("div", "also-ok muted");
      also.append(el("p", "", "Also accepted:"));
      for (const a of others.slice(0, 4)) also.append(el("p", "", a));
      card.append(also);
    }

    const row = el("div", "practice-actions");
    if (r.verdict !== "correct") {
      const bRetry = el("button", "btn", "↺ Try again");
      bRetry.type = "button";
      bRetry.addEventListener("click", () => { TTS.stop(); renderQuestion(); const t2 = $("practice-input"); if (t2) t2.focus(); });
      row.append(bRetry);
    }
    const bNext = el("button", "btn btn-primary", "Next →");
    bNext.type = "button";
    bNext.addEventListener("click", () => commit(state.firstVerdict));
    row.append(bNext);
    card.append(row);
    if (r.verdict !== "correct") {
      const bOver = el("button", "btn btn-small override-btn", "My answer was also correct");
      bOver.type = "button";
      bOver.addEventListener("click", () => commit("correct"));
      card.append(bOver);
    }
    // second opinion: copies a ready-made prompt; the app itself sends nothing
    const bDone = el("button", "btn btn-small override-btn", "✓ Mastered — don't show this again");
    bDone.type = "button";
    bDone.addEventListener("click", () => {
      Store.addPracticeDone(current.id);
      tally.mastered = (tally.mastered || 0) + 1;
      commit(state.firstVerdict, true);
    });
    card.append(bDone);
    const bAsk = el("button", "btn btn-small override-btn", "📋 Ask Claude — copy my answer as a question");
    bAsk.type = "button";
    const askNote = el("div", "ask-note");
    askNote.hidden = true;
    bAsk.addEventListener("click", () => askClaude(bAsk, askNote));
    card.append(bAsk, askNote);
    card.scrollIntoView({ block: "start" });

    // spoken as a direct result of the Check tap/Enter (user gesture); German only
    if (Store.getSettings().speakAnswer !== false) TTS.speak(r.best, speakBtn);
  }

  /* "Ask Claude": build a question about the learner's sentence and put it on
   * the clipboard, to be pasted into the Claude app by hand. No network call. */
  function askPrompt() {
    const st = bank.stages[level() - 1];
    const lines = [
      "I am learning German (my level: " + st.label + "). I translated an English sentence into German. Please check my German sentence.",
      "",
      "English: " + current.en,
    ];
    if (current.cue) lines.push("Context: " + current.cue);
    lines.push(
      "My German: " + state.lastInput.trim(),
      "Reference answer from my study app: " + current.de,
      "",
      "1. Is my sentence grammatically correct, and does it mean the same as the English?",
      "2. If not, give the corrected sentence and explain each mistake briefly in English (word order, case, endings, word choice).",
      "3. If my sentence is correct but simply different from the reference answer, say so clearly.",
      "Keep the explanation short and suited to my level."
    );
    return lines.join("\n");
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
    } catch (e) { /* fall through to the legacy path */ }
    try {
      const tmp = document.createElement("textarea");
      tmp.value = text;
      tmp.setAttribute("readonly", "");
      tmp.style.position = "fixed";
      tmp.style.opacity = "0";
      document.body.append(tmp);
      tmp.select();
      tmp.setSelectionRange(0, text.length);
      const ok = document.execCommand("copy");
      tmp.remove();
      return ok;
    } catch (e) { return false; }
  }

  async function askClaude(btn, note) {
    const text = askPrompt();
    const ok = await copyText(text);
    note.textContent = "";
    note.hidden = false;
    if (ok) {
      btn.textContent = "✓ Copied";
      note.append(el("p", "muted", "Now open the Claude app and paste. Nothing was sent by this app."));
    } else {
      // clipboard blocked: show the text so it can be copied by hand
      note.append(el("p", "muted", "Could not copy automatically — select the text below and copy it, then paste it into the Claude app."));
      const box = el("textarea", "input practice-input");
      box.readOnly = true;
      box.rows = 8;
      box.value = text;
      note.append(box);
      box.focus();
      box.select();
    }
  }

  /* "Mastered" tapped on the question itself: hide the sentence without an
   * answer. No SRS grade is written — nothing was actually answered. */
  function skipMastered() {
    if (!current) return;
    Store.addPracticeDone(current.id);
    tally.mastered = (tally.mastered || 0) + 1;
    done += 1;
    next();
  }

  /* grade the item once, when the learner moves on */
  function commit(verdict, noRequeue) {
    const now = Date.now();
    const n = requeues[current.id] || 0;
    // Typed correctly at the first go without a hint = known: Easy, so it stays
    // away for days instead of the flashcard learning steps (10 min). With a
    // hint or on a second pass: Good (back next session). Almost: Hard. Wrong: Again.
    const g = verdict === "correct" ? (state.hint || n ? 2 : 3) : verdict === "almost" ? 1 : 0;
    Store.setRec(current.id, SRS.grade(Store.getRec(current.id), g, now));
    if (n === 0) tally[verdict] += 1;            // tally the first pass only
    if (verdict === "wrong" && n < MAX_REQUEUE && !noRequeue) {
      requeues[current.id] = n + 1;
      queue.push(current);                        // comes back at the end of the session
    } else {
      done += 1;
    }
    next();
  }

  function finish() {
    current = null;
    Store.clearPracticeSession();
    TTS.stop();
    $("practice-card").hidden = true;
    $("practice-done").hidden = false;
    $("practice-progress").style.width = "100%";
    $("practice-pos").textContent = step + " / " + step;
    $("practice-done-msg").textContent = total + " sentences · " + tally.correct + " correct · " + tally.almost + " almost · " + tally.wrong + " to work on"
      + (tally.mastered ? " · " + tally.mastered + " marked as mastered" : "")
      + ". Sentences you missed come back sooner next time.";
  }

  /* leave the session (also called when another screen opens) */
  function exit() {
    TTS.stop();
    current = null;
    queue = [];
    const sess = $("practice-session");
    if (sess && !sess.hidden) {
      sess.hidden = true;
      $("practice-setup").hidden = false;
      tabBar(false);
    }
  }

  function backToSetup() { exit(); if (bank) renderSetup(); }

  // ---------- wiring ----------
  $("btn-practice-start").addEventListener("click", start);
  $("btn-practice-resume").addEventListener("click", resume);
  $("btn-practice-restore").addEventListener("click", () => {
    if (!bank) return;
    Store.removePracticeDone(masteredInSelection().map(it => it.id));
    renderSetup();
  });
  $("practice-exit").addEventListener("click", backToSetup);
  $("btn-practice-again").addEventListener("click", backToSetup);
  $("practice-level").addEventListener("input", (e) => {
    Store.saveSettings({ practiceLevel: Number(e.target.value) });
    if (bank) renderSetup();
  });
  $("practice-speak").addEventListener("change", (e) => {
    Store.saveSettings({ speakAnswer: e.target.checked });
  });

  return { show, exit };
})();
