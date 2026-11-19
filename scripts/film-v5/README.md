# KYVERA V5 Film Production

Produces the 120-second product film, the 15-second silent homepage preview, the poster and the WebVTT captions.

## Prerequisites

- Node 20 and Playwright with Chrome
- Python 3.11
- `edge-tts` 7.3.1
- FFmpeg (or set `FFMPEG=/path/to/ffmpeg`)

## Steps

```bash
# 1. Capture the live or local v5 app at 1920×1080
BASE=https://kyvera-alpha.vercel.app node scripts/film-v5/capture.mjs

# 2. Render title cards
node scripts/film-v5/cards.mjs

# 3. Generate per-sentence narration and the audio manifest
python3 scripts/film-v5/narrate.py

# 4. Assemble the film, preview, poster and captions
python3 scripts/film-v5/build.py
```

Intermediate clips and audio live in `.context/film-v5` and are not committed.

## Output

- `apps/web/public/demo/kyvera-v5-product-film.mp4`
- `apps/web/public/demo/kyvera-v5-product-film.vtt`
- `apps/web/public/demo/kyvera-v5-preview.mp4`
- `apps/web/public/demo/kyvera-v5-poster.webp`

## Accuracy rules

- Real application screens at the recorded commit.
- No fabricated wallet approval or transaction.
- Deterministic fixtures are labelled in the UI.
- Public relay claims are limited to the executed two-relay lifecycle evidence.
- The v5 film supersedes the previous films; old files remain for URL compatibility.
