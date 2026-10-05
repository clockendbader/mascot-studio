"""Three 2010s directions for the whole pane, drawn only with what the terminal can show:
text cells (fg/bg colour per cell) and half-block pixel rows (1 cell = 1x2 px)."""
import html
import sys

import poses

COLS, ROWS = 46, 24
CW, CH = 8, 16  # one terminal cell in the mockup, in screen pixels
FONT = "Consolas, 'Cascadia Mono', 'SF Mono', Menlo, monospace"


def hexc(c):
    return c if c.startswith('#') else '#' + c


class Pane:
    def __init__(self, page_bg):
        self.bg = [[page_bg] * COLS for _ in range(ROWS)]
        self.text_runs = []  # (row, col, text, fg, bold)
        self.pixels = {}  # (px_x, px_y) -> colour, px_y in 0..2*ROWS

    def fill(self, row, c0, c1, color):
        for c in range(c0, c1 + 1):
            if 0 <= c < COLS:
                self.bg[row][c] = color

    def text(self, row, col, s, fg, bg=None, bold=False):
        if bg is not None:
            self.fill(row, col, col + len(s) - 1, bg)
        self.text_runs.append((row, col, s, fg, bold))

    def px(self, x, y, color):
        if 0 <= x < COLS and 0 <= y < ROWS * 2:
            self.pixels[(x, y)] = color

    def px_rect(self, x0, y0, x1, y1, color):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.px(x, y, color)

    def svg(self):
        out = []
        for r in range(ROWS):
            for c in range(COLS):
                out.append(f'<rect x="{c * CW}" y="{r * CH}" width="{CW + .3}" height="{CH + .3}" fill="{self.bg[r][c]}"/>')
        for (x, y), color in self.pixels.items():
            out.append(f'<rect x="{x * CW}" y="{y * CH // 2}" width="{CW + .3}" height="{CH // 2 + .3}" fill="{color}"/>')
        for row, col, s, fg, bold in self.text_runs:
            weight = '700' if bold else '400'
            out.append(f'<text x="{col * CW}" y="{row * CH + 12}" fill="{fg}" font-family="{FONT}" font-size="13" '
                       f'font-weight="{weight}" textLength="{len(s) * CW}" lengthAdjust="spacingAndGlyphs" '
                       f'xml:space="preserve">{html.escape(s)}</text>')
        return (f'<svg viewBox="0 0 {COLS * CW} {ROWS * CH}" width="{COLS * CW}" height="{ROWS * CH}" '
                f'shape-rendering="crispEdges" style="display:block">{"".join(out)}</svg>')


def lerp(a, b, t):
    a, b = int(a[1:], 16), int(b[1:], 16)
    ch = [round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * t) for s in (16, 8, 0)]
    return '#%02X%02X%02X' % tuple(ch)


# What goes in every mockup
CLIPS = ['Read', 'Read', 'Grep', 'Edit', 'Edit', 'Bash', 'Read', 'Edit', 'Bash', 'err', 'Edit', 'Edit', 'Web',
         'Read', 'Edit', 'Bash', 'Agent', 'Edit', 'Edit', 'Bash', 'Read', 'Edit', 'Edit', 'Bash', 'Edit', 'Edit', 'Edit']
CLIP_COLORS = {'Read': '#4A90E2', 'Grep': '#4A90E2', 'Edit': '#D97757', 'Bash': '#4B5563', 'Web': '#2EAD6B',
               'err': '#E5484D', 'Agent': '#8E5CD9'}
STAGE_ROW, STAGE_COL = 6, 3  # where the 40x24 px Stage sits (cells)


def stage(p, bg_fn):
    """The Stage: a background, then frame 0 of the coding pose over it."""
    g = poses.coding(0)
    for y in range(poses.H):
        for x in range(poses.W):
            ch = g[y][x]
            color = poses.PAL[ch] if ch != '.' else bg_fn(x, y)
            p.px(STAGE_COL + x, STAGE_ROW * 2 + y, color)


def filmstrip(p, row, film, hole, gap, playhead, flat=False):
    y0 = row * 2
    x0, x1 = 2, COLS - 3
    if not flat:
        p.px_rect(x0, y0, x1, y0 + 3, film)
        for x in range(x0 + 1, x1, 3):
            p.px(x, y0, hole)
            p.px(x, y0 + 3, hole)
    x = x0 + 1
    for clip in CLIPS:
        if x > x1 - 1:
            break
        p.px_rect(x, y0 + 1, x, y0 + 2, CLIP_COLORS[clip])
        x += 1
        p.px_rect(x, y0 + 1, x, y0 + 2, gap)
        x += 1 if not flat else 0
    p.px_rect(x - 1, y0, x - 1, y0 + 3, playhead)


# ── A · Windows 7 Aero ───────────────────────────────────────────────────

def aero():
    p = Pane('#F3F7FC')
    glass_top, glass = '#DDEBFA', '#B9D3F0'
    p.fill(0, 0, COLS - 1, glass)
    for x in range(COLS):
        p.px(x, 0, glass_top)
        p.px(x, 1, lerp(glass_top, glass, .6))
    for x, y in [(0, 0), (COLS - 1, 0)]:
        p.px(x, y, '#F3F7FC')
    p.fill(1, 0, COLS - 1, glass)
    p.text(1, 1, '◆', '#D97757', glass, bold=True)
    p.text(1, 3, 'Clawd Studio', '#1E395B', glass)
    p.text(1, 36, ' ─ ', '#1E395B', '#CFE0F4')
    p.text(1, 39, ' □ ', '#1E395B', '#CFE0F4')
    p.text(1, 42, ' ✕  ', '#FFFFFF', '#C75050', bold=True)
    for r in range(2, ROWS):
        p.fill(r, 0, 0, glass)
        p.fill(r, COLS - 1, COLS - 1, glass)
    p.fill(2, 1, COLS - 2, '#E3EDF8')
    p.text(2, 2, ' Home ', '#1E395B', '#FFFFFF', bold=True)
    p.text(2, 9, 'Usage', '#3D5A80', '#E3EDF8')
    p.text(2, 16, 'Music', '#3D5A80', '#E3EDF8')
    p.text(2, 23, 'View', '#3D5A80', '#E3EDF8')
    filmstrip(p, 3, '#2A2F36', '#9AA6B2', '#1A1D22', '#E81123')
    p.text(5, 2, 'frame 27 · 0:42 · visitor #000427', '#56708F', None)
    stage(p, lambda x, y: lerp('#3B7FC4', '#A9D2F5', y / 23) if y < 19 else '#F3F7FC')
    p.fill(18, 1, COLS - 2, '#FFFFFF')
    p.fill(19, 1, COLS - 2, '#FFFFFF')
    p.text(18, 2, '✎ Editing', '#1E395B', None, bold=True)
    p.text(18, 13, 'hooks/views/studio.tsx', '#3D5A80', None)
    p.text(19, 2, 'Pose: coding at the laptop · turn 0:42', '#6B819C', None)
    for r in (20, 21, 22):
        p.fill(r, 1, COLS - 2, '#16202B')
    for x in range(1, COLS - 1):
        p.px(x, 40, '#3A4A5C')
        p.px(x, 41, '#1C2733')
    p.text(21, 2, '◀◀', '#BFD7F2', None)
    p.text(21, 5, '●', '#3FA9F5', None, bold=True)
    p.text(21, 7, '▶▶', '#BFD7F2', None)
    p.text(21, 11, '♪ Ron Artest — Babyface Ray', '#FFFFFF', None)
    for x in range(11, 43):
        p.px(x, 45, '#3FA9F5' if x < 24 else '#33414F')
    p.fill(23, 0, COLS - 1, '#D6E4F3')
    p.text(23, 2, 'Context 42%  ·  5-hour 31%  ·  $0.84', '#1E395B', None)
    return p


# ── B · Mac OS X (Snow Leopard / Lion) ───────────────────────────────────

def aqua():
    p = Pane('#ECECEC')
    top, bottom = '#EDEDED', '#C9C9C9'
    for x in range(COLS):
        p.px(x, 0, top)
        p.px(x, 1, lerp(top, bottom, .25))
        p.px(x, 2, lerp(top, bottom, .5))
        p.px(x, 3, lerp(top, bottom, .75))
    for x, y in [(0, 0), (COLS - 1, 0)]:
        p.px(x, y, '#FFFFFF')
    p.text(1, 1, '●', '#FF5F57', None)
    p.text(1, 3, '●', '#FEBC2E', None)
    p.text(1, 5, '●', '#28C840', None)
    p.text(1, 17, 'Clawd Studio', '#4D4D4D', None, bold=True)
    p.fill(2, 0, COLS - 1, '#D8D8D8')
    p.text(2, 11, ' Timeline ', '#FFFFFF', '#3D8BE8', bold=True)
    p.text(2, 21, ' Usage ', '#333333', '#F7F7F7')
    p.text(2, 28, ' Music ', '#333333', '#F7F7F7')
    filmstrip(p, 3, '#C9C9C9', '#ECECEC', '#ECECEC', '#F5C400')
    p.text(5, 2, 'frame 27 · 0:42 · visitor #000427', '#7A7A7A', None)

    def linen(x, y):
        if y >= 19:
            return '#ECECEC'
        return '#3E4350' if (x * 3 + y * 5) % 7 < 3 else '#383D49'
    stage(p, linen)
    p.fill(18, 2, COLS - 3, '#2B2B2B')
    p.fill(19, 2, COLS - 3, '#2B2B2B')
    p.text(18, 3, '✎ Editing', '#FFFFFF', None, bold=True)
    p.text(18, 14, 'hooks/views/studio.tsx', '#C8C8C8', None)
    p.text(19, 3, 'Pose: coding at the laptop · 0:42', '#9A9A9A', None)
    for r in (20, 21, 22):
        p.fill(r, 3, COLS - 4, '#E6EBDA')
    p.text(20, 15, 'Ron Artest', '#2E2E2E', None, bold=True)
    p.text(21, 11, 'Babyface Ray · Spotify', '#5E6152', None)
    for x in range(8, 38):
        p.px(x, 45, '#4A4A4A' if x < 20 else '#B9BEAA')
    p.text(21, 4, '◀◀', '#555555', None)
    p.text(21, 38, '▶▶', '#555555', None)
    p.text(20, 4, '❚❚', '#555555', None)
    p.fill(23, 0, COLS - 1, '#D0D0D0')
    p.text(23, 2, 'Context 42% · 5-hour 31% · $0.84', '#505050', None)
    return p


# ── C · Flat 2014–2016 ───────────────────────────────────────────────────

def flat():
    p = Pane('#FFFFFF')
    p.fill(0, 0, COLS - 1, '#D97757')
    p.fill(1, 0, COLS - 1, '#D97757')
    p.text(1, 2, 'Clawd Studio', '#FFFFFF', None, bold=True)
    p.text(1, 37, '—  ☐  ✕', '#FFFFFF', None)
    p.text(2, 2, 'Timeline', '#D97757', None, bold=True)
    p.text(2, 13, 'Usage', '#9AA0A6', None)
    p.text(2, 21, 'Music', '#9AA0A6', None)
    for x in range(2, 10):
        p.px(x, 6, '#D97757')
    filmstrip(p, 3, '#FFFFFF', '#FFFFFF', '#FFFFFF', '#1F2937', flat=True)
    p.text(5, 2, 'frame 27 · 0:42 · visitor #000427', '#9AA0A6', None)

    def pastel(x, y):
        if y >= 19:
            return '#FFFFFF'
        shadow = x + y > 30 and x - y < 30
        return '#F6D9C8' if shadow else '#FCEDE3'
    stage(p, pastel)
    p.text(18, 2, 'EDITING', '#D97757', None, bold=True)
    p.text(18, 11, 'hooks/views/studio.tsx', '#1F2937', None)
    p.text(19, 2, 'coding at the laptop · 0:42', '#9AA0A6', None)
    for r in (20, 21, 22):
        p.fill(r, 2, COLS - 3, '#F4F5F7')
    p.text(21, 4, '●', '#D97757', None, bold=True)
    p.text(20, 7, 'Ron Artest', '#1F2937', None, bold=True)
    p.text(21, 7, 'Babyface Ray', '#6B7280', None)
    p.text(21, 34, '⏮ ⏯ ⏭', '#1F2937', None)
    for x in range(7, 42):
        p.px(x, 45, '#D97757' if x < 20 else '#E5E7EB')
    p.text(23, 2, 'CONTEXT 42%   5-HOUR 31%   $0.84', '#6B7280', None)
    return p


def animated_stage(scale_x=CW, scale_y=CH // 2):
    """The coding loop, as an absolutely placed strip over the Stage area (pixels only, transparent background)."""
    frames = [poses.coding(f) for f in range(8)]
    rects = []
    for i, g in enumerate(frames):
        for y, row in enumerate(g):
            for x, ch in enumerate(row):
                if ch != '.':
                    rects.append(f'<rect x="{i * poses.W + x}" y="{y}" width="1.02" height="1.02" fill="{poses.PAL[ch]}"/>')
    w, h = poses.W * scale_x, poses.H * scale_y
    return w, h, (f'<svg viewBox="0 0 {poses.W * 8} {poses.H}" width="{w * 8}" height="{h}" preserveAspectRatio="none" '
                  f'shape-rendering="crispEdges" style="display:block">{"".join(rects)}</svg>')


def card(choice, title, desc, pane, stage_bg_css):
    w, h, strip = animated_stage()
    left, top = STAGE_COL * CW, STAGE_ROW * CH
    return f'''
  <div class="card" data-choice="{choice}" onclick="toggleSelect(this)" style="max-width:420px">
    <div class="card-image" style="display:flex;justify-content:center;padding:14px;background:#DDE3EA">
      <div style="position:relative;width:{COLS * CW}px;height:{ROWS * CH}px;border-radius:8px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.25)">
        {pane.svg()}
        <div style="position:absolute;left:{left}px;top:{top}px;width:{w}px;height:{h}px;overflow:hidden;background:{stage_bg_css}">
          <div style="width:{w * 8}px;animation:stagecode 1.328s steps(8) infinite">{strip}</div>
        </div>
      </div>
    </div>
    <div class="card-body"><h3>{title}</h3><p>{desc}</p></div>
  </div>'''


def page():
    w = poses.W * CW
    return f'''<style>@keyframes stagecode {{ from {{ transform: translateX(0) }} to {{ transform: translateX(-{w * 8}px) }} }}</style>
<h2>Which 2010s look should the studio wear?</h2>
<p class="subtitle">Each is the whole pane at 46 columns × 24 rows, built only from what a terminal can draw: coloured text cells plus half-block pixels. The studio idea stays (timeline, Stage, Properties, music) but in 2010s clothes.</p>
<div class="cards">
{card('a', 'A · Windows 7 Aero', 'Sky-blue glass frame and title bar, red close button, a Ribbon-style tab row, a filmstrip timeline like Windows Live Movie Maker, Media Player-style dark glass music bar.', aero(), 'linear-gradient(#3B7FC4,#A9D2F5 79%,#F3F7FC 79%)')}
{card('b', 'B · Mac OS X (Snow Leopard / Lion)', 'Grey unified toolbar with traffic lights, a blue Aqua segmented control, a linen backdrop behind Clawd, a dark HUD for Properties and an iTunes-style LCD for music.', aqua(), 'repeating-linear-gradient(45deg,#3E4350 0 3px,#383D49 3px 6px)')}
{card('c', 'C · Flat 2014–2016', 'Claude-orange title bar, underlined tabs, flat colour chips for the timeline, a pastel Stage with a long shadow, a clean card for music.', flat(), 'linear-gradient(#FCEDE3,#FCEDE3 79%,#FFFFFF 79%)')}
</div>
'''


if __name__ == '__main__':
    open(sys.argv[1], 'w', encoding='utf-8').write(page())
    print('wrote', sys.argv[1])
