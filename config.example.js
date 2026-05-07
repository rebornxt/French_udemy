/* =============================================================
 * config.js — TTS configuration
 * -------------------------------------------------------------
 * COPY THIS FILE TO `config.js` (it is gitignored) AND FILL IN
 * YOUR AZURE TEXT-TO-SPEECH CREDENTIALS.
 *
 * Without these, the app falls back to the browser's built-in
 * speechSynthesis API — works offline but voice quality varies
 * a lot between browsers / OSes.
 *
 * SECURITY NOTE: Because this is a static GitHub-Pages app,
 * your key WILL be visible to anyone who can load the page.
 * Use this only for personal sites and consider:
 *   - Keeping the repository PRIVATE, or
 *   - Generating a key with the smallest scope possible, or
 *   - Putting Azure usage caps on the resource.
 *
 * GitHub Pages with a private repo + custom domain works well
 * for personal use.
 * ============================================================= */

window.AZURE_TTS_CONFIG = {
  // Your Azure Speech resource key (looks like a long hex string)
  key: "",

  // The Azure region of your Speech resource, e.g. "francecentral",
  // "westeurope", "eastus", "southeastasia"
  region: "",

  // Voice — fr-FR-DeniseNeural is the default natural female voice.
  // Other options: fr-FR-HenriNeural (male), fr-FR-EloiseNeural,
  //                fr-FR-DeniseNeural (also has multiple speaking styles)
  voice: "fr-FR-DeniseNeural",

  // Speaking rate — "0%" is normal. Try "-10%" for learner mode.
  rate: "-5%",

  // Pitch — "0%" is normal.
  pitch: "0%",
};
