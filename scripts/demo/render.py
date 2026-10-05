"""Turns the demo test's FRAME lines into docs/media/demo.gif and the three theme screenshots.

Each frame is the pane's drawn tree (Clients inlined) plus the latest raster
blits. It becomes HTML: Box -> flex div, Text -> one fixed-width cell per
character, Raster -> SVG of half-block cells. Pages of frames are
screenshotted with a headless Chromium browser (Edge or Chrome), cropped and
stitched into a GIF with ffmpeg.

usage: render.py <frames.log> <out-dir> [--work <dir>]
env:   BROWSER_BIN  path to msedge / chrome / chromium (found automatically if unset)
"""

import argparse
import base64
import html
import json
import os
import shutil
import struct
import subprocess
import sys
from pathlib import Path

CW, CH = 10, 20            # one terminal cell, in CSS px
FONT_PX = 17
PAD, CAP_H = 12, 34        # frame padding and caption bar height
TERM_BG, TERM_FG = '#101114', '#D4D4D4'
DEFAULT_COLOR = 0x01000000
PER_PAGE, PAGE_COLS = 12, 3
FPS = 6
GIF_LIMIT = 6 * 1024 * 1024
BLOCKS = {'█': 'full', '▀': 'top', '▄': 'bottom', '▆': 'low3'}
THEME_SHOTS = {'windows7': 'Claude edits a file', 'macos': 'Mac OS X theme', 'ubuntu': 'Ubuntu theme'}

BROWSERS = [
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'microsoft-edge', 'google-chrome', 'chromium', 'chromium-browser',
]


def find_browser() -> str:
    for candidate in [os.environ.get('BROWSER_BIN', '')] + BROWSERS:
        if candidate and (Path(candidate).exists() or shutil.which(candidate)):
            return candidate
    sys.exit('render.py: no Edge, Chrome or Chromium found; set BROWSER_BIN')


def hex_color(value: int):
    """A raster colour as CSS, or None for the terminal's own colour."""
    return None if value >= DEFAULT_COLOR else '#%06X' % value


def esc(text: str) -> str:
    return html.escape(text, quote=True)


def raster_svg(cols: int, rows: int, cells: str) -> str:
    data = base64.b64decode(cells)
    words = struct.unpack('<%dI' % (len(data) // 4), data)
    out = []
    for i in range(min(cols * rows, len(words) // 3)):
        cp, fg, bg = words[3 * i: 3 * i + 3]
        x, y = (i % cols) * CW, (i // cols) * CH
        top, bottom = hex_color(fg), hex_color(bg)
        if cp == 0x2580:
            if top:
                out.append(f'<rect x="{x}" y="{y}" width="{CW}" height="{CH // 2}" fill="{top}"/>')  # colours are #RRGGBB built here
            if bottom:
                out.append(f'<rect x="{x}" y="{y + CH // 2}" width="{CW}" height="{CH // 2}" fill="{bottom}"/>')
            continue
        if bottom:
            out.append(f'<rect x="{x}" y="{y}" width="{CW}" height="{CH}" fill="{bottom}"/>')
        if cp != 0x20:
            out.append(
                f'<text x="{x + CW / 2}" y="{y + CH * 0.72}" fill="{top or TERM_FG}" text-anchor="middle">{esc(chr(cp))}</text>'
            )
    return (
        f'<svg class="r" width="{cols * CW}" height="{rows * CH}" viewBox="0 0 {cols * CW} {rows * CH}" '
        f'shape-rendering="crispEdges">{"".join(out)}</svg>'
    )


def text_of(children) -> str:
    return ''.join(c if isinstance(c, str) else text_of(c.get('children', [])) for c in children or [])


def cells(text: str, wrap: bool) -> str:
    """Characters as fixed-width cells; when wrapping, words stay together."""
    def one(ch: str) -> str:
        # block elements fill the cell in a terminal; a font's glyph may not
        if ch in BLOCKS:
            return f'<i class="{BLOCKS[ch]}"></i>'
        return f'<i>{esc(ch)}</i>' if ch != ' ' else '<i> </i>'
    if not wrap:
        return ''.join(one(ch) for ch in text)
    parts, word = [], ''
    for ch in text:
        if ch == ' ':
            if word:
                parts.append(f'<b class="w">{"".join(one(c) for c in word)}</b>')
                word = ''
            parts.append(one(' '))
        else:
            word += ch
    if word:
        parts.append(f'<b class="w">{"".join(one(c) for c in word)}</b>')
    return ''.join(parts)


def size(value, unit: int):
    if isinstance(value, (int, float)):
        return f'{value * unit}px'
    return value if isinstance(value, str) else None


def node_html(node, rasters) -> str:
    if isinstance(node, str):
        return f'<span class="t">{cells(node, False)}</span>'
    kind = node.get('type')
    props = node.get('props') or {}
    kids = node.get('children') or []
    if kind == 'Raster':
        key = props.get('key')
        cols, rows = int(props.get('columns', 0)), int(props.get('rows', 0))
        cells_b64 = props.get('cells', '')
        latest = rasters.get(key)
        if latest and len(base64.b64decode(latest)) == cols * rows * 12:
            cells_b64 = latest
        return raster_svg(cols, rows, cells_b64)
    if kind == 'Text':
        style = []
        if props.get('color'):
            style.append(f'color:{props["color"]}')
        if props.get('backgroundColor'):
            style.append(f'background:{props["backgroundColor"]}')
        if props.get('bold'):
            style.append('font-weight:700')
        wrap = props.get('wrap') == 'wrap'
        return f'<span class="t{" wrap" if wrap else ""}" style="{esc(";".join(style))}">{cells(text_of(kids), wrap)}</span>'
    # Box, ClientBox (a Client's own drawing, sized as the Client), anything else as a box
    style = ['flex-direction:' + ('column' if props.get('flexDirection') == 'column' else 'row')]
    for prop, unit, css in (('width', CW, 'width'), ('height', CH, 'height'), ('minWidth', CW, 'min-width'), ('minHeight', CH, 'min-height')):
        v = size(props.get(prop), unit)
        if v:
            style.append(f'{css}:{v}')
    if props.get('backgroundColor'):
        style.append(f'background:{props["backgroundColor"]}')
    if props.get('position') == 'absolute':
        style.append('position:absolute')
        for side, unit in (('top', CH), ('bottom', CH), ('left', CW), ('right', CW)):
            if isinstance(props.get(side), (int, float)):
                style.append(f'{side}:{props[side] * unit}px')
    for prop, css in (('justifyContent', 'justify-content'), ('alignItems', 'align-items')):
        if props.get(prop):
            style.append(f'{css}:{props[prop]}')
    for prop, unit, css in (('paddingX', CW, ('padding-left', 'padding-right')), ('paddingY', CH, ('padding-top', 'padding-bottom')),
                            ('marginX', CW, ('margin-left', 'margin-right')), ('marginY', CH, ('margin-top', 'margin-bottom'))):
        if isinstance(props.get(prop), (int, float)):
            style.extend(f'{c}:{props[prop] * unit}px' for c in css)
    if isinstance(props.get('gap'), (int, float)):
        style.append(f'gap:{props["gap"] * CH}px {props["gap"] * CW}px')
    if props.get('display') == 'none':
        style.append('display:none')
    inner = ''.join(node_html(k, rasters) for k in kids)
    border = ''
    if props.get('borderStyle'):
        style.append(f'padding:{CH}px {CW}px')
        radius = '7px' if props['borderStyle'] == 'round' else '1px'
        border_style = f'border-color:{props.get("borderColor", TERM_FG)};border-radius:{radius}'
        border = f'<div class="bd" style="{esc(border_style)}"></div>'
    return f'<div class="box" style="{esc(";".join(style))}">{border}{inner}</div>'


def frame_html(frame, index: int, total: int, caption: bool, cols: int, rows: int) -> str:
    cap = ''
    if caption:
        cap = (
            f'<div class="cap"><span class="n">{index + 1:>3}/{total}</span>'
            f'<span>{esc(frame["caption"])}</span></div>'
        )
    pane = node_html(frame['tree'], frame.get('rasters', {}))
    return f'<div class="frame{" bare" if not caption else ""}">{cap}<div class="pane" style="width:{cols * CW}px;height:{rows * CH}px">{pane}</div></div>'


def page_html(body: str, cols_per_row: int, fw: int) -> str:
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
html, body {{ background: {TERM_BG}; overflow: hidden; }}
.page {{ display: grid; grid-template-columns: repeat({cols_per_row}, {fw}px); }}
.frame {{ padding: {PAD}px; background: {TERM_BG}; display: flex; flex-direction: column; }}
.cap {{ height: {CAP_H}px; display: flex; align-items: center; gap: 10px; color: #F4F4F5;
        font: 600 15px "Segoe UI", "Helvetica Neue", Arial, sans-serif; }}
.cap .n {{ font: 600 12px Consolas, monospace; color: #9CA3AF; background: #23252B; border-radius: 4px; padding: 2px 6px; }}
.pane {{ position: relative; overflow: hidden; background: {TERM_BG}; color: {TERM_FG};
         font-family: "Cascadia Mono", Consolas, "DejaVu Sans Mono", Menlo, monospace; font-size: {FONT_PX}px; line-height: {CH}px; }}
.box {{ display: flex; position: relative; flex-shrink: 0; overflow: hidden; }}
.bd {{ position: absolute; inset: {CH // 2}px {CW // 2}px; border: 2px solid; pointer-events: none; }}
.t {{ display: flex; flex-wrap: nowrap; white-space: pre; overflow: hidden; min-width: 0; flex-shrink: 1; height: {CH}px; }}
.t.wrap {{ flex-wrap: wrap; height: auto; }}
.t i {{ display: block; flex: none; width: {CW}px; height: {CH}px; text-align: center; font-style: normal; overflow: visible; }}
.t b.w {{ display: flex; flex: none; font-weight: inherit; }}
.t i.full {{ background: currentColor; }}
.t i.top {{ background: linear-gradient(currentColor 50%, transparent 50%); }}
.t i.bottom {{ background: linear-gradient(transparent 50%, currentColor 50%); }}
.t i.low3 {{ background: linear-gradient(transparent 25%, currentColor 25%); }}
svg.r {{ flex: none; display: block; font-family: "Cascadia Mono", Consolas, monospace; font-size: {FONT_PX}px; }}
</style></head><body><div class="page">{body}</div></body></html>'''


def screenshot(browser: str, page: Path, out: Path, width: int, height: int, scale: int = 1) -> None:
    subprocess.run(
        [browser, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--mute-audio',
         f'--user-data-dir={(page.parent / "browser-profile").resolve()}',
         f'--force-device-scale-factor={scale}', f'--window-size={width},{height}',
         f'--screenshot={out.resolve()}', page.resolve().as_uri()],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120,
    )
    if not out.exists():
        sys.exit(f'render.py: the browser wrote no screenshot for {page}')


def ffmpeg(*args: str) -> None:
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *args], check=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('log')
    parser.add_argument('out')
    parser.add_argument('--work', default='.demo/render')
    args = parser.parse_args()

    frames = [json.loads(line[6:]) for line in Path(args.log).read_text(encoding='utf-8').splitlines() if line.startswith('FRAME ')]
    if not frames:
        sys.exit('render.py: no FRAME lines in the log')
    tree = frames[0]['tree']['props']
    cols = int(tree.get('width', 46))
    rows = 24
    fw, fh = cols * CW + 2 * PAD, CAP_H + rows * CH + 2 * PAD
    work, out = Path(args.work), Path(args.out)
    shutil.rmtree(work, ignore_errors=True)
    (work / 'frames').mkdir(parents=True)
    out.mkdir(parents=True, exist_ok=True)
    browser = find_browser()

    # the GIF: pages of frames, screenshotted, cropped one frame at a time
    n = 0
    for start in range(0, len(frames), PER_PAGE):
        batch = frames[start:start + PER_PAGE]
        body = ''.join(frame_html(f, start + i, len(frames), True, cols, rows) for i, f in enumerate(batch))
        page = work / f'page{start // PER_PAGE:02d}.html'
        page.write_text(page_html(body, PAGE_COLS, fw), encoding='utf-8')
        page_rows = (len(batch) + PAGE_COLS - 1) // PAGE_COLS
        shot = work / f'page{start // PER_PAGE:02d}.png'
        screenshot(browser, page, shot, PAGE_COLS * fw, page_rows * fh)
        for i in range(len(batch)):
            x, y = (i % PAGE_COLS) * fw, (i // PAGE_COLS) * fh
            ffmpeg('-i', str(shot), '-vf', f'crop={fw}:{fh}:{x}:{y}', str(work / 'frames' / f'{n:03d}.png'))
            n += 1
    gif = out / 'demo.gif'
    palette = work / 'palette.png'
    ffmpeg('-framerate', str(FPS), '-i', str(work / 'frames' / '%03d.png'), '-vf', 'palettegen=max_colors=256:stats_mode=full', str(palette))
    ffmpeg('-framerate', str(FPS), '-i', str(work / 'frames' / '%03d.png'), '-i', str(palette),
           '-lavfi', 'paletteuse=dither=none:diff_mode=rectangle', '-loop', '0', str(gif))
    size_bytes = gif.stat().st_size
    print(f'render.py: {gif} {n} frames, {size_bytes / 1024 / 1024:.2f} MB')
    if size_bytes > GIF_LIMIT:
        sys.exit('render.py: the GIF is over 6 MB')

    # the theme screenshots, at 2x, no caption
    for theme, caption in THEME_SHOTS.items():
        pick = [f for f in frames if f['theme'] == theme and f['caption'].startswith(caption)]
        if not pick:
            sys.exit(f'render.py: no frame for the {theme} screenshot')
        frame = pick[len(pick) // 2]
        page = work / f'theme-{theme}.html'
        page.write_text(page_html(frame_html(frame, 0, 1, False, cols, rows), 1, cols * CW + 2 * PAD), encoding='utf-8')
        screenshot(browser, page, out / f'theme-{theme}.png', cols * CW + 2 * PAD, rows * CH + 2 * PAD, scale=2)
        print(f'render.py: {out / f"theme-{theme}.png"}')


if __name__ == '__main__':
    main()
