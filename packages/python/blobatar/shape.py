"""Shape geometry — superellipse, polygon, blob path. Ported from shape.ts."""
import math


def _round(v: float) -> str:
    """Round to 2 decimal places, matching JS Math.round(v*100)/100."""
    return f"{round(v, 2):g}"


def superellipse(params: dict) -> str:
    """Generate a superellipse SVG path. Matches shape.ts P().

    params: {cx, cy, rx, ry, n=4, rot=0}
    """
    cx = params['cx']
    cy = params['cy']
    rx = params['rx']
    ry = params['ry']
    n = params.get('n', 4)
    rot = params.get('rot', 0)

    s = min(1, (8 * 2**(-1/n) - 4) / 3)
    c_x = rx
    c_y = ry
    l_x = c_x * s
    l_y = c_y * s

    # 12 control points
    u = [
        [c_x, 0], [c_x, l_y], [l_x, c_y],
        [0, c_y], [-l_x, c_y], [-c_x, l_y],
        [-c_x, 0], [-c_x, -l_y], [-l_x, -c_y],
        [0, -c_y], [l_x, -c_y], [c_x, -l_y],
        [c_x, 0]
    ]

    b = rot * math.pi / 180
    cos_b = math.cos(b)
    sin_b = math.sin(b)

    def pt(i):
        gx, gy = u[i]
        x = cx + gx * cos_b - gy * sin_b
        y = cy + gx * sin_b + gy * cos_b
        return f"{_round(x)} {_round(y)}"

    path = f"M{pt(0)}"
    for x in range(1, 13, 3):
        path += f"C{pt(x)} {pt(x+1)} {pt(x+2)}"
    return path + "Z"


def organic_path(params: dict) -> str:
    """Spline-based blob path. Matches shape.ts et()/bt()."""
    cx = params['cx']
    cy = params['cy']
    rx = params['rx']
    ry = params['ry']
    radii = params['radii']
    rot = params.get('rot', 0)

    s = len(radii)
    c = rot * math.pi / 180

    # Points on the perimeter
    points = []
    for i in range(s):
        angle = c + 2 * math.pi * i / s
        points.append([
            cx + rx * radii[i] * math.cos(angle),
            cy + ry * radii[i] * math.sin(angle)
        ])

    def get(idx):
        return points[idx % s]

    path = f"M{_round(get(0)[0])} {_round(get(0)[1])}"
    for i in range(s):
        prev = get(i - 1)
        curr = get(i)
        nxt = get(i + 1)
        after = get(i + 2)
        path += f"C{_round(curr[0] + (nxt[0] - prev[0]) / 6)} {_round(curr[1] + (nxt[1] - prev[1]) / 6)} "
        path += f"{_round(nxt[0] - (after[0] - curr[0]) / 6)} {_round(nxt[1] - (after[1] - curr[1]) / 6)} "
        path += f"{_round(nxt[0])} {_round(nxt[1])}"
    return path + "Z"


def polygon_path(params: dict) -> str:
    """Regular polygon path. Matches shape.ts nt()."""
    cx = params['cx']
    cy = params['cy']
    rx = params['rx']
    ry = params['ry']
    sides = params['sides']
    round_ = params.get('round', 0.3)
    rot = params.get('rot', 0)

    c = round_ / 2 if (round_ > 0 and round_ < 1) else (0.5 if round_ >= 1 else 0)
    angle_start = rot * math.pi / 180 - math.pi / 2

    pts = []
    for i in range(sides):
        a = angle_start + 2 * math.pi * i / sides
        pts.append([cx + rx * math.cos(a), cy + ry * math.sin(a)])

    def get(idx):
        return pts[idx % sides]

    def pt(p, q):
        pp = get(p)
        qq = get(q)
        x = pp[0] + (qq[0] - pp[0]) * c
        y = pp[1] + (qq[1] - pp[1]) * c
        return f"{_round(x)} {_round(y)}"

    path = f"M{pt(0, -1)}"
    for i in range(sides):
        d = get(i)
        path += f"Q{_round(d[0])} {_round(d[1])} {pt(i, i + 1)}"
        if c < 0.5:
            path += f"L{pt(i + 1, i)}"
    return path + "Z"


def box_path(params: dict) -> str:
    """Stadium/capsule path. Matches shape.ts rt()."""
    cx = params['cx']
    cy = params['cy']
    rx = params['rx']
    ry = params['ry']
    return f"M{_round(cx - rx)} {_round(cy - ry)}H{_round(cx + rx)}V{_round(cy + ry)}H{_round(cx - rx)}Z"


def droplet_tip(params: dict) -> str:
    """Droplet's tapered tip path. Matches shape.ts ot()."""
    cx = params['cx']
    cy = params['cy']
    rx = params['rx']
    ry = params['ry']
    tip = params['tip']

    r = max(1.05, tip)
    s = rx * math.sqrt(1 - 1 / (r * r))
    top = cy - ry / r
    bottom = cy - r * ry
    lx = s * 0.14
    mid = top + 0.86 * (bottom - top)

    return (f"M{_round(cx - s)} {_round(top)}L{_round(cx - lx)} {_round(mid)}"
            f"Q{_round(cx)} {_round(bottom)} {_round(cx + lx)} {_round(mid)}"
            f"L{_round(cx + s)} {_round(top)}Z")
