/* grammar.js — grammar reference section. First topic: adjective declension.
 * Structured so more topics can be added to TOPICS later.
 */
"use strict";

const Grammar = (() => {
  const $ = (id) => document.getElementById(id);

  /* ---------------- adjective declension data ----------------
   * Columns: after der-word (weak) | after ein-word (mixed) | no article (strong)
   * Each cell: [article shown, ending] — ending is highlighted in the UI.
   */
  const DECLENSION = {
    Nominativ: {
      question: "Wer? Was? — the subject of the sentence",
      rows: [
        { g: "der",  weak: ["der",  "e"],  mixed: ["ein",   "er"], strong: ["—", "er"], noun: "Mann" },
        { g: "die",  weak: ["die",  "e"],  mixed: ["eine",  "e"],  strong: ["—", "e"],  noun: "Frau" },
        { g: "das",  weak: ["das",  "e"],  mixed: ["ein",   "es"], strong: ["—", "es"], noun: "Kind" },
        { g: "die (Pl.)", weak: ["die", "en"], mixed: ["keine", "en"], strong: ["—", "e"], noun: "Leute" },
      ],
      examples: [
        { de: "Der alte Mann wohnt neben uns.", en: "The old man lives next to us.", hl: "alte" },
        { de: "Ein alter Mann wohnt neben uns.", en: "An old man lives next to us.", hl: "alter" },
        { de: "Meine kleine Schwester lernt Deutsch.", en: "My little sister is learning German.", hl: "kleine" },
        { de: "Starker Kaffee schmeckt mir am besten.", en: "Strong coffee tastes best to me.", hl: "Starker" },
      ],
      tip: "After der/die/das the adjective relaxes to -e (the article already does the work). After ein you can't hear the gender — so the adjective shows it: ein altER Mann, ein altES Kind.",
    },
    Akkusativ: {
      question: "Wen? Was? — the direct object · after: durch, für, gegen, ohne, um",
      rows: [
        { g: "den",  weak: ["den",  "en"], mixed: ["einen", "en"], strong: ["—", "en"], noun: "Mann" },
        { g: "die",  weak: ["die",  "e"],  mixed: ["eine",  "e"],  strong: ["—", "e"],  noun: "Frau" },
        { g: "das",  weak: ["das",  "e"],  mixed: ["ein",   "es"], strong: ["—", "es"], noun: "Kind" },
        { g: "die (Pl.)", weak: ["die", "en"], mixed: ["keine", "en"], strong: ["—", "e"], noun: "Leute" },
      ],
      examples: [
        { de: "Ich sehe den alten Mann jeden Morgen.", en: "I see the old man every morning.", hl: "alten" },
        { de: "Ich trinke einen starken Kaffee.", en: "I'm drinking a strong coffee.", hl: "starken" },
        { de: "Er sucht seinen schwarzen Koffer.", en: "He's looking for his black suitcase.", hl: "schwarzen" },
        { de: "Sie kauft frisches Brot für das Frühstück.", en: "She buys fresh bread for breakfast.", hl: "frisches" },
      ],
      tip: "Akkusativ is a copy of Nominativ — except masculine. Only \"the man\" changes: der → den, alte → alten. Feminine, neuter and plural stay exactly the same.",
    },
    Dativ: {
      question: "Wem? — the indirect object · after: aus, bei, mit, nach, seit, von, zu",
      rows: [
        { g: "dem",  weak: ["dem",  "en"], mixed: ["einem", "en"], strong: ["—", "em"], noun: "Mann" },
        { g: "der",  weak: ["der",  "en"], mixed: ["einer", "en"], strong: ["—", "er"], noun: "Frau" },
        { g: "dem",  weak: ["dem",  "en"], mixed: ["einem", "en"], strong: ["—", "em"], noun: "Kind" },
        { g: "den (Pl.)", weak: ["den", "en"], mixed: ["keinen", "en"], strong: ["—", "en"], noun: "Leuten" },
      ],
      examples: [
        { de: "Ich helfe dem alten Mann mit dem Koffer.", en: "I help the old man with the suitcase.", hl: "alten" },
        { de: "Wir wohnen in einer kleinen Wohnung.", en: "We live in a small flat.", hl: "kleinen" },
        { de: "Wir helfen unserer alten Nachbarin.", en: "We're helping our old neighbour.", hl: "alten" },
        { de: "Nach langem Warten kam endlich der Bus.", en: "After a long wait the bus finally came.", hl: "langem" },
      ],
      tip: "With any article in front, Dativ is pure -en — no exceptions, all genders. You only need to think when there's no article at all (then the adjective takes the article's own ending: -em, -er, -en).",
    },
    Genitiv: {
      question: "Wessen? — possession · after: wegen, trotz, während, (an)statt",
      rows: [
        { g: "des",  weak: ["des",  "en"], mixed: ["eines", "en"], strong: ["—", "en"], noun: "Mannes" },
        { g: "der",  weak: ["der",  "en"], mixed: ["einer", "en"], strong: ["—", "er"], noun: "Frau" },
        { g: "des",  weak: ["des",  "en"], mixed: ["eines", "en"], strong: ["—", "en"], noun: "Kindes" },
        { g: "der (Pl.)", weak: ["der", "en"], mixed: ["keiner", "en"], strong: ["—", "er"], noun: "Leute" },
      ],
      examples: [
        { de: "Das Auto des alten Mannes ist kaputt.", en: "The old man's car is broken.", hl: "alten" },
        { de: "Trotz des schlechten Wetters machen wir einen Ausflug.", en: "Despite the bad weather we're going on a trip.", hl: "schlechten" },
        { de: "Die Farbe meines neuen Autos ist blau.", en: "The colour of my new car is blue.", hl: "neuen" },
        { de: "Wegen starken Regens fährt der Zug nicht.", en: "Because of heavy rain the train isn't running.", hl: "starken" },
      ],
      tip: "With an article: always -en, like Dativ. Without an article, masculine and neuter still take -en — the noun itself already shows the Genitiv with its -(e)s ending (starkEN RegenS).",
    },
  };

  const TRICKS = [
    {
      title: "The \"only 5 are -e\" rule",
      body: "After der/die/das, sixteen forms exist but only FIVE end in -e — the rest are ALL -en. The five: der alte, die alte, das alte (Nominativ) + die alte, das alte (Akkusativ). Memorize the block below; everything outside it is -en.",
      grid: true,
    },
    {
      title: "No article? The adjective steals the article's ending",
      body: "kaltES Wasser (das), starkER Kaffee (der), mit frischER Milch (der Dativ: der → -er). If no article shows gender and case, the adjective does that job and wears the der/die/das ending itself. Only exception: Genitiv masculine/neuter → -en, because the noun's -s already marks the case.",
    },
    {
      title: "Dativ & Genitiv = -en (with articles)",
      body: "Whenever ANY article stands in front, Dativ and Genitiv adjectives always end in -en. Half the table costs you nothing to learn.",
    },
    {
      title: "Akkusativ: only the man changes",
      body: "From Nominativ to Akkusativ, only masculine changes (der → den, ein → einen, -e → -en). Feminine, neuter, plural: identical. So really you learn Nominativ + one change.",
    },
  ];

  /* ---------------- memory-sentence generator ----------------
   * One chain sentence (or 4 short sentences for "no article") walking
   * through Nominativ → Akkusativ → Dativ → Genitiv for the chosen
   * gender + article type. forms[] = the 4 declined noun phrases.
   */
  const GEN = {
    M: {
      label: "der Mann (m)",
      def: {
        forms: ["der alte Mann", "den alten Mann", "dem alten Mann", "des alten Mannes"],
        chain: "Der alte Mann ist mein Nachbar: Ich sehe den alten Mann jeden Morgen, ich helfe dem alten Mann beim Einkaufen, und ich kenne den Hund des alten Mannes.",
        en: "The old man is my neighbour: I see the old man every morning, I help the old man with the shopping, and I know the old man's dog.",
      },
      indef: {
        forms: ["ein alter Mann", "einen alten Mann", "einem alten Mann", "eines alten Mannes"],
        chain: "Ein alter Mann braucht Ruhe: Im Bus sieht man oft einen alten Mann, man hilft einem alten Mann gern, und die Erfahrung eines alten Mannes ist wertvoll.",
        en: "An old man needs rest: on the bus you often see an old man, people are glad to help an old man, and an old man's experience is valuable.",
      },
      none: {
        forms: ["starker Kaffee", "starken Kaffee", "starkem Kaffee", "starken Kaffees"],
        lines: [
          { c: "Nom.", de: "Starker Kaffee schmeckt gut.", en: "Strong coffee tastes good." },
          { c: "Akk.", de: "Ich trinke starken Kaffee.", en: "I drink strong coffee." },
          { c: "Dat.", de: "Mit starkem Kaffee beginnt mein Tag.", en: "My day begins with strong coffee." },
          { c: "Gen.", de: "Der Geschmack starken Kaffees ist bitter.", en: "The taste of strong coffee is bitter." },
        ],
      },
    },
    F: {
      label: "die Frau (f)",
      def: {
        forms: ["die alte Frau", "die alte Frau", "der alten Frau", "der alten Frau"],
        chain: "Die alte Frau ist meine Nachbarin: Ich sehe die alte Frau jeden Morgen, ich helfe der alten Frau beim Einkaufen, und ich kenne die Katze der alten Frau.",
        en: "The old woman is my neighbour: I see the old woman every morning, I help the old woman with the shopping, and I know the old woman's cat.",
      },
      indef: {
        forms: ["eine alte Frau", "eine alte Frau", "einer alten Frau", "einer alten Frau"],
        chain: "Eine alte Frau weiß viel: Im Park trifft man oft eine alte Frau, man hilft einer alten Frau gern, und die Erfahrung einer alten Frau ist wertvoll.",
        en: "An old woman knows a lot: in the park you often meet an old woman, people are glad to help an old woman, and an old woman's experience is valuable.",
      },
      none: {
        forms: ["frische Milch", "frische Milch", "frischer Milch", "frischer Milch"],
        lines: [
          { c: "Nom.", de: "Frische Milch ist gesund.", en: "Fresh milk is healthy." },
          { c: "Akk.", de: "Ich kaufe frische Milch.", en: "I buy fresh milk." },
          { c: "Dat.", de: "Müsli mit frischer Milch schmeckt gut.", en: "Muesli with fresh milk tastes good." },
          { c: "Gen.", de: "Der Preis frischer Milch steigt.", en: "The price of fresh milk is rising." },
        ],
      },
    },
    N: {
      label: "das Kind (n)",
      def: {
        forms: ["das kleine Kind", "das kleine Kind", "dem kleinen Kind", "des kleinen Kindes"],
        chain: "Das kleine Kind ist unser Nachbarskind: Ich sehe das kleine Kind jeden Morgen, ich helfe dem kleinen Kind bei den Hausaufgaben, und ich kenne die Eltern des kleinen Kindes.",
        en: "The little child is our neighbours' kid: I see the little child every morning, I help the little child with homework, and I know the little child's parents.",
      },
      indef: {
        forms: ["ein kleines Kind", "ein kleines Kind", "einem kleinen Kind", "eines kleinen Kindes"],
        chain: "Ein kleines Kind braucht viel Schlaf: Im Park sieht man oft ein kleines Kind, man hilft einem kleinen Kind gern, und das Lachen eines kleinen Kindes macht glücklich.",
        en: "A little child needs a lot of sleep: in the park you often see a little child, people are glad to help a little child, and a little child's laughter makes you happy.",
      },
      none: {
        forms: ["kaltes Wasser", "kaltes Wasser", "kaltem Wasser", "kalten Wassers"],
        lines: [
          { c: "Nom.", de: "Kaltes Wasser ist erfrischend.", en: "Cold water is refreshing." },
          { c: "Akk.", de: "Ich trinke kaltes Wasser.", en: "I drink cold water." },
          { c: "Dat.", de: "Er duscht mit kaltem Wasser.", en: "He showers with cold water." },
          { c: "Gen.", de: "Die Temperatur kalten Wassers ist niedrig.", en: "The temperature of cold water is low." },
        ],
      },
    },
    Pl: {
      label: "die Leute (pl)",
      def: {
        forms: ["die alten Leute", "die alten Leute", "den alten Leuten", "der alten Leute"],
        chain: "Die alten Leute sind unsere Nachbarn: Ich sehe die alten Leute jeden Morgen, ich helfe den alten Leuten beim Einkaufen, und ich kenne die Enkel der alten Leute.",
        en: "The old people are our neighbours: I see the old people every morning, I help the old people with the shopping, and I know the old people's grandchildren.",
      },
      indef: {
        forms: ["meine alten Freunde", "meine alten Freunde", "meinen alten Freunden", "meiner alten Freunde"],
        chain: "Meine alten Freunde wohnen in Berlin: Ich besuche meine alten Freunde oft, ich schreibe meinen alten Freunden jede Woche, und ich mag den Humor meiner alten Freunde.",
        en: "My old friends live in Berlin: I visit my old friends often, I write to my old friends every week, and I like my old friends' humour.",
        note: "ein has no plural — kein and the possessives (meine…) take its place.",
      },
      none: {
        forms: ["alte Bücher", "alte Bücher", "alten Büchern", "alter Bücher"],
        lines: [
          { c: "Nom.", de: "Alte Bücher sind interessant.", en: "Old books are interesting." },
          { c: "Akk.", de: "Ich lese alte Bücher.", en: "I read old books." },
          { c: "Dat.", de: "In alten Büchern findet man Schätze.", en: "One finds treasures in old books." },
          { c: "Gen.", de: "Der Geruch alter Bücher ist besonders.", en: "The smell of old books is special." },
        ],
      },
    },
  };

  /* weak-declension mini grid for the 5-e trick */
  const WEAK_GRID = {
    cols: ["m", "f", "n", "Pl."],
    rows: [
      { c: "Nom.", e: ["e", "e", "e", "en"] },
      { c: "Akk.", e: ["en", "e", "e", "en"] },
      { c: "Dat.", e: ["en", "en", "en", "en"] },
      { c: "Gen.", e: ["en", "en", "en", "en"] },
    ],
  };

  let currentCase = "Nominativ";
  let genGender = "M";
  let genArticle = "def";

  /* Highlight every adjective (stem bold, ending accent-colored) in a text. */
  const ADJ_RE = /\b(alt|klein|stark|frisch|kalt)(en|em|er|es|e)\b/gi;
  function highlightAdjectives(text) {
    const frag = document.createDocumentFragment();
    let last = 0;
    for (const m of text.matchAll(ADJ_RE)) {
      frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const stem = document.createElement("b");
      stem.className = "g-word";
      stem.textContent = m[1];
      frag.appendChild(stem);
      const end = document.createElement("b");
      end.className = "g-word g-ending";
      end.textContent = m[2];
      frag.appendChild(end);
      last = m.index + m[0].length;
    }
    frag.appendChild(document.createTextNode(text.slice(last)));
    return frag;
  }

  /* ---------------- rendering ---------------- */

  function endingSpan(article, ending) {
    const frag = document.createDocumentFragment();
    const art = document.createElement("span");
    art.className = "g-art";
    art.textContent = article === "—" ? "" : article + " ";
    frag.appendChild(art);
    const stem = document.createElement("span");
    stem.textContent = "gut";
    frag.appendChild(stem);
    const e = document.createElement("b");
    e.className = "g-ending";
    e.textContent = ending;
    frag.appendChild(e);
    return frag;
  }

  function highlightSentence(text, word) {
    const frag = document.createDocumentFragment();
    const idx = text.indexOf(word);
    if (idx < 0) { frag.appendChild(document.createTextNode(text)); return frag; }
    frag.appendChild(document.createTextNode(text.slice(0, idx)));
    const stemLen = word.length - (word.endsWith("en") ? 2 : word.endsWith("es") || word.endsWith("er") || word.endsWith("em") ? 2 : 1);
    const stem = document.createElement("b");
    stem.className = "g-word";
    stem.textContent = word.slice(0, stemLen);
    const end = document.createElement("b");
    end.className = "g-word g-ending";
    end.textContent = word.slice(stemLen);
    frag.appendChild(stem);
    frag.appendChild(end);
    frag.appendChild(document.createTextNode(text.slice(idx + word.length)));
    return frag;
  }

  function caseTable(data) {
    const wrap = document.createElement("div");
    wrap.className = "stats-scroll";
    const t = document.createElement("table");
    t.className = "g-table";
    const thead = document.createElement("thead");
    const hr = document.createElement("tr");
    for (const h of ["", "der / die / das", "ein / kein / mein…", "no article"]) {
      const th = document.createElement("th"); th.textContent = h; hr.appendChild(th);
    }
    thead.appendChild(hr);
    t.appendChild(thead);
    const tb = document.createElement("tbody");
    for (const row of data.rows) {
      const tr = document.createElement("tr");
      const td0 = document.createElement("td");
      td0.className = "g-gender";
      td0.textContent = row.g + " " + row.noun;
      tr.appendChild(td0);
      for (const kind of ["weak", "mixed", "strong"]) {
        const td = document.createElement("td");
        td.appendChild(endingSpan(row[kind][0], row[kind][1]));
        tr.appendChild(td);
      }
      tb.appendChild(tr);
    }
    t.appendChild(tb);
    wrap.appendChild(t);
    return wrap;
  }

  function exampleBlock(ex) {
    const box = document.createElement("div");
    box.className = "example";
    const line = document.createElement("div");
    line.className = "de-line";
    line.appendChild(TTS.button(ex.de, ex.de));
    const span = document.createElement("span");
    span.lang = "de";
    span.appendChild(highlightSentence(ex.de, ex.hl));
    line.appendChild(span);
    box.appendChild(line);
    const en = document.createElement("div");
    en.className = "en-line";
    en.textContent = ex.en;
    box.appendChild(en);
    return box;
  }

  function weakGrid() {
    const wrap = document.createElement("div");
    wrap.className = "stats-scroll";
    const t = document.createElement("table");
    t.className = "g-table g-minigrid";
    const thead = document.createElement("thead");
    const hr = document.createElement("tr");
    hr.appendChild(document.createElement("th"));
    for (const c of WEAK_GRID.cols) {
      const th = document.createElement("th"); th.textContent = c; hr.appendChild(th);
    }
    thead.appendChild(hr);
    t.appendChild(thead);
    const tb = document.createElement("tbody");
    for (const row of WEAK_GRID.rows) {
      const tr = document.createElement("tr");
      const td0 = document.createElement("td");
      td0.className = "g-gender";
      td0.textContent = row.c;
      tr.appendChild(td0);
      for (const e of row.e) {
        const td = document.createElement("td");
        td.textContent = "-" + e;
        if (e === "e") td.className = "g-five";
        tr.appendChild(td);
      }
      tb.appendChild(tr);
    }
    t.appendChild(tb);
    wrap.appendChild(t);
    return wrap;
  }

  function render() {
    const host = $("grammar-content");
    host.innerHTML = "";

    // case tabs
    const tabs = document.createElement("div");
    tabs.className = "level-tabs";
    for (const name of Object.keys(DECLENSION)) {
      const b = document.createElement("button");
      b.className = "level-tab" + (currentCase === name ? " active" : "");
      b.textContent = name.slice(0, 3) + ".";
      b.setAttribute("aria-label", name);
      b.addEventListener("click", () => { currentCase = name; TTS.stop(); render(); });
      tabs.appendChild(b);
    }
    host.appendChild(tabs);

    // legend: the three patterns, shown once above the case panel
    const legend = document.createElement("div");
    legend.className = "card-panel";
    const lh = document.createElement("h2");
    lh.textContent = "Three patterns, every case";
    legend.appendChild(lh);
    const lp = document.createElement("p");
    lp.className = "muted";
    lp.textContent = "Every case below shows all three columns:";
    legend.appendChild(lp);
    const ul = document.createElement("ul");
    ul.className = "g-legend";
    for (const [name, desc] of [
      ["der / die / das", "definite articles — also dieser, jeder, welcher (adjective relaxes: -e / -en)"],
      ["ein / kein / mein…", "indefinite article, negative kein, and ALL possessives: mein, dein, sein, ihr, unser, euer, Ihr — they decline alike"],
      ["no article", "bare noun — the adjective itself takes the article's ending (kaltes Wasser ← das)"],
    ]) {
      const li = document.createElement("li");
      const b = document.createElement("b");
      b.textContent = name + ": ";
      li.appendChild(b);
      li.appendChild(document.createTextNode(desc));
      ul.appendChild(li);
    }
    legend.appendChild(ul);
    host.appendChild(legend);

    const data = DECLENSION[currentCase];
    const panel = document.createElement("div");
    panel.className = "card-panel";
    const h = document.createElement("h2");
    h.textContent = currentCase;
    panel.appendChild(h);
    const q = document.createElement("p");
    q.className = "muted";
    q.textContent = data.question;
    panel.appendChild(q);
    panel.appendChild(caseTable(data));
    for (const ex of data.examples) panel.appendChild(exampleBlock(ex));
    const tip = document.createElement("div");
    tip.className = "g-tip";
    tip.textContent = "💡 " + data.tip;
    panel.appendChild(tip);
    host.appendChild(panel);
    host.appendChild(generatorPanel());

    // memory tricks
    const tricks = document.createElement("div");
    tricks.className = "card-panel";
    const th = document.createElement("h2");
    th.textContent = "Merkhilfen — how to actually remember this";
    tricks.appendChild(th);
    for (const tr of TRICKS) {
      const d = document.createElement("details");
      d.className = "g-trick";
      const s = document.createElement("summary");
      s.textContent = tr.title;
      d.appendChild(s);
      const body = document.createElement("div");
      body.className = "g-trick-body";
      const p = document.createElement("p");
      p.textContent = tr.body;
      body.appendChild(p);
      if (tr.grid) body.appendChild(weakGrid());
      d.appendChild(body);
      tricks.appendChild(d);
    }
    host.appendChild(tricks);
  }

  /* "One sentence beats the whole table": pick gender + article type,
   * get the four-case memory sentence to drill out loud. */
  function segmented(options, current, onPick) {
    const tabs = document.createElement("div");
    tabs.className = "level-tabs";
    for (const [value, label] of options) {
      const b = document.createElement("button");
      b.className = "level-tab" + (current === value ? " active" : "");
      b.textContent = label;
      b.addEventListener("click", () => { onPick(value); });
      tabs.appendChild(b);
    }
    return tabs;
  }

  function generatorPanel() {
    const panel = document.createElement("div");
    panel.className = "card-panel";
    const h = document.createElement("h2");
    h.textContent = "One sentence beats the whole table";
    panel.appendChild(h);
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "Pick a gender and an article type, then memorize the sentence — it walks through Nominativ → Akkusativ → Dativ → Genitiv. Say it out loud until wrong endings sound wrong.";
    panel.appendChild(p);

    panel.appendChild(segmented(
      Object.entries(GEN).map(([k, v]) => [k, k === "Pl" ? "Pl." : k]),
      genGender,
      (v) => { genGender = v; TTS.stop(); render(); }
    ));
    panel.appendChild(segmented(
      [["def", "der/die/das"], ["indef", "ein/mein…"], ["none", "no article"]],
      genArticle,
      (v) => { genArticle = v; TTS.stop(); render(); }
    ));

    const data = GEN[genGender][genArticle];

    // the four declined forms, labeled by case
    const formsRow = document.createElement("div");
    formsRow.className = "g-forms";
    ["Nom.", "Akk.", "Dat.", "Gen."].forEach((c, i) => {
      const chip = document.createElement("div");
      chip.className = "g-form";
      const lbl = document.createElement("span");
      lbl.className = "g-form-case";
      lbl.textContent = c;
      chip.appendChild(lbl);
      const val = document.createElement("span");
      val.lang = "de";
      val.appendChild(highlightAdjectives(data.forms[i]));
      chip.appendChild(val);
      formsRow.appendChild(chip);
    });
    panel.appendChild(formsRow);

    if (data.chain) {
      const box = document.createElement("div");
      box.className = "example";
      const line = document.createElement("div");
      line.className = "de-line";
      line.appendChild(TTS.button(data.chain, data.chain));
      const span = document.createElement("span");
      span.lang = "de";
      span.appendChild(highlightAdjectives(data.chain));
      line.appendChild(span);
      box.appendChild(line);
      const en = document.createElement("div");
      en.className = "en-line";
      en.textContent = data.en;
      box.appendChild(en);
      panel.appendChild(box);
    } else {
      for (const ln of data.lines) {
        const box = document.createElement("div");
        box.className = "example";
        const line = document.createElement("div");
        line.className = "de-line";
        line.appendChild(TTS.button(ln.de, ln.de));
        const span = document.createElement("span");
        span.lang = "de";
        const caseTag = document.createElement("span");
        caseTag.className = "g-form-case";
        caseTag.textContent = ln.c + " ";
        span.appendChild(caseTag);
        span.appendChild(highlightAdjectives(ln.de));
        line.appendChild(span);
        box.appendChild(line);
        const en = document.createElement("div");
        en.className = "en-line";
        en.textContent = ln.en;
        box.appendChild(en);
        panel.appendChild(box);
      }
    }
    if (data.note) {
      const note = document.createElement("p");
      note.className = "muted";
      note.textContent = "Note: " + data.note;
      panel.appendChild(note);
    }
    return panel;
  }

  function show() { render(); }

  return { show };
})();
