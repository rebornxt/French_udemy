# Mon Cours de Français

A personal web app to study French from scanned course sheets, with click-to-pronounce on every word and sentence using Azure Text-to-Speech (with a graceful fallback to the browser's built-in voice).

![preview](#)

## What's inside

- **28 lessons** across two levels (Débutant + Intermédiaire)
- **82 sheets** (vocabulaire, leçons, exercices, vidéos)
- **~5,000 clickable French expressions** — click to hear them spoken
- A **conjugation test** as a bonus
- Editorial typography (Fraunces + EB Garamond) and a calm parchment paper aesthetic
- 100% static — nothing to install, deploys to GitHub Pages with a single push

## Quick start

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/mon-cours-de-francais.git
cd mon-cours-de-francais

# 2. Run a local server (any will do)
python3 -m http.server 8080
# → open http://localhost:8080
```

The app loads immediately with the **browser's built-in French voice** as a fallback. Click any word with a ♪ next to it to hear it.

## Add Azure Text-to-Speech (recommended)

The browser voice works but is robotic. Azure's neural voices (Denise, Henri, Éloïse…) sound natural.

### Option A — In-app (easiest)

1. Click the ⚙ icon in the top right.
2. Paste your Azure Speech key + region.
3. Pick a voice (default: **Denise — France, female, natural**).
4. Click **Tester la voix** to verify, then **Enregistrer**.

The key is stored in `localStorage` on your browser. It is **not** committed to git.

### Option B — Bake it into the repo

Copy `config.example.js` → `config.js` and fill in your key. Note that anyone who can load the page can read the key. Only do this for **private repos**.

### Getting an Azure key

1. Go to [portal.azure.com](https://portal.azure.com) and create a **Speech Service** resource.
2. The free tier (**F0**) includes **500,000 characters/month** of neural TTS — more than enough for personal study.
3. Copy KEY 1 and the Location/Region (e.g. `francecentral`, `westeurope`, `eastus`, `southeastasia`).

## How audio gets played

```
   click on French word
          │
          ▼
   ┌─────────────────────┐
   │ Azure key configured?│
   └─────────────────────┘
       │ yes        │ no
       ▼            ▼
   IndexedDB    Browser
   cache hit?   speechSynthesis
       │ no   │ yes      (offline)
       ▼      │
   Azure TTS  │
   REST API   │
       │      │
       └──┬───┘
          ▼
        🔊 plays
```

Every Azure response is cached in IndexedDB by `voice + rate + text`, so a word fetched once never costs you another character.

### Sample sounds — try before you set up Azure

You don't need anything pre-generated. **Every** clickable word in the app is a live sample played through your browser's built-in French voice the first time you load. Open the app, click 5 different phrases — that's your sample test. If it sounds robotic, that's expected; add an Azure key in Settings and the same words will sound natural on the next click.

## Deploy to GitHub Pages

1. Push this directory as the root of a repo.
2. Repo → **Settings → Pages → Source: Deploy from branch**, Branch: `main` / `(root)`.
3. Visit `https://YOUR_USERNAME.github.io/REPO_NAME/`.

For a **private** Pages site (so your Azure key isn't public), you need GitHub Pro or Enterprise. With a free account, prefer **Option A** above (key in localStorage only).

## Project layout

```
.
├── index.html         # app shell
├── styles.css         # all styling (no framework)
├── app.js             # router + views (vanilla JS)
├── tts.js             # TTS engine: Azure + browser fallback + IndexedDB cache
├── config.js          # default config (empty)
├── config.example.js  # template for baking in a key
├── data.json          # all extracted course content (~1 MB)
└── img/               # 374 page images (~50 MB)
```

## Regenerating the content

If you add new sheets to your course, you can rebuild `data.json` and `img/` from the source PDFs. The original extraction script lives outside this repo — keep your raw PDFs together and re-run extraction whenever the source material changes.

## Security note ⚠

Azure keys placed in `config.js` are visible to anyone who can load the page. For a personal app:

- **Best:** in-app settings (key stays in your browser only).
- **OK:** private repo with the key in `config.js`.
- **Not OK:** public repo with a real key in `config.js`. Use the F0 free tier and apply usage caps in Azure if you do this anyway.

## Credits

Course content: your private course materials.
TTS: Microsoft Azure Cognitive Services — Speech.
Fonts: [Fraunces](https://fonts.google.com/specimen/Fraunces), [EB Garamond](https://fonts.google.com/specimen/EB+Garamond), [DM Mono](https://fonts.google.com/specimen/DM+Mono).
