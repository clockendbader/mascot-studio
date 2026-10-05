import sys
import styles
from styles import Pane, COLS, ROWS, lerp, stage, filmstrip


def ubuntu():
    p = Pane('#F2F1F0')
    bar_top, bar = '#5A5954', '#3C3B37'
    for x in range(COLS):
        p.px(x, 0, bar_top)
        p.px(x, 1, lerp(bar_top, bar, .5))
        p.px(x, 2, bar)
        p.px(x, 3, bar)
    for x, y in [(0, 0), (COLS - 1, 0)]:
        p.px(x, y, '#F2F1F0')
    p.fill(1, 0, COLS - 1, bar)
    p.text(1, 1, '●', '#F07746', None, bold=True)
    p.text(1, 3, '●', '#8A8780', None)
    p.text(1, 5, '●', '#8A8780', None)
    p.text(1, 8, 'Clawd Studio', '#DFDBD2', None, bold=True)
    p.fill(2, 0, COLS - 1, '#E6E4E1')
    p.text(2, 2, ' Timeline ', '#3C3B37', '#FFFFFF', bold=True)
    p.text(2, 13, 'Usage', '#5E5C57', None)
    p.text(2, 20, 'Music', '#5E5C57', None)
    filmstrip(p, 3, '#2C2C2C', '#77746E', '#1C1C1C', '#F07746')
    p.text(5, 2, 'frame 27 · 0:42 · visitor #000427', '#7A776F', None)

    def aubergine(x, y):
        if y >= 19:
            return '#F2F1F0'
        t = min(1.0, (x * 0.6 + y * 1.4) / 44)
        if t < 0.6:
            return lerp('#2C001E', '#77216F', t / 0.6)
        return lerp('#77216F', '#E95420', (t - 0.6) / 0.4)
    stage(p, aubergine)
    p.fill(18, 1, COLS - 2, '#FFFFFF')
    p.fill(19, 1, COLS - 2, '#FFFFFF')
    p.text(18, 2, '✎ Editing', '#E95420', None, bold=True)
    p.text(18, 13, 'hooks/views/studio.tsx', '#3C3B37', None)
    p.text(19, 2, 'Pose: coding at the laptop · 0:42', '#7A776F', None)
    for r in (20, 21, 22):
        p.fill(r, 1, COLS - 2, '#3C3B37')
    p.text(21, 2, '◀◀', '#DFDBD2', None)
    p.text(21, 5, '❚❚', '#F07746', None, bold=True)
    p.text(21, 8, '▶▶', '#DFDBD2', None)
    p.text(21, 12, '♪ Ron Artest — Babyface Ray', '#FFFFFF', None)
    for x in range(12, 43):
        p.px(x, 45, '#F07746' if x < 25 else '#5E5C57')
    p.fill(23, 0, COLS - 1, '#DFDBD2')
    p.text(23, 2, 'Context 42%  ·  5-hour 31%  ·  $0.84', '#3C3B37', None)
    return p


def page():
    w = styles.poses.W * styles.CW
    ub_bg = 'linear-gradient(160deg,#2C001E,#77216F 60%,#E95420)'
    return f'''<style>@keyframes stagecode {{ from {{ transform: translateX(0) }} to {{ transform: translateX(-{w * 8}px) }} }}</style>
<h2>Three themes, one setting</h2>
<p class="subtitle">Same studio, same Clawd, three 2010s skins. <b>Theme: Auto</b> (the default) picks the one that matches your computer; <code>/config</code> lets anyone choose another. Changing it reloads the studio instantly.</p>
<div class="cards">
{styles.card('win7', 'Windows 7', 'Aero glass frame, red ✕, Ribbon-style tabs, Movie Maker film strip, Media Player dark glass music bar. Auto on Windows.', styles.aero(), 'linear-gradient(#3B7FC4,#A9D2F5 79%,#F3F7FC 79%)')}
{styles.card('mac', 'Mac OS X', 'Unified grey toolbar with traffic lights, Aqua blue tab switch, linen backdrop, dark info panel, iTunes LCD. Auto on macOS.', styles.aqua(), 'repeating-linear-gradient(45deg,#3E4350 0 3px,#383D49 3px 6px)')}
{styles.card('ubuntu', 'Ubuntu (Ambiance)', 'Dark title bar with orange window buttons on the left, orange highlights, aubergine-to-orange backdrop, dark music bar. Auto on Linux.', ubuntu(), ub_bg)}
</div>
'''


if __name__ == '__main__':
    open(sys.argv[1], 'w', encoding='utf-8').write(page())
    print('wrote', sys.argv[1])
