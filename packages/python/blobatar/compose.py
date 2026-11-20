"""Compose system — layout + render. Ported from styles/compose.ts, styles/blob.ts, styles/shapes.ts."""
import math
from .shape import superellipse, organic_path, polygon_path, box_path, droplet_tip
from .traits import traits as _traits


def _r2(v):
    if v == -0: return "0"
    return f"{round(v, 2):g}"


# --- Shape definitions ---

def _shrunk(k):
    def fn(b):
        return {'cx': b['cx'], 'cy': b['cy'], 'rx': b['rx'] * k, 'ry': b['ry'] * k}
    return fn

def _spline_face(b):
    return _shrunk(min(b['radii']) * 0.95)(b)

def _poly_face(b):
    return _shrunk(0.84)(b)

_round = {'name': 'round', 'core': 1}
_organic = {'name': 'organic', 'core': 0.98,
            'path': lambda b: organic_path({'cx': b['cx'], 'cy': b['cy'], 'rx': b['rx'], 'ry': b['ry'], 'radii': b['radii'], 'rot': b.get('rot', 0)}),
            'face': _spline_face}
_boxy = {'name': 'boxy', 'core': 0.86,
         'body': lambda t, b: (b.__setitem__('n', t.num('body.n', 3.4, 6)), b.__setitem__('rot', t.num('body.rot', -20, 20)))}
_capsule = {'name': 'capsule', 'core': 1.02,
            'body': lambda t, b: b.__setitem__('ry', b['ry'] * t.num('capsule.squat', 0.55, 0.68)),
            'face': _shrunk(0.94),
            'decorate': lambda t, b, out: [out['petals'].append({'cx': b['cx'] + s * (b['rx'] - b['ry']), 'cy': b['cy'], 'r': b['ry']}) for s in [-1, 1]],
            'path': lambda b: box_path({'cx': b['cx'], 'cy': b['cy'], 'rx': b['rx'] - b['ry'], 'ry': b['ry']})}
_nub = {'name': 'nub', 'core': 0.88,
        'decorate': lambda t, b, out: [
            out['petals'].append({
                'cx': b['cx'] + math.cos(t.num(f'nub.a{i}', 0, 2 * math.pi)) * b['rx'] * 0.88,
                'cy': b['cy'] + math.sin(t.num(f'nub.a{i}', 0, 2 * math.pi)) * b['rx'] * 0.88,
                'r': b['rx'] * t.num(f'nub.r{i}', 0.24, 0.4)
            }) for i in range(t.int_('nub.n', 1, 2))
        ]}
_cloud = {'name': 'cloud', 'core': 0.78, 'face': _spline_face,
           'path': lambda b: organic_path({'cx': b['cx'], 'cy': b['cy'], 'rx': b['rx'], 'ry': b['ry'], 'radii': b['radii'], 'rot': b.get('rot', 0)}),
           'decorate': lambda t, b, out: [
               out['petals'].append({
                   'cx': b['cx'] + math.cos(math.pi + math.pi * (i + 0.5) / count) * b['rx'] * 0.8,
                   'cy': b['cy'] + math.sin(math.pi + math.pi * (i + 0.5) / count) * b['rx'] * 0.5,
                   'r': b['rx'] * t.num(f'cloud.r{i}', 0.44, 0.62)
               }) for i, count in enumerate([t.int_('cloud.n', 4, 6)])
               for _ in [None]  # just to make the list comp work
           ]}

# Fix cloud decorate to work correctly
def _cloud_decorate(t, b, out):
    count = t.int_('cloud.n', 4, 6)
    for i in range(count):
        a = math.pi + math.pi * (i + 0.5) / count
        out['petals'].append({
            'cx': b['cx'] + math.cos(a) * b['rx'] * 0.8,
            'cy': b['cy'] + math.sin(a) * b['rx'] * 0.5,
            'r': b['rx'] * t.num(f'cloud.r{i}', 0.44, 0.62)
        })

_cloud['decorate'] = _cloud_decorate

_droplet = {'name': 'droplet', 'core': 0.78,
            'body': lambda t, b: (b.__setitem__('cy', b['cy'] + 0.22 * b['ry']), b.__setitem__('n', 2)),
            'face': lambda b: {'cx': b['cx'], 'cy': b['cy'] + b['ry'] * 0.05, 'rx': b['rx'] * 0.88, 'ry': b['ry'] * 0.88},
            'decorate': lambda t, b, out: out['extra'].append(
                droplet_tip({'cx': b['cx'], 'cy': b['cy'], 'rx': b['rx'], 'ry': b['ry'], 'tip': t.num('droplet.tip', 1.4, 1.65)})
            )}
_hexagon = {'name': 'hexagon', 'core': 1.05, 'face': _poly_face,
             'body': lambda t, b: (b.__setitem__('sides', 6), b.__setitem__('rot', t.num('body.rot', -12, 12)), b.__setitem__('round', t.num('poly.round', 0.24, 0.5))),
             'path': lambda b: polygon_path({'cx': b['cx'], 'cy': b['cy'], 'rx': b['rx'], 'ry': b['ry'], 'sides': b['sides'], 'round': b.get('round', 0.3), 'rot': b.get('rot', 0)})}
_sun = {'name': 'sun', 'core': 0.7,
        'decorate': lambda t, b, out: [
            out['petals'].append({
                'cx': b['cx'] + math.cos(t.num('sun.rot', 0, 2 * math.pi) + 2 * math.pi * i / count) * b['rx'] * t.num('sun.dist', 1.0, 1.08),
                'cy': b['cy'] + math.sin(t.num('sun.rot', 0, 2 * math.pi) + 2 * math.pi * i / count) * b['rx'] * t.num('sun.dist', 1.0, 1.08),
                'r': b['rx'] * t.num('sun.r', 0.2, 0.26)
            }) for i, count in enumerate([t.int_('sun.n', 6, 9)])
            for _ in [None]
        ]}

def _sun_decorate(t, b, out):
    count = t.int_('sun.n', 6, 9)
    dist = b['rx'] * t.num('sun.dist', 1.0, 1.08)
    pr = b['rx'] * t.num('sun.r', 0.2, 0.26)
    off = t.num('sun.rot', 0, 2 * math.pi)
    for i in range(count):
        a = off + 2 * math.pi * i / count
        out['petals'].append({'cx': b['cx'] + math.cos(a) * dist, 'cy': b['cy'] + math.sin(a) * dist, 'r': pr})

_sun['decorate'] = _sun_decorate

_triangle = {'name': 'triangle', 'core': 1.15,
             'body': lambda t, b: (b.__setitem__('sides', 3), b.__setitem__('rot', t.num('body.rot', -5, 5)), b.__setitem__('round', t.num('poly.round', 0.24, 0.5))),
             'face': lambda b: {'cx': b['cx'], 'cy': b['cy'] + b['ry'] * 0.1, 'rx': b['rx'] * 0.54, 'ry': b['ry'] * 0.36},
             'path': lambda b: polygon_path({'cx': b['cx'], 'cy': b['cy'], 'rx': b['rx'], 'ry': b['ry'], 'sides': b['sides'], 'round': b.get('round', 0.3), 'rot': b.get('rot', 0)})}


BANDS = [
    (_round, 0.22), (_organic, 0.48), (_boxy, 0.6), (_capsule, 0.7),
    (_nub, 0.79), (_cloud, 0.86), (_droplet, 0.915), (_hexagon, 0.95),
    (_sun, 0.98), (_triangle, 1),
]



def _pick_shape(v, bands=None):
    for shape, threshold in (bands or BANDS):
        if v < threshold:
            return shape
    return (bands or BANDS)[-1][0]


def _face_fit(t, body, face):
    """Eye cluster fitting. Matches compose.ts faceFit."""
    rx = body['rx']
    er0 = t.num('eye.rx', 0.075, 0.105) * rx
    ratio = t.num('eye.ratio', 1.9, 3.2)
    scale = t.num('eye.scale', 0.78, 1.24)
    stretch = t.num('eye.stretch', 0.85, 1.18)
    clearance = t.num('eye.gap', 0.1, 0.24) * rx
    wide = er0 * max(1, scale)
    tall = er0 * ratio * max(1, scale * stretch)
    gap0 = wide + rx * 0.03 + clearance

    gx = t.jitter('gaze.x', 0.09) * face['rx']
    gy = t.num('gaze.y', -0.2, 0.08) * face['ry']
    dy = t.jitter('eye.dy', 0.04) * face['ry']
    reach = math.hypot(wide, tall)
    need = math.hypot(
        (abs(gx) + gap0 + reach) / face['rx'],
        (abs(gy) + abs(dy) + reach) / face['ry']
    )
    fit = 0.9 / need if need > 0.9 else 1

    er = er0 * fit
    eye_ry = er * ratio
    gap = gap0 * fit
    room = max(0, min(1, clearance / tall))
    bound = min(12, math.asin(room) * 180 / math.pi)
    lean = t.num('eye.lean', -1, 1) * bound
    lean2 = max(-12, min(12, lean + t.jitter('eye.lean2', 3.5)))

    cx = face['cx'] + gx * fit
    cy = face['cy'] + gy * fit
    n = t.num('eye.n', 3.5, 6)
    return [
        {'cx': cx - gap, 'cy': cy, 'rx': er, 'ry': eye_ry, 'n': n, 'rot': lean},
        {'cx': cx + gap, 'cy': cy + dy * fit, 'rx': er * scale, 'ry': eye_ry * scale * stretch, 'n': n, 'rot': lean2},
    ]


def layout(t, bands=None):
    """Compute layout for a trait accessor. Matches compose.ts layout()."""
    shape = _pick_shape(t('shape'), bands)
    r = t.num('body.r', 31, 38) * shape['core']
    body = {
        'cx': 50 + t.jitter('body.x', 1.5),
        'cy': 50 + t.jitter('body.y', 1.5),
        'rx': r,
        'ry': r * t.num('body.ratio', 0.92, 1.08),
        'n': t.num('body.n', 1.9, 2.5),
        'rot': 0,
        'radii': [1 + t.jitter(f'body.r{i}', 0.16) for i in range(t.int_('body.pts', 6, 8))],
    }
    if 'body' in shape and shape['body']:
        shape['body'](t, body)

    face = shape['face'](body) if 'face' in shape and shape['face'] else body
    deco = {'petals': [], 'extra': []}
    if 'decorate' in shape and shape['decorate']:
        shape['decorate'](t, body, deco)

    return {
        'shape': shape['name'],
        'draw': shape.get('path'),
        'body': body,
        'face': face,
        'petals': deco['petals'],
        'extra': deco['extra'],
        'eyes': _face_fit(t, body, face),
    }


def render(l, p, mo=False):
    """Render layout to SVG inner markup. Matches compose.ts render()."""
    def eye(e, i):
        path = f'<path d="{superellipse(e)}"/>'
        if mo:
            return (f'<g class="mo-eye" style="--mo-wrap:{1 if i else -1};'
                    f'--mo-lean:{_r2(e["rot"])};'
                    f'transform-origin:{_r2(e["cx"])}px {_r2(e["cy"])}px">{path}</g>')
        return path

    body_g = f'<g fill="{p["head"]}">'
    for d in l['petals']:
        body_g += f'<circle cx="{_r2(d["cx"])}" cy="{_r2(d["cy"])}" r="{_r2(d["r"])}"/>'
    for d in l['extra']:
        body_g += f'<path d="{d}"/>'
    body_g += f'<path d="{l["draw"](l["body"]) if l["draw"] else superellipse(l["body"])}"/>'
    body_g += '</g>'

    eyes_g = f'<g fill="{p["eye"]}"'
    if mo:
        eyes_g += ' class="mo-eyes"'
    eyes_g += '>'
    for i, e in enumerate(l['eyes']):
        eyes_g += eye(e, i)
    eyes_g += '</g>'

    if mo:
        return f'<g class="mo-breathe"><g class="mo-bob">{body_g}{eyes_g}</g></g>'
    return body_g + eyes_g
