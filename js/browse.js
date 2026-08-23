/* browse.js — search & filter across the selected decks (or all decks). */
"use strict";

const Browse = (() => {
  const $ = (id) => document.getElementById(id);
  let cards = [];
  let loaded = false;

  async function load() {
    const deckIds = Decks.all().map(d => d.id);
    const { cards: c, failures } = await Decks.getCardsMulti(deckIds);
    cards = c;
    if (failures.length) App.showNotice(failures.join(" "));
    loaded = true;
    fillFilters();
    render();
  }

  function fillFilters() {
    const lessonSel = $("browse-lesson");
    const topicSel = $("browse-topic");
    const keepL = lessonSel.value, keepT = topicSel.value;
    lessonSel.length = 1;
    topicSel.length = 1;
    const lessons = [...new Set(cards.map(c => c._lessonLabel).filter(Boolean))];
    const topics = [...new Set(cards.map(c => c.topic).filter(Boolean))].sort((a, b) => a.localeCompare(b, "de"));
    for (const l of lessons) lessonSel.add(new Option(l, l));
    for (const t of topics) topicSel.add(new Option(t, t));
    lessonSel.value = keepL;
    topicSel.value = keepT;
  }

  function matches(card, q, lesson, topic) {
    if (lesson && card._lessonLabel !== lesson) return false;
    if (topic && card.topic !== topic) return false;
    if (!q) return true;
    const hay = (card.de + " " + card.en + " " + (card.topic || "")).toLowerCase();
    return hay.includes(q);
  }

  function detailNode(card) {
    const d = document.createElement("div");
    d.className = "b-detail";
    if (card.plural) {
      const p = document.createElement("div");
      p.className = "word-sub";
      p.textContent = "Plural: " + card.plural;
      d.appendChild(p);
    }
    for (const [de, en] of [[card.s1_de, card.s1_en], [card.s2_de, card.s2_en]]) {
      if (!de) continue;
      const box = document.createElement("div");
      box.className = "example";
      const line = document.createElement("div");
      line.className = "de-line";
      line.appendChild(TTS.button(de, de));
      const span = document.createElement("span");
      span.lang = "de";
      span.textContent = de;
      line.appendChild(span);
      box.appendChild(line);
      if (en) {
        const enLine = document.createElement("div");
        enLine.className = "en-line";
        enLine.textContent = en;
        box.appendChild(enLine);
      }
      d.appendChild(box);
    }
    const chips = document.createElement("div");
    chips.className = "chip-row";
    for (const t of [card._lessonLabel, card.topic]) {
      if (!t) continue;
      const c = document.createElement("span");
      c.className = "chip";
      c.textContent = t;
      chips.appendChild(c);
    }
    d.appendChild(chips);
    return d;
  }

  function render() {
    const q = $("browse-search").value.trim().toLowerCase();
    const lesson = $("browse-lesson").value;
    const topic = $("browse-topic").value;
    const list = $("browse-list");
    list.innerHTML = "";

    const hits = cards.filter(c => matches(c, q, lesson, topic));
    $("browse-count").textContent = hits.length + " of " + cards.length + " cards";

    const frag = document.createDocumentFragment();
    for (const card of hits.slice(0, 200)) {
      const li = document.createElement("li");
      const det = document.createElement("details");
      det.className = "browse-item";
      const sum = document.createElement("summary");
      const de = document.createElement("span");
      de.className = "b-de";
      de.lang = "de";
      de.textContent = card.de;
      const en = document.createElement("span");
      en.className = "b-en";
      en.textContent = card.en;
      sum.appendChild(de);
      sum.appendChild(en);
      det.appendChild(sum);
      det.addEventListener("toggle", () => {
        if (det.open && !det.querySelector(".b-detail")) det.appendChild(detailNode(card));
      }, { once: false });
      li.appendChild(det);
      frag.appendChild(li);
    }
    list.appendChild(frag);
    if (hits.length > 200) {
      const li = document.createElement("li");
      li.className = "muted";
      li.style.padding = "8px";
      li.textContent = "Showing first 200 — refine your search.";
      list.appendChild(li);
    }
  }

  function show() {
    if (!loaded) load();
    else { fillFilters(); render(); }
  }

  function invalidate() { loaded = false; }

  function init() {
    $("browse-search").addEventListener("input", render);
    $("browse-lesson").addEventListener("change", render);
    $("browse-topic").addEventListener("change", render);
  }

  return { init, show, invalidate };
})();
