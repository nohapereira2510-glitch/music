# Hitmaker Studio 🎧

**Author:** Noha Pereira · Florida Atlantic University, ISM 6427C

A one-page AI music studio built on the [Suno API](https://docs.sunoapi.org/). Users unlock it with **their own Suno API key**, then create songs, write lyrics, remix their own audio, generate sound effects and turn tracks into stems, WAVs and music videos.

## Features

| Area | What you can do | Suno API endpoint |
|---|---|---|
| 🔑 Key gate | Enter and verify an API key (optionally remembered on the device); live credit balance | `GET /api/v1/generate/credit` |
| 🎵 Create: Simple | Describe a song, optional style, instrumental toggle, 🎲 Surprise me, inspire it with a photo or audio clip | `POST /api/v1/generate` (`customMode: false`) |
| 🎚️ Create: Custom | Title, style with genre/mood chips, lyrics with section-tag buttons, vocal gender, avoid-styles, length, style weight, weirdness, audio weight, variety, personas | `POST /api/v1/generate` (`customMode: true`) |
| 🚀 Boost style | Expand a few words into a rich style prompt | `POST /api/v1/style/generate` |
| 🤖 Models | V6 (recommended), V6 Wild, V6 Mini, plus legacy V5.5 to V4 | `model` parameter |
| ✍️ Lyrics | Generate lyric drafts, then send them straight into a song | `POST /api/v1/lyrics` |
| 🎛️ Remix | Upload audio (or paste a link) to Cover it, Extend it, Add vocals, Add backing music, or Mash up two tracks | `upload-cover`, `upload-extend`, `add-vocals`, `add-instrumental`, `mashup`, File Upload API |
| 🔊 Sounds | Loops and sound effects with BPM, key and loop controls | `POST /api/v1/generate/sounds` |
| 📚 Library | Play (streams the first take early), download MP3, search | `GET /api/v1/generate/record-info` |
| ➡️ Extend | Continue any track from a chosen second | `POST /api/v1/generate/extend` |
| 🎚️ Stems | Vocals + instrumental, or a full stem split | `POST /api/v1/vocal-removal/generate` |
| 💿 WAV | Lossless download | `POST /api/v1/wav/generate` |
| 🎬 Music video | MP4 with visualizer and artist name | `POST /api/v1/mp4/generate` |
| 🖼️ Cover art | Generate album covers and pick one | `POST /api/v1/suno/cover/generate` |
| 🎤 Synced lyrics | Karaoke view that follows the audio | `POST /api/v1/generate/get-timestamped-lyrics` |
| 🧬 Personas | Save a track's voice/style and reuse it | `POST /api/v1/generate/generate-persona` |

Also: light, dark and system themes; responsive for phones, tablets and desktops; a live "in the studio" tracker with progress steps; toasts; and a sticky player (space bar plays/pauses). Jobs and the library are saved in the browser, so a reload picks up where you left off.

## How it works

- Plain HTML, CSS and JavaScript. No build step, no dependencies.
- Every Suno task is asynchronous: the app submits it, gets a `taskId`, and polls the matching `record-info` endpoint every few seconds.
- On Netlify, API calls go through same-origin proxy rules in `netlify.toml` (`/suno/*` and `/suno-upload/*`), which avoids browser CORS problems. The user's key is sent in the `Authorization` header and is never stored on a server.
- The API requires a `callBackUrl`, so `netlify/functions/suno-callback.mjs` simply acknowledges callbacks. Results come from polling.

## Deploy to Netlify

1. In Netlify choose **Add new site → Import an existing project** and pick this repo.
2. Branch: `main`. Leave the build command empty. Publish directory `.` and functions directory `netlify/functions` are already set in `netlify.toml`.
3. Deploy, open the site and paste your Suno API key (get one at https://sunoapi.org/api-key).

## Run locally

```bash
npx netlify-cli dev      # recommended: runs the proxy rules and the callback function
# or, without the proxy (calls the API directly, which may hit CORS limits):
python3 -m http.server 8000
```

## Notes

- Generated files are kept by Suno for about 14 days, and uploads for 3 days. Download what you want to keep.
- Each song request produces 2 versions and uses credits from the user's Suno API account.

## Files

- `index.html`: page structure (key gate, studio tabs, player, modal)
- `styles.css`: theme tokens, layout and responsive rules
- `app.js`: API client, polling, forms, library, player and karaoke
- `netlify.toml`: Netlify settings and API proxy rules
- `netlify/functions/suno-callback.mjs`: callback acknowledger
