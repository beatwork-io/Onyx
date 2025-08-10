#!/usr/bin/env python3
import sys, json
import numpy as np

# Light-weight fallback using librosa only (easier to install). If Essentia is available, you can swap it.
try:
    import librosa
except Exception as e:
    print(json.dumps({"error": f"librosa missing: {e}"}))
    sys.exit(1)

path = sys.argv[1]
y, sr = librosa.load(path, sr=None, mono=True)

def estimate_bpm(y, sr):
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
    # Normalize double/half time to common trap ranges
    bpm = float(tempo)
    if bpm < 70: bpm *= 2
    if bpm > 180: bpm /= 2
    conf = min(1.0, len(beats)/ (len(y)/sr/0.5 + 1e-6)) # crude confidence proxy
    return bpm, conf

# Key detection (very simplified): chroma + mode guess
def estimate_key(y, sr):
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    chroma_mean = chroma.mean(axis=1)
    pitch_classes = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
    key_index = int(np.argmax(chroma_mean))
    # mode (major/minor) heuristic using harmonic-percussive separation
    y_harm, _ = librosa.effects.hpss(y)
    chroma_h = librosa.feature.chroma_cqt(y=y_harm, sr=sr)
    maj_profile = np.array([6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88])
    min_profile = np.array([6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17])
    rot = np.roll
    major_score = (rot(maj_profile, key_index) * chroma_h.mean(axis=1)).sum()
    minor_score = (rot(min_profile, key_index) * chroma_h.mean(axis=1)).sum()
    mode = 'm' if minor_score > major_score else 'M'
    conf = float(abs(minor_score - major_score) / (major_score + minor_score + 1e-6))
    return f"{pitch_classes[key_index]}{mode}", conf

# 808 root fallback: find strongest sub-bass bin (30-120Hz)
def estimate_808_root(y, sr):
    S = np.abs(librosa.stft(y, n_fft=4096))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=4096)
    mask = (freqs>=30) & (freqs<=120)
    band = S[mask, :].mean(axis=1)
    f = freqs[mask][int(np.argmax(band))]
    # map frequency to nearest pitch class
    A4 = 440.0
    n = int(round(12*np.log2(f/A4)))
    pitch_classes = ['A','A#','B','C','C#','D','D#','E','F','F#','G','G#']
    pc = pitch_classes[(n % 12)]
    return pc + 'm', 0.5

bpm, cbpm = estimate_bpm(y, sr)
key_tonal, ckey = estimate_key(y, sr)
key_808, c808 = estimate_808_root(y, sr)

# choose strategy
strategy = 'tonal'
key = key_tonal
conf = ckey
if ckey < 0.25:
    key = key_808
    conf = c808
    strategy = '808'

print(json.dumps({
    "bpm": float(bpm),
    "key": key,
    "confidence_bpm": float(cbpm),
    "confidence_key": float(conf),
    "strategy": strategy
}))
