"""Animated pose mockups: glossy Clawd at a laptop, at the Stage's real resolution (40x24 px)."""
import struct
import sys
import zlib

W, H = 40, 24
PAL = {
    'o': '#D97757', 'O': '#EDA88C', 'd': '#B5553A', 'k': '#1F1410', 'w': '#FFFFFF',
    'B': '#2B2F36',  # bezel
    'G': '#8B9096', 'g': '#C9CDD2',  # laptop body / keys
    's': '#1E2433',  # code screen
    'K': '#0B0D10',  # terminal screen
    'P': '#C678DD', 'C': '#61AFEF', 'Y': '#E5C07B', 'L': '#98C379', 'R': '#E06C75', 'T': '#ABB2BF',  # syntax
    'x': '#FFFFFF',  # cursor / glyph white
    'e': '#E8ECF1', 'n': '#7A8594',  # document page / text
    'r': '#D9534F',  # error red
    'v': '#4CAF50',  # done green
    'q': '#3A3A3A',  # thought ink
    'b': '#FFFFFF',  # bubble
    'u': '#C8B39A', 'U': '#9C8569',  # desk
    'z': '#FFD54F',  # sparkle / key flash
    'c': '#8FD3FF',  # sweat drop
}


def blank():
    return [['.'] * W for _ in range(H)]


def put(g, x, y, ch):
    if 0 <= y < H and 0 <= x < W:
        g[y][x] = ch


def rect(g, x0, y0, x1, y1, ch):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            put(g, x, y, ch)


def stamp(g, rows, x, y):
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch != '.':
                put(g, x + dx, y + dy, ch)


# ── Clawd (glossy edition), 16x10 body ───────────────────────────────────

def clawd(g, x0, y0, look=(0, 0), blink=False, arms='none', f=0):
    rect(g, x0, y0, x0 + 15, y0 + 9, 'o')
    for x, y in [(x0, y0), (x0 + 15, y0), (x0, y0 + 9), (x0 + 15, y0 + 9)]:
        put(g, x, y, '.')
    rect(g, x0 + 1, y0, x0 + 14, y0, 'O')
    rect(g, x0, y0 + 1, x0, y0 + 4, 'O')
    rect(g, x0 + 1, y0 + 9, x0 + 14, y0 + 9, 'd')
    rect(g, x0 + 15, y0 + 5, x0 + 15, y0 + 8, 'd')
    put(g, x0 + 2, y0 + 1, 'w')
    dx, dy = look
    for ex in (x0 + 3, x0 + 11):
        if blink:
            rect(g, ex + dx, y0 + 4 + dy, ex + 1 + dx, y0 + 4 + dy, 'k')
        else:
            rect(g, ex + dx, y0 + 2 + dy, ex + 1 + dx, y0 + 4 + dy, 'k')
            put(g, ex + 1 + dx, y0 + 2 + dy, 'w')
    for lx in (x0 + 1, x0 + 4, x0 + 10, x0 + 13):
        rect(g, lx, y0 + 10, lx + 1, y0 + 11, 'd')
    ay = y0 + 5
    if arms == 'side':
        rect(g, x0 - 3, ay, x0 - 1, ay + 1, 'o')
        rect(g, x0 + 16, ay, x0 + 18, ay + 1, 'o')
    if arms == 'scratch':
        hx = x0 + 1 + (f % 3)
        rect(g, x0 - 2, y0 - 2, x0 - 1, ay + 1, 'o')
        rect(g, x0 - 1, y0 - 2, hx + 2, y0 - 1, 'o')
        rect(g, hx, y0 - 2, hx + 2, y0 - 2, 'O')
        if f % 2 == 0:
            put(g, hx + 4, y0 - 3, 'q')
            put(g, hx - 2, y0 - 3, 'q')
    if arms == 'facepalm':
        rect(g, x0 - 2, y0 + 2, x0 - 1, ay + 1, 'd')
        rect(g, x0 - 1, y0 + 1, x0 + 7, y0 + 5, 'o')
        rect(g, x0 - 1, y0 + 1, x0 + 7, y0 + 1, 'O')
        rect(g, x0 + 7, y0 + 2, x0 + 7, y0 + 5, 'd')
    if arms == 'up':
        rect(g, x0 - 2, y0 - 3, x0 - 1, ay + 1, 'o')
        rect(g, x0 + 16, y0 - 3, x0 + 17, ay + 1, 'o')
        put(g, x0 - 2, y0 - 3, 'O')
        put(g, x0 + 16, y0 - 3, 'O')


# ── Desk, laptop, hands on the keyboard ──────────────────────────────────

SX0, SY0, SX1, SY1 = 23, 4, 35, 13  # screen interior, 13 x 10


def desk_and_laptop(g, screen):
    rect(g, 0, 19, W - 1, 19, 'u')
    rect(g, 0, 20, W - 1, 20, 'U')
    rect(g, 22, 3, 36, 14, 'B')
    rect(g, SX0, SY0, SX1, SY1, screen)
    rect(g, 24, 15, 34, 15, 'G')
    rect(g, 9, 16, 37, 17, 'g')
    for kx in range(10, 37, 2):
        put(g, kx, 16, 'G')
    rect(g, 8, 18, 38, 18, 'G')


def hands(g, mode, f):
    """Two hands on the keyboard deck in front of Clawd; typing lifts them in turn."""
    for i, hx in enumerate((10, 17)):
        up = mode == 'type' and f % 2 == i
        top = 13 if up else 14
        stamp(g, ['dOOd', 'dood', '.dd.'], hx, top)
        if mode == 'type' and not up:
            put(g, hx + 1, 13, 'z')
            put(g, hx + 2, 12, 'z')


def code_lines(frame):
    runs = ['PPCCC', '.YYYTT', '..LLLLL', '.CCRR', 'PPPTYY', '..TTTLLL', '.RRCCC', 'TT']
    return [runs[i % len(runs)] for i in range(frame + 4)][-5:]


def draw_code(g, frame, cursor=True):
    lines = code_lines(frame)
    for i, run in enumerate(lines):
        y = SY0 + 1 + i * 2
        for j, ch in enumerate(run):
            if ch != '.':
                put(g, SX0 + 1 + j, y, ch)
        if i == len(lines) - 1 and cursor and frame % 2 == 0:
            put(g, SX0 + 2 + len(run), y, 'x')


def draw_doc(g, frame):
    lengths = [11, 8, 10, 6, 11, 7, 9, 5, 11, 8, 4, 10]
    for i in range(10):
        if (i + frame) % 3 == 2:
            continue
        n = lengths[(i + frame) % len(lengths)]
        rect(g, SX0 + 1, SY0 + i, SX0 + n, SY0 + i, 'Y' if i == 4 else 'n')


def draw_terminal(g, frame):
    out = []
    for i in range(frame + 5):
        out.append(('L', 2 + (i % 4)) if i % 3 == 0 else ('T', 3 + (i * 3) % 8))
    for i, (col, n) in enumerate(out[-5:]):
        y = SY0 + i * 2
        if col == 'L':
            put(g, SX0 + 1, y, 'L')
            rect(g, SX0 + 3, y, SX0 + 2 + n, y, 'x')
        else:
            rect(g, SX0 + 1, y, SX0 + n, y, 'T')


ERROR_X = ['x...x', '.x.x.', '..x..', '.x.x.', 'x...x']
CHECK = ['.....x', '....xx', 'x..xx.', 'xxxx..', '.xx...']
SPARK = ['.z.', 'zzz', '.z.']
THOUGHT = ['.bbbbbbbbbb.', 'bbbbbbbbbbbb', 'bbbbbbbbbbbb', '.bbbbbbbbbb.']


# ── Animations ───────────────────────────────────────────────────────────

def coding(f):
    g = blank()
    bob = -1 if f % 4 in (1, 2) else 0
    clawd(g, 4, 5 + bob, look=(1, 1), blink=(f == 5))
    desk_and_laptop(g, 's')
    hands(g, 'type', f)
    draw_code(g, f)
    return g


def thinking(f):
    g = blank()
    clawd(g, 4, 6, look=(1, -1), arms='scratch', f=f)
    desk_and_laptop(g, 's')
    rect(g, 17, 15, 19, 16, 'o')
    put(g, 17, 15, 'O')
    draw_code(g, 3, cursor=(f % 2 == 0))
    stamp(g, THOUGHT, 9, 0)
    put(g, 21, 2, 'b')
    if f % 8 < 6:
        for i in range(f % 4):
            rect(g, 11 + i * 3, 1, 12 + i * 3, 2, 'q')
    else:
        stamp(g, ['qq.', '..q', '.q.'], 14, 0)
    return g


def reading(f):
    g = blank()
    clawd(g, 4, 5, look=(1, 0), blink=(f == 6))
    desk_and_laptop(g, 'e')
    hands(g, 'rest', f)
    draw_doc(g, f)
    return g


def terminal(f):
    g = blank()
    clawd(g, 4, 5, look=(1, 1 if f % 4 < 2 else 0))
    desk_and_laptop(g, 'K')
    hands(g, 'type', f // 2)
    draw_terminal(g, f)
    return g


def oops(f):
    g = blank()
    shake = f % 2
    clawd(g, 4 + shake, 5, arms='facepalm')
    desk_and_laptop(g, 'r')
    rect(g, 17, 15, 19, 16, 'o')
    stamp(g, ERROR_X, 27, 6)
    if f % 4 < 2:
        put(g, 21, 3, 'c')
        put(g, 21, 4, 'c')
    return g


def done(f):
    g = blank()
    hop = [0, -2, -3, -2, 0, 0][f % 6]
    clawd(g, 4, 5 + hop, arms='up' if hop < 0 else 'none')
    desk_and_laptop(g, 'v')
    if hop == 0:
        hands(g, 'rest', f)
    stamp(g, CHECK, 26, 6)
    if hop < 0:
        stamp(g, SPARK, 0, 1 + (f % 2))
        stamp(g, SPARK, 20, (f + 1) % 2)
    return g


ANIMS = [
    ('coding', 'Coding', 'Edit · Write: both hands tap the keys, code lines appear, the cursor blinks', coding, 8),
    ('thinking', 'Thinking', 'Between steps: scratches its head, thought dots fill, then a “?”', thinking, 8),
    ('reading', 'Reading', 'Read · Grep · Glob: hands rest, the page scrolls past, one line highlighted', reading, 8),
    ('terminal', 'Running a command', 'Bash: types a command, output scrolls on a black screen', terminal, 8),
    ('oops', 'Oops', 'A tool failed: facepalm, red screen, nervous shake and a sweat drop', oops, 6),
    ('done', 'Done', 'Turn finished: hops with arms up, green check, sparkles', done, 6),
]


def svg_strip(frames, scale):
    rects = []
    for i, g in enumerate(frames):
        for y, row in enumerate(g):
            for x, ch in enumerate(row):
                if ch != '.':
                    rects.append(f'<rect x="{i * W + x}" y="{y}" width="1.02" height="1.02" fill="{PAL[ch]}"/>')
    n = len(frames)
    return (f'<svg viewBox="0 0 {W * n} {H}" width="{W * n * scale}" height="{H * scale}" '
            f'shape-rendering="crispEdges" style="display:block">{"".join(rects)}</svg>')


def page(scale=7):
    css, cards = [], []
    for key, title, desc, fn, n in ANIMS:
        frames = [fn(f) for f in range(n)]
        width = W * scale
        css.append(f'@keyframes play-{key} {{ from {{ transform: translateX(0) }} to {{ transform: translateX(-{width * n}px) }} }}')
        cards.append(f'''
  <div class="card" data-choice="{key}" onclick="toggleSelect(this)">
    <div class="card-image" style="display:flex;justify-content:center;padding:14px;background:linear-gradient(#F4F7FB,#E3EAF2)">
      <div style="width:{width}px;height:{H * scale}px;overflow:hidden;border-radius:8px">
        <div style="width:{width * n}px;animation:play-{key} {n * 0.166:.3f}s steps({n}) infinite">{svg_strip(frames, scale)}</div>
      </div>
    </div>
    <div class="card-body"><h3>{title}</h3><p>{desc}</p></div>
  </div>''')
    return f'''<style>{"".join(css)}</style>
<h2>Clawd at work: do these animations feel right?</h2>
<p class="subtitle">Each plays at the real Stage size (40×24 pixels = 40 columns × 12 terminal rows) and real speed (6 frames a second). Click any you love; tell me in the terminal what to change.</p>
<div class="cards">{"".join(cards)}</div>
'''


def contact_sheet(path, scale=6):
    rows = [[fn(f) for f in range(n)] for _, _, _, fn, n in ANIMS]
    cols = max(len(r) for r in rows)
    iw, ih = cols * (W + 2) * scale, len(rows) * (H + 2) * scale
    img = [[(240, 244, 248)] * iw for _ in range(ih)]
    for r, frames in enumerate(rows):
        for c, g in enumerate(frames):
            ox, oy = c * (W + 2) * scale + scale, r * (H + 2) * scale + scale
            for y, row in enumerate(g):
                for x, ch in enumerate(row):
                    if ch == '.':
                        continue
                    h = PAL[ch].lstrip('#')
                    col = (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
                    for dy in range(scale):
                        line = img[oy + y * scale + dy]
                        for dx in range(scale):
                            line[ox + x * scale + dx] = col
    raw = b''.join(b'\x00' + bytes(v for px in line for v in px) for line in img)

    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)

    png = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', iw, ih, 8, 2, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))
    open(path, 'wb').write(png)


if __name__ == '__main__':
    if sys.argv[1].endswith('.png'):
        contact_sheet(sys.argv[1])
    else:
        open(sys.argv[1], 'w', encoding='utf-8').write(page())
    print('wrote', sys.argv[1])
