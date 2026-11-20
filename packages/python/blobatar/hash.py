"""Deterministic hash and seed normalization — ported from hash.ts.

Two guarantees this file exists to provide, mirroring upstream:

1. Avalanche — "alain" and "alaim" must produce visually unrelated blobatars.
2. Streaming — the seed is hashed once, then each trait key continues from
   that state, so trait values are independent of one another.
"""

import unicodedata

# ponytail: JS String.prototype.trim() strips U+FEFF (BOM) and other space
# chars Python's str.strip() leaves alone; hand-listed from ECMAScript spec.
_JS_TRIM_CHARS = (
    "\t\n\v\f\r \x85\xa0 ᠎\u2002\u2003\u2004\u2005\u2006\u2007\u2008"
    "\u2009\u200a\n\u2028\u2029\u202f\u205f\u3000\ufeff"
)


def normalize(seed: str) -> str:
    """NFC-normalize, JS-trim, lowercase — matches hash.ts normalizeSeed().

    The trim set is ECMAScript's WhiteSpace + LineTerminator, which includes
    U+FEFF; Python's str.strip() does not, so it is applied explicitly.
    """
    s = seed.strip(_JS_TRIM_CHARS)
    return unicodedata.normalize("NFC", s).lower()


def _imul32(a: int, b: int) -> int:
    """JavaScript's Math.imul — 32-bit integer multiply, result as unsigned."""
    return ((a & 0xFFFFFFFF) * (b & 0xFFFFFFFF)) & 0xFFFFFFFF


def _rotl32(h: int, n: int) -> int:
    """JS `(h << n) | (h >>> (32 - n))` on the unsigned 32-bit repr."""
    h &= 0xFFFFFFFF
    return ((h << n) | (h >> (32 - n))) & 0xFFFFFFFF


def feed(h: int, data: bytes) -> int:
    """Mixes bytes into a 32-bit state. Matches hash.ts feed().

    State is kept as an unsigned 32-bit int throughout; JS keeps it as
    int32, but every operation here is bit-identical under either repr.
    """
    for byte in data:
        h = _imul32(h ^ byte, 3432918353)
        h = _rotl32(h, 13)
    return h & 0xFFFFFFFF


def finalize(h: int) -> int:
    """murmur3 fmix32. Matches hash.ts finalize()."""
    h = _imul32(h ^ ((h & 0xFFFFFFFF) >> 16), 2246822507)
    h = _imul32(h ^ ((h & 0xFFFFFFFF) >> 13), 3266489909)
    return ((h ^ ((h & 0xFFFFFFFF) >> 16)) & 0xFFFFFFFF)


def _js_length(s: str) -> int:
    """JS String.length — UTF-16 code units, not codepoints or bytes.

    Astral-plane characters (emoji etc.) count as 2 in JS but 1 in
    Python's len(). The fixture vectors were generated from JS, so this
    must match to pass the parity gate.
    """
    return len(s.encode("utf-16-le")) // 2


def seed_state(seed: str, normalize_seed: bool = True) -> int:
    """Hash seed into reusable state. Matches hash.ts seedState().

    The initial state mixes the string's UTF-16 length (what JS's s.length
    reports), then feeds the UTF-8 bytes — byte-identical to upstream for
    every seed, including astral-plane characters and combining marks.
    """
    name = normalize(seed) if normalize_seed else seed
    return feed(1779033703 ^ _js_length(name), name.encode("utf-8"))


def stream(state: int, key: str) -> float:
    """Derive one uniform float in [0, 1) for key. Matches hash.ts stream()."""
    h = feed(state, b"\xff")
    h = feed(h, key.encode("utf-8"))
    return finalize(h) / 4294967296


def to_signed32(u: int) -> int:
    """The int32 representation JS callers see (fixture vectors use this)."""
    return u - (1 << 32) if u >= (1 << 31) else u
