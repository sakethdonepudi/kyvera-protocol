import json, re, subprocess, wave
from pathlib import Path

import os
ROOT = Path(os.environ.get('KYVERA_FILM_WORK', '.context/film-v5'))
SCRIPT_DIR = Path(__file__).resolve().parent
AUDIO = ROOT / 'audio'
RAW = AUDIO / 'raw'
RAW.mkdir(parents=True, exist_ok=True)
FF = os.environ.get('FFMPEG', 'ffmpeg')

def run(args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def wav_duration(path):
    with wave.open(str(path), 'rb') as w:
        return w.getnframes() / w.getframerate()

def make_silence(path, seconds):
    run([FF, '-y', '-f', 'lavfi', '-i', f'anullsrc=r=48000:cl=mono', '-t', str(seconds), '-c:a', 'pcm_s16le', str(path)])

def concat_wavs(paths, out):
    with wave.open(str(out), 'wb') as o:
        o.setnchannels(1); o.setsampwidth(2); o.setframerate(48000)
        for p in paths:
            with wave.open(str(p), 'rb') as i:
                o.writeframes(i.readframes(i.getnframes()))

def to_wav(mp3, wav):
    run([FF, '-y', '-i', str(mp3), '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', str(wav)])

data = json.loads((SCRIPT_DIR / 'narration.json').read_text())
sil_sentence = AUDIO / 'sil-0.22.wav'
sil_section = AUDIO / 'sil-1.0.wav'
make_silence(sil_sentence, 0.22)
make_silence(sil_section, 1.0)

manifest = {'sections': []}
full_paths = []
section_start = 0.0

for section in data['sections']:
    sid = section['id']
    sentences = [s.strip() for s in re.split(r'(?<=[.?!])\s+', section['text']) if s.strip()]
    pieces = []
    sentence_meta = []
    cursor = 0.0
    for i, text in enumerate(sentences):
        mp3 = RAW / f'{sid}-{i}.mp3'
        wav = RAW / f'{sid}-{i}.wav'
        run(['edge-tts', '--voice', 'en-US-BrianNeural', '--text', text, '--write-media', str(mp3)])
        to_wav(mp3, wav)
        d = wav_duration(wav)
        sentence_meta.append({'text': text, 'start': cursor, 'duration': d})
        pieces.append(wav)
        cursor += d
        if i < len(sentences) - 1:
            pieces.append(sil_sentence)
            cursor += 0.22
    section_wav = AUDIO / f'{sid}.wav'
    concat_wavs(pieces, section_wav)
    d = wav_duration(section_wav)
    manifest['sections'].append({
        'id': sid,
        'start': section_start,
        'duration': d,
        'sentences': sentence_meta,
    })
    full_paths.append(section_wav)
    section_start += d
    if sid != data['sections'][-1]['id']:
        full_paths.append(sil_section)
        section_start += 1.0

narration = AUDIO / 'narration.wav'
concat_wavs(full_paths, narration)
manifest['duration'] = wav_duration(narration)
(ROOT / 'audio-manifest.json').write_text(json.dumps(manifest, indent=2))
print(json.dumps(manifest, indent=2))
