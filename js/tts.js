/* tts.js — German speech via the Web Speech API only.
 * No cloud, no keys. Speech starts only from a user tap.
 * English is never spoken.
 *
 * Mobile hardening (iOS Safari / Android Chrome quirks):
 *  - never speak() synchronously right after cancel() — the new utterance
 *    is silently dropped; defer it instead
 *  - keep a reference to the current utterance — Chrome can garbage-collect
 *    it mid-speech, cutting audio and never firing onend
 *  - resume() a stuck "paused" synth before speaking (iOS)
 *  - iOS 17+: switch the page's audio session to "playback" so speech is
 *    audible even with the ring/silent switch on silent
 *  - pick the voice from a fresh getVoices() call (stale voice objects are
 *    ignored on iOS); if speech never starts, retry once with lang only
 *  - record attempt/start/error so Settings can show what happened
 */
"use strict";

const TTS = (() => {
  const synth = window.speechSynthesis || null;
  let germanVoices = [];
  let currentBtn = null;
  let currentUtterance = null;   // GC guard
  let lastError = null;
  let lastAttempt = 0;
  let lastStarted = 0;

  function supported() { return !!synth; }

  function filterGerman(list) { return list.filter(v => /^de([-_]|$)/i.test(v.lang)); }

  function refreshVoices() {
    if (!synth) return [];
    germanVoices = filterGerman(synth.getVoices());
    return germanVoices;
  }

  function getGermanVoices() { return germanVoices; }
  function getLastError() { return lastError; }
  function getStatus() {
    return {
      attempted: lastAttempt > 0,
      started: lastAttempt > 0 && lastStarted >= lastAttempt,
      error: lastError,
    };
  }

  /* Always choose from a fresh voice list: iOS invalidates old voice objects. */
  function pickVoice() {
    const fresh = filterGerman(synth.getVoices());
    if (fresh.length) germanVoices = fresh;
    const list = germanVoices;
    const wanted = Store.getSettings().voiceURI;
    if (wanted) {
      const v = list.find(v => v.voiceURI === wanted);
      if (v) return v;
    }
    return list.find(v => /de[-_]DE/i.test(v.lang)) || list[0] || null;
  }

  function unlockAudioSession() {
    // iOS 17+: let speech play through the silent switch (ignored elsewhere)
    try {
      if (navigator.audioSession && navigator.audioSession.type !== "playback") {
        navigator.audioSession.type = "playback";
      }
    } catch (e) { /* unsupported */ }
  }

  function clearBtn(btn) {
    if (btn) btn.classList.remove("speaking");
    if (currentBtn === btn || !btn) currentBtn = null;
  }

  function stop() {
    if (synth && (synth.speaking || synth.pending || synth.paused)) {
      try { synth.cancel(); } catch (e) { /* ignore */ }
    }
    clearBtn(null);
    currentUtterance = null;
  }

  function makeUtterance(text, btn, withVoice) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "de-DE";
    if (withVoice) {
      const voice = pickVoice();
      if (voice) u.voice = voice;
    }
    u.rate = Store.getSettings().rate || 0.8;
    u.pitch = 1;
    u.volume = 1;
    u._started = false;
    u._errored = false;
    u.onstart = () => { u._started = true; lastStarted = Date.now(); };
    u.onend = () => {
      clearBtn(btn);
      if (currentUtterance === u) currentUtterance = null;
    };
    u.onerror = (e) => {
      u._errored = true;
      if (e.error !== "interrupted" && e.error !== "canceled") {
        lastError = e.error || "unknown";
        console.warn("TTS error:", e.error);
      }
      clearBtn(btn);
      if (currentUtterance === u) currentUtterance = null;
    };
    return u;
  }

  function launch(u, btn, allowRetry) {
    try {
      if (synth.paused) synth.resume();
      synth.speak(u);
    } catch (e) {
      lastError = e.message || String(e);
      console.warn("TTS speak() threw:", e);
      clearBtn(btn);
      return;
    }
    if (!allowRetry) return;
    // iOS standalone sometimes ignores an utterance with an explicit voice
    // object: if nothing started after 1.5 s, retry once with lang only.
    setTimeout(() => {
      if (currentUtterance !== u || u._started || u._errored) return;
      try { synth.cancel(); } catch (e) { /* ignore */ }
      const u2 = makeUtterance(u.text, btn, false);
      currentUtterance = u2;
      setTimeout(() => launch(u2, btn, false), 150);
    }, 1500);
  }

  /* Speak German text. btn (optional) gets a "speaking" highlight and acts as stop-toggle. */
  function speak(text, btn) {
    if (!synth || !text) return;
    if (btn && btn === currentBtn && (synth.speaking || synth.pending)) { stop(); return; }

    unlockAudioSession();
    const wasBusy = synth.speaking || synth.pending || synth.paused;
    stop();

    lastAttempt = Date.now();
    lastError = null;
    const u = makeUtterance(text, btn, true);
    if (btn) { btn.classList.add("speaking"); currentBtn = btn; }
    currentUtterance = u;

    // speaking right after cancel() drops the utterance on iOS/Android — defer
    if (wasBusy) setTimeout(() => launch(u, btn, true), 120);
    else launch(u, btn, true);
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

  return { supported, refreshVoices, getGermanVoices, getLastError, getStatus, speak, stop, button };
})();
