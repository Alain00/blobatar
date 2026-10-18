"""OKLCh color system — ported from color.ts."""
import math


def _linearize(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _gamma(c: float) -> float:
    if c <= 0.0031308:
        return 12.92 * c
    return 1.055 * (c ** (1 / 2.4)) - 0.055


def oklch_to_srgb(l: float, c: float, h: float) -> list:
    """OKLCh → [r, g, b] linear. May be out of gamut."""
    h_rad = h * math.pi / 180
    o = c * math.cos(h_rad)
    a = c * math.sin(h_rad)
    l_ = l + 0.3963377774 * o + 0.2158037573 * a
    m = l - 0.1055613458 * o - 0.0638541728 * a
    s = l - 0.0894841775 * o - 1.291485548 * a
    l3, m3, s3 = l_*l_*l_, m*m*m, s*s*s
    return [
        4.0767416621*l3 - 3.3077115913*m3 + 0.2309699292*s3,
        -1.2684380046*l3 + 2.6097574011*m3 - 0.3413193965*s3,
        -0.0041960863*l3 - 0.7034186147*m3 + 1.707614701*s3,
    ]


def _in_gamut(rgb: list) -> bool:
    return all(-0.0001 <= v <= 1.0001 for v in rgb)


def oklch_to_srgb_clamped(l: float, c: float, h: float) -> list:
    """OKLCh → sRGB with gamut mapping (binary search on chroma)."""
    rgb = oklch_to_srgb(l, c, h)
    if _in_gamut(rgb):
        return rgb
    lo, hi = 0.0, c
    for _ in range(12):
        mid = (lo + hi) / 2
        rgb = oklch_to_srgb(l, mid, h)
        if _in_gamut(rgb):
            lo = mid
        else:
            hi = mid
    return oklch_to_srgb(l, lo, h)


def _relative_luminance(rgb: list) -> float:
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]


def contrast_ratio(rgb1: list, rgb2: list) -> float:
    l1 = _relative_luminance(rgb1)
    l2 = _relative_luminance(rgb2)
    return (max(l1, l2) + 0.05) / (min(l1, l2) + 0.05)


def _ensure_contrast(fg: dict, bg: dict, min_ratio: float) -> dict:
    """Adjust fg lightness until contrast ratio met. Binary search on lightness."""
    fg_rgb = oklch_to_srgb_clamped(fg['l'], fg['c'], fg['h'])
    bg_rgb = oklch_to_srgb_clamped(bg['l'], bg['c'], bg['h'])
    if contrast_ratio(fg_rgb, bg_rgb) >= min_ratio:
        return fg

    direction = 1 if fg['l'] >= bg['l'] else -1
    for d in [direction, -direction]:
        candidate = dict(fg)
        for _ in range(60):
            candidate['l'] = min(1, max(0, candidate['l'] + d * 0.02))
            rgb = oklch_to_srgb_clamped(candidate['l'], candidate['c'], candidate['h'])
            if contrast_ratio(rgb, bg_rgb) >= min_ratio:
                return candidate
            if candidate['l'] in (0, 1):
                break

    dark = dict(fg, l=0, c=0)
    light = dict(fg, l=1, c=0)
    dr = oklch_to_srgb_clamped(dark['l'], dark['c'], dark['h'])
    lr = oklch_to_srgb_clamped(light['l'], light['c'], light['h'])
    return dark if contrast_ratio(dr, bg_rgb) >= contrast_ratio(lr, bg_rgb) else light


def rgb_to_hex(rgb: list) -> str:
    def to_byte(v):
        v = max(0, min(1, v))
        lin = 12.92 * v if v <= 0.0031308 else 1.055 * (v ** (1/2.4)) - 0.055
        return max(0, min(255, round(lin * 255)))
    return "#" + "".join(f"{to_byte(v):02x}" for v in rgb)


def hex_to_oklch(hex_color: str) -> dict:
    e = int(hex_color[1:], 16)
    r, g, b = [(e >> 16) & 255, (e >> 8) & 255, e & 255]
    rgb = [_linearize(c / 255) for c in [r, g, b]]
    l = math.cbrt(0.4122214708*rgb[0] + 0.5363325363*rgb[1] + 0.0514459929*rgb[2])
    m = math.cbrt(0.2119034982*rgb[0] + 0.6806995451*rgb[1] + 0.1073969566*rgb[2])
    s = math.cbrt(0.0883024619*rgb[0] + 0.2817188376*rgb[1] + 0.6299787005*rgb[2])
    i = 1.9779984951*l - 2.428592205*m + 0.4505937099*s
    j = 0.0259040371*l + 0.7827717662*m - 0.808675766*s
    return {
        'l': 0.2104542553*l + 0.793617785*m - 0.0040720468*s,
        'c': math.hypot(i, j),
        'h': math.atan2(j, i) * 180 / math.pi,
    }


_SWATCHES = [
    (0.2,  {'l': 0.86, 'c': 0.085}),
    (0.36, {'l': 0.9,  'c': 0.028}),
    (0.62, {'l': 0.73, 'c': 0.135}),
    (0.8,  {'l': 0.62, 'c': 0.165}),
    (0.93, {'l': 0.87, 'c': 0.16}),
    (1.0,  {'l': 0.34, 'c': 0.035}),
]

_DARK = {'l': 0.145, 'c': 0, 'h': 0}
_DARK_RATIO = 1.5
_CONTRAST = [('head', 'bg', 1.25), ('eye', 'head', 4.5)]


def palette(hue: float, contrast: bool = True, tone: float = 0) -> dict:
    """Generate palette. Matches color.ts palette()."""
    swatch_l, swatch_c = 0.86, 0.085
    for upper, s in _SWATCHES:
        if tone < upper:
            swatch_l, swatch_c = s['l'], s['c']
            break

    head = {'l': swatch_l, 'c': swatch_c, 'h': hue}
    head = _ensure_contrast(head, _DARK, _DARK_RATIO)

    if head['l'] >= 0.5:
        eye = {'l': 0.17, 'c': 0.02, 'h': hue}
    else:
        eye = {'l': 0.97, 'c': 0.012, 'h': hue}

    bg = {'l': 0.965, 'c': 0.01, 'h': hue}
    result = {'bg': bg, 'head': head, 'eye': eye}

    if contrast:
        for fg_key, bg_key, ratio in _CONTRAST:
            result[fg_key] = _ensure_contrast(result[fg_key], result[bg_key], ratio)

    return result


def palette_hex(hue: float, contrast: bool = True, tone: float = 0) -> dict:
    """Palette with hex colors."""
    p = palette(hue, contrast, tone)
    return {k: rgb_to_hex(oklch_to_srgb_clamped(v['l'], v['c'], v['h'])) for k, v in p.items()}


def from_hex(hex_color: str) -> dict:
    """Hex → OKLCh. Matches v1 color.ts fromHex()."""
    h = hex_color.lstrip('#')
    if len(h) == 3:
        h = h[0]*2 + h[1]*2 + h[2]*2
    return hex_to_oklch('#' + h)


def mix_hex(a: str, b: str, t: float) -> str:
    """Mix two hex colors in OKLCh space. Matches v1 color.ts mixHex()."""
    a_ok = from_hex(a)
    b_ok = from_hex(b)
    import math
    a_rad = a_ok['h'] * math.pi / 180
    b_rad = b_ok['h'] * math.pi / 180
    a_x = a_ok['c'] * math.cos(a_rad)
    a_y = a_ok['c'] * math.sin(a_rad)
    b_x = b_ok['c'] * math.cos(b_rad)
    b_y = b_ok['c'] * math.sin(b_rad)
    mx = a_x + (b_x - a_x) * t
    my = a_y + (b_y - a_y) * t
    ml = a_ok['l'] + (b_ok['l'] - a_ok['l']) * t
    mc = (mx ** 2 + my ** 2) ** 0.5
    mh = math.atan2(my, mx) * 180 / math.pi
    return rgb_to_hex(oklch_to_srgb_clamped(ml, mc, mh))
