/* tts.js — German speech via the Web Speech API only.
 * No cloud, no keys. Speech starts only from a user tap.
 * English is never spoken.
 *
 * Mobile hardening (iOS Safari / Android Chrome quirks):
 *  - never call speak() synchronously right after cancel() — the new
 *    utterance is silently dropped; defer it instead
 *  - keep a reference to the current utterance — Chrome can garbage-collect
 *    it mid-speech, cutting audio and never firing onend
 *  - resume() a stuck "paused" synth before speaking (iOS)
 *  - record the last engine error so Settings can show it
 */
"use strict";

const TTS = (() => {
  const synth = window.speechSynthesis || null;
  let germanVoices = [];
  let currentBtn = null;
  let currentUtterance = null;   // GC guard
  let lastError = null;
  let lastStart = 0;

  function supported() { return !!synth; }

  function refreshVoices() {
    if (!synth) return [];
    germanVoices = synth.getVoices().filter(v => /^de([-_]|$)/i.test(v.lang));
    return germanVoices;
  }

  function getGermanVoices() { return germanVoices; }
  function getLastError() { return lastError; }

  function pickVoice() {
    if (!germanVoices.length) refreshVoices();
    const wanted = Store.getSettings().voiceURI;
    if (wanted) {
      const v = germanVoices.find(v => v.voiceURI === wanted);
      if (v) return v;
    }
    // prefer a de-DE voice, else any de-* voice
    return germanVoices.find(v => /de[-_]DE/i.test(v.lang)) || germanVoices[0] || null;
  }

  function clearBtn() {
    if (currentBtn) { currentBtn.classList.remove("speaking"); currentBtn = null; }
  }

  function stop() {
    if (synth && (synth.speaking || synth.pending || synth.paused)) {
      try { synth.cancel(); } catch (e) { /* ignore */ }
    }
    clearBtn();
  }

  /* Speak German text. btn (optional) gets a "speaking" highlight and acts as stop-toggle. */
  function speak(text, btn) {
    if (!synth || !text) return;
    if (btn && btn === currentBtn && (synth.speaking || synth.pending)) { stop(); return; }

    const wasBusy = synth.speaking || synth.pending;
    stop();

    const u = new SpeechSynthesisUtterance(text);
    u.lang = "de-DE";
    const voice = pickVoice();
    if (voice) u.voice = voice;
    u.rate = Store.getSettings().rate || 0.8;
    u.pitch = 1;
    u.volume = 1;

    u.onstart = () => { lastStart = Date.now(); lastError = null; };
    u.onend = () => {
      if (btn) btn.classList.remove("speaking");
      if (currentBtn === btn) currentBtn = null;
      if (currentUtterance === u) currentUtterance = null;
    };
    u.onerror = (e) => {
      // "interrupted"/"canceled" are normal when the user taps another button
      if (e.error !== "interrupted" && e.error !== "canceled") {
        lastError = e.error || "unknown";
        console.warn("TTS error:", e.error);
      }
      if (btn) btn.classList.remove("speaking");
      if (currentBtn === btn) currentBtn = null;
      if (currentUtterance === u) currentUtterance = null;
    };

    if (btn) { btn.classList.add("speaking"); currentBtn = btn; }
    currentUtterance = u;

    const go = () => {
      try {
        if (synth.paused) synth.resume();
        synth.speak(u);
      } catch (e) {
        lastError = e.message || String(e);
        console.warn("TTS speak() threw:", e);
        if (btn) btn.classList.remove("speaking");
        if (currentBtn === btn) currentBtn = null;
      }
    };
    // speaking right after cancel() drops the utterance on iOS/Android — defer
    if (wasBusy) setTimeout(go, 120); else go();
  }

  /* Build a round speaker button that speaks `text` on tap. */
  function button(text, label) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tts-btn";
    b.textContent = "🔊";
    b.setAttribute("aria-label", "Speak German: " + (label || text));
    b.addEventListener("click", (e) => { e.stopPropagation(); speak(text, b); });
    return b;
  }

  if (synth) {
    refreshVoices();
    // iOS/Chrome load voices asynchronously
    synth.addEventListener?.("voiceschanged", () => {
      refreshVoices();
      document.dispatchEvent(new CustomEvent("dd-voices-changed"));
    });
  }

  return { supported, refreshVoices, getGermanVoices, getLastError, speak, stop, button };
})();
