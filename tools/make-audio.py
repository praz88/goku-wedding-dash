#!/usr/bin/env python3
"""Bakes the game's soundscape into assets/sfx/*.mp3.

Sources (CC0, see assets/sfx/CREDITS.md): BigSoundBank field recordings by Joseph Sardin
(rain, storm wind, thunder) and OpenGameArt creak recordings, as collected by the NoiseSmith
project. Everything else is synthesized here. Requires numpy, scipy, ffmpeg (libmp3lame).
"""
import os, subprocess, numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'tools', 'audio-src')
OUT = os.path.join(ROOT, 'assets', 'sfx')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)

# ---------------------------------------------------------------- helpers
def load(name):
    p = os.path.join('/tmp', 'src_' + name + '.wav')
    if not os.path.exists(p):
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', os.path.join(SRC, name + ('.ogg' if name.startswith(('rain', 'wind', 'thunder')) else '.wav')), '-ac', '1', '-ar', str(SR), p], check=True)
    sr, d = wavfile.read(p)
    d = d.astype(np.float32) / 32768.0
    return d

def sec(n): return int(n * SR)
def t(n): return np.arange(sec(n)) / SR
def norm(x, peak=0.9):
    m = np.max(np.abs(x)) + 1e-9
    return x * (peak / m)
def fade(x, fin=0.01, fout=0.05):
    x = x.copy(); a, b = sec(fin), sec(fout)
    if a: x[:a] *= np.linspace(0, 1, a)
    if b: x[-b:] *= np.linspace(1, 0, b)
    return x
def butter(x, fc, kind='low', order=2):
    sos = signal.butter(order, fc / (SR / 2), kind, output='sos')
    return signal.sosfilt(sos, x)
def bandpass(x, lo, hi, order=2):
    sos = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], 'band', output='sos')
    return signal.sosfilt(sos, x)
def resample(x, factor):  # factor>1 = higher pitch / shorter
    n = int(len(x) / factor)
    return signal.resample(x, n).astype(np.float32)
def ir(seconds=2.5, decay=3.0, lp=3500):
    n = sec(seconds); k = rng.standard_normal(n).astype(np.float32)
    env = np.exp(-np.linspace(0, decay * 3, n)); k *= env
    k[:sec(0.01)] *= np.linspace(0, 1, sec(0.01))
    return butter(k, lp)
IR_HALL = ir(2.8, 2.6, 3000); IR_HALL /= np.sqrt(np.sum(IR_HALL ** 2))
IR_SMALL = ir(0.9, 4.0, 5000); IR_SMALL /= np.sqrt(np.sum(IR_SMALL ** 2))
def reverb(x, wet=0.35, imp=None):
    imp = IR_HALL if imp is None else imp
    y = signal.fftconvolve(x, imp)[:len(x) + len(imp)]
    out = np.zeros(len(y), np.float32); out[:len(x)] += x; out += y * wet
    return out
def loopify(x, seconds, xfade=1.5):
    n, xf = sec(seconds), sec(xfade)
    x = x[:n + xf]
    head, tail = x[:xf].copy(), x[n:n + xf]
    body = x[:n].copy()
    ramp = np.linspace(0, 1, xf)
    body[:xf] = head * ramp + tail * (1 - ramp)
    return body
def save(name, x, kbps=96):
    x = np.clip(x, -1, 1).astype(np.float32)
    tmp = os.path.join('/tmp', 'out_' + name + '.wav')
    wavfile.write(tmp, SR, (x * 32767).astype(np.int16))
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', tmp, '-codec:a', 'libmp3lame', '-b:a', f'{kbps}k', '-ac', '1', os.path.join(OUT, name + '.mp3')], check=True)
    print(f'{name}.mp3  {len(x)/SR:5.1f}s')
def saw(f, dur, detune=0.0):
    tt = t(dur); ph = (tt * (f * (1 + detune))) % 1.0
    return (2 * ph - 1).astype(np.float32)
def sine(f, dur, phase=0.0):
    return np.sin(2 * np.pi * f * t(dur) + phase).astype(np.float32)
def noise(dur): return rng.standard_normal(sec(dur)).astype(np.float32)
def adsr(dur, a, d, s, r):
    n = sec(dur); e = np.ones(n, np.float32)
    a_, d_, r_ = sec(a), sec(d), sec(r)
    e[:a_] = np.linspace(0, 1, a_)
    e[a_:a_ + d_] = np.linspace(1, s, d_)
    e[a_ + d_:n - r_] = s
    e[n - r_:] = np.linspace(s, 0, r_)
    return e
def mix(*parts):
    n = max(len(p) for p in parts); out = np.zeros(n, np.float32)
    for p in parts: out[:len(p)] += p
    return out
def place(canvas, x, at):
    i = sec(at); canvas[i:i + len(x)] += x[:len(canvas) - i]; return canvas

# ---------------------------------------------------------------- recordings
rain = load('rain_heavy_terrace'); wind_ch = load('wind_whistle_chimney'); wind_in = load('wind_strong_inside')
th = {k: load('thunder_' + k) for k in ['3113', '3179', '2718', '3181']}
hinge = load('hinge_spooky'); door_open = load('door_creak_open'); floor = [load('floor_creak_%d' % i) for i in (1, 2, 3)]

# rain heard through the exit glass
save('rain_loop', norm(loopify(butter(rain, 5500), 22, 2.0), 0.6), 80)
# wind: chimney whistle pitched down into a moan + storm from inside
w = mix(resample(wind_ch, 0.78)[:sec(26)] * 0.9, wind_in[:sec(26)] * 0.5)
lfo = 0.7 + 0.3 * np.sin(2 * np.pi * 0.07 * t(26) + 1.0)
save('wind_loop', norm(loopify(butter(w, 2800) * lfo[:len(w)], 24, 2.0), 0.55), 80)
# thunder, through walls
save('thunder_1', norm(fade(butter(th['3113'], 3800), 0.01, 0.4), 0.9))
save('thunder_2', norm(fade(butter(th['3179'][:sec(7.5)], 3800), 0.01, 0.8), 0.9))
save('thunder_3', norm(fade(butter(th['2718'][:sec(8)], 3800), 0.01, 0.8), 0.9))
# creaks
save('creak_door', norm(reverb(fade(butter(hinge[:sec(3.2)], 5000), 0.01, 0.3), 0.3)[:sec(4.2)], 0.8))
vault = mix(resample(door_open, 0.55), place(np.zeros(sec(3.0), np.float32), norm(mix(*[sine(f, 1.6) * np.exp(-np.linspace(0, 6, sec(1.6))) for f in (180, 497, 972, 1607)]) * 0.5, 0.7), 1.9))
save('creak_vault', norm(reverb(fade(butter(vault, 4000), 0.01, 0.4), 0.4)[:sec(4.5)], 0.85))
for i, f in enumerate(floor):
    save('creak_floor_%d' % (i + 1), norm(reverb(fade(resample(f, 0.8), 0.01, 0.2), 0.3, IR_SMALL)[:sec(2.6)], 0.7))
# footsteps on tile (synth): click + thump, 4 variants
for i in range(4):
    dur = 0.22; n = noise(dur) * np.exp(-np.linspace(0, 40, sec(dur)))
    click = bandpass(n, 900 + 300 * i, 3500 + 300 * i) * 0.8
    thump = sine(75 + 10 * i, dur) * np.exp(-np.linspace(0, 30, sec(dur))) * 0.9
    save('step_%d' % (i + 1), norm(reverb(fade(click + thump, 0.002, 0.05), 0.5, IR_SMALL)[:sec(0.6)], 0.8))
# heartbeat
hb = np.zeros(sec(0.7), np.float32)
for at, f, a in ((0.0, 58, 1.0), (0.18, 52, 0.8)):
    hb = place(hb, (sine(f, 0.16) * np.exp(-np.linspace(0, 12, sec(0.16)))) * a, at)
save('heartbeat', norm(fade(butter(hb, 300), 0.001, 0.05), 0.9))

# ---------------------------------------------------------------- designed sounds
# dark drone bed
D = 48; tt = t(D)
drone = mix(*[saw(36.7, D, d) for d in (-0.004, 0.0, 0.004)]) * 0.33 + saw(73.4, D, 0.002) * 0.15 + sine(30, D) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.1 * tt))
cut = 120 + 90 * np.sin(2 * np.pi * 0.023 * tt)
# time-varying lowpass: process in blocks
blk = sec(0.25); out = np.zeros_like(drone)
for i in range(0, len(drone), blk):
    out[i:i + blk] = butter(drone[max(0, i - blk):i + blk], float(cut[min(i, len(cut) - 1)]))[-(min(blk, len(drone) - i)):]
tinn = sine(6100, D) * 0.004 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.31 * tt) ** 8)
dr = out * 0.9 + tinn
# distant metallic events
for at in (9.0, 23.5, 37.0):
    hit = mix(*[sine(f, 2.2) * np.exp(-np.linspace(0, 5, sec(2.2))) for f in (140, 386, 755, 1250)]) * 0.12
    dr = place(dr, reverb(hit, 0.8), at)
save('drone_loop', norm(loopify(dr, 44, 3.0), 0.5), 80)

# music bed: detuned pads, a wrong music box, a far piano thud
M = 64; tm = t(M); music = np.zeros(sec(M), np.float32)
def pad(freq, start, dur, amp):
    e = adsr(dur, 3.0, 1.0, 0.8, 4.0)
    tone = mix(*[sine(freq * (1 + d), dur) for d in (-0.003, 0, 0.003)]) * 0.33 + saw(freq, dur) * 0.08
    return butter(tone * e * amp, 900)
chords = [((73.4, 110.0, 146.8, 155.6, 174.6), 0), ((58.3, 87.3, 116.5, 174.6, 185.0), 16), ((49.0, 98.0, 146.8, 155.6, 233.1), 32), ((55.0, 82.4, 110.0, 116.5, 164.8), 48)]
for notes, start in chords:
    for i, f in enumerate(notes):
        music = place(music, pad(f, start, 18, 0.11 if i else 0.16), start)
scale = [587.3, 659.3, 698.5, 784.0, 880.0, 932.3, 1108.7, 1174.7]  # D harmonic minor, music-box register
phrase = [0, 2, 1, 0, 4, 3, 1, 0, 5, 4, 3, 2]
for base in (8.0, 40.0):
    tcur = base
    for k, idx in enumerate(phrase):
        f = scale[idx] * (1 - 0.006)  # the box is a little flat
        dur = 1.4; e = np.exp(-np.linspace(0, 7, sec(dur)))
        note = (sine(f, dur) + 0.35 * sine(f * 2, dur) + 0.12 * sine(f * 4.1, dur)) * e * 0.09
        music = place(music, reverb(note, 0.9), tcur)
        tcur += 0.55 + rng.uniform(-0.05, 0.12) + (0.6 if k in (3, 7) else 0)
for at in (14.0, 46.0):
    thud = (sine(55, 3.0) + 0.5 * sine(110, 3.0)) * np.exp(-np.linspace(0, 4, sec(3.0))) * 0.25 + noise(0.05) .sum() * 0
    music = place(music, reverb(thud, 0.8), at)
save('music_loop', norm(loopify(music, 60, 4.0), 0.5), 80)

# stings: reversed thunder swell -> dissonant cluster -> hit -> sub drop
def sting(pitch=1.0, seed=0):
    L = 4.2; c = np.zeros(sec(L), np.float32)
    rev = th['3113'][:sec(1.6)][::-1] * np.linspace(0.2, 1.0, sec(1.6)) ** 2
    c = place(c, butter(rev, 3000) * 0.5, 0.0)
    dur = 1.5; e = (np.linspace(0, 1, sec(dur)) ** 3)
    cl = mix(*[saw(f * pitch, dur) * (1 + 0.02 * np.sin(2 * np.pi * (5.5 + 0.5 * i) * t(dur))) for i, f in enumerate((220, 233, 247, 311, 330, 466, 622))]) * e * 0.12
    c = place(c, bandpass(cl, 150, 4000), 0.4)
    hitn = bandpass(noise(0.35), 600, 6000) * np.exp(-np.linspace(0, 14, sec(0.35))) * 0.9
    metal = mix(*[sine(180 * pitch * r, 1.8) * np.exp(-np.linspace(0, 4 + r, sec(1.8))) for r in (1, 2.76, 5.4, 8.93)]) * 0.35
    sub = np.sin(2 * np.pi * np.cumsum(np.linspace(70, 24, sec(1.6))) / SR) * np.exp(-np.linspace(0, 2.5, sec(1.6))) * 0.9
    c = place(c, mix(hitn, metal), 1.9); c = place(c, sub, 1.9)
    return norm(reverb(fade(c, 0.005, 0.6), 0.45)[:sec(5.0)], 0.95)
save('sting_1', sting(1.0)); save('sting_2', sting(0.84)); save('sting_3', sting(1.19))
# riser: 3 s build before a sting (reversed thunder + sweeping noise + accelerating pulse)
R = 3.0; riser = th['3181'][sec(4):sec(4) + sec(R)][::-1] * np.linspace(0.1, 1.0, sec(R)) ** 2 * 0.6
nz = noise(R); blk = sec(0.1); sw = np.zeros_like(nz)
for i in range(0, len(nz), blk):
    k = i / len(nz); sw[i:i + blk] = bandpass(nz[max(0, i - blk):i + blk], 150 + 2500 * k ** 2, 400 + 5000 * k ** 2)[-(min(blk, len(nz) - i)):]
pulse = sine(90, R) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * np.cumsum(np.linspace(2, 14, sec(R))) / SR)))
riser = mix(riser, sw * np.linspace(0, 0.5, sec(R)) ** 2, pulse * np.linspace(0, 0.35, sec(R)) ** 2)
save('riser', norm(fade(riser, 0.05, 0.02), 0.9))
# whispers: formant-filtered breath with syllables, reversed layer
def whisper(seed, pitch=1.0):
    L = 2.2; n = noise(L); env = np.zeros(sec(L), np.float32); pos = 0.15
    r2 = np.random.default_rng(seed)
    while pos < L - 0.3:
        d = r2.uniform(0.09, 0.26); i, j = sec(pos), sec(pos + d)
        env[i:j] = np.hanning(j - i) * r2.uniform(0.4, 1.0); pos += d + r2.uniform(0.03, 0.12)
    f = mix(bandpass(n, 500 * pitch, 900 * pitch) * 1.0, bandpass(n, 1100 * pitch, 1500 * pitch) * 0.7, bandpass(n, 2400 * pitch, 3100 * pitch) * 0.5)
    v = f * env; v = mix(v, (v[::-1] * 0.5))
    return norm(reverb(fade(butter(v, 5000), 0.02, 0.2), 0.7)[:sec(3.4)], 0.6)
save('whisper_1', whisper(1)); save('whisper_2', whisper(2, 0.85)); save('whisper_3', whisper(3, 1.15))
# breath close by
br = bandpass(noise(2.4), 300, 1800) * (np.sin(2 * np.pi * 0.42 * t(2.4)) ** 2) * np.hanning(sec(2.4))
save('breath', norm(reverb(br, 0.2, IR_SMALL), 0.5))
# the Manager's chuckle: pulsed, distorted, low
L = 1.4; ch = np.zeros(sec(L), np.float32)
for k, at in enumerate((0.0, 0.19, 0.4, 0.64, 0.95)):
    d = 0.13; f = 95 - k * 6
    syl = saw(f, d) * np.hanning(sec(d)) * (1 - k * 0.12)
    ch = place(ch, syl, at)
ch = np.tanh(bandpass(ch, 120, 1800) * 4) * 0.6
save('laugh', norm(reverb(fade(ch, 0.005, 0.3), 0.6)[:sec(3.0)], 0.85))
# phone: landline trill + a mobile marimba ringtone
L = 2.4; ring = np.zeros(sec(L), np.float32)
for at in (0.0, 1.2):
    seg = (sine(400, 0.5) + sine(450, 0.5)) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 20 * t(0.5))))
    ring = place(ring, seg * np.hanning(sec(0.5)) ** 0.3, at)
save('ring_landline', norm(reverb(ring * 0.5, 0.4)[:sec(3.2)], 0.7))
mob = np.zeros(sec(1.6), np.float32)
for k, f in enumerate((1318.5, 1568.0, 1975.5, 2637.0, 1975.5, 1568.0)):
    nt = (sine(f, 0.35) + 0.3 * sine(f * 3, 0.35)) * np.exp(-np.linspace(0, 9, sec(0.35)))
    mob = place(mob, nt, k * 0.19)
save('ring_mobile', norm(reverb(mob, 0.5)[:sec(2.6)], 0.7))
# door slam (wrong turn), shutter, drip, horn
sl = mix(sine(48, 0.9) * np.exp(-np.linspace(0, 9, sec(0.9))), bandpass(noise(0.25), 200, 2500) * np.exp(-np.linspace(0, 25, sec(0.25))) * 0.7)
save('slam', norm(reverb(fade(sl, 0.002, 0.2), 0.6)[:sec(2.4)], 0.95))
sh = bandpass(noise(0.8), 800, 5000) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 22 * t(0.8)))) * np.hanning(sec(0.8)) ** 0.4
sh = mix(sh * 0.5, place(np.zeros(sec(1.2), np.float32), mix(*[sine(f, 0.8) * np.exp(-np.linspace(0, 7, sec(0.8))) for f in (420, 1160, 2300)]) * 0.3, 0.75))
save('shutter', norm(reverb(fade(sh, 0.005, 0.2), 0.5)[:sec(2.6)], 0.8))
dr = np.sin(2 * np.pi * np.cumsum(np.linspace(1900, 900, sec(0.08))) / SR) * np.exp(-np.linspace(0, 10, sec(0.08)))
save('drip', norm(reverb(dr, 0.9)[:sec(1.2)], 0.5))
hn = np.zeros(sec(1.0), np.float32)
for at in (0.0, 0.32):
    seg = (np.sign(sine(330, 0.24)) + np.sign(sine(415, 0.24))) * np.hanning(sec(0.24)) ** 0.2
    hn = place(hn, butter(seg, 2500) * 0.4, at)
save('horn', norm(reverb(hn, 0.6)[:sec(2.2)], 0.7))
print('done →', OUT)
