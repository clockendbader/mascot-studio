"""Clickable tab layout, Windows 7 theme: the Stage stays on top, tabs switch what's below it."""
import sys

import poses
import styles
from styles import COLS, CW, CH, Pane, lerp

ROWS = styles.ROWS  # 24
GLASS, GLASS_TOP, BODY = '#B9D3F0', '#DDEBFA', '#F3F7FC'
INK, SOFT = '#1E395B', '#56708F'
HOVER = '#FFF3C4'
STAGE_ROW = 3


def chrome(p, active):
    p.fill(0, 0, COLS - 1, GLASS)
    for x in range(COLS):
        p.px(x, 0, GLASS_TOP)
        p.px(x, 1, lerp(GLASS_TOP, GLASS, .6))
    p.fill(1, 0, COLS - 1, GLASS)
    p.text(1, 1, '◆', '#D97757', None, bold=True)
    p.text(1, 3, 'Clawd Studio', INK, None)
    p.text(1, 36, ' ─ ', INK, '#CFE0F4')
    p.text(1, 39, ' □ ', INK, '#CFE0F4')
    p.text(1, 42, ' ✕  ', '#FFFFFF', '#C75050', bold=True)
    for r in range(2, ROWS):
        p.fill(r, 0, 0, GLASS)
        p.fill(r, COLS - 1, COLS - 1, GLASS)
    p.fill(2, 1, COLS - 2, '#E3EDF8')
    col = 2
    for name in ('Timeline', 'Usage', 'Music'):
        label = f' {name} '
        if name == active:
            p.text(2, col, label, INK, '#FFFFFF', bold=True)
        else:
            p.text(2, col, label, '#3D5A80', '#E3EDF8')
        col += len(label) + 1
    p.text(2, 38, '1 2 3', '#8AA2BF', None)


def stage(p):
    g = poses.coding(2)
    for y in range(poses.H):
        for x in range(poses.W):
            ch = g[y][x]
            color = poses.PAL[ch] if ch != '.' else (lerp('#3B7FC4', '#A9D2F5', y / 23) if y < 19 else BODY)
            p.px(3 + x, STAGE_ROW * 2 + y, color)


def status(p, hovered=None):
    p.fill(23, 0, COLS - 1, '#D6E4F3')
    parts = [('Context 42%', 2), ('5-hour 31%', 16), ('♪ Ron Artest', 29)]
    for label, col in parts:
        bg = HOVER if label == hovered else None
        p.text(23, col, label, INK, bg)


def timeline_tab(p):
    p.text(15, 2, 'Steps this turn', SOFT, None, bold=True)
    p.text(15, 30, 'click a clip ▾', '#8AA2BF', None)
    styles.filmstrip(p, 16, '#2A2F36', '#9AA6B2', '#1A1D22', '#E81123')
    # hovered clip: a highlight box and a tooltip card
    p.px_rect(30, 33, 30, 34, '#FFE58F')
    p.fill(18, 1, COLS - 2, '#FFFFFF')
    p.fill(19, 1, COLS - 2, '#FFFFFF')
    p.fill(20, 1, COLS - 2, '#FFFFFF')
    p.text(18, 2, '✎ Step 14 · Edit', INK, None, bold=True)
    p.text(18, 33, '✓ 120 ms', '#2E8B57', None)
    p.text(19, 2, 'hooks/views/studio.tsx', '#3D5A80', None)
    p.text(20, 2, '◀ prev', '#3D5A80', '#E3EDF8')
    p.text(20, 10, 'next ▶', '#3D5A80', '#E3EDF8')
    p.text(20, 31, ' Back to live ', '#FFFFFF', '#3B7FC4', bold=True)
    p.text(21, 2, 'Now: coding at the laptop · 0:42', SOFT, None)


def bar(p, row, label, pct, color, extra):
    p.text(row, 2, label.ljust(8), INK, None)
    cells = 18
    lit = round(pct / 100 * cells)
    p.text(row, 10, '█' * lit, color, None)
    p.text(row, 10 + lit, '░' * (cells - lit), '#C5D3E3', None)
    p.text(row, 29, f'{pct}%', INK, None, bold=True)
    p.text(row, 34, extra, SOFT, None)


def usage_tab(p):
    p.text(15, 2, 'Claude usage', SOFT, None, bold=True)
    p.text(15, 33, 'details ▸', '#3B7FC4', HOVER)
    bar(p, 16, 'Context', 42, '#3FA9F5', '84k tok')
    bar(p, 17, '5-hour', 31, '#3FA9F5', '↻ 4:10 PM')
    bar(p, 18, 'Weekly', 18, '#3FA9F5', '↻ Mon')
    for x in range(2, COLS - 2):
        for y in (38, 39, 40, 41):
            p.px(x, y, '#0B1A0B' if (x % 4) else '#14361A')
    samples = [5, 8, 12, 15, 15, 22, 30, 28, 35, 42, 41, 48, 42, 40, 38, 42]
    for i, s in enumerate(samples):
        x = COLS - 3 - (len(samples) - 1 - i) * 2
        y = 41 - round(s / 100 * 3 * 2)
        p.px(x, max(38, y), '#5DFF5D')
        p.px(x - 1, max(38, y), '#5DFF5D')
    p.text(21, 2, 'Est. cost $0.84 · 12 turns · 27 tools', SOFT, None)
    p.text(22, 2, 'Context history (one point per turn)', '#8AA2BF', None)


def music_tab(p):
    p.text(15, 2, 'Now playing · Spotify', SOFT, None, bold=True)
    blob = poses.blank()
    for r, row in enumerate(['..zzzzzz..', '.z......z.', 'zz.dddd.zz', 'zzdddddDzz', '.ddkddkdd.', '.dddddddd.', '.ddDkkDdd.', '.dddddddd.', '..dddddd..', '..k....k..']):
        for c, ch in enumerate(row):
            if ch != '.':
                color = {'z': '#000000', 'd': '#7A3FA0', 'D': '#A060C8', 'k': '#1A1A1A'}[ch]
                p.px(3 + c, 32 + r, color)
    p.text(16, 15, 'Ron Artest', INK, None, bold=True)
    p.text(17, 15, 'Babyface Ray', SOFT, None)
    for x in range(15, 43):
        p.px(x, 37, '#3FA9F5' if x < 24 else '#C5D3E3')
    p.text(19, 15, '1:12', SOFT, None)
    p.text(19, 39, '3:05', SOFT, None)
    p.text(20, 15, ' ⏮ ', INK, '#E3EDF8')
    p.text(20, 19, ' ⏯ ', '#FFFFFF', '#3B7FC4', bold=True)
    p.text(20, 23, ' ⏭ ', INK, '#E3EDF8')
    p.text(21, 3, 'dances', '#8AA2BF', None)


def pane(active, hovered=None):
    p = Pane(BODY)
    chrome(p, active)
    stage(p)
    {'Timeline': timeline_tab, 'Usage': usage_tab, 'Music': music_tab}[active](p)
    status(p, hovered)
    return p


def card(choice, title, desc, p):
    return f'''
  <div class="card" data-choice="{choice}" onclick="toggleSelect(this)" style="max-width:420px">
    <div class="card-image" style="display:flex;justify-content:center;padding:14px;background:#DDE3EA">
      <div style="border-radius:8px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.25)">{p.svg()}</div>
    </div>
    <div class="card-body"><h3>{title}</h3><p>{desc}</p></div>
  </div>'''


def page():
    return f'''<h2>Easy and clickable: Clawd on top, three tabs below</h2>
<p class="subtitle">Windows 7 theme shown; Mac and Ubuntu get the same layout in their own colours. Everything you see that looks like a control is one: click it, or press its key (1, 2, 3 for the tabs). Things you can click light up when the mouse is over them (yellow here).</p>
<div class="cards">
{card('timeline', 'Timeline tab', 'Each coloured clip is one step Claude took (blue read, orange edit, grey command, red failed). Click one to see what it did; ◀ ▶ walk through steps; “Back to live” returns.', pane('Timeline'))}
{card('usage', 'Usage tab', 'Context, 5-hour and weekly limits as glossy bars with when they reset, cost, turns and tools, plus a little graph of context over the session.', pane('Usage'))}
{card('music', 'Music tab', 'What’s playing, the DJ blob dancing, a progress bar and big ⏮ ⏯ ⏭ buttons.', pane('Music', hovered='♪ Ron Artest'))}
</div>
<p class="subtitle" style="margin-top:12px">The bottom bar is always there and clickable too: click “Context 42%” to jump to Usage, the song to jump to Music.</p>
'''


if __name__ == '__main__':
    open(sys.argv[1], 'w', encoding='utf-8').write(page())
    print('wrote', sys.argv[1])
