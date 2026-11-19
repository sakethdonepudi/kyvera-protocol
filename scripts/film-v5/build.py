import json, subprocess, re
from pathlib import Path

import os
ROOT = Path(os.environ.get('KYVERA_FILM_WORK', '.context/film-v5'))
SCREENS = ROOT / 'screens'
CARDS = ROOT / 'cards'
CLIPS = ROOT / 'clips'
CLIPS.mkdir(parents=True, exist_ok=True)
OUT = Path('apps/web/public/demo')
OUT.mkdir(parents=True, exist_ok=True)
FF = os.environ.get('FFMPEG', 'ffmpeg')
FPS = 30
O = 0.7

# target durations (sum = 120.0) mapped to real application screens / title cards
items = [
    ('opening', CARDS/'opening.png', 8.0),
    ('homepage-hero', SCREENS/'homepage-hero.png', 10.6),
    ('create-default', SCREENS/'create-default.png', 6.0),
    ('create-proof', SCREENS/'create-proof.png', 6.0),
    ('create-verified', SCREENS/'create-verified.png', 6.32),
    ('binding-card', CARDS/'binding.png', 6.0),
    ('verify-public-revoked', SCREENS/'verify-public-revoked.png', 9.0),
    ('discovery-card', CARDS/'discovery.png', 7.0),
    ('verify-time-machine', SCREENS/'verify-time-machine.png', 3.1),
    ('lifecycle-bind', SCREENS/'homepage-lifecycle-bind.png', 4.5),
    ('lifecycle-rotate', SCREENS/'homepage-lifecycle-rotate.png', 4.5),
    ('lifecycle-revoke', SCREENS/'homepage-lifecycle-revoke.png', 4.2),
    ('lifecycle-card', CARDS/'lifecycle.png', 5.5),
    ('challenge-authenticate', SCREENS/'challenge-authenticate.png', 6.8),
    ('challenge-prove', SCREENS/'challenge-prove.png', 4.0),
    ('auth-rejection', SCREENS/'auth-demo-rejection.png', 4.0),
    ('developers-sdk', SCREENS/'developers-sdk.png', 6.5),
    ('rp-terminal', CARDS/'rp-terminal.png', 7.5),
    ('closing', CARDS/'closing.png', 10.48),
]

def run(args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def make_clip(name, image, duration, idx):
    raw = duration + (O if idx < len(items)-1 else 0)
    frames = max(1, int(raw * FPS))
    # Alternate a very slow push-in and pull-out for quiet motion.
    if idx % 2 == 0:
        z = f"1+0.035*on/{frames}"
    else:
        z = f"1.035-0.035*on/{frames}"
    vf = (
        "scale=2400:1350,"
        f"zoompan=z='{z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps={FPS},"
        "format=yuv420p"
    )
    out = CLIPS / f"{idx:02d}-{name}.mp4"
    run([FF, '-y', '-loop', '1', '-i', str(image), '-t', f'{raw:.3f}', '-vf', vf,
         '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
         '-r', str(FPS), str(out)])
    return out

clips = [make_clip(name, image, duration, i) for i, (name, image, duration) in enumerate(items)]

# Build the xfade chain. Offsets are cumulative target durations.
inputs = []
for clip in clips:
    inputs += ['-i', str(clip)]
parts = []
prev = '[0:v]'
cum = 0.0
for i in range(1, len(items)):
    cum += items[i-1][2]
    label = f'[v{i}]'
    parts.append(f'{prev}[{i}:v]xfade=transition=fade:duration={O}:offset={cum:.3f}{label}')
    prev = label
last = f'{prev}fade=t=in:st=0:d=0.7,fade=t=out:st=119.2:d=0.8,format=yuv420p[vout]'
parts.append(last)
filtergraph = ';'.join(parts)

film_tmp = ROOT / 'film-video.mp4'
run([FF, '-y', *inputs, '-i', str(ROOT/'audio'/'narration.wav'),
     '-filter_complex', filtergraph,
     '-map', '[vout]', '-map', f'{len(clips)}:a',
     '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
     '-r', str(FPS), '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
     '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11,volume=2.5dB,apad=whole_dur=120', '-t', '120', '-movflags', '+faststart', str(film_tmp)])

# Captions from the per-sentence narration manifest.
manifest = json.loads((ROOT/'audio-manifest.json').read_text())
def ts(seconds):
    ms = int(round(seconds * 1000))
    h = ms // 3600000; ms %= 3600000
    m = ms // 60000; ms %= 60000
    s = ms // 1000; ms %= 1000
    return f'{h:02d}:{m:02d}:{s:02d}.{ms:03d}'
cues = []
for section in manifest['sections']:
    for sentence in section['sentences']:
        start = section['start'] + sentence['start']
        end = start + sentence['duration']
        cues.append((start, end, sentence['text']))
vtt = ['WEBVTT', '']
for n, (start, end, text) in enumerate(cues, 1):
    vtt += [str(n), f'{ts(start)} --> {ts(end)}', text, '']
(OUT/'kyvera-v5-product-film.vtt').write_text('\n'.join(vtt))

run([FF, '-y', '-i', str(film_tmp), '-c', 'copy', '-movflags', '+faststart', str(OUT/'kyvera-v5-product-film.mp4')])

# Silent 15s homepage preview: hero -> create verified -> challenge -> lifecycle -> hero.
preview_items = [
    ('homepage-hero', SCREENS/'homepage-hero.png', 3.4),
    ('create-verified', SCREENS/'create-verified.png', 3.0),
    ('challenge-authenticate', SCREENS/'challenge-authenticate.png', 3.0),
    ('lifecycle-rotate', SCREENS/'homepage-lifecycle-rotate.png', 2.8),
    ('homepage-hero-end', SCREENS/'homepage-hero.png', 2.8),
]
prev_clips = [make_clip(name, image, duration, i) for i, (name, image, duration) in enumerate(preview_items)]
prev_inputs = []
for clip in prev_clips:
    prev_inputs += ['-i', str(clip)]
parts = []
prev = '[0:v]'
cum = 0.0
for i in range(1, len(preview_items)):
    cum += preview_items[i-1][2]
    label = f'[p{i}]'
    parts.append(f'{prev}[{i}:v]xfade=transition=fade:duration=0.5:offset={cum:.3f}{label}')
    prev = label
parts.append(f'{prev}fade=t=in:st=0:d=0.35,fade=t=out:st=14.55:d=0.45,scale=1280:720,format=yuv420p[vout]')
run([FF, '-y', *prev_inputs, '-filter_complex', ';'.join(parts), '-map', '[vout]',
     '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p',
     '-r', str(FPS), '-t', '15', '-crf', '26', '-movflags', '+faststart', str(OUT/'kyvera-v5-preview.mp4')])

# Poster from the approved opening card.
run([FF, '-y', '-i', str(CARDS/'opening.png'), '-c:v', 'libwebp', '-quality', '88', '-frames:v', '1', str(OUT/'kyvera-v5-poster.webp')])

print('wrote film, preview, poster, captions')
