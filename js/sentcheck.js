/* sentcheck.js — on-device answer checking for sentence practice.
 * No network, no AI: the typed sentence is compared with the accepted
 * answers of an item; differences are aligned word by word and classified
 * (word order, article/case, ending, spelling, missing/extra word).
 * This is a comparison against known-good sentences, not a free grammar
 * checker — a correct sentence phrased differently can still be flagged,
 * which is why the UI offers a "my answer was also correct" override.
 */
"use strict";

const SentCheck = (() => {
  const PUNCT = /[.,!?;:"„“”‚‘’()«»…–—]/g;

  // digits typed for small numbers count as the written word ("2 Jahren" = "zwei Jahren")
  const NUM = { "2": "zwei", "3": "drei", "4": "vier", "5": "fuenf", "6": "sechs", "7": "sieben", "8": "acht", "9": "neun", "10": "zehn", "11": "elf", "12": "zwoelf", "20": "zwanzig", "100": "hundert" };

  function canon(w) {
    const c = w.toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
    return NUM[c] || c;
  }

  /* -> [{disp, raw, c}] — disp keeps punctuation for display, raw/c are the bare word */
  function tokenize(s) {
    return String(s || "").normalize("NFC").trim().split(/\s+/)
      .map(chunk => {
        const raw = chunk.replace(PUNCT, "");
        return { disp: chunk, raw, c: canon(raw) };
      })
      .filter(t => t.raw !== "");
  }

  /* Treat preposition + article as one unit so that "in dem" equals "im",
   * and "in das Regal" vs "im Regal" is reported as ONE article/case slip. */
  const CONTR = { "in dem": "im", "in das": "ins", "an dem": "am", "an das": "ans", "zu dem": "zum", "zu der": "zur", "von dem": "vom", "bei dem": "beim" };
  const PREP = /^(in|an|zu|von|bei)$/;
  const ART = /^(der|die|das|den|dem|des)$/;
  function mergePrepArticle(tok) {
    const out = [];
    for (let i = 0; i < tok.length; i++) {
      const a = tok[i], b = tok[i + 1];
      if (b && PREP.test(a.c) && ART.test(b.c)) {
        out.push({ disp: a.disp + " " + b.disp, raw: a.raw + " " + b.raw, c: CONTR[a.c + " " + b.c] || a.c + "_" + b.c });
        i++;
      } else out.push(a);
    }
    return out;
  }
  function words(s) { return mergePrepArticle(tokenize(s)); }

  function lev(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  }

  /* longest common subsequence on canonical words -> matched index pairs */
  function lcsPairs(A, B) {
    const m = A.length, n = B.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = m - 1; i >= 0; i--) {
      for (let j = n - 1; j >= 0; j--) {
        dp[i][j] = A[i].c === B[j].c ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const pairs = [];
    let i = 0, j = 0;
    while (i < m && j < n) {
      if (A[i].c === B[j].c) { pairs.push([i, j]); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
      else j++;
    }
    return pairs;
  }

  /* determiner / pronoun families: same family + different form = case/gender slip */
  function family(c) {
    if (/^(der|die|das|den|dem|des)$/.test(c)) return "art:the";
    let m = c.match(/^(k|m|d|s)?ein(e|en|em|er|es)?$/);
    if (m) return "art:" + (m[1] || "") + "ein";
    m = c.match(/^(ihr|unser|unsr|euer|eur|dies|welch|jed)(e|en|em|er|es)?$/);
    if (m) return "art:" + m[1];
    if (/^(zum|zur|zu_\w+)$/.test(c)) return "art:zu";
    if (/^(im|ins|in_\w+)$/.test(c)) return "art:in";
    if (/^(am|ans|an_\w+)$/.test(c)) return "art:an";
    if (/^(vom|von_\w+)$/.test(c)) return "art:von";
    if (/^(beim|bei_\w+)$/.test(c)) return "art:bei";
    if (/^(mich|mir)$/.test(c)) return "pro:ich";
    if (/^(dich|dir)$/.test(c)) return "pro:du";
    if (/^(ihn|ihm)$/.test(c)) return "pro:er";
    return null;
  }

  const ENDING = /^(|e|n|s|t|r|m|en|er|es|em|et|st|te|ten|est)$/;
  function isEndingSlip(a, b) {
    let p = 0;
    while (p < a.length && p < b.length && a[p] === b[p]) p++;
    return p >= 3 && ENDING.test(a.slice(p)) && ENDING.test(b.slice(p));
  }

  function isSpellingSlip(a, b) {
    const shorter = Math.min(a.length, b.length);
    if (shorter < 4) return false;
    return lev(a, b) <= (shorter <= 5 ? 1 : 2);
  }

  function pairType(a, b) {
    const fa = family(a), fb = family(b);
    if (fa && fa === fb) return fa.startsWith("pro:") ? "pronoun" : "article";
    if (isEndingSlip(a, b)) return "ending";
    if (isSpellingSlip(a, b)) return "spelling";
    return null;
  }

  /* compare the input with ONE accepted answer */
  function compare(inTok, answer) {
    const ansTok = words(answer);
    const inCls = new Array(inTok.length).fill("bad");
    const ansCls = new Array(ansTok.length).fill("bad");
    const pairs = lcsPairs(inTok, ansTok);
    for (const [i, j] of pairs) { inCls[i] = "ok"; ansCls[j] = "ok"; }

    let restIn = inTok.map((_, i) => i).filter(i => inCls[i] !== "ok");
    let restAns = ansTok.map((_, j) => j).filter(j => ansCls[j] !== "ok");
    const issues = [];

    // 1) same word present on both sides, different position -> word order
    const moved = [];
    for (const i of restIn.slice()) {
      const j = restAns.find(j => ansTok[j].c === inTok[i].c);
      if (j === undefined) continue;
      moved.push(ansTok[j].raw);
      inCls[i] = "move"; ansCls[j] = "move";
      restIn = restIn.filter(x => x !== i);
      restAns = restAns.filter(x => x !== j);
    }
    if (moved.length) issues.push({ type: "order", words: moved });

    // 2) related forms (article/case, ending, spelling)
    for (const i of restIn.slice()) {
      let found = null;
      for (const j of restAns) {
        const t = pairType(inTok[i].c, ansTok[j].c);
        if (t) { found = { j, t }; break; }
      }
      if (!found) continue;
      issues.push({ type: found.t, a: inTok[i].raw, b: ansTok[found.j].raw });
      restIn = restIn.filter(x => x !== i);
      restAns = restAns.filter(x => x !== found.j);
    }

    // 3) leftovers: one-for-one replacement, else missing / extra
    if (restIn.length && restIn.length === restAns.length) {
      restIn.forEach((i, k) => issues.push({ type: "word", a: inTok[i].raw, b: ansTok[restAns[k]].raw }));
    } else {
      for (const j of restAns) issues.push({ type: "missing", b: ansTok[j].raw });
      for (const i of restIn) issues.push({ type: "extra", a: inTok[i].raw });
    }

    let score = 0;
    for (const it of issues) score += it.type === "spelling" ? 0.5 : it.type === "order" ? it.words.length : 1;

    // soft notes (never change the verdict)
    const notes = [];
    const caps = [];
    for (const [i, j] of pairs) {
      if (j === 0) continue;   // be lenient about the sentence-initial capital
      const a = inTok[i].raw[0], b = ansTok[j].raw[0];
      if (a !== b && a.toLowerCase() === b.toLowerCase()) caps.push(ansTok[j].raw);
    }
    if (caps.length) {
      notes.push("Capitalisation: " + caps.slice(0, 4).map(w => "“" + w + "”").join(", ") + (caps.length > 4 ? " …" : "") + " — nouns (and formal Sie) are written with a capital letter.");
    }
    return { answer, ansTok, inCls, ansCls, issues, score, notes };
  }

  function describe(it) {
    const q = w => "“" + w + "”";
    switch (it.type) {
      case "order": return "Word order: check the position of " + it.words.map(q).join(", ") + ".";
      case "article": return "Article / case: " + q(it.a) + " should be " + q(it.b) + ".";
      case "pronoun": return "Pronoun case: " + q(it.a) + " should be " + q(it.b) + ".";
      case "ending": return "Ending: " + q(it.a) + " should be " + q(it.b) + ".";
      case "spelling": return "Spelling: " + q(it.b) + " (you wrote " + q(it.a) + ").";
      case "word": return "Different word: " + q(it.a) + " → " + q(it.b) + ".";
      case "missing": return "Missing: " + q(it.b) + ".";
      case "extra": return "Not needed: " + q(it.a) + ".";
    }
    return "";
  }

  /* Check `input` against all accepted answers of an item ({de, alt}).
   * -> { verdict: 'empty'|'correct'|'almost'|'wrong', best, inTok, inCls, ansTok, ansCls, messages, notes } */
  function check(input, item) {
    const inTok = words(input);
    if (!inTok.length) return { verdict: "empty" };
    const answers = [item.de].concat(item.alt || []);
    let best = null;
    for (const a of answers) {
      const r = compare(inTok, a);
      if (!best || r.score < best.score) best = r;
      if (r.score === 0) break;
    }
    let verdict = "wrong";
    if (best.issues.length === 0) verdict = "correct";
    else if (best.issues.length <= 2 && best.issues.every(it => it.type === "spelling")) verdict = "almost";

    const commas = s => (String(s).match(/,/g) || []).length;
    // commas that only set off "bitte" are optional; clause commas are not
    const clauseCommas = commas(best.answer.replace(/,\s*bitte\b/gi, ""));
    if (clauseCommas > 0 && commas(input) < clauseCommas) {
      best.notes.push("Comma: German separates main and subordinate clause with a comma.");
    }
    return {
      verdict, best: best.answer, inTok, inCls: best.inCls, ansTok: best.ansTok, ansCls: best.ansCls,
      messages: best.issues.map(describe), notes: best.notes,
    };
  }

  return { check, tokenize, canon };
})();
