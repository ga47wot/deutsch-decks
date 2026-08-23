/* study.js — review (SM-2 scheduled) and cram sessions, card rendering. */
"use strict";

const Study = (() => {
  const REQUEUE_HORIZON = 15 * 60 * 1000; // re-show within session if due this soon

  let mode = null;          // 'review' | 'cram'
  let queue = [];           // cards waiting
  let current = null;
  let initialCount = 0;
  let doneCount = 0;
  let flipped = false;

  const $ = (id) => document.getElementById(id);

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* ---------- queue building ---------- */

  async function buildQueue(m) {
    const sel = Store.getSettings().selectedDecks;
    const { cards, failures } = await Decks.getCardsMulti(sel);
    if (failures.length) App.showNotice(failures.join(" "));

    if (m === "cram") return shuffle(cards.slice());

    const now = Date.now();
    const learning = [], review = [], fresh = [];
    for (const c of cards) {
      const rec = Store.getRec(c.id);
      if (!rec) { fresh.push(c); continue; }
      if ((rec.st === "learn" || rec.st === "relearn") && SRS.isDueToday(rec, now)) learning.push(c);
      else if (SRS.isDueToday(rec, now)) review.push(c);
    }
    learning.sort((a, b) => Store.getRec(a.id).due - Store.getRec(b.id).due);
    review.sort((a, b) => Store.getRec(a.id).due - Store.getRec(b.id).due);
    const newAllowance = Math.max(0, (Store.getSettings().newPerDay || 20) - Store.newIntroducedToday());
    return [...learning, ...review, ...shuffle(fresh).slice(0, newAllowance)];
  }

  /* ---------- rendering ---------- */

  function chipRow(card) {
    const row = document.createElement("div");
    row.className = "chip-row";
    const chips = [card._lessonLabel, card.topic, card.type === "phrase" ? "phrase" : null];
    for (const text of chips) {
      if (!text) continue;
      const c = document.createElement("span");
      c.className = "chip";
      c.textContent = text;
      row.appendChild(c);
    }
    return row;
  }

  function germanWordLine(card, big) {
    const line = document.createElement("div");
    line.className = "word-line";
    const w = document.createElement("div");
    w.className = big ? "word-main" : "word-main";
    w.lang = "de";
    w.textContent = card.de;
    line.appendChild(w);
    line.appendChild(TTS.button(card.de, card.de));
    return line;
  }

  function pluralLine(card) {
    if (!card.plural) return null;
    const p = document.createElement("div");
    p.className = "word-sub";
    p.textContent = "Plural: " + card.plural;
    return p;
  }

  function example(deText, enText) {
    if (!deText) return null;
    const box = document.createElement("div");
    box.className = "example";
    const deLine = document.createElement("div");
    deLine.className = "de-line";
    deLine.appendChild(TTS.button(deText, deText));
    const span = document.createElement("span");
    span.lang = "de";
    span.textContent = deText;
    deLine.appendChild(span);
    box.appendChild(deLine);
    if (enText) {
      const enLine = document.createElement("div");
      enLine.className = "en-line";
      enLine.textContent = enText;
      box.appendChild(enLine);
    }
    return box;
  }

  function renderFront(card) {
    const el = $("card-front");
    el.innerHTML = "";
    const dir = Store.getSettings().direction;
    if (dir === "de-en") {
      el.appendChild(germanWordLine(card, true));
      const pl = pluralLine(card);
      if (pl) el.appendChild(pl);
    } else {
      const w = document.createElement("div");
      w.className = "word-main";
      w.textContent = card.en;
      el.appendChild(w);
    }
    el.appendChild(chipRow(card));
  }

  function renderBack(card) {
    const el = $("card-back");
    el.innerHTML = "";
    const dir = Store.getSettings().direction;

    if (dir === "de-en") {
      el.appendChild(germanWordLine(card, true));
      const pl = pluralLine(card);
      if (pl) el.appendChild(pl);
      const hr = document.createElement("hr"); hr.className = "divider";
      el.appendChild(hr);
      const en = document.createElement("div");
      en.className = "word-main";
      en.textContent = card.en;
      el.appendChild(en);
    } else {
      const en = document.createElement("div");
      en.className = "word-main";
      en.textContent = card.en;
      el.appendChild(en);
      const hr = document.createElement("hr"); hr.className = "divider";
      el.appendChild(hr);
      el.appendChild(germanWordLine(card, true));
      const pl = pluralLine(card);
      if (pl) el.appendChild(pl);
    }

    const ex1 = example(card.s1_de, card.s1_en);
    const ex2 = example(card.s2_de, card.s2_en);
    if (ex1) el.appendChild(ex1);
    if (ex2) el.appendChild(ex2);
    el.appendChild(chipRow(card));
  }

  function updateProgress() {
    const total = initialCount || 1;
    const pct = Math.min(100, Math.round((doneCount / total) * 100));
    $("study-progress").style.width = pct + "%";
    $("study-count").textContent = doneCount + " / " + initialCount;
  }

  function gradeLabels() {
    const names = ["Again", "Hard", "Good", "Easy"];
    const buttons = document.querySelectorAll("#grade-buttons .grade");
    buttons.forEach((b, i) => {
      b.innerHTML = "";
      b.appendChild(document.createTextNode(names[i]));
      if (mode === "review") {
        const small = document.createElement("small");
        small.textContent = SRS.previewIvl(Store.getRec(current.id), i, Date.now());
        b.appendChild(small);
      }
    });
  }

  function showNext() {
    TTS.stop();
    flipped = false;
    const now = Date.now();

    // skip queued learning cards that are not yet due; if everything left is
    // "waiting", show the soonest one anyway rather than stalling the session
    if (mode === "review" && queue.length) {
      const ready = queue.findIndex(c => {
        const rec = Store.getRec(c.id);
        return !rec || rec.due <= now;
      });
      if (ready > 0) queue.unshift(queue.splice(ready, 1)[0]);
    }

    current = queue.shift() || null;
    updateProgress();

    if (!current) {
      $("study-card").hidden = true;
      $("study-actions").hidden = true;
      $("study-done").hidden = false;
      $("study-done-msg").textContent =
        mode === "cram" ? "Cram round complete." : "No more cards due right now. Well done!";
      return;
    }
    $("study-card").hidden = false;
    $("study-actions").hidden = false;
    $("study-done").hidden = true;
    renderFront(current);
    $("card-front").hidden = false;
    $("card-back").hidden = true;
    $("btn-flip").hidden = false;
    $("grade-buttons").hidden = true;
  }

  function flip() {
    if (!current || flipped) return;
    flipped = true;
    renderBack(current);
    $("card-front").hidden = true;
    $("card-back").hidden = false;
    $("btn-flip").hidden = true;
    $("grade-buttons").hidden = false;
    gradeLabels();
  }

  function gradeCurrent(g) {
    if (!current || !flipped) return;
    const now = Date.now();

    if (mode === "review") {
      const prev = Store.getRec(current.id);
      if (!prev) Store.bumpNewIntroduced();
      const rec = SRS.grade(prev, g, now);
      Store.setRec(current.id, rec);
      if (rec.due - now <= REQUEUE_HORIZON) {
        queue.push(current);           // still in learning steps — see it again soon
      } else {
        doneCount += 1;
      }
    } else {
      // cram: no schedule changes; Again re-queues, everything else completes
      if (g === 0) queue.push(current);
      else doneCount += 1;
    }
    App.updateDueBadge();
    showNext();
  }

  async function start(m) {
    mode = m;
    queue = await buildQueue(m);
    initialCount = queue.length;
    doneCount = 0;
    if (!initialCount) {
      App.showNotice(m === "review"
        ? "Nothing due right now in the selected decks. Try Cram, or come back later."
        : "The selected decks contain no cards.");
      return false;
    }
    showNext();
    return true;
  }

  function exit() {
    TTS.stop();
    mode = null;
    queue = [];
    current = null;
  }

  function isFlipped() { return flipped; }

  return { start, flip, gradeCurrent, exit, isFlipped };
})();
