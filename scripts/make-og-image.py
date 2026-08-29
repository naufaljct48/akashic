"""
Generates public/og-image.png — the link preview card.

Rendered rather than hand-drawn so it stays in step with the design system:
the palette below is copied from the light-mode tokens in src/index.css, and
the type is the app's own Anton and Plus Jakarta Sans, decompressed from the
self-hosted woff2 files rather than substituted.

Run: python scripts/make-og-image.py
"""
import io
import os
import tempfile

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630  # the size Facebook, X, WhatsApp and Slack all read

# --- palette, from src/index.css :root (light) ---
PAPER = (228, 221, 205)      # --paper
SHEET = (239, 233, 220)      # --paper-sheet
INK = (22, 19, 15)           # --ink
INK_SOFT = (76, 68, 58)      # --ink-soft
INK_FAINT = (102, 92, 77)    # --ink-faint
RULE = (176, 166, 145)       # --rule
SPOT = (193, 0, 92)          # --ink-magenta, the default spot

FONT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'fonts')


def load(woff2_name, size):
    """woff2 is a web format Pillow cannot read; unpack it to a real TTF."""
    src = os.path.join(FONT_DIR, woff2_name)
    font = TTFont(src)  # fontTools decompresses woff2 transparently (needs brotli)
    buf = io.BytesIO()
    font.flavor = None
    font.save(buf)
    buf.seek(0)
    tmp = tempfile.NamedTemporaryFile(suffix='.ttf', delete=False)
    tmp.write(buf.read())
    tmp.close()
    return ImageFont.truetype(tmp.name, size)


anton = lambda s: load('anton-normal-latin.woff2', s)
jakarta = lambda s: load('jakarta-normal-latin.woff2', s)

img = Image.new('RGB', (W, H), PAPER)
d = ImageDraw.Draw(img)

# --- halftone screen, the signature texture: a 3px dot grid at low contrast ---
for y in range(0, H, 3):
    for x in range(0, W, 3):
        d.point((x, y), fill=(215, 208, 192))

# --- the sheet, inset, with a heavy keyline ---
M = 46
d.rectangle([M, M, W - M, H - M], fill=SHEET, outline=INK, width=3)

PAD = M + 44
top = M + 34

# --- issue strip: small caps, letterspaced by hand (Pillow has no tracking) ---
def stamp(draw, xy, text, font, fill, tracking=3):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + tracking
    return x


f_stamp = jakarta(15)
stamp(d, (PAD, top), 'WEEKLY EDITION', f_stamp, INK_FAINT)
stamp(d, (PAD + 178, top), '/', f_stamp, RULE)
stamp(d, (PAD + 202, top), 'MANGA · MANHWA · MANHUA', f_stamp, INK_FAINT)

right = '17,900+ TITLES ON FILE'
rw = sum(d.textlength(c, font=f_stamp) + 3 for c in right)
stamp(d, (W - PAD - rw, top), right, f_stamp, INK_FAINT)

d.line([(PAD, top + 30), (W - PAD, top + 30)], fill=INK, width=3)

# --- masthead ---
f_mast = anton(112)
d.text((PAD, top + 52), 'AKASHIC DEX', font=f_mast, fill=INK)

# --- the demonstration: a query nothing could keyword-match ---
y = top + 206
f_lead = jakarta(25)
d.text((PAD, y), 'Ketik ceritanya, bukan judulnya.', font=f_lead, fill=INK_SOFT)

y += 58
f_query = jakarta(31)
# The spot bar in the margin — the same cursor the finder prints beside a row.
d.rectangle([PAD, y + 4, PAD + 5, y + 82], fill=SPOT)
d.text((PAD + 26, y), '“cerita tentang raksasa yang memakan', font=f_query, fill=INK)
d.text((PAD + 26, y + 42), 'manusia di balik tembok”', font=f_query, fill=INK)

y += 102
f_ans = anton(46)

# Anton is a display face with no arrow glyph — it renders as tofu. Draw one.
ax, ay = PAD + 26, y + 24
d.line([(ax, ay), (ax + 38, ay)], fill=SPOT, width=5)
d.polygon([(ax + 34, ay - 11), (ax + 52, ay), (ax + 34, ay + 11)], fill=SPOT)
d.text((ax + 72, y), 'ATTACK ON TITAN', font=f_ans, fill=SPOT)

# --- the publication's device ---
#
# The same geometry as public/favicon.svg, drawn at 32-unit scale and mapped up:
# hexagonal grimoire, angular A, knocked-out aperture, spot-colour spark, rule.
# Redrawn rather than pasted because the original mark is a crimson gradient
# with a drop-shadow glow — a language this sheet does not speak.
LOGO, LX, LY = 168, W - PAD - 168, top + 176


def u(px, py):
    """32-unit design space -> canvas."""
    return (LX + px * LOGO / 32.0, LY + py * LOGO / 32.0)


hexagon = [u(16, 2), u(29, 9.5), u(29, 22.5), u(16, 30), u(3, 22.5), u(3, 9.5)]
d.polygon(hexagon, fill=PAPER, outline=INK)
d.line(hexagon + [hexagon[0]], fill=INK, width=max(2, LOGO // 24), joint='curve')

d.polygon(
    [u(16, 6), u(24, 22), u(19.5, 22), u(17.5, 17.5), u(14.5, 17.5), u(12.5, 22), u(8, 22)],
    fill=INK,
)
d.polygon([u(16, 11), u(18.2, 15.5), u(13.8, 15.5)], fill=PAPER)

cx, cy = u(16, 13.6)
r = 1.15 * LOGO / 32.0
d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=SPOT)

d.line([u(8, 24.6), u(24, 24.6)], fill=INK, width=max(2, LOGO // 26))

# --- folio ---
fy = H - M - 58
d.line([(PAD, fy), (W - PAD, fy)], fill=RULE, width=2)
f_folio = jakarta(17)
stamp(d, (PAD, fy + 18), 'AKASHIC-DEX.VERCEL.APP', f_folio, INK_FAINT)
tail = 'GRATIS · TANPA AKUN'
tw = sum(d.textlength(c, font=f_folio) + 3 for c in tail)
stamp(d, (W - PAD - tw, fy + 18), tail, f_folio, INK_FAINT)

out = os.path.join(os.path.dirname(__file__), '..', 'public', 'og-image.png')
img.save(out, 'PNG', optimize=True)
print('wrote %s (%d bytes, %dx%d)' % (os.path.abspath(out), os.path.getsize(out), W, H))
