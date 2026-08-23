/* srs.js — SM-2-style scheduler.
 * Record shape (stored per card id):
 *   { st: 'learn'|'rev'|'relearn', step, ef, ivl (days), due (ms), reps, lapses, last (ms) }
 * A card with no record is "unseen".
 * Grades: 0 Again, 1 Hard, 2 Good, 3 Easy.
 */
"use strict";

const SRS = (() => {
  const MIN = 60 * 1000;
  const DAY = 24 * 60 * 60 * 1000;
  const LEARN_STEPS = [1 * MIN, 10 * MIN];
  const RELEARN_STEP = 10 * MIN;
  const EF_MIN = 1.3;
  const EF_MAX = 3.0;
  const GRADUATE_IVL = 1;   // days, after finishing learning steps
  const EASY_IVL = 4;       // days, Easy on a new/learning card
  const MATURE_IVL = 21;    // days

  function newRec(now) {
    return { st: "learn", step: 0, ef: 2.5, ivl: 0, due: now, reps: 0, lapses: 0, last: now };
  }

  function clampEf(ef) { return Math.min(EF_MAX, Math.max(EF_MIN, ef)); }

  function grade(rec, g, now) {
    const r = Object.assign({}, rec || newRec(now));
    r.reps += 1;
    r.last = now;

    if (r.st === "learn") {
      if (g === 0) { r.step = 0; r.due = now + LEARN_STEPS[0]; }
      else if (g === 1) { r.due = now + LEARN_STEPS[Math.min(r.step, LEARN_STEPS.length - 1)]; }
      else if (g === 2) {
        r.step += 1;
        if (r.step >= LEARN_STEPS.length) { r.st = "rev"; r.ivl = GRADUATE_IVL; r.due = now + r.ivl * DAY; }
        else { r.due = now + LEARN_STEPS[r.step]; }
      } else { r.st = "rev"; r.ivl = EASY_IVL; r.due = now + r.ivl * DAY; }
      return r;
    }

    if (r.st === "relearn") {
      if (g === 0 || g === 1) { r.due = now + RELEARN_STEP; }
      else {
        r.st = "rev";
        if (g === 3) r.ivl = Math.max(1, r.ivl + 1);
        r.due = now + r.ivl * DAY;
      }
      return r;
    }

    // review state
    if (g === 0) {
      r.lapses += 1;
      r.ef = clampEf(r.ef - 0.2);
      r.ivl = Math.max(1, Math.round(r.ivl * 0.5));
      r.st = "relearn";
      r.due = now + RELEARN_STEP;
    } else if (g === 1) {
      r.ef = clampEf(r.ef - 0.15);
      r.ivl = Math.max(r.ivl + 1, Math.round(r.ivl * 1.2));
      r.due = now + r.ivl * DAY;
    } else if (g === 2) {
      r.ivl = Math.max(r.ivl + 1, Math.round(r.ivl * r.ef));
      r.due = now + r.ivl * DAY;
    } else {
      r.ef = clampEf(r.ef + 0.15);
      r.ivl = Math.max(r.ivl + 1, Math.round(r.ivl * r.ef * 1.3));
      r.due = now + r.ivl * DAY;
    }
    return r;
  }

  /* Preview label for a grade button, e.g. "10 min" / "3 d" */
  function previewIvl(rec, g, now) {
    const r = grade(rec, g, now);
    const delta = r.due - now;
    if (delta < 60 * MIN) return Math.max(1, Math.round(delta / MIN)) + " min";
    if (delta < DAY) return Math.round(delta / (60 * MIN)) + " h";
    return Math.round(delta / DAY) + " d";
  }

  function endOfToday(now) {
    const d = new Date(now);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }

  function isDueNow(rec, now) { return !!rec && rec.due <= now; }
  function isDueToday(rec, now) { return !!rec && rec.due <= endOfToday(now); }

  /* Stats bucket: unseen | learning | young | mature; "difficult" is orthogonal */
  function bucket(rec) {
    if (!rec) return "unseen";
    if (rec.st === "learn" || rec.st === "relearn") return "learning";
    return rec.ivl >= MATURE_IVL ? "mature" : "young";
  }

  function isDifficult(rec) {
    return !!rec && (rec.lapses >= 3 || (rec.ef <= 1.6 && rec.reps >= 3));
  }

  return { grade, previewIvl, isDueNow, isDueToday, bucket, isDifficult, MATURE_IVL };
})();
