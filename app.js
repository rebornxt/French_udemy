/* =============================================================
 * app.js — main application (router + views)
 * ============================================================= */

(function () {
  'use strict';

  // ----- Global data -------------------------------------------
  let DATA = null;
  const $app = document.getElementById('app');

  // ----- Utilities ---------------------------------------------
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else node.setAttribute(k, v);
    }
    const arr = Array.isArray(children) ? children : [children];
    for (const c of arr) {
      if (c == null || c === false) continue;
      if (typeof c === 'string') node.appendChild(document.createTextNode(c));
      else node.appendChild(c);
    }
    return node;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function toast(msg, dur = 2200) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(t._h);
    t._h = setTimeout(() => { t.hidden = true; }, dur);
  }

  // ----- Click-to-speak wiring ---------------------------------
  // Attach a click handler to any element with .js-speak; the text spoken
  // is taken from data-text or the element's own textContent.
  function wireSpeakable(scope) {
    scope.querySelectorAll('.js-speak').forEach((node) => {
      if (node._wired) return;
      node._wired = true;
      node.addEventListener('click', (e) => {
        e.preventDefault();
        const text = node.dataset.text || node.textContent.trim();
        if (!text) return;
        // Clear playing state from anything else
        document.querySelectorAll('.is-playing').forEach((n) => n.classList.remove('is-playing'));
        node.classList.add('is-playing');
        TTS.speak(text, {
          onstart: (engine) => { /* could update UI further */ },
          onend: () => { node.classList.remove('is-playing'); },
          onerror: (err) => {
            node.classList.remove('is-playing');
            toast('Lecture impossible : ' + (err && err.message || 'erreur inconnue'));
          },
        });
      });
    });
  }

  // ----- Router ------------------------------------------------
  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '');
    if (!h) return { name: 'home' };
    const parts = h.split('/').filter(Boolean);
    if (parts[0] === 'level' && parts[1]) return { name: 'level', level: parseInt(parts[1]) };
    if (parts[0] === 'lesson' && parts[1]) return { name: 'lesson', id: parts[1], tab: parts[2] || null };
    if (parts[0] === 'extras') return { name: 'extras' };
    if (parts[0] === 'extra' && parts[1]) return { name: 'extra', idx: parseInt(parts[1]) };
    if (parts[0] === 'settings') return { name: 'settings' };
    return { name: 'home' };
  }

  function navigate(hash) {
    if (location.hash === hash) {
      // force re-render
      render();
    } else {
      location.hash = hash;
    }
  }

  function highlightNav(name) {
    document.querySelectorAll('.topnav a').forEach((a) => {
      a.classList.toggle('active', a.dataset.route === name);
    });
  }

  function render() {
    const r = parseHash();
    clear($app);
    let page;
    switch (r.name) {
      case 'level':    page = renderLevel(r.level); highlightNav('home'); break;
      case 'lesson':   page = renderLesson(r.id, r.tab); highlightNav('home'); break;
      case 'extras':   page = renderExtras(); highlightNav('extras'); break;
      case 'extra':    page = renderExtra(r.idx); highlightNav('extras'); break;
      case 'settings': page = renderSettings(); highlightNav('settings'); break;
      default:         page = renderHome(); highlightNav('home'); break;
    }
    $app.appendChild(page);
    wireSpeakable($app);
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  // ----- View: Home --------------------------------------------
  function renderHome() {
    const page = el('div', { class: 'page' });
    const lessonsByLevel = {};
    DATA.lessons.forEach((l) => {
      if (!lessonsByLevel[l.level]) lessonsByLevel[l.level] = [];
      lessonsByLevel[l.level].push(l);
    });

    page.appendChild(el('div', { class: 'home-hero' }, [
      el('div', {}, [
        el('p', { class: 'h-eyebrow', text: 'Application personnelle' }),
        el('h1', { class: 'h-display', html: 'Mon Cours <em>de</em> Français' }),
        el('p', { class: 'h-deck', text: 'Vocabulaire, leçons, exercices et vidéos — chaque mot et chaque phrase se prononce d’un simple clic.' }),
      ]),
      el('div', { class: 'meta-tag' }, [
        el('span', { text: `${DATA.lessons.length} leçons` }),
        el('span', { text: countPhrases() + ' expressions' }),
      ]),
    ]));

    page.appendChild(el('div', { class: 'rule', text: '✦  Choisissez un niveau' }));

    const grid = el('div', { class: 'level-grid' });
    DATA.meta.levels.forEach((lvl) => {
      const lessons = lessonsByLevel[lvl.id] || [];
      const numeral = romanize(lvl.id);
      const sheets = lessons.reduce((n, l) => n + l.sheets.length, 0);
      const phrases = lessons.reduce((n, l) => n + l.sheets.reduce(
        (m, s) => m + s.pages.reduce((k, p) => k + p.phrases.length, 0), 0), 0);
      const card = el('a', {
        class: 'level-card',
        href: '#/level/' + lvl.id,
        dataset: { numeral },
      }, [
        el('div', { class: 'lc-eyebrow', text: 'Niveau ' + lvl.id }),
        el('h2', { class: 'lc-title', text: lvl.name.replace(/^Niveau \d+\s*—\s*/, '') }),
        el('div', { class: 'lc-stats' }, [
          el('span', {}, [ el('strong', { text: lessons.length }), ' leçons' ]),
          el('span', {}, [ el('strong', { text: sheets }), ' fiches' ]),
          el('span', {}, [ el('strong', { text: phrases }), ' expressions' ]),
        ]),
        el('span', { class: 'lc-arrow', html: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' }),
      ]);
      grid.appendChild(card);
    });
    page.appendChild(grid);

    // Quick row
    const quick = el('div', { class: 'quick-row' });
    quick.appendChild(el('a', { href: '#/extras', class: 'quick-card' }, [
      el('span', { class: 'qc-icon', text: 'C' }),
      el('span', { class: 'qc-text' }, [
        el('span', { class: 'qc-title', text: 'Test de conjugaison' }),
        el('span', { class: 'qc-sub', text: 'Bonus — niveau A1.1 → A1.2' }),
      ]),
    ]));
    quick.appendChild(el('a', { href: '#/settings', class: 'quick-card' }, [
      el('span', { class: 'qc-icon', text: '⚙' }),
      el('span', { class: 'qc-text' }, [
        el('span', { class: 'qc-title', text: 'Réglages de la voix' }),
        el('span', { class: 'qc-sub', text: TTS.isAzureConfigured() ? 'Azure connecté' : 'Voix du navigateur' }),
      ]),
    ]));
    page.appendChild(quick);

    return page;
  }

  function romanize(n) {
    return ['','I','II','III','IV','V','VI','VII','VIII','IX','X'][n] || String(n);
  }
  function countPhrases() {
    let n = 0;
    DATA.lessons.forEach((l) => l.sheets.forEach((s) => s.pages.forEach((p) => n += p.phrases.length)));
    DATA.extras.forEach((s) => s.pages.forEach((p) => n += p.phrases.length));
    return n;
  }

  // ----- View: Level (lesson list) ----------------------------
  function renderLevel(levelId) {
    const page = el('div', { class: 'page' });
    const meta = DATA.meta.levels.find((l) => l.id === levelId);
    const lessons = DATA.lessons.filter((l) => l.level === levelId);

    page.appendChild(el('div', { class: 'crumb' }, [
      el('a', { href: '#/', text: 'Accueil' }),
      el('span', { class: 'crumb-sep', text: '/' }),
      el('span', { text: 'Niveau ' + levelId }),
    ]));
    page.appendChild(el('p', { class: 'h-eyebrow', text: 'Niveau ' + levelId }));
    page.appendChild(el('h1', { class: 'h-display', text: meta ? meta.name.replace(/^Niveau \d+\s*—\s*/, '') : 'Niveau ' + levelId }));
    page.appendChild(el('p', { class: 'h-deck', text: lessons.length + ' leçons disponibles. Cliquez sur une leçon pour ouvrir vocabulaire, exercices et fiches.' }));

    const grid = el('div', { class: 'lessons-grid' });
    lessons.forEach((l) => {
      const types = Array.from(new Set(l.sheets.map((s) => s.type)));
      const card = el('a', {
        class: 'lesson-card',
        href: '#/lesson/' + l.id,
        dataset: { num: String(l.lesson_number).padStart(2, '0') },
      }, [
        el('div', { class: 'lc-num', text: 'Leçon ' + l.lesson_number }),
        el('div', { class: 'lc-name', text: lessonShortName(l) }),
        el('div', { class: 'lc-types' }, types.map((t) => el('span', {
          class: 'lc-type-badge t-' + t,
          text: humanType(t),
        }))),
      ]);
      grid.appendChild(card);
    });
    page.appendChild(grid);
    return page;
  }

  function humanType(t) {
    return ({
      vocabulaire: 'Vocab',
      lecon: 'Leçon',
      exercices: 'Exercices',
      video: 'Vidéo',
      conjugaison_test: 'Conjug.',
    })[t] || t;
  }

  function lessonShortName(l) {
    // Pull the first few notable phrases from vocabulary, or return generic
    const v = l.sheets.find((s) => s.type === 'vocabulaire');
    if (v && v.pages[0] && v.pages[0].phrases[0]) {
      const p = v.pages[0].phrases[0];
      return '« ' + p.fr + ' »';
    }
    return 'Leçon ' + l.lesson_number;
  }

  // ----- View: Lesson detail ----------------------------------
  function renderLesson(id, tabName) {
    const lesson = DATA.lessons.find((l) => l.id === id);
    const page = el('div', { class: 'page' });
    if (!lesson) {
      page.appendChild(el('h1', { class: 'h-display', text: 'Leçon introuvable' }));
      page.appendChild(el('a', { href: '#/', text: '← retour' }));
      return page;
    }

    // Crumb
    page.appendChild(el('div', { class: 'crumb' }, [
      el('a', { href: '#/', text: 'Accueil' }),
      el('span', { class: 'crumb-sep', text: '/' }),
      el('a', { href: '#/level/' + lesson.level, text: 'Niveau ' + lesson.level }),
      el('span', { class: 'crumb-sep', text: '/' }),
      el('span', { text: 'Leçon ' + lesson.lesson_number }),
    ]));

    page.appendChild(el('div', { class: 'lesson-header' }, [
      el('div', {}, [
        el('p', { class: 'h-eyebrow', text: 'Niveau ' + lesson.level + ' — Leçon ' + lesson.lesson_number }),
        el('h1', { class: 'h-display', html: '<span class="lesson-num">№ ' + lesson.lesson_number + '</span>' + lessonShortName(lesson).replace(/^« | »$/g, '') }),
      ]),
      // prev / next nav
      el('div', { class: 'page-nav' }, [
        prevNextLink(lesson, -1),
        prevNextLink(lesson, +1),
      ]),
    ]));

    // Tabs
    const tabs = el('div', { class: 'tabs' });
    const activeTab = tabName || lesson.sheets[0].type;
    lesson.sheets.forEach((s) => {
      const btn = el('button', {
        class: 'tab-btn' + (s.type === activeTab ? ' active' : ''),
        onclick: () => navigate('#/lesson/' + lesson.id + '/' + s.type),
      }, [
        s.title,
        el('span', { class: 'tab-count', text: ' · ' + countSheetPhrases(s) }),
      ]);
      tabs.appendChild(btn);
    });
    page.appendChild(tabs);

    // Active sheet content
    const sheet = lesson.sheets.find((s) => s.type === activeTab) || lesson.sheets[0];
    page.appendChild(renderSheet(sheet));

    return page;
  }

  function prevNextLink(lesson, delta) {
    const list = DATA.lessons.filter((l) => l.level === lesson.level);
    const idx = list.findIndex((l) => l.id === lesson.id);
    const target = list[idx + delta];
    const arrow = delta < 0 ? '←' : '→';
    if (!target) return el('button', { disabled: true, text: arrow });
    return el('a', {
      href: '#/lesson/' + target.id,
      class: '',
      style: 'display:grid;place-items:center;width:32px;height:32px;border:1px solid var(--hairline);border-radius:50%;color:var(--ink-soft);text-decoration:none;font-family:var(--mono);',
      title: 'Leçon ' + target.lesson_number,
      text: arrow,
    });
  }

  function countSheetPhrases(s) {
    return s.pages.reduce((n, p) => n + p.phrases.length, 0);
  }

  // ----- View: Sheet -------------------------------------------
  function renderSheet(sheet) {
    const wrap = el('div', { class: 'sheet-wrap' });

    // Vocabulaire = special two-column layout, no image needed (but show below)
    if (sheet.type === 'vocabulaire') {
      sheet.pages.forEach((page, idx) => {
        if (idx > 0) wrap.appendChild(el('div', { class: 'rule', text: '— page ' + page.page + ' —' }));
        wrap.appendChild(renderVocabPage(page));
      });
      return wrap;
    }

    // Other types: image + phrase chip cloud, page navigation
    const state = { pageIdx: 0 };
    const inner = el('div', { class: 'sheet-content' });
    function refresh() {
      clear(inner);
      const page = sheet.pages[state.pageIdx];
      // page nav
      inner.appendChild(el('div', { class: 'page-nav' }, [
        el('button', {
          disabled: state.pageIdx === 0,
          onclick: () => { state.pageIdx--; refresh(); },
          text: '‹',
        }),
        el('span', { text: 'Page ' + (state.pageIdx + 1) + ' / ' + sheet.pages.length }),
        el('button', {
          disabled: state.pageIdx >= sheet.pages.length - 1,
          onclick: () => { state.pageIdx++; refresh(); },
          text: '›',
        }),
      ]));
      inner.appendChild(renderImagePage(page));
      wireSpeakable(inner);
    }
    refresh();
    wrap.appendChild(inner);
    return wrap;
  }

  function renderVocabPage(page) {
    const dense = page.phrases.length >= 14;
    const list = el('div', { class: 'vocab-list-grid' + (dense ? ' dense' : '') });
    page.phrases.forEach((p) => {
      list.appendChild(el('div', { class: 'vocab-fr-cell js-speak', dataset: { text: p.fr } }, [ p.fr ]));
      list.appendChild(el('div', { class: 'vocab-en-cell' }, [
        p.en || '',
        p.tag ? el('span', { class: 'vocab-tag', text: p.tag }) : null,
      ]));
    });

    return el('div', { class: 'vocab-page' }, [
      el('div', { class: 'vocab-col' }, [
        el('div', { class: 'vocab-col-h' }, [
          el('span', {}, [ el('span', { class: 'col-flag fr-flag' }), 'Français → English' ]),
          el('span', { text: page.phrases.length + ' mots' }),
        ]),
        list,
      ]),
    ]);
  }

  function renderImagePage(page) {
    const grid = el('div', { class: 'sheet-page' });
    if (page.image) {
      const imgWrap = el('div', { class: 'sheet-image-wrap' }, [
        el('img', {
          src: page.image,
          alt: 'Page de la fiche',
          loading: 'lazy',
          onclick: (e) => openLightbox(page.image),
        }),
        el('span', { class: 'zoom-tag', text: 'Cliquer pour agrandir' }),
      ]);
      grid.appendChild(imgWrap);
    }
    const panel = el('div', { class: 'phrases-panel' }, [
      el('h4', { text: page.phrases.length + ' expressions à prononcer' }),
    ]);
    if (!page.phrases.length) {
      panel.appendChild(el('p', { class: 'empty', text: 'Aucune expression détectée — cliquez sur l’image pour étudier la fiche.' }));
    } else {
      const chips = el('div', { class: 'phrase-chips' });
      page.phrases.forEach((p) => {
        chips.appendChild(el('button', {
          class: 'chip js-speak',
          dataset: { text: p.fr },
          text: p.fr,
          title: p.en || '',
        }));
      });
      panel.appendChild(chips);
    }
    grid.appendChild(panel);
    return grid;
  }

  function openLightbox(src) {
    const lb = el('div', { class: 'lightbox', onclick: (e) => { if (e.target === lb || e.target.tagName === 'BUTTON') lb.remove(); } }, [
      el('button', { class: 'lightbox-close', text: '✕  Fermer' }),
      el('img', { src }),
    ]);
    document.body.appendChild(lb);
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { lb.remove(); document.removeEventListener('keydown', esc); }
    });
  }

  // ----- View: Extras (conjugation test) ----------------------
  function renderExtras() {
    const page = el('div', { class: 'page' });
    page.appendChild(el('p', { class: 'h-eyebrow', text: 'Bonus' }));
    page.appendChild(el('h1', { class: 'h-display', html: 'Extras <em>&</em> tests' }));
    page.appendChild(el('p', { class: 'h-deck', text: 'Petits compléments à votre cours.' }));
    const grid = el('div', { class: 'lessons-grid' });
    DATA.extras.forEach((s, idx) => {
      grid.appendChild(el('a', {
        class: 'lesson-card',
        href: '#/extra/' + idx,
        dataset: { num: '★' },
      }, [
        el('div', { class: 'lc-num', text: humanType(s.type) }),
        el('div', { class: 'lc-name', text: s.title }),
        el('div', { class: 'lc-types' }, [
          el('span', { class: 'lc-type-badge', text: countSheetPhrases(s) + ' phrases' }),
        ]),
      ]));
    });
    page.appendChild(grid);
    return page;
  }

  function renderExtra(idx) {
    const sheet = DATA.extras[idx];
    const page = el('div', { class: 'page' });
    if (!sheet) {
      page.appendChild(el('h1', { class: 'h-display', text: 'Extra introuvable' }));
      return page;
    }
    page.appendChild(el('div', { class: 'crumb' }, [
      el('a', { href: '#/', text: 'Accueil' }),
      el('span', { class: 'crumb-sep', text: '/' }),
      el('a', { href: '#/extras', text: 'Extras' }),
      el('span', { class: 'crumb-sep', text: '/' }),
      el('span', { text: sheet.title }),
    ]));
    page.appendChild(el('p', { class: 'h-eyebrow', text: 'Bonus' }));
    page.appendChild(el('h1', { class: 'h-display', text: sheet.title }));
    page.appendChild(el('p', { class: 'h-deck', text: 'Cliquez sur n’importe quelle phrase pour l’écouter.' }));

    sheet.pages.forEach((p, i) => {
      page.appendChild(el('div', { class: 'rule', text: 'Page ' + p.page + (i === 0 ? ' — questions' : ' — corrigé') }));
      const card = el('div', { class: 'conj-card' });
      const list = el('ul', { class: 'conj-list' });
      const lines = (p.raw_text || '').split('\n').map((s) => s.trim()).filter(Boolean);
      if (lines.length) {
        lines.forEach((rawLine) => {
          // Collapse 4+ dots to a single ellipsis-like blank for readability
          const line = rawLine.replace(/\.{4,}/g, ' …… ').replace(/\s+/g, ' ').trim();
          // Skip lines that are entirely punctuation/blank
          if (!/[A-Za-zÀ-ÿ]/.test(line)) return;
          // Heading-ish lines
          if (/^(test|correction|conjuguez)/i.test(line) || /^\w+\s?:\s*$/.test(line)) {
            list.appendChild(el('li', { class: 'heading', text: line }));
            return;
          }
          // For TTS, drop the parenthetical infinitive hint if present
          // ("Je réserve (réserver)" → speak "Je réserve")
          const ttsText = line.replace(/\s*\([^)]*\)\s*$/, '').replace('……', '').trim();
          // Only attach speaking if there's something speakable
          if (ttsText && /[A-Za-zÀ-ÿ]/.test(ttsText)) {
            list.appendChild(el('li', {
              class: 'js-speak',
              dataset: { text: ttsText },
              text: line,
            }));
          } else {
            list.appendChild(el('li', { text: line, style: 'cursor:default;color:var(--ink-mute)' }));
          }
        });
      } else {
        p.phrases.forEach((ph) => {
          list.appendChild(el('li', {
            class: 'js-speak',
            dataset: { text: ph.fr },
            text: ph.fr,
          }));
        });
      }
      card.appendChild(list);
      page.appendChild(card);
    });

    return page;
  }

  // ----- View: Settings ----------------------------------------
  function renderSettings() {
    const page = el('div', { class: 'page' });
    const cfg = TTS.getConfig();

    page.appendChild(el('p', { class: 'h-eyebrow', text: 'Réglages' }));
    page.appendChild(el('h1', { class: 'h-display', html: 'Voix <em>&</em> prononciation' }));
    page.appendChild(el('p', { class: 'h-deck', text: 'Connectez votre clé Azure Speech pour une prononciation naturelle. Sans clé, l’application utilise la voix française du navigateur.' }));

    const card = el('div', { class: 'settings-card' });

    const status = el('span', {
      class: 'status-pill ' + (TTS.isAzureConfigured() ? 'ok' : 'warn'),
    }, [
      el('span', { class: 'dot' }),
      el('span', { text: TTS.isAzureConfigured() ? 'Azure configuré' : 'Voix du navigateur' }),
    ]);
    card.appendChild(el('div', { style: 'margin-bottom:24px' }, [status]));

    // Key
    const keyInput = el('input', {
      type: 'password',
      placeholder: 'votre-clé-azure-speech',
      value: cfg.key || '',
      autocomplete: 'off',
      spellcheck: 'false',
    });
    card.appendChild(el('div', { class: 'field' }, [
      el('label', { text: 'Clé Azure Speech' }),
      keyInput,
      el('span', { class: 'hint', text: 'Stockée en local dans votre navigateur (localStorage).' }),
    ]));

    // Region
    const regionInput = el('input', {
      type: 'text',
      placeholder: 'francecentral',
      value: cfg.region || '',
      autocomplete: 'off',
      spellcheck: 'false',
    });
    card.appendChild(el('div', { class: 'field' }, [
      el('label', { text: 'Région' }),
      regionInput,
      el('span', { class: 'hint', text: 'Ex. francecentral, westeurope, eastus, southeastasia.' }),
    ]));

    // Voice
    const voiceSelect = el('select', {});
    TTS.listFrenchVoices().forEach((v) => {
      voiceSelect.appendChild(el('option', { value: v.id, text: v.label, selected: v.id === cfg.voice }));
    });
    card.appendChild(el('div', { class: 'field' }, [
      el('label', { text: 'Voix' }),
      voiceSelect,
    ]));

    // Rate
    const rateInput = el('input', { type: 'text', value: cfg.rate || '-5%' });
    card.appendChild(el('div', { class: 'field' }, [
      el('label', { text: 'Vitesse' }),
      rateInput,
      el('span', { class: 'hint', text: 'Ex. 0% (normal), -10% (lent pour apprenants), +10% (rapide).' }),
    ]));

    // Buttons
    const saveBtn = el('button', { class: 'btn btn-primary', text: 'Enregistrer' });
    const testBtn = el('button', { class: 'btn btn-ghost', text: 'Tester la voix' });
    const clearCacheBtn = el('button', { class: 'btn btn-ghost', text: 'Vider le cache audio' });
    const resetBtn = el('button', { class: 'btn btn-danger', text: 'Effacer la clé' });

    saveBtn.addEventListener('click', () => {
      TTS.setConfig({
        key: keyInput.value.trim(),
        region: regionInput.value.trim(),
        voice: voiceSelect.value,
        rate: rateInput.value.trim() || '0%',
        pitch: cfg.pitch || '0%',
      });
      TTS.updateStatus();
      toast('Réglages enregistrés ✓');
      render();
    });
    testBtn.addEventListener('click', () => {
      // Use the form values directly without saving
      const tmp = {
        key: keyInput.value.trim(),
        region: regionInput.value.trim(),
        voice: voiceSelect.value,
        rate: rateInput.value.trim() || '0%',
        pitch: cfg.pitch || '0%',
      };
      TTS.setConfig(tmp);
      TTS.updateStatus();
      TTS.speak('Bonjour ! Bienvenue dans votre cours de français.', {
        onstart: (engine) => toast('Lecture (' + engine + ')…'),
        onerror: (e) => toast('Erreur de lecture'),
      });
    });
    clearCacheBtn.addEventListener('click', async () => {
      await TTS.cacheClear();
      toast('Cache audio vidé');
    });
    resetBtn.addEventListener('click', () => {
      keyInput.value = '';
      regionInput.value = '';
      TTS.setConfig({ key: '', region: '', voice: voiceSelect.value, rate: rateInput.value.trim() || '0%' });
      TTS.updateStatus();
      toast('Clé effacée');
      render();
    });
    card.appendChild(el('div', { class: 'btn-row' }, [saveBtn, testBtn, clearCacheBtn, resetBtn]));

    page.appendChild(card);

    // Help text
    const help = el('div', { class: 'settings-card', style: 'margin-top:24px' }, [
      el('h3', { class: 'h-eyebrow', text: 'Comment obtenir une clé Azure' }),
      el('p', { style: 'margin:.4em 0', html: '1. Allez sur <a href="https://portal.azure.com" target="_blank" rel="noopener">portal.azure.com</a> et créez une ressource <em>Speech Service</em> (le palier gratuit F0 inclut 500 000 caractères / mois).' }),
      el('p', { style: 'margin:.4em 0', text: '2. Dans la ressource, ouvrez « Keys and Endpoint » et copiez KEY 1 ainsi que la Location/Region.' }),
      el('p', { style: 'margin:.4em 0', text: '3. Collez les deux ci-dessus, choisissez une voix, puis « Tester la voix ».' }),
    ]);
    page.appendChild(help);

    return page;
  }

  // ----- Boot ---------------------------------------------------
  async function boot() {
    try {
      const resp = await fetch('data.json');
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      DATA = await resp.json();
      render();
      window.addEventListener('hashchange', render);
    } catch (err) {
      $app.innerHTML = '';
      $app.appendChild(el('div', { class: 'page' }, [
        el('h1', { class: 'h-display', text: 'Erreur de chargement' }),
        el('p', { class: 'h-deck', text: 'Impossible de charger data.json — ' + err.message }),
        el('p', {}, [
          'Si vous ouvrez ce fichier directement avec ',
          el('code', { text: 'file://' }),
          ', les requêtes fetch sont bloquées. Lancez un serveur local :',
        ]),
        el('pre', { style: 'background:var(--cream-deep);padding:12px;font-family:var(--mono);font-size:.85rem;border-radius:2px;overflow:auto', text: 'cd app && python3 -m http.server 8080\n# puis ouvrez http://localhost:8080' }),
      ]));
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
