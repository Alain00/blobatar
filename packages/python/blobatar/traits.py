"""Trait system — ported from traits.ts.

A trait is a deterministic float [0,1) derived from a seed string and a key.
The `traits()` function returns a callable with convenience methods.
"""
from .hash import seed_state, stream


def traits(seed: str, normalize: bool = True, overrides: dict | None = None):
    """Create a trait accessor for the given seed.
    Matches traits.ts: F(seed, e, n) -> function with .num, .int, .pick, .bool, .jitter
    """
    state = seed_state(seed, normalize)

    def accessor(key: str) -> float:
        """Get a raw trait value [0,1) for the given key."""
        if overrides and key in overrides:
            val = overrides[key]
            if isinstance(val, list):
                if len(val) > 0:
                    # Array override: the key's own hash picks from it
                    idx = int(stream(state, key) * len(val))
                    return val[min(idx, len(val) - 1)]
                # Empty list = no override, fall through to hash-derived
            elif not isinstance(val, list):
                # Single value: clamp to [0, 0.999999]
                v = float(val)
                if v < 0:
                    return 0.0
                if v >= 1:
                    return 0.999999
                return v
        v = stream(state, key)
        if v > 0 and v < 1:
            return v
        if v >= 1:
            return 0.999999
        return 0.0

    def num(key: str, lo: float, hi: float) -> float:
        """Trait value mapped to [lo, hi]."""
        return lo + accessor(key) * (hi - lo)

    def int_(key: str, lo: int, hi: int) -> int:
        """Trait value as integer in [lo, hi]."""
        return lo + int(accessor(key) * (hi - lo + 1))

    def pick(key: str, options: list):
        """Pick one from options list based on trait value."""
        idx = int(accessor(key) * len(options))
        return options[min(idx, len(options) - 1)]

    def bool_(key: str, p: float = 0.5) -> bool:
        """Boolean trait: true with probability p."""
        return accessor(key) < p

    def jitter(key: str, amount: float) -> float:
        """Symmetric jitter: [-amount, +amount]."""
        return (accessor(key) * 2 - 1) * amount

    accessor.num = num
    accessor.int_ = int_
    accessor.pick = pick
    accessor.bool_ = bool_
    accessor.jitter = jitter
    return accessor
