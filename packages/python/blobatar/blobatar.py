"""Main blobatar entry point. Ported from blobatar.ts + render.ts."""
import html as html_mod
from .traits import traits as _traits
from .color import palette as _palette, palette_hex, oklch_to_srgb_clamped, rgb_to_hex, hex_to_oklch, _ensure_contrast, _DARK, _DARK_RATIO, _CONTRAST
from .compose import layout as _layout, render as _render
from .animate import motion_vars, root_class
from .expression import EXPRESSIONS, EXPRESSION_TINT, TINTS, expression_vars, bake_pose


def _escape(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def blobatar(name, size=None, background=None, hue=None, tone=None,
             normalize=True, contrast=True, title=None, animate=None,
             expression=None, traits_overrides=None):
    """Generate blobatar SVG markup. Matches blobatar.ts blobatar()."""
    t = _traits(name, normalize, traits_overrides)

    # Resolve palette
    h = hue if hue is not None else t('hue') * 360
    tn = tone if tone is not None else t('tone')
    pal = palette_hex(h, contrast, tn)

    # Apply expression tint if needed
    expr_name = expression or 'idle'
    expr = EXPRESSIONS.get(expr_name, EXPRESSIONS['idle'])
    tint_name = EXPRESSION_TINT.get(expr_name)
    if tint_name:
        pal = _apply_tint(pal, tint_name, expr)

    # Layout
    l = _layout(t)
    # Bake expression into geometry for static rendering (matches upstream render.ts)
    wrap = ''
    if not animate and expr_name != 'idle':
        l, wrap = bake_pose(l, expr.get('p', {}))
    inner = _render(l, pal, mo=bool(animate))

    # Build SVG
    dim = f' width="{size}" height="{size}"' if size else ''
    label = f'<title>{_escape(title)}</title>' if title else ''
    bg = ''
    if background and background != 'none':
        if background == 'square':
            bg = '<path d="M0 0H100V100H0Z" fill="' + pal['bg'] + '"/>'
        elif background == 'circle':
            from .shape import superellipse
            bg = f'<path d="{superellipse({"cx": 50, "cy": 50, "rx": 50, "ry": 50, "n": 2})}" fill="{pal["bg"]}"/>'
        elif background == 'squircle':
            from .shape import superellipse
            bg = f'<path d="{superellipse({"cx": 50, "cy": 50, "rx": 50, "ry": 50, "n": 6})}" fill="{pal["bg"]}"/>'

    # CSS vars for animation
    style = ''
    if animate:
        t_full = _traits(name, normalize, traits_overrides)
        mv = motion_vars(t_full)
        # Add head/eye colors
        mv['--mo-head'] = pal['head']
        mv['--mo-eye'] = pal['eye']
        # Add expression vars
        ev = expression_vars(expr)
        mv.update(ev)
        style = ' style="' + ';'.join(f'{k}:{v}' for k, v in mv.items()) + '"'

    cls = root_class(animate or '', expressive=(expr_name != 'idle')) if animate else ''

    if cls:
        wrap_g = f' transform="{wrap}"' if wrap else ''
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"{dim}{style}>{label}{bg}<g class="{cls}"{wrap_g}>{inner}</g></svg>'
    else:
        wrap_g = f'<g transform="{wrap}">' if wrap else ''
        wrap_end = '</g>' if wrap else ''
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"{dim}{style}>{label}{bg}{wrap_g}{inner}{wrap_end}</svg>'
    return svg


def _apply_tint(pal, tint_name, expr):
    """Apply expression tint to palette. Simplified from color.ts tinted()."""
    tint = TINTS[tint_name]
    head_oklch = hex_to_oklch(pal['head'])

    # Mix head toward tint target
    pull = tint['pull']
    head_rgb = oklch_to_srgb_clamped(head_oklch['l'], head_oklch['c'], head_oklch['h'])
    tint_rgb = oklch_to_srgb_clamped(tint['l'], tint['c'], tint['h'])

    # Walk mix at 11 samples to find tinted head
    best_head = head_oklch
    for i in range(11):
        t = i / 10
        # OKLab mix
        mix_l = head_oklch['l'] + (tint['l'] - head_oklch['l']) * t * pull
        mix_c = head_oklch['c'] + (tint['c'] - head_oklch['c']) * t * pull
        mix_h = head_oklch['h'] + (tint['h'] - head_oklch['h']) * t * pull
        rgb = oklch_to_srgb_clamped(mix_l, mix_c, mix_h)
        # Ensure contrast
        bg_rgb = oklch_to_srgb_clamped(0.965, 0.01, tint['h'])
        from .color import contrast_ratio
        if contrast_ratio(rgb, bg_rgb) >= 1.25:
            best_head = {'l': mix_l, 'c': mix_c, 'h': mix_h}

    # Adjust eye for tint contrast
    eye = {'l': 0.17, 'c': 0.02, 'h': tint['h']}
    eye = _ensure_contrast(eye, best_head, 4.5)

    return {
        'bg': pal['bg'],
        'head': rgb_to_hex(oklch_to_srgb_clamped(best_head['l'], best_head['c'], best_head['h'])),
        'eye': rgb_to_hex(oklch_to_srgb_clamped(eye['l'], eye['c'], eye['h'])),
    }
