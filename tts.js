/* =============================================================
 * tts.js — Text-to-Speech module
 * Strategy:
 *   1. If Azure key is configured (window.AZURE_TTS_CONFIG.key OR
 *      a key in localStorage), call Azure TTS REST API.
 *   2. Cache the resulting MP3 blob in IndexedDB keyed by
 *      {voice}::{text}, so subsequent plays are instant + free.
 *   3. If Azure isn't configured OR fails, fall back to the
 *      browser's SpeechSynthesis API.
 *
 * Public API:
 *   TTS.getConfig() / TTS.setConfig(cfg) / TTS.testVoice(text)
 *   TTS.speak(text, { onstart, onend, onerror })
 *   TTS.stop()
 *   TTS.isAzureConfigured()
 * ============================================================= */

(function () {
  'use strict';

  // ---- IndexedDB cache ----------------------------------------
  const DB_NAME = 'mcdf-tts';
  const STORE = 'audio';
  let _db = null;
  function openDB() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
      req.onerror = (e) => reject(e);
    });
  }
  async function cacheGet(key) {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const r = tx.objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => resolve(null);
    });
  }
  async function cachePut(key, blob) {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }
  async function cacheClear() {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  // ---- Config -------------------------------------------------
  // Priority: localStorage override > config.js default
  function getConfig() {
    const def = window.AZURE_TTS_CONFIG || {};
    const stored = localStorage.getItem('tts-config');
    if (stored) {
      try { return Object.assign({}, def, JSON.parse(stored)); } catch (_) {}
    }
    return Object.assign({ key: '', region: '', voice: 'fr-FR-DeniseNeural', rate: '-5%', pitch: '0%' }, def);
  }
  function setConfig(cfg) {
    localStorage.setItem('tts-config', JSON.stringify(cfg));
  }
  function isAzureConfigured() {
    const c = getConfig();
    return !!(c.key && c.region);
  }

  // ---- Build SSML ---------------------------------------------
  function buildSSML(text, voice, rate, pitch) {
    // Escape XML
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
    return `<speak version="1.0" xml:lang="fr-FR">
  <voice name="${voice}">
    <prosody rate="${rate}" pitch="${pitch}">${escaped}</prosody>
  </voice>
</speak>`;
  }

  // ---- Azure call ---------------------------------------------
  async function fetchAzureAudio(text, cfg) {
    const url = `https://${cfg.region}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const ssml = buildSSML(text, cfg.voice, cfg.rate || '0%', cfg.pitch || '0%');
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': cfg.key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'mcdf-french-app',
      },
      body: ssml,
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`Azure TTS failed: ${resp.status} ${resp.statusText} ${errText.slice(0, 120)}`);
    }
    return resp.blob();
  }

  // ---- Audio playback -----------------------------------------
  const audioEl = document.getElementById('tts-audio') || (() => {
    const a = document.createElement('audio');
    a.id = 'tts-audio'; a.preload = 'none';
    document.body.appendChild(a);
    return a;
  })();

  let _currentURL = null;
  let _currentUtterance = null;
  let _playToken = 0;

  function _stop() {
    _playToken++;
    try { audioEl.pause(); } catch (_) {}
    if (_currentURL) {
      URL.revokeObjectURL(_currentURL);
      _currentURL = null;
    }
    if (_currentUtterance && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      _currentUtterance = null;
    }
  }

  // Try once to populate browser voices on first call
  let _voicesPrimed = false;
  function primeVoices() {
    if (_voicesPrimed) return;
    if (!window.speechSynthesis) return;
    window.speechSynthesis.getVoices();
    _voicesPrimed = true;
  }

  function speakBrowser(text, callbacks) {
    primeVoices();
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      callbacks.onerror && callbacks.onerror(new Error('SpeechSynthesis not supported'));
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    // Find best French voice
    const voices = window.speechSynthesis.getVoices();
    const frVoices = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith('fr'));
    const preferred = frVoices.find(v => /Denise|denise/i.test(v.name))
      || frVoices.find(v => /female|amelie|amélie/i.test(v.name))
      || frVoices[0];
    if (preferred) u.voice = preferred;
    u.rate = 0.95;
    u.onstart = () => callbacks.onstart && callbacks.onstart('browser');
    u.onend = () => { _currentUtterance = null; callbacks.onend && callbacks.onend(); };
    u.onerror = (e) => { _currentUtterance = null; callbacks.onerror && callbacks.onerror(e); };
    _currentUtterance = u;
    window.speechSynthesis.speak(u);
  }

  async function speak(text, callbacks = {}) {
    text = (text || '').trim();
    if (!text) return;
    _stop();
    const myToken = ++_playToken;
    const cfg = getConfig();

    if (!cfg.key || !cfg.region) {
      // Browser fallback
      speakBrowser(text, callbacks);
      return;
    }

    // Azure path with IndexedDB cache
    const cacheKey = `${cfg.voice}::${cfg.rate}::${text}`;
    try {
      let blob = await cacheGet(cacheKey);
      if (!blob) {
        blob = await fetchAzureAudio(text, cfg);
        cachePut(cacheKey, blob);
      }
      if (myToken !== _playToken) return; // user clicked something else, abandon
      const url = URL.createObjectURL(blob);
      _currentURL = url;
      audioEl.src = url;
      audioEl.onended = () => { callbacks.onend && callbacks.onend(); _currentURL = null; URL.revokeObjectURL(url); };
      audioEl.onerror = (e) => { callbacks.onerror && callbacks.onerror(e); };
      audioEl.onplay = () => { callbacks.onstart && callbacks.onstart('azure'); };
      await audioEl.play();
    } catch (err) {
      console.warn('Azure TTS failed, falling back to browser:', err);
      // Fallback
      speakBrowser(text, Object.assign({}, callbacks, {
        onstart: (engine) => callbacks.onstart && callbacks.onstart('browser-fallback'),
      }));
    }
  }

  function listFrenchVoices() {
    return [
      // fr-FR (France)
      { id: 'fr-FR-DeniseNeural',   label: 'Denise (FR — femme, naturelle)' },
      { id: 'fr-FR-HenriNeural',    label: 'Henri (FR — homme, naturel)' },
      { id: 'fr-FR-EloiseNeural',   label: 'Éloïse (FR — fillette)' },
      { id: 'fr-FR-AlainNeural',    label: 'Alain (FR — homme)' },
      { id: 'fr-FR-BrigitteNeural', label: 'Brigitte (FR — femme)' },
      { id: 'fr-FR-CelesteNeural',  label: 'Céleste (FR — femme)' },
      { id: 'fr-FR-ClaudeNeural',   label: 'Claude (FR — homme)' },
      { id: 'fr-FR-CoralieNeural',  label: 'Coralie (FR — femme)' },
      { id: 'fr-FR-JacquelineNeural', label: 'Jacqueline (FR — femme)' },
      { id: 'fr-FR-JeromeNeural',   label: 'Jérôme (FR — homme)' },
      { id: 'fr-FR-JosephineNeural', label: 'Joséphine (FR — femme)' },
      { id: 'fr-FR-MauriceNeural',  label: 'Maurice (FR — homme)' },
      { id: 'fr-FR-RemyMultilingualNeural', label: 'Rémy multilingue (FR)' },
      { id: 'fr-FR-VivienneMultilingualNeural', label: 'Vivienne multilingue (FR)' },
      { id: 'fr-FR-YvesNeural',     label: 'Yves (FR — homme)' },
      { id: 'fr-FR-YvetteNeural',   label: 'Yvette (FR — femme)' },
      // fr-CA (Canada)
      { id: 'fr-CA-SylvieNeural',   label: 'Sylvie (CA — femme)' },
      { id: 'fr-CA-AntoineNeural',  label: 'Antoine (CA — homme)' },
      { id: 'fr-CA-JeanNeural',     label: 'Jean (CA — homme)' },
      // fr-CH (Switzerland)
      { id: 'fr-CH-ArianeNeural',   label: 'Ariane (CH — femme)' },
      { id: 'fr-CH-FabriceNeural',  label: 'Fabrice (CH — homme)' },
      // fr-BE (Belgium)
      { id: 'fr-BE-CharlineNeural', label: 'Charline (BE — femme)' },
      { id: 'fr-BE-GerardNeural',   label: 'Gérard (BE — homme)' },
    ];
  }

  // expose
  window.TTS = {
    speak,
    stop: _stop,
    getConfig,
    setConfig,
    isAzureConfigured,
    listFrenchVoices,
    cacheClear,
    primeVoices,
  };

  // Update footer status pill
  function updateStatus() {
    const el = document.getElementById('tts-status');
    if (!el) return;
    el.classList.remove('azure', 'browser', 'error');
    if (isAzureConfigured()) {
      el.textContent = 'Voix : Azure ' + (getConfig().voice || '');
      el.classList.add('azure');
    } else {
      el.textContent = 'Voix : navigateur';
      el.classList.add('browser');
    }
  }
  document.addEventListener('DOMContentLoaded', () => {
    updateStatus();
    primeVoices();
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = primeVoices;
    }
  });
  // expose for app.js to refresh after settings change
  window.TTS.updateStatus = updateStatus;
})();
