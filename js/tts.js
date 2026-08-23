/* tts.js — German speech via the Web Speech API only.
 * No cloud, no keys. Speech starts only from a user tap.
 * English is never spoken.
 */
"use strict";

const TTS = (() => {
  const synth = window.speechSynthesis || null;
  let germanVoices = [];
  let currentBtn = null;

  function supported() { return !!synth; }

  function refreshVoices() {
    if (!synth) return [];
    germanVoices = synth.getVoices().filter(v => /^de/i.test(v.lang));
    return germanVoices;
  }

  function getGermanVoices() { return germanVoices; }

  function pickVoice() {
    const wanted = Store.getSettings().voiceURI;
    if (wanted) {
      const v = germanVoices.find(v => v.voiceURI === wanted);
      if (v) return v;
    }
    // prefer a de-DE voice, else any de-* voice
    return germanVoices.find(v => /de[-_]DE/i.test(v.lang)) || germanVoices[0] || null;
  }

  function stop() {
    if (synth) synth.cancel();
    if (currentBtn) { currentBtn.classList.remove("speaking"); currentBtn = null; }
  }

  /* Speak German text. btn (optional) gets a "speaking" highlight and acts as stop-toggle. */
  function speak(text, btn) {
    if (!synth || !text) return;
    if (btn && btn === currentBtn && synth.speaking) { stop(); return; }
    stop();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "de-DE";
    const voice = pickVoice();
    if (voice) u.voice = voice;
    u.rate = Store.getSettings().rate || 0.8;
    u.onend = u.onerror = () => {
      if (btn) btn.classList.remove("speaking");
      if (currentBtn === btn) currentBtn = null;
    };
    if (btn) { btn.classList.add("speaking"); currentBtn = btn; }
    synth.speak(u);
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

  return { supported, refreshVoices, getGermanVoices, speak, stop, button };
})();
