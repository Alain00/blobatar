"""Flask adapter — mirrors apps/api/src/avatar.ts endpoint behavior."""
from hashlib import md5
from flask import Blueprint, Response, request, current_app, g
from .blobatar import blobatar as _blobatar
from .traits import traits as _traits

def _etag(body: str) -> str:
    """FNV-1a over UTF-16 code units, base36 — matches apps/api avatar.ts etag()."""
    h = 0x811C9DC5
    units = body.encode("utf-16-le")
    for i in range(0, len(units), 2):
        h ^= units[i] | (units[i + 1] << 8)
        h = (h * 0x01000193) & 0xFFFFFFFF
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    out = []
    while h:
        h, r = divmod(h, 36)
        out.append(digits[r])
    return '"' + ("".join(reversed(out)) or "0") + '"'


blobatar_bp = Blueprint("blobatar", __name__)

# Gravatar params we accept but ignore (parity with upstream endpoint)
IGNORED = {"d", "default", "f", "forcedefault", "r", "rating"}

USAGE = (
    "Parameters: size (8-1024), background (none|square|circle|squircle), "
    "hue (0-360), tone (0-1), expression (idle|happy|sad|mad|surprised|"
    "wink|sleepy|smug|unsure|scared|love|shy|sick|thinking), "
    "title (≤128 chars), gen (1|2)\n"
    "Each parameter is optional; defaults produce a deterministic avatar "
    "for the given name."
)

# Pin gen=1 — map our gen=2 render via gen parameter
GEN_PARAM = "gen"

def _error(status, message):
    body = f"{message}\n"
    return Response(body, status=status, content_type="text/plain; charset=utf-8")

def _svg_response(svg, gen=None):
    body = svg.encode("utf-8")
    etag = _etag(svg)
    pinned = GEN_PARAM in request.args
    cache = "public, max-age=31536000, immutable" if pinned else \
            "public, max-age=86400, stale-while-revalidate=2592000"
    inm = request.headers.get("If-None-Match", "")
    if inm == etag:
        return Response(status=304)
    headers = {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": cache,
        "ETag": etag,
        "Access-Control-Allow-Origin": "*",
        "Vary": "Accept",
    }
    return Response(body, headers=headers)


@blobatar_bp.route("/avatar")
def avatar_root():
    return Response(USAGE, content_type="text/plain; charset=utf-8")


@blobatar_bp.route("/avatar/<name>")
def avatar(name: str):
    # Filter ignored Gravatar params from the unknown check
    unknown = [k for k in request.args if k not in (
        "s", "size", "background", "hue", "tone",
        "expression", "title", GEN_PARAM, *IGNORED,
    )]
    if unknown:
        return _error(400, f'Unknown parameter: {", ".join(unknown)}')

    # Validate gen parameter
    gen = request.args.get(GEN_PARAM, "2")
    if gen not in ("1", "2"):
        return _error(400, "gen must be 1 or 2")

    # Size — clamp like upstream (don't reject out-of-range)
    size = None
    raw = request.args.get("s") or request.args.get("size")
    if raw:
        try:
            size = max(8, min(1024, int(raw)))
        except ValueError:
            return _error(400, "size must be an integer")

    # Hue
    hue = None
    raw = request.args.get("hue")
    if raw:
        try:
            hue = float(raw)
        except ValueError:
            return _error(400, "hue must be a number")
        if not (0 <= hue <= 360):
            return _error(400, "hue must be 0-360")

    # Tone
    tone = None
    raw = request.args.get("tone")
    if raw:
        try:
            tone = float(raw)
        except ValueError:
            return _error(400, "tone must be a number")
        if not (0 <= tone <= 1):
            return _error(400, "tone must be 0-1")

    # Background
    bg = request.args.get("background")
    if bg and bg not in ("none", "square", "circle", "squircle"):
        return _error(400, "background must be none|square|circle|squircle")
    background = bg if bg and bg != "none" else None

    # Expression
    expr = request.args.get("expression")
    if expr and expr not in ("idle", "happy", "sad", "mad", "surprised", "wink",
                             "sleepy", "smug", "unsure", "scared", "love", "shy",
                             "sick", "thinking"):
        return _error(400, "expression: idle|happy|sad|mad|surprised|wink|sleepy|smug|unsure|scared|love|shy|sick|thinking")

    # Title
    title = request.args.get("title")
    if title and len(title) > 128:
        return _error(400, "title must be ≤128 characters")

    try:
        svg = _blobatar(
            name,
            size=size,
            background=background,
            hue=hue,
            tone=tone,
            expression=expr,
            title=title,
        )
    except Exception as exc:
        return _error(500, f"blobatar error: {exc}")

    return _svg_response(svg, gen=gen)


def init_app(app):
    app.register_blueprint(blobatar_bp)
    app.jinja_env.filters["blobatar"] = blobatar_filter


def blobatar_filter(name, size=200, **kwargs):
    svg = _blobatar(name, size=size, **kwargs)
    return svg


def blobatar_uri(name, **kwargs):
    import base64
    svg = _blobatar(name, **kwargs)
    encoded = base64.b64encode(svg.encode("utf-8")).decode("ascii")
    return f"data:image/svg+xml;base64,{encoded}"
