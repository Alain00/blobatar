"""Expressions — 14 face poses. Ported from expression.ts."""

# Identity (idle) values
IDENT = {'esx': 1, 'esy': 1, 'tilt': 0, 'edy': 0, 'edx': 0,
         'esx2': 0, 'esy2': 0, 'tilt2': 0, 'edy2': 0, 'lock': 0,
         'heat': 0, 'shake': 0, 'rock': 0, 'bdy': 0}

# Tint targets (from color.ts)
TINTS = {
    'hot':   {'h': 27,  'l': 0.58, 'pull': 0.6,  'c': 0.18},
    'rose':  {'h': 358, 'l': 0.72, 'pull': 0.55, 'c': 0.16},
    'blush': {'h': 12,  'l': 0.84, 'pull': 0.4,  'c': 0.10},
    'bile':  {'h': 142, 'l': 0.66, 'pull': 0.6,  'c': 0.13},
}


def _pose(**kwargs):
    """Create a pose dict, filling identity defaults."""
    p = dict(IDENT)
    p.update(kwargs)
    return p


# 14 expressions with their pose channels — values match expression.ts exactly
EXPRESSIONS = {
    'idle':       _pose(),

    'happy':      _pose(esx=1.72, esy=0.30, tilt=8, edy=-1.5, edx=1.5,
                        esx2=0.08, esy2=0.05, tilt2=-16, bdy=-2.2, lock=1),
    'sad':        _pose(esx=0.60, esy=0.56, tilt=26, edy=3.6, edx=1.9,
                        esx2=-0.05, esy2=-0.07, tilt2=-7, bdy=2.6, lock=1),
    'mad':        _pose(esx=1.85, esy=0.26, tilt=-33, edy=0.4, edx=0.6,
                        esy2=-0.03, tilt2=5, heat=0.62, shake=0.55,
                        bdy=0.8, lock=1),
    'surprised':  _pose(esx=1.34, esy=1.20, tilt=-6, edy=-1.05, edx=0.5,
                        esx2=0.05, esy2=0.07, tilt2=3, bdy=-1.4, lock=1),
    'wink':       _pose(esx=1.32, esy=0.76, tilt=5, edy=-0.6, edx=0.8,
                        esx2=0.26, esy2=-0.56, tilt2=-11, bdy=-1.1, lock=1),
    'sleepy':     _pose(esx=1.14, esy=0.22, tilt=0, edy=2.4, edx=0.3,
                        esx2=-0.04, esy2=0.03, tilt2=4, bdy=1.2, lock=1),
    'smug':       _pose(esx=1.30, esy=0.42, tilt=18, edy=-0.5, edx=0.5,
                        esx2=0.06, esy2=-0.06, tilt2=-36, bdy=-1, lock=1),
    'unsure':     _pose(esx=0.95, esy=1.02, tilt=4, edy=-0.2, edx=0.3,
                        esx2=0.24, esy2=-0.44, tilt2=-18, lock=1),
    'scared':     _pose(esx=0.78, esy=0.96, tilt=-12, edy=-1.5, edx=-0.8,
                        esx2=-0.04, esy2=0.05, tilt2=4, shake=0.35,
                        bdy=-0.6, lock=1),
    'love':       _pose(esx=0.86, esy=1.28, tilt=-14, edy=-0.5, edx=-0.35,
                        esx2=0.05, esy2=0.06, tilt2=6, heat=0.6,
                        bdy=-1.6, lock=1),
    'shy':        _pose(esx=0.62, esy=0.50, tilt=10, edy=1.4, edx=-0.2,
                        esx2=-0.05, esy2=-0.04, tilt2=-8, heat=0.55,
                        bdy=0.9, lock=1),
    'sick':       _pose(esx=1.25, esy=0.34, tilt=20, edy=1.8, edx=0.8,
                        esx2=0.05, esy2=-0.05, tilt2=-6, heat=0.6,
                        shake=0.18, bdy=1.4, lock=1),
    'thinking':   _pose(esx=1.15, esy=0.62, tilt=0, edy=4.2, edx=0.4,
                        esx2=0.02, esy2=0.06, edy2=-8.4, rock=0.8,
                        bdy=-0.4, lock=1),
}

# Expression → tint name mapping
EXPRESSION_TINT = {
    'mad': 'hot',
    'love': 'rose',
    'shy': 'blush',
    'sick': 'bile',
}


def expression_vars(pose: dict) -> dict:
    """Convert pose channels to CSS custom property strings.
    Skips identity channels (matching poseVars() in animate.ts).
    """
    vars_ = {}
    for k, v in pose.items():
        if k in ('heat',):  # heat is resolved in Python, not CSS
            continue
        if IDENT.get(k, 0) == v:
            continue  # skip identity
        if k in ('shake', 'rock', 'bdy'):
            vars_[f'--mo-{k}'] = str(round(v, 3))
        else:
            vars_[f'--mo-{k}'] = str(round(v, 3))
    return vars_


# --- Static pose baking (matches morph.ts bakePose) ---

def _r3(v):
    """Three-decimal-place rounding, matching upstream r3()."""
    return str(round(v * 1000) / 1000)


def bake_pose(layout, pose):
    """Bake expression pose into geometry for static rendering.

    Matches upstream morph.ts bakePose(): eye channels baked into cx/cy/rx/ry/rot,
    body channel (bdy) returned as a wrap transform string.
    """
    new_eyes = []
    for i, e in enumerate(layout["eyes"]):
        is_right = 1 if i else 0
        new_eyes.append({
            **e,
            "cx": e["cx"] + pose.get("edx", 0) * (-1 if not i else 1),
            "cy": e["cy"] + pose.get("edy", 0) + (pose.get("edy2", 0) if i else 0),
            "rx": e["rx"] * (pose.get("esx", 1) + (pose.get("esx2", 0) if i else 0)),
            "ry": e["ry"] * (pose.get("esy", 1) + (pose.get("esy2", 0) if i else 0)),
            "rot": e["rot"] * (1 - pose.get("lock", 0))
                + (pose.get("tilt", 0) + (pose.get("tilt2", 0) if i else 0))
                * (-1 if not i else 1),
        })

    new_layout = {**layout, "eyes": new_eyes}
    bdy = pose.get("bdy", 0)
    wrap = f"translate(0 {_r3(bdy)})" if bdy != 0 else ""
    return new_layout, wrap
