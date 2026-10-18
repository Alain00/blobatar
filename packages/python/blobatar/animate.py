"""Animation seeds — per-blobatar timing. Ported from animate.ts."""
import math


def motion_seeds(t):
    """Derive idle animation seeds from traits. Matches animate.ts motionSeeds()."""
    blink = round(t.num('motion.blink', 3500, 6500))
    saccade = round(t.num('motion.saccade', 4200, 7600))
    look_x = t.num('motion.lookX', 1, 2.2)
    look_y = t.num('motion.lookY', 0.8, 1.7)
    r2 = lambda v: round(v, 2)
    return {
        'phase': round(t.num('motion.phase', 0, 2800)),
        'bob': round(t.num('motion.bob', 0, 3400)),
        'blink': blink,
        'blinkPhase': round(t.num('motion.blinkPhase', 0, blink)),
        'saccade': saccade,
        'saccadePhase': round(t.num('motion.saccadePhase', 0, saccade)),
        'lookX': r2(look_x) * (-1 if t.bool_('motion.lookXFlip') else 1),
        'lookY': r2(look_y) * (-1 if t.bool_('motion.lookYFlip') else 1),
        'lookMX': r2(look_x),
        'lookMY': r2(look_y),
    }


def motion_vars(t):
    """CSS custom properties for idle animation. Matches animate.ts motionVars()."""
    s = motion_seeds(t)
    return {
        '--mo-phase': f'{-s["phase"]}ms',
        '--mo-bob-phase': f'{-s["bob"]}ms',
        '--mo-blink': f'{s["blink"]}ms',
        '--mo-blink-phase': f'{-s["blinkPhase"]}ms',
        '--mo-look-x': str(s['lookX']),
        '--mo-look-mx': str(s['lookMX']),
        '--mo-look-y': str(s['lookY']),
        '--mo-look-my': str(s['lookMY']),
        '--mo-saccade': f'{s["saccade"]}ms',
        '--mo-saccade-phase': f'{-s["saccadePhase"]}ms',
    }


def root_class(animate, expressive=False):
    """CSS class for the root element. Matches animate.ts rootClass()."""
    cls = 'mo-root'
    if animate == 'always':
        cls += ' mo-always'
    if expressive:
        cls += ' mo-expr'
    return cls
