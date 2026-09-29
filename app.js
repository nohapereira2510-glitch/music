'use strict';

/* =====================================================================
   Hitmaker Studio: a one-page front end for the Suno API
   Docs: https://docs.sunoapi.org
   ===================================================================== */

// ---------- Endpoints ----------
// On Netlify, requests go through same-origin proxy rules in netlify.toml
// (avoids browser CORS issues). Locally we call the APIs directly.
const HOSTED = /^https?:$/.test(location.protocol) &&
  !['localhost', '127.0.0.1', '0.0.0.0', ''].includes(location.hostname);
const API_BASE = HOSTED ? '/suno' : 'https://api.sunoapi.org';
const UPLOAD_BASE = HOSTED ? '/suno-upload' : 'https://sunoapiorg.redpandaai.co';
// The API requires a callBackUrl even though this app polls for results.
const CALLBACK_URL = HOSTED
  ? `${location.origin}/.netlify/functions/suno-callback`
  : 'https://example.com/suno-callback';

// ---------- Static data ----------
const MODELS = [
  { id: 'V6', name: 'V6', desc: 'Natural vocals, rich detail', badge: 'Recommended' },
  { id: 'V6_WILD', name: 'V6 Wild', desc: 'Bold, experimental, distinctive' },
  { id: 'V6_MINI', name: 'V6 Mini', desc: 'Fast and lightweight' },
];
const LEGACY_MODELS = [
  { id: 'V5_5', name: 'V5.5', desc: 'Custom voice models' },
  { id: 'V5', name: 'V5', desc: 'Fast, musical' },
  { id: 'V4_5PLUS', name: 'V4.5+', desc: 'Richer tones, 8 min' },
  { id: 'V4_5ALL', name: 'V4.5 All', desc: 'Better structure' },
  { id: 'V4_5', name: 'V4.5', desc: 'Smart prompts, 8 min' },
  { id: 'V4', name: 'V4', desc: 'Clear vocals, 4 min' },
];
const ALL_MODELS = [...MODELS, ...LEGACY_MODELS];
const DURATION_MODELS = ['V6', 'V6_WILD', 'V6_MINI', 'V5_5'];

const GENRES = ['Pop', 'Hip-hop', 'R&B', 'Lo-fi', 'EDM', 'Rock', 'Indie folk', 'Jazz', 'Latin', 'Reggaeton',
  'Country', 'Synthwave', 'Afrobeats', 'Classical', 'Metal', 'K-pop', 'Gospel', 'Cinematic'];
const MOODS = ['upbeat', 'dreamy', 'melancholic', 'energetic', 'chill', 'epic', 'romantic', 'dark'];

const IDEAS = [
  ['A sunny reggae tune about skipping class to hit the beach in Boca Raton', 'reggae, sunny, laid-back'],
  ['An epic cinematic anthem for an owl who becomes a superhero', 'cinematic, orchestral, epic'],
  ['A lo-fi study beat for late nights in the library', 'lo-fi hip hop, chill, rain'],
  ['A heartbreak country ballad about a lost pickup truck', 'country, acoustic, twangy'],
  ['A hyper-pop banger about running out of phone battery', 'hyperpop, glitchy, energetic'],
  ['A jazzy lounge song about the perfect cup of Cuban coffee', 'smooth jazz, lounge, saxophone'],
  ['An 80s synthwave track about driving I-95 at midnight', 'synthwave, retro, neon'],
  ['A motivational hip-hop track about crushing finals week', 'hip-hop, motivational, hard-hitting'],
  ['A K-pop dance song about a cat who runs a startup', 'k-pop, dance, bright'],
  ['A sea shanty about hurricane season in Florida', 'sea shanty, folk, group vocals'],
];
const LYRIC_IDEAS = ['First day at a new job', 'Long-distance friendship', 'Summer road trip',
  'Coffee addiction', 'Graduation day', 'Rainy Sunday', 'Chasing a dream', 'My dog is my best friend'];
const SOUND_IDEAS = ['Ocean waves at night', 'Trap hi-hat loop 140 bpm', 'Cozy fireplace crackle',
  'Sci-fi door whoosh', 'Jungle birds ambience', 'Funky bass groove', 'Retro game coin sound'];
const SECTION_TAGS = ['[Intro]', '[Verse]', '[Pre-Chorus]', '[Chorus]', '[Bridge]', '[Outro]', '[Instrumental]', '[Drop]'];
const KEYS = ['Any', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
  'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm'];
const VARIETY = ['Exact', 'Normal', 'High', 'Extra', 'Max'];

const MUSIC_STEPS = ['Queued', 'Writing', 'First take', 'Done'];
const SIMPLE_STEPS = ['Queued', 'Working', 'Done'];
const MUSIC_FAIL = ['CREATE_TASK_FAILED', 'GENERATE_AUDIO_FAILED', 'CALLBACK_EXCEPTION', 'SENSITIVE_WORD_ERROR', 'FAILED'];
const POLL_MS = 5000;
const JOB_TIMEOUT_MS = 25 * 60 * 1000;

const ERROR_TEXT = {
  400: 'Some settings were not accepted.',
  401: 'That API key was rejected. Check it and try again.',
  404: 'That feature is not available right now.',
  405: 'Rate limit reached. Wait a moment and try again.',
  413: 'Your prompt or lyrics are too long.',
  429: 'You are out of credits. Top up at sunoapi.org.',
  430: 'Too many requests at once. Wait a few seconds and retry.',
  455: 'Suno is under maintenance. Try again soon.',
  500: 'The server had a problem. Try again.',
};

// ---------- Helpers ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const fmtTime = (s) => {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const store = {
  get(key, fallback, session = false) {
    try {
      const v = (session ? sessionStorage : localStorage).getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value, session = false) {
    try { (session ? sessionStorage : localStorage).setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  },
  del(key) {
    try { localStorage.removeItem(key); sessionStorage.removeItem(key); } catch { /* ignore */ }
  },
};

function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), type === 'err' ? 7000 : 4500);
}

// ---------- State ----------
const state = {
  key: store.get('hm-key', null) || store.get('hm-key', null, true),
  mode: store.get('hm-mode', 'simple'),
  model: store.get('hm-model', 'V6'),
  remixMode: 'cover',
  tracks: store.get('hm-tracks', []),
  jobs: store.get('hm-jobs', []),
  personas: store.get('hm-personas', []),
  lyricDrafts: store.get('hm-lyrics', []),
  current: null,
  pollTimer: null,
};
const saveTracks = () => store.set('hm-tracks', state.tracks);
const saveJobs = () => store.set('hm-jobs', state.jobs);

// ---------- API ----------
class ApiError extends Error {
  constructor(code, msg) {
    super(ERROR_TEXT[code] ? `${ERROR_TEXT[code]}${msg && code === 400 ? ` (${msg})` : ''}` : (msg || `Request failed (${code})`));
    this.code = code;
  }
}

async function api(path, { method = 'GET', body, base = API_BASE, key = state.key, form } = {}) {
  const headers = { Authorization: `Bearer ${key}` };
  let payload;
  if (form) payload = form;
  else if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }

  let res;
  try {
    res = await fetch(base + path, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, 'Could not reach the Suno API. Check your connection.');
  }
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  if (!json) {
    throw new ApiError(res.status === 200 ? 502 : res.status,
      HOSTED ? 'The site could not reach the Suno API through Netlify. Check that netlify.toml was deployed.' : `Unexpected response (${res.status}).`);
  }
  const code = json?.code ?? res.status;
  if (!res.ok || (json && json.code !== undefined && json.code !== 200) || json?.success === false) {
    throw new ApiError(code === 200 ? res.status : code, json?.msg);
  }
  return json?.data;
}

const post = (path, body) => api(path, { method: 'POST', body: { callBackUrl: CALLBACK_URL, ...body } });

async function uploadFile(file) {
  const form = new FormData();
  form.append('file', file);
  form.append('uploadPath', 'hitmaker-studio');
  form.append('fileName', `${Date.now()}-${file.name.replace(/[^\w.-]+/g, '_')}`);
  const data = await api('/api/file-stream-upload', { method: 'POST', base: UPLOAD_BASE, form });
  if (!data?.downloadUrl) throw new Error('Upload failed.');
  return data.downloadUrl;
}

// The docs list two paths for the credit balance; try both.
async function getCredits(key = state.key) {
  try {
    return await api('/api/v1/generate/credit', { key });
  } catch (err) {
    if (err.code === 404) return api('/api/v1/get-credits', { key });
    throw err;
  }
}

// Accept keys pasted as "Bearer xyz", in quotes, or with stray spaces.
const cleanKey = (raw) => raw.trim().replace(/^bearer\s+/i, '').replace(/^["'`]+|["'`]+$/g, '').replace(/\s+/g, '');

async function refreshCredits() {
  try {
    const c = await getCredits();
    const n = typeof c === 'object' && c !== null ? (c.credits ?? c.balance ?? JSON.stringify(c)) : c;
    $('#credits-val').textContent = typeof n === 'number' ? n.toLocaleString() : n;
    return n;
  } catch (err) {
    if (err.code === 401) lock('Your API key is no longer valid.');
    return null;
  }
}

// ---------- Theme ----------
function applyTheme(choice) {
  const root = document.documentElement;
  if (choice === 'light' || choice === 'dark') {
    root.setAttribute('data-theme', choice);
    try { localStorage.setItem('hm-theme', choice); } catch { /* ignore */ }
  } else {
    root.removeAttribute('data-theme');
    try { localStorage.removeItem('hm-theme'); } catch { /* ignore */ }
  }
  $$('[data-theme-choice]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.themeChoice === choice)));
}
function savedTheme() {
  try { const t = localStorage.getItem('hm-theme'); return t === 'light' || t === 'dark' ? t : 'system'; } catch { return 'system'; }
}

// ---------- Key gate ----------
function showGate(message = '') {
  $('#app').hidden = true;
  $('#gate').hidden = false;
  $('#key-error').textContent = message;
  setTimeout(() => $('#key-input').focus(), 50);
}
function showApp() {
  $('#gate').hidden = true;
  $('#app').hidden = false;
  refreshCredits();
  renderLibrary();
  renderJobs();
  startPolling();
}
function lock(message = '') {
  state.key = null;
  store.del('hm-key');
  stopPolling();
  showGate(message);
}

function gateError(err) {
  if (err.code === 401) {
    return 'Suno rejected this key (error 401). Keys are case-sensitive: copy it again from sunoapi.org/api-key, or reset it there if it was shared.';
  }
  if (err.code === 0 && !HOSTED) {
    return 'Your browser blocked the request because the page is opened from your computer. Open your Netlify site instead (or run "npx netlify-cli dev").';
  }
  return `${err.message}${err.code ? ` (error ${err.code})` : ''}`;
}

function initGate() {
  $('#key-toggle').addEventListener('click', () => {
    const i = $('#key-input');
    i.type = i.type === 'password' ? 'text' : 'password';
  });
  $('#key-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = cleanKey($('#key-input').value);
    if (!key) return;
    const btn = $('#key-submit');
    btn.disabled = true;
    btn.textContent = 'Checking your key…';
    $('#key-error').textContent = '';
    try {
      await getCredits(key);
      state.key = key;
      const remember = $('#key-remember').checked;
      store.del('hm-key');
      store.set('hm-key', key, !remember);
      $('#key-input').value = '';
      showApp();
      toast('Welcome to the studio! 🎶', 'ok');
    } catch (err) {
      $('#key-error').textContent = gateError(err);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Unlock the studio →';
    }
  });
  $('#logout').addEventListener('click', () => {
    if (confirm('Lock the studio and forget your API key on this device? Your library stays.')) lock();
  });
}

// ---------- Tabs ----------
function goTab(name) {
  $$('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  $$('.panel').forEach((p) => { p.hidden = p.id !== `tab-${name}`; });
  if (name === 'library') renderLibrary();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------- Create ----------
function setMode(mode) {
  state.mode = mode;
  store.set('hm-mode', mode);
  const form = $('#create-form');
  form.classList.toggle('mode-simple', mode === 'simple');
  form.classList.toggle('mode-custom', mode === 'custom');
  $$('[data-mode]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === mode)));
}

function renderModels() {
  const card = (m) => `<button type="button" role="radio" class="model" data-model="${m.id}" aria-checked="${m.id === state.model}">
      ${m.badge ? `<i class="badge">${esc(m.badge)}</i>` : ''}<b>${esc(m.name)}</b><span>${esc(m.desc)}</span></button>`;
  $('#models').innerHTML = MODELS.map(card).join('');
  $('#legacy-models').innerHTML = LEGACY_MODELS.map(card).join('');
  if (LEGACY_MODELS.some((m) => m.id === state.model)) $('.legacy').open = true;
  $('#duration-field').style.opacity = DURATION_MODELS.includes(state.model) ? '1' : '.45';
}

function modelOptions(selected = 'V6') {
  return ALL_MODELS.map((m) => `<option value="${m.id}" ${m.id === selected ? 'selected' : ''}>${esc(m.name)}${LEGACY_MODELS.includes(m) ? ' (legacy)' : ''}</option>`).join('');
}

function bindCounters() {
  $$('.counter').forEach((c) => {
    const input = document.getElementById(c.dataset.for);
    const update = () => { c.textContent = `${input.value.length} / ${input.maxLength}`; };
    input.addEventListener('input', update);
    update();
  });
}

function renderPersonas() {
  const sel = $('#c-persona');
  sel.innerHTML = '<option value="">None</option>' +
    state.personas.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
}

function initCreate() {
  setMode(state.mode);
  renderModels();
  renderPersonas();

  $$('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  $('#c-gender').addEventListener('click', (e) => {
    const b = e.target.closest('[data-val]');
    if (!b) return;
    $$('#c-gender [data-val]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
  });

  const pickModel = (e) => {
    const b = e.target.closest('[data-model]');
    if (!b) return;
    state.model = b.dataset.model;
    store.set('hm-model', state.model);
    renderModels();
  };
  $('#models').addEventListener('click', pickModel);
  $('#legacy-models').addEventListener('click', pickModel);

  // Genre + mood chips append to the style field
  $('#genre-chips').innerHTML = [...GENRES, ...MOODS].map((g) => `<button type="button" class="chip" data-chip="${esc(g)}">${esc(g)}</button>`).join('');
  $('#genre-chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-chip]');
    if (!b) return;
    const input = $('#c-style');
    const parts = input.value.split(',').map((s) => s.trim()).filter(Boolean);
    const val = b.dataset.chip;
    const i = parts.findIndex((p) => p.toLowerCase() === val.toLowerCase());
    if (i >= 0) parts.splice(i, 1); else parts.push(val);
    input.value = parts.join(', ');
    syncChips();
  });
  $('#c-style').addEventListener('input', syncChips);

  // Section tags insert at cursor
  $('#tag-bar').innerHTML = SECTION_TAGS.map((t) => `<button type="button" data-tag="${t}">${t}</button>`).join('');
  $('#tag-bar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tag]');
    if (!b) return;
    const ta = $('#c-lyrics');
    const { selectionStart: s, selectionEnd: en, value } = ta;
    const insert = `${s > 0 && value[s - 1] !== '\n' ? '\n\n' : ''}${b.dataset.tag}\n`;
    ta.value = value.slice(0, s) + insert + value.slice(en);
    ta.focus();
    ta.selectionStart = ta.selectionEnd = s + insert.length;
    ta.dispatchEvent(new Event('input'));
  });

  $('#surprise').addEventListener('click', () => {
    const [p, s] = pick(IDEAS);
    $('#c-prompt').value = p;
    $('#c-style').value = s;
    $('#c-prompt').dispatchEvent(new Event('input'));
    syncChips();
  });

  // Sliders
  const out = (id) => {
    const el = $(`#${id}`);
    const o = $(`[data-out="${id}"]`);
    const upd = () => { o.textContent = `${Math.round(el.value * 100)}%`; };
    el.addEventListener('input', upd); upd();
  };
  ['c-styleWeight', 'c-weird', 'c-audioWeight'].forEach(out);
  const dur = $('#c-duration');
  const durUpd = () => { $('#c-duration-val').textContent = +dur.value ? fmtTime(+dur.value) : 'auto'; };
  dur.addEventListener('input', durUpd); durUpd();
  const variety = $('#c-variety');
  const varUpd = () => { $('#c-variety-val').textContent = VARIETY[variety.value]; };
  variety.addEventListener('input', varUpd); varUpd();
  ['c-styleWeight', 'c-weird', 'c-audioWeight', 'c-variety'].forEach((id) =>
    $(`#${id}`).addEventListener('input', () => { $('#c-send-sliders').checked = true; }));

  $('#boost-style').addEventListener('click', boostStyle);
  $('#write-lyrics').addEventListener('click', openLyricsHelper);
  $('#create-form').addEventListener('submit', submitCreate);
}

function syncChips() {
  const parts = $('#c-style').value.toLowerCase().split(',').map((s) => s.trim());
  $$('#genre-chips .chip').forEach((c) => c.classList.toggle('on', parts.includes(c.dataset.chip.toLowerCase())));
}

async function boostStyle() {
  const content = $('#c-style').value.trim() || $('#c-prompt').value.trim() || $('#c-title').value.trim();
  if (!content) { toast('Type a few style words first, like "dreamy pop".'); $('#c-style').focus(); return; }
  const btn = $('#boost-style');
  btn.disabled = true; btn.textContent = '🚀 Boosting…';
  try {
    const data = await api('/api/v1/style/generate', { method: 'POST', body: { content } });
    const result = data?.result || data?.style || (typeof data === 'string' ? data : '');
    if (result) {
      $('#c-style').value = result.slice(0, 1000);
      syncChips();
      toast('Style boosted ✨', 'ok');
      if (data?.creditsRemaining != null) $('#credits-val').textContent = data.creditsRemaining;
    } else toast('No boosted style came back. Try different words.');
  } catch (err) { toast(err.message, 'err'); } finally {
    btn.disabled = false; btn.textContent = '🚀 Boost style';
  }
}

async function withUpload(file, label) {
  if (!file) return null;
  toast(`Uploading ${label}…`);
  return uploadFile(file);
}

async function submitCreate(e) {
  e.preventDefault();
  const btn = $('#create-btn');
  const custom = state.mode === 'custom';
  const model = state.model;
  const instrumental = $('#c-instrumental').checked;
  const style = $('#c-style').value.trim();
  const body = { customMode: custom, instrumental, model };

  if (style) body.style = style.slice(0, model === 'V4' ? 200 : 1000);

  try {
    btn.disabled = true;
    btn.textContent = 'Sending to the studio…';

    if (!custom) {
      const prompt = $('#c-prompt').value.trim();
      const image = $('#c-image').files[0];
      const audio = $('#c-audio').files[0];
      if (!prompt && !style && !image && !audio) throw new Error('Describe your song first, or tap 🎲 Surprise me.');
      if (prompt) body.prompt = prompt;
      const imgUrl = await withUpload(image, 'your image');
      const audUrl = await withUpload(audio, 'your audio');
      if (imgUrl) body.imageUrls = [imgUrl];
      if (audUrl) body.audioUrls = [audUrl];
    } else {
      const title = $('#c-title').value.trim();
      const lyrics = $('#c-lyrics').value.trim();
      const negative = $('#c-negative').value.trim();
      const gender = $('#c-gender [aria-checked="true"]').dataset.val;
      if (!style && !lyrics && !negative) throw new Error('Add a style or some lyrics so the model knows what to make.');
      if (!instrumental && !lyrics && !style) throw new Error('Add lyrics, or switch on Instrumental.');
      if (title) body.title = title;
      if (lyrics && !instrumental) { body.lyrics = lyrics; body.prompt = lyrics; }
      if (negative) body.negativeTags = negative;
      if (gender && !instrumental) body.vocalGender = gender;
      const dur = +$('#c-duration').value;
      if (dur && DURATION_MODELS.includes(model)) body.duration = dur;
      if ($('#c-send-sliders').checked) {
        body.styleWeight = +(+$('#c-styleWeight').value).toFixed(2);
        body.weirdnessConstraint = +(+$('#c-weird').value).toFixed(2);
        if (!instrumental) body.audioWeight = +(+$('#c-audioWeight').value).toFixed(2);
        body.variety = +$('#c-variety').value;
      }
      const persona = $('#c-persona').value;
      if (persona) { body.personaId = persona; body.personaModel = $('#c-personaModel').value; }
    }

    const data = await post('/api/v1/generate', body);
    const label = body.title || body.prompt?.slice(0, 60) || body.style?.slice(0, 60) || 'New song';
    addJob({ taskId: data.taskId, kind: 'music', label, meta: { model, source: 'song' } });
    toast('Your song is being made! About 1 to 3 minutes. 🎵', 'ok');
  } catch (err) {
    toast(err.message, 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = '🎵 Create song';
  }
}

// ---------- Lyrics ----------
function initLyrics() {
  $('#lyric-ideas').innerHTML = LYRIC_IDEAS.map((l) => `<button type="button" class="chip" data-idea="${esc(l)}">${esc(l)}</button>`).join('');
  $('#lyric-ideas').addEventListener('click', (e) => {
    const b = e.target.closest('[data-idea]');
    if (!b) return;
    $('#l-prompt').value = b.dataset.idea;
    $('#l-prompt').dispatchEvent(new Event('input'));
  });
  $('#lyrics-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = $('#l-prompt').value.trim();
    if (!prompt) return;
    await startLyricsJob(prompt, false);
  });
  $('#lyrics-results').addEventListener('click', (e) => {
    const b = e.target.closest('[data-use],[data-copy],[data-del-lyric]');
    if (!b) return;
    const d = state.lyricDrafts[+(b.dataset.use ?? b.dataset.copy ?? b.dataset.delLyric)];
    if (!d) return;
    if (b.dataset.use !== undefined) useLyrics(d);
    else if (b.dataset.copy !== undefined) navigator.clipboard?.writeText(d.text).then(() => toast('Lyrics copied 📋', 'ok'));
    else { state.lyricDrafts.splice(+b.dataset.delLyric, 1); store.set('hm-lyrics', state.lyricDrafts); renderLyrics(); }
  });
  renderLyrics();
}

async function startLyricsJob(prompt, fill) {
  try {
    const data = await post('/api/v1/lyrics', { prompt: prompt.slice(0, 200) });
    addJob({ taskId: data.taskId, kind: 'lyrics', label: `Lyrics: ${prompt.slice(0, 50)}`, meta: { fill } });
    toast('Writing your lyrics… ✍️', 'ok');
  } catch (err) { toast(err.message, 'err'); }
}

function useLyrics(d) {
  goTab('create');
  setMode('custom');
  $('#c-lyrics').value = d.text;
  if (d.title && !$('#c-title').value) $('#c-title').value = d.title.slice(0, 80);
  $('#c-lyrics').dispatchEvent(new Event('input'));
  $('#c-instrumental').checked = false;
  toast('Lyrics loaded. Pick a style and hit Create!', 'ok');
}

function renderLyrics() {
  $('#lyrics-results').innerHTML = state.lyricDrafts.map((d, i) => `
    <article class="card lyric-card">
      <div class="label-row"><h3>${esc(d.title || 'Untitled')}</h3>
        <button class="icon-btn" data-del-lyric="${i}" title="Delete">🗑️</button></div>
      <pre>${esc(d.text)}</pre>
      <div class="row gap-s wrap">
        <button class="btn primary small" data-use="${i}">🎵 Turn into a song</button>
        <button class="btn small" data-copy="${i}">📋 Copy</button>
      </div>
    </article>`).join('');
}

function openLyricsHelper() {
  const seed = [$('#c-title').value, $('#c-style').value].filter(Boolean).join(', ');
  openModal(`
    <h2>✍️ Write lyrics with AI</h2>
    <p class="muted">Describe the story. The lyrics will drop into your song when they're ready.</p>
    <form id="lh-form" class="form">
      <textarea id="lh-prompt" rows="3" maxlength="200" required placeholder="A love song about two owls on campus">${esc(seed)}</textarea>
      <button class="btn primary">Write them</button>
    </form>`);
  $('#lh-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    closeModal();
    await startLyricsJob($('#lh-prompt').value.trim(), true);
  });
}

// ---------- Remix ----------
function initRemix() {
  $('#r-model').innerHTML = modelOptions('V6');
  $('#remix-modes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rmode]');
    if (!b) return;
    state.remixMode = b.dataset.rmode;
    syncRemix();
  });
  $('#remix-form').addEventListener('submit', submitRemix);
  syncRemix();
}

function syncRemix() {
  const m = state.remixMode;
  $$('[data-rmode]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.rmode === m)));
  const show = (sel, on) => $$(sel).forEach((el) => { el.hidden = !on; });
  show('.r-mashup', m === 'mashup');
  show('.r-extend', m === 'extend');
  show('.r-lyrics', m !== 'instrumental');
  show('.r-instr', m === 'cover' || m === 'extend');
  show('.r-gender', m !== 'instrumental');
  show('.r-negative', true);
  const required = m === 'vocals' || m === 'instrumental';
  $$('.r-opt').forEach((el) => { el.textContent = required ? '(required)' : '(optional)'; });
  $('#remix-btn').textContent = {
    cover: '🎭 Make a cover', extend: '➡️ Extend it', vocals: '🎤 Add vocals',
    instrumental: '🎸 Add backing music', mashup: '🔀 Mash them up',
  }[m];
}

async function sourceUrl(fileSel, urlSel, label) {
  const file = $(fileSel).files[0];
  if (file) return uploadFile(file);
  const url = $(urlSel).value.trim();
  if (!url) throw new Error(`Add ${label}: upload a file or paste a link.`);
  return url;
}

async function submitRemix(e) {
  e.preventDefault();
  const m = state.remixMode;
  const btn = $('#remix-btn');
  const original = btn.textContent;
  const title = $('#r-title').value.trim();
  const style = $('#r-style').value.trim();
  const lyrics = $('#r-lyrics').value.trim();
  const negative = $('#r-negative').value.trim();
  const gender = $('#r-gender').value;
  const model = $('#r-model').value;
  const instrumental = $('#r-instrumental').checked;

  try {
    if ((m === 'vocals' || m === 'instrumental') && (!title || !style)) throw new Error('Add a title and a style for this remix.');
    btn.disabled = true;
    btn.textContent = 'Uploading…';
    const uploadUrl = await sourceUrl('#r-file', '#r-url', 'your audio');
    let path; let body;
    const common = {};
    if (title) common.title = title;
    if (gender && m !== 'instrumental') common.vocalGender = gender;

    if (m === 'cover' || m === 'extend') {
      path = m === 'cover' ? '/api/v1/generate/upload-cover' : '/api/v1/generate/upload-extend';
      // Custom mode needs a style and a title; otherwise the prompt describes the result.
      const customMode = Boolean(style && title);
      body = { ...common, uploadUrl, model, instrumental, customMode };
      if (style) body.style = style;
      if (lyrics && !instrumental) { body.lyrics = lyrics; body.prompt = lyrics; }
      if (!customMode && !body.prompt) body.prompt = style || title || (m === 'cover' ? 'A fresh cover of this song' : 'Continue this song');
      if (negative) body.negativeTags = negative;
      if (m === 'extend') {
        const at = +$('#r-continue').value;
        if (at > 0) body.continueAt = at;
      }
      if (instrumental) delete body.vocalGender;
    } else if (m === 'vocals') {
      path = '/api/v1/generate/add-vocals';
      body = { ...common, uploadUrl, model, style, negativeTags: negative || 'low quality' };
      if (lyrics) { body.lyrics = lyrics; body.prompt = lyrics; } else body.prompt = style;
    } else if (m === 'instrumental') {
      path = '/api/v1/generate/add-instrumental';
      body = { ...common, uploadUrl, model, tags: style, negativeTags: negative || 'low quality' };
    } else {
      path = '/api/v1/generate/mashup';
      const second = await sourceUrl('#r-file2', '#r-url2', 'the second track');
      body = { ...common, uploadUrlList: [uploadUrl, second], model };
      if (style) body.style = style;
      if (lyrics) { body.lyrics = lyrics; body.prompt = lyrics; }
    }

    btn.textContent = 'Starting…';
    const data = await post(path, body);
    const names = { cover: 'Cover', extend: 'Extended', vocals: 'Vocals added', instrumental: 'Backing added', mashup: 'Mashup' };
    addJob({ taskId: data.taskId, kind: 'music', label: title || `${names[m]} remix`, meta: { model, source: m } });
    toast('Remix started! 🎛️', 'ok');
  } catch (err) {
    toast(err.message, 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

// ---------- Sounds ----------
function initSounds() {
  $('#s-key').innerHTML = KEYS.map((k) => `<option>${k}</option>`).join('');
  $('#s-model').innerHTML = modelOptions('V6');
  $('#sound-ideas').innerHTML = SOUND_IDEAS.map((s) => `<button type="button" class="chip" data-sidea="${esc(s)}">${esc(s)}</button>`).join('');
  $('#sound-ideas').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sidea]');
    if (!b) return;
    $('#s-prompt').value = b.dataset.sidea;
    $('#s-prompt').dispatchEvent(new Event('input'));
  });
  const t = $('#s-tempo');
  const upd = () => { $('#s-tempo-val').textContent = +t.value ? `${t.value} BPM` : 'Auto'; };
  t.addEventListener('input', upd); upd();

  $('#sounds-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = $('#s-prompt').value.trim();
    if (!prompt) return;
    const body = {
      prompt, model: $('#s-model').value, soundLoop: $('#s-loop').checked,
      soundKey: $('#s-key').value, grabLyrics: $('#s-grab').checked,
    };
    if (+t.value) body.soundTempo = +t.value;
    try {
      const data = await post('/api/v1/generate/sounds', body);
      addJob({ taskId: data.taskId, kind: 'music', label: `Sound: ${prompt.slice(0, 50)}`, meta: { model: body.model, source: 'sound' } });
      toast('Cooking up your sound… 🔊', 'ok');
    } catch (err) { toast(err.message, 'err'); }
  });
}

// ---------- Jobs & polling ----------
function addJob({ taskId, kind, label, trackId, meta = {} }) {
  if (!taskId) { toast('The API did not return a task ID.', 'err'); return; }
  state.jobs.unshift({ taskId, kind, label, trackId, meta, status: 'PENDING', step: 0, createdAt: Date.now(), announced: false });
  saveJobs();
  renderJobs();
  startPolling();
  setTimeout(pollAll, 2500);
}

function renderJobs() {
  const list = $('#jobs-list');
  $('#jobs').hidden = state.jobs.length === 0;
  list.innerHTML = state.jobs.map((j, i) => {
    const steps = j.kind === 'music' ? MUSIC_STEPS : SIMPLE_STEPS;
    const failed = j.status === 'FAILED';
    const bars = steps.map((_, s) => `<i class="${failed ? '' : s < j.step ? 'done' : s === j.step ? 'now' : ''}"></i>`).join('');
    const mins = Math.floor((Date.now() - j.createdAt) / 60000);
    return `<li class="job ${failed ? 'failed' : ''}">
      ${failed ? '<span aria-hidden="true">⚠️</span>' : '<span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>'}
      <div class="ellipsis"><b>${esc(j.label)}</b>
        <div class="small muted">${failed ? esc(j.error || 'Failed') : `${steps[Math.min(j.step, steps.length - 1)]}… ${mins ? `${mins} min` : 'just now'}`}</div>
        <div class="steps">${bars}</div></div>
      <button class="icon-btn" data-dismiss="${i}" title="${failed ? 'Dismiss' : 'Stop tracking'}">✕</button>
    </li>`;
  }).join('');
}

function startPolling() {
  if (state.pollTimer || !state.jobs.length) return;
  state.pollTimer = setInterval(pollAll, POLL_MS);
}
function stopPolling() {
  clearInterval(state.pollTimer);
  state.pollTimer = null;
}

let polling = false;
async function pollAll() {
  if (polling || !state.key) return;
  polling = true;
  try {
    for (const job of [...state.jobs]) {
      if (job.status === 'FAILED') continue;
      if (Date.now() - job.createdAt > JOB_TIMEOUT_MS) { failJob(job, 'Timed out. Try importing the task later.'); continue; }
      try { await pollJob(job); } catch (err) {
        if (err.code === 401) { lock('Your API key is no longer valid.'); return; }
        if ([400, 404, 413].includes(err.code)) failJob(job, err.message);
      }
      await sleep(250);
    }
  } finally {
    polling = false;
    saveJobs();
    renderJobs();
    if (!state.jobs.some((j) => j.status !== 'FAILED')) stopPolling();
  }
}

const EXTRA_ENDPOINT = {
  wav: '/api/v1/wav/record-info',
  stems: '/api/v1/vocal-removal/record-info',
  video: '/api/v1/mp4/record-info',
  cover: '/api/v1/suno/cover/record-info',
};

function flagState(d) {
  const f = d?.successFlag ?? d?.status;
  if (f === 'SUCCESS' || f === 1 || f === '1') return 'done';
  if (typeof f === 'string' && /FAIL|ERROR|EXCEPTION/i.test(f)) return 'failed';
  if (f === 2 || f === 3 || f === '2' || f === '3') return 'failed';
  return 'pending';
}

async function pollJob(job) {
  const q = `?taskId=${encodeURIComponent(job.taskId)}`;
  if (job.kind === 'music') {
    const d = await api(`/api/v1/generate/record-info${q}`);
    const status = d?.status || 'PENDING';
    job.status = status;
    job.step = { PENDING: 0, GENERATING: 1, TEXT_SUCCESS: 1, FIRST_SUCCESS: 2, SUCCESS: 3 }[status] ?? job.step;
    const items = d?.response?.sunoData || d?.response?.data || [];
    if (items.length) upsertTracks(job, items);
    if (status === 'FIRST_SUCCESS' && !job.announced && items.some((t) => t.stream_audio_url || t.streamAudioUrl || t.audio_url || t.audioUrl)) {
      job.announced = true;
      toast(`🎧 First take of "${job.label}" is streaming. Open your Library!`, 'ok');
      updateLibCount();
    }
    if (status === 'SUCCESS') finishJob(job, `✅ "${job.label}" is ready!`);
    else if (MUSIC_FAIL.includes(status)) failJob(job, d?.errorMessage || friendlyStatus(status));
    return;
  }
  if (job.kind === 'lyrics') {
    const d = await api(`/api/v1/lyrics/record-info${q}`);
    job.status = d?.status || 'PENDING';
    job.step = job.status === 'SUCCESS' ? 2 : 1;
    if (job.status === 'SUCCESS') {
      const drafts = (d?.response?.data || []).filter((x) => x.text);
      state.lyricDrafts.unshift(...drafts.map((x) => ({ title: x.title, text: x.text })));
      state.lyricDrafts = state.lyricDrafts.slice(0, 30);
      store.set('hm-lyrics', state.lyricDrafts);
      renderLyrics();
      if (job.meta.fill && drafts[0]) {
        $('#c-lyrics').value = drafts[0].text;
        if (drafts[0].title && !$('#c-title').value) $('#c-title').value = drafts[0].title.slice(0, 80);
        $('#c-lyrics').dispatchEvent(new Event('input'));
      }
      finishJob(job, job.meta.fill ? '✍️ Lyrics added to your song!' : `✍️ ${drafts.length} lyric drafts ready.`);
    } else if (/FAIL|ERROR/.test(job.status)) failJob(job, d?.errorMessage || 'Lyrics failed.');
    return;
  }
  const d = await api(`${EXTRA_ENDPOINT[job.kind]}${q}`);
  const st = flagState(d);
  job.step = st === 'done' ? 2 : 1;
  if (st === 'done') {
    const track = state.tracks.find((t) => t.id === job.trackId);
    if (track) {
      track.extras = track.extras || {};
      const r = d.response || {};
      if (job.kind === 'wav' && r.audioWavUrl) track.extras.wav = r.audioWavUrl;
      if (job.kind === 'video' && r.videoUrl) track.extras.video = r.videoUrl;
      if (job.kind === 'cover' && r.images?.length) track.extras.covers = r.images;
      if (job.kind === 'stems') track.extras.stems = collectStems(r);
      saveTracks();
      renderLibrary();
    }
    finishJob(job, `✅ ${job.label} is ready. Open the track's ⋯ menu.`);
  } else if (st === 'failed') failJob(job, d?.errorMessage || 'Failed');
}

function collectStems(r) {
  const stems = {};
  (r.originData || []).forEach((s) => { if (s.audio_url) stems[s.stem_type_group_name || `Stem ${Object.keys(stems).length + 1}`] = s.audio_url; });
  Object.entries(r).forEach(([k, v]) => {
    if (typeof v === 'string' && /Url$/.test(k) && k !== 'originUrl' && v.startsWith('http')) {
      const name = k.replace(/Url$/, '').replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
      if (!Object.values(stems).includes(v)) stems[name] = v;
    }
  });
  return stems;
}

function friendlyStatus(s) {
  return {
    SENSITIVE_WORD_ERROR: 'Blocked by the content filter. Try rewording.',
    CREATE_TASK_FAILED: 'The task could not be created.',
    GENERATE_AUDIO_FAILED: 'Audio generation failed. Try again.',
    CALLBACK_EXCEPTION: 'Something went wrong while finishing up.',
  }[s] || s;
}

function finishJob(job, msg) {
  state.jobs = state.jobs.filter((j) => j !== job);
  toast(msg, 'ok');
  refreshCredits();
  updateLibCount();
}
function failJob(job, msg) {
  job.status = 'FAILED';
  job.error = msg;
  toast(`⚠️ ${job.label}: ${msg}`, 'err');
}

function upsertTracks(job, items) {
  items.forEach((it) => {
    const id = it.id || it.audioId;
    if (!id) return;
    let t = state.tracks.find((x) => x.id === id);
    if (!t) {
      t = { id, taskId: job.taskId, createdAt: Date.now(), extras: {}, source: job.meta?.source || 'song', model: job.meta?.model };
      state.tracks.unshift(t);
    }
    Object.assign(t, {
      title: it.title || t.title || job.label,
      tags: it.tags || t.tags || '',
      lyrics: it.prompt || t.lyrics || '',
      image: it.image_url || it.imageUrl || t.image || '',
      audio: it.audio_url || it.audioUrl || t.audio || '',
      stream: it.stream_audio_url || it.streamAudioUrl || t.stream || '',
      duration: it.duration || t.duration || 0,
      model: it.model_name || t.model,
    });
  });
  saveTracks();
  updateLibCount();
  if (!$('#tab-library').hidden) renderLibrary();
}

// ---------- Library ----------
function updateLibCount() { $('#lib-count').textContent = state.tracks.length; }

function renderLibrary() {
  updateLibCount();
  const q = $('#lib-search').value.trim().toLowerCase();
  const list = state.tracks.filter((t) => !q || `${t.title} ${t.tags} ${t.lyrics}`.toLowerCase().includes(q));
  $('#library-empty').hidden = state.tracks.length > 0;
  $('#library').innerHTML = list.map((t) => {
    const playable = t.audio || t.stream;
    const x = t.extras || {};
    const extras = [
      x.wav && `<a href="${esc(x.wav)}" target="_blank" rel="noopener">WAV</a>`,
      x.video && `<a href="${esc(x.video)}" target="_blank" rel="noopener">Video</a>`,
      x.stems && Object.keys(x.stems).length && `<a href="#" data-open="${esc(t.id)}">${Object.keys(x.stems).length} stems</a>`,
    ].filter(Boolean).join('');
    return `<article class="track">
      <div class="art">
        ${t.image ? `<img src="${esc(t.image)}" alt="" loading="lazy">` : ''}
        <span class="kind">${esc(t.source || 'song')}</span>
        ${t.duration ? `<span class="dur">${fmtTime(t.duration)}</span>` : (!t.audio && t.stream ? '<span class="dur">streaming</span>' : '')}
        ${playable ? `<button class="play-btn" data-play="${esc(t.id)}" aria-label="Play ${esc(t.title)}">${state.current?.id === t.id && !$('#audio').paused ? '❚❚' : '▶'}</button>` : ''}
      </div>
      <div class="body">
        <h3 class="ellipsis" title="${esc(t.title)}">${esc(t.title || 'Untitled')}</h3>
        <div class="tags">${esc(t.tags)}</div>
        ${extras ? `<div class="extras">${extras}</div>` : ''}
        <div class="actions">
          ${t.audio ? `<a class="btn small" href="${esc(t.audio)}" target="_blank" rel="noopener" download>⬇ MP3</a>` : ''}
          <button class="btn small" data-open="${esc(t.id)}">⋯ More</button>
        </div>
      </div>
    </article>`;
  }).join('');
}

function initLibrary() {
  $('#lib-search').addEventListener('input', renderLibrary);
  $('#library').addEventListener('click', (e) => {
    const p = e.target.closest('[data-play]');
    if (p) { togglePlay(state.tracks.find((t) => t.id === p.dataset.play)); return; }
    const o = e.target.closest('[data-open]');
    if (o) { e.preventDefault(); openTrack(o.dataset.open); }
  });
  $('#import-task').addEventListener('click', () => {
    const id = prompt('Paste a music task ID from the Suno API:');
    if (id?.trim()) { addJob({ taskId: id.trim(), kind: 'music', label: 'Imported task', meta: { source: 'import' } }); toast('Importing…'); }
  });
  $('#jobs-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-dismiss]');
    if (!b) return;
    state.jobs.splice(+b.dataset.dismiss, 1);
    saveJobs();
    renderJobs();
  });
  $$('[data-goto]').forEach((b) => b.addEventListener('click', () => goTab(b.dataset.goto)));
}

// ---------- Track actions ----------
function openTrack(id) {
  const t = state.tracks.find((x) => x.id === id);
  if (!t) return;
  const x = t.extras || {};
  const stems = x.stems && Object.keys(x.stems).length ? `
    <div><h3>🎚️ Stems</h3><div class="stem-list">${Object.entries(x.stems).map(([n, u]) =>
      `<div><b class="small">${esc(n)}</b><audio controls preload="none" src="${esc(u)}"></audio><a class="btn small" href="${esc(u)}" target="_blank" rel="noopener">⬇</a></div>`).join('')}</div></div>` : '';
  const video = x.video ? `<div><h3>🎬 Music video</h3><video controls preload="metadata" src="${esc(x.video)}"></video>
    <a class="btn small" href="${esc(x.video)}" target="_blank" rel="noopener">⬇ Download MP4</a></div>` : '';
  const covers = x.covers?.length ? `<div><h3>🖼️ Cover art <span class="muted small">(tap one to use it)</span></h3>
    <div class="covers">${x.covers.map((c) => `<img src="${esc(c)}" alt="Cover option" data-set-cover="${esc(c)}">`).join('')}</div></div>` : '';
  const wav = x.wav ? `<a class="btn small" href="${esc(x.wav)}" target="_blank" rel="noopener">⬇ WAV</a>` : '';

  openModal(`
    <div class="row gap">
      ${t.image ? `<img src="${esc(t.image)}" alt="" width="84" height="84" style="border-radius:14px;object-fit:cover">` : ''}
      <div style="min-width:0">
        <h2 class="ellipsis">${esc(t.title || 'Untitled')}</h2>
        <p class="muted small">${esc(t.tags)}</p>
        <p class="muted small">${t.duration ? fmtTime(t.duration) : ''} ${t.model ? `· ${esc(t.model)}` : ''}</p>
      </div>
    </div>
    <div class="row gap-s wrap">
      ${t.audio || t.stream ? `<button class="btn primary small" data-act="play">▶ Play</button>` : ''}
      ${t.audio ? `<a class="btn small" href="${esc(t.audio)}" target="_blank" rel="noopener">⬇ MP3</a>` : ''}
      ${wav}
    </div>
    <div class="action-grid">
      <button class="action" data-act="extend"><b>➡️ Extend</b><span>Keep the song going</span></button>
      <button class="action" data-act="stems"><b>🎚️ Split stems</b><span>Vocals, drums, bass and more</span></button>
      <button class="action" data-act="karaoke"><b>🎤 Synced lyrics</b><span>Karaoke-style playback</span></button>
      <button class="action" data-act="wav"><b>💿 Get WAV</b><span>Lossless, studio-ready file</span></button>
      <button class="action" data-act="video"><b>🎬 Music video</b><span>MP4 with visualizer</span></button>
      <button class="action" data-act="cover"><b>🖼️ New cover art</b><span>Generate album covers</span></button>
      <button class="action" data-act="persona"><b>🧬 Save as persona</b><span>Reuse this voice and style</span></button>
      <button class="action" data-act="remove"><b>🗑️ Remove</b><span>Delete from your library</span></button>
    </div>
    ${stems}${video}${covers}
    ${t.lyrics ? `<details class="more"><summary>📝 Lyrics</summary><pre style="white-space:pre-wrap;font:inherit;margin:0">${esc(t.lyrics)}</pre></details>` : ''}
    <p class="muted small">Task ID: <code>${esc(t.taskId)}</code></p>`);

  $('#modal-body').onclick = (e) => {
    const c = e.target.closest('[data-set-cover]');
    if (c) { t.image = c.dataset.setCover; saveTracks(); renderLibrary(); toast('Cover updated 🖼️', 'ok'); openTrack(t.id); return; }
    const a = e.target.closest('[data-act]');
    if (a) trackAction(t, a.dataset.act);
  };
}

async function trackAction(t, act) {
  const base = { taskId: t.taskId, audioId: t.id };
  try {
    switch (act) {
      case 'play': closeModal(); togglePlay(t, true); break;
      case 'extend': return extendForm(t);
      case 'stems': return stemsForm(t);
      case 'video': return videoForm(t);
      case 'persona': return personaForm(t);
      case 'karaoke': closeModal(); togglePlay(t, true); openKaraoke(t); break;
      case 'wav': {
        const d = await post('/api/v1/wav/generate', base);
        addJob({ taskId: d.taskId, kind: 'wav', label: `WAV of "${t.title}"`, trackId: t.id });
        closeModal(); toast('Converting to WAV… 💿', 'ok'); break;
      }
      case 'cover': {
        const d = await post('/api/v1/suno/cover/generate', { taskId: t.taskId });
        addJob({ taskId: d.taskId, kind: 'cover', label: `Cover art for "${t.title}"`, trackId: t.id });
        closeModal(); toast('Painting cover art… 🖼️', 'ok'); break;
      }
      case 'remove':
        if (confirm(`Remove "${t.title}" from your library?`)) {
          state.tracks = state.tracks.filter((x) => x !== t);
          saveTracks(); renderLibrary(); closeModal();
        }
        break;
      default: break;
    }
  } catch (err) { toast(err.message, 'err'); }
}

function extendForm(t) {
  const at = t.duration ? Math.max(1, Math.floor(t.duration - 20)) : 60;
  openModal(`
    <h2>➡️ Extend "${esc(t.title)}"</h2>
    <form id="ext-form" class="form">
      <div class="grid-2">
        <div class="field"><label for="x-at">Continue from (seconds)</label><input id="x-at" type="number" min="1" ${t.duration ? `max="${Math.floor(t.duration) - 1}"` : ''} value="${at}"></div>
        <div class="field"><label for="x-model">Model</label><select id="x-model">${modelOptions('V6')}</select></div>
      </div>
      <div class="field"><label for="x-style">Style</label><input id="x-style" maxlength="1000" value="${esc(t.tags)}"></div>
      <div class="field"><label for="x-title">Title</label><input id="x-title" maxlength="100" value="${esc(`${t.title || 'Untitled'} (Extended)`)}"></div>
      <div class="field"><label for="x-lyrics">New lyrics <span class="muted">(optional)</span></label><textarea id="x-lyrics" rows="4" maxlength="5000" placeholder="[Bridge]&#10;…"></textarea></div>
      <label class="switch"><input type="checkbox" id="x-instr"><span></span> Instrumental extension</label>
      <button class="btn primary">➡️ Extend</button>
    </form>`);
  $('#ext-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = { audioId: t.id, taskId: t.taskId, model: $('#x-model').value, instrumental: $('#x-instr').checked };
    const at2 = +$('#x-at').value;
    if (at2 > 0) body.continueAt = at2;
    const st = $('#x-style').value.trim(); if (st) body.style = st;
    const ti = $('#x-title').value.trim(); if (ti) body.title = ti;
    const ly = $('#x-lyrics').value.trim();
    if (ly && !body.instrumental) { body.lyrics = ly; body.prompt = ly; }
    try {
      const d = await post('/api/v1/generate/extend', body);
      addJob({ taskId: d.taskId, kind: 'music', label: ti || `${t.title} (Extended)`, meta: { model: body.model, source: 'extend' } });
      closeModal(); toast('Extending your song… ➡️', 'ok');
    } catch (err) { toast(err.message, 'err'); }
  });
}

function stemsForm(t) {
  openModal(`
    <h2>🎚️ Split "${esc(t.title)}" into stems</h2>
    <form id="stem-form" class="form">
      <label class="check"><input type="radio" name="stype" value="separate_vocal" checked> <span><b>Vocals + instrumental</b><br><span class="muted small">Two clean tracks, perfect for karaoke or remixing.</span></span></label>
      <label class="check"><input type="radio" name="stype" value="split_stem"> <span><b>Full stem split</b><br><span class="muted small">Up to 12 tracks: drums, bass, guitar, keys, strings and more. Uses more credits.</span></span></label>
      <button class="btn primary">🎚️ Split it</button>
    </form>`);
  $('#stem-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = $('input[name="stype"]:checked').value;
    try {
      const d = await post('/api/v1/vocal-removal/generate', { taskId: t.taskId, audioId: t.id, type });
      addJob({ taskId: d.taskId, kind: 'stems', label: `Stems of "${t.title}"`, trackId: t.id });
      closeModal(); toast('Separating stems… 🎚️', 'ok');
    } catch (err) { toast(err.message, 'err'); }
  });
}

function videoForm(t) {
  openModal(`
    <h2>🎬 Music video for "${esc(t.title)}"</h2>
    <form id="vid-form" class="form">
      <div class="field"><label for="v-author">Artist name shown in the video</label><input id="v-author" maxlength="50" placeholder="Your artist name"></div>
      <div class="field"><label for="v-domain">Website or handle <span class="muted">(optional)</span></label><input id="v-domain" maxlength="50" placeholder="@yourhandle"></div>
      <button class="btn primary">🎬 Make video</button>
    </form>`);
  $('#vid-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = { taskId: t.taskId, audioId: t.id };
    const a = $('#v-author').value.trim(); if (a) body.author = a;
    const dn = $('#v-domain').value.trim(); if (dn) body.domainName = dn;
    try {
      const d = await post('/api/v1/mp4/generate', body);
      addJob({ taskId: d.taskId, kind: 'video', label: `Video for "${t.title}"`, trackId: t.id });
      closeModal(); toast('Rendering your music video… 🎬', 'ok');
    } catch (err) { toast(err.message, 'err'); }
  });
}

function personaForm(t) {
  openModal(`
    <h2>🧬 Save "${esc(t.title)}" as a persona</h2>
    <p class="muted">A persona captures this track's voice and vibe so you can reuse it in Custom mode.</p>
    <form id="per-form" class="form">
      <div class="field"><label for="pe-name">Persona name</label><input id="pe-name" required maxlength="60" placeholder="Midnight Crooner"></div>
      <div class="field"><label for="pe-desc">Describe the sound</label><textarea id="pe-desc" rows="3" required placeholder="Smoky baritone, soulful, retro R&B">${esc(t.tags)}</textarea></div>
      <div class="grid-2">
        <div class="field"><label for="pe-start">Analyze from (s)</label><input id="pe-start" type="number" min="0" value="0"></div>
        <div class="field"><label for="pe-end">to (s)</label><input id="pe-end" type="number" min="1" value="30"></div>
      </div>
      <button class="btn primary">🧬 Create persona</button>
    </form>`);
  $('#per-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const start = +$('#pe-start').value;
    const end = +$('#pe-end').value;
    if (end <= start) { toast('The end time must be after the start time.', 'err'); return; }
    try {
      const d = await api('/api/v1/generate/generate-persona', {
        method: 'POST',
        body: { taskId: t.taskId, audioId: t.id, name: $('#pe-name').value.trim(), description: $('#pe-desc').value.trim(), vocalStart: start, vocalEnd: end, style: t.tags?.slice(0, 200) || undefined },
      });
      if (!d?.personaId) throw new Error('No persona ID came back.');
      state.personas.unshift({ id: d.personaId, name: d.name || $('#pe-name').value.trim() });
      store.set('hm-personas', state.personas);
      renderPersonas();
      closeModal();
      toast('Persona saved! Find it under Custom → Advanced. 🧬', 'ok');
    } catch (err) { toast(err.message, 'err'); }
  });
}

// ---------- Karaoke ----------
async function openKaraoke(t) {
  openModal(`<h2>🎤 ${esc(t.title)}</h2><div id="karaoke" class="karaoke"><span class="eq"><i></i><i></i><i></i><i></i></span> Loading synced lyrics…</div>`);
  try {
    const d = await api('/api/v1/generate/get-timestamped-lyrics', { method: 'POST', body: { taskId: t.taskId, audioId: t.id } });
    const words = d?.alignedWords || [];
    if (!words.length) { $('#karaoke').textContent = 'No synced lyrics for this track (instrumentals have none).'; return; }
    $('#karaoke').innerHTML = words.map((w) => {
      const txt = String(w.word || '').replace(/\[[^\]]*\]/g, '');
      const html = esc(txt).replace(/\n+/g, '<br>');
      return html.trim() ? `<span data-s="${w.startS}" data-e="${w.endS}">${html} </span>` : html;
    }).join('');
    syncKaraoke();
  } catch (err) {
    if ($('#karaoke')) $('#karaoke').textContent = err.message;
  }
}
let lastKaraokeWord = null;
function syncKaraoke() {
  const box = $('#karaoke');
  if (!box || !$('#modal').open) return;
  const now = $('#audio').currentTime;
  let active = null;
  $$('span[data-s]', box).forEach((s) => {
    const st = +s.dataset.s; const en = +s.dataset.e;
    s.classList.toggle('sung', en <= now);
    const on = st <= now && now < en;
    s.classList.toggle('now', on);
    if (on) active = s;
  });
  if (active && active !== lastKaraokeWord) active.scrollIntoView({ block: 'center', behavior: 'smooth' });
  lastKaraokeWord = active || lastKaraokeWord;
}

// ---------- Player ----------
function togglePlay(t, forcePlay = false) {
  if (!t) return;
  const audio = $('#audio');
  const src = t.audio || t.stream;
  if (!src) { toast('This track is not playable yet.'); return; }
  if (state.current?.id === t.id && audio.src === src && !forcePlay) {
    if (audio.paused) audio.play(); else audio.pause();
    return;
  }
  state.current = t;
  if (audio.src !== src) audio.src = src;
  $('#player').hidden = false;
  $('#p-title').textContent = t.title || 'Untitled';
  $('#p-tags').textContent = t.tags || '';
  const img = $('#p-img');
  if (t.image) img.src = t.image; else img.removeAttribute('src');
  img.style.visibility = t.image ? 'visible' : 'hidden';
  audio.play().catch(() => toast('Tap play to start listening.'));
}

function initPlayer() {
  const audio = $('#audio');
  const seek = $('#p-seek');
  const setIcons = () => {
    $('#p-play').textContent = audio.paused ? '▶' : '❚❚';
    $('#p-play').setAttribute('aria-label', audio.paused ? 'Play' : 'Pause');
    $$('[data-play]').forEach((b) => { b.textContent = state.current?.id === b.dataset.play && !audio.paused ? '❚❚' : '▶'; });
  };
  audio.addEventListener('play', setIcons);
  audio.addEventListener('pause', setIcons);
  audio.addEventListener('ended', setIcons);
  audio.addEventListener('error', () => toast('That audio could not be loaded. Links expire after about 14 days.', 'err'));
  audio.addEventListener('timeupdate', () => {
    $('#p-cur').textContent = fmtTime(audio.currentTime);
    if (isFinite(audio.duration)) {
      $('#p-dur').textContent = fmtTime(audio.duration);
      seek.value = (audio.currentTime / audio.duration) * 100;
    }
    syncKaraoke();
  });
  seek.addEventListener('input', () => { if (isFinite(audio.duration)) audio.currentTime = (seek.value / 100) * audio.duration; });
  $('#p-play').addEventListener('click', () => { if (audio.paused) audio.play(); else audio.pause(); });
  $('#p-karaoke').addEventListener('click', () => { if (state.current) openKaraoke(state.current); });
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !$('#player').hidden && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName)) {
      e.preventDefault();
      if (audio.paused) audio.play(); else audio.pause();
    }
  });
}

// ---------- Modal ----------
function openModal(html) {
  $('#modal-body').innerHTML = html;
  $('#modal-body').onclick = null;
  const m = $('#modal');
  if (!m.open) m.showModal();
}
function closeModal() { $('#modal').close(); }

// ---------- Init ----------
function init() {
  applyTheme(savedTheme());
  $$('[data-theme-choice]').forEach((b) => b.addEventListener('click', () => applyTheme(b.dataset.themeChoice)));
  $$('[data-tab]').forEach((b) => b.addEventListener('click', () => goTab(b.dataset.tab)));
  $('#credits').addEventListener('click', refreshCredits);
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

  initGate();
  initCreate();
  initLyrics();
  initRemix();
  initSounds();
  initLibrary();
  initPlayer();
  bindCounters();
  syncChips();

  if (state.key) showApp(); else showGate();
}

init();
