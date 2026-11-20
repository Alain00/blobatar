# blobatar (Python)

Python port of the [blobatar](https://blobatar.dev/) generation-2 core —
deterministic avatars, byte-identical to the upstream TypeScript.

## Install

```bash
pip install blobatar

# With Flask integration
pip install "blobatar[flask]"
```

## Use

```python
from blobatar import blobatar

svg = blobatar("alain00")
svg = blobatar("alain00", background="circle", expression="happy")
svg = blobatar("alain00", size=200, hue=0.67, tone=0.2, title="My avatar")
```

### Flask adapter

```python
from flask import Flask
from blobatar.flask import init_app, blobatar_filter, blobatar_uri

app = Flask(__name__)
init_app(app)  # registers GET /avatar/<name>

# Jinja2 filter: renders inline SVG
# <img src="{{ 'alain00' | blobatar(size=48) }}">

# Data URI for CSS backgrounds
# background-image: url({{ 'alain00' | blobatar_uri() }});
```

### Parameters

| Parameter | Values | Default |
|-----------|--------|---------|
| size | 8–1024 | `null` (no width/height) |
| background | `none`, `square`, `circle`, `squircle` | default backdrop |
| hue | 0.0–1.0 | seeded |
| tone | 0.0–1.0 | seeded |
| expression | `idle`, `happy`, `sad`, `mad`, `surprised`, `wink`, `sleepy`, `smug`, `unsure`, `scared`, `love`, `shy`, `sick`, `thinking` | `idle` |
| title | ≤128 chars | `null` |
| normalize | `True`/`False` | `True` |
| contrast | `True`/`False` | `True` |

### Traits

```python
from blobatar import traits

t = traits("alain00")           # all seeded
t = traits("alain00", normalize=False)  # NFC normalization off
t = traits("alain00", overrides={"hue": 0.5, "shape": 0.8})  # override hue + shape
```

### Hash

```python
from blobatar.hash import fnv1a, murmur3

h = fnv1a("alain00")       # → 2292908991
h = fnv1a("alain00", 17)   # → seed 17
h = murmur3("alain00")     # → (42, 32-bit state)
```

## Parity

This package passes the same reference-vectors fixture as the Flutter SDK:
**hash 31/31, palette 112/112, overrides 9/9, expressions 14/14,
layout 1570/1570 (shapes, geometry, eye paths, body paths)**.

Run the parity gate:

```bash
cd packages/python && pytest -v
```

## Scope

**Generation 2 only.** The upstream repository ships blobatar v2 as the current
generation. Generation 1 (blobatar v1) is a separate frozen npm package
([blobatar-v1](https://www.npmjs.com/package/blobatar-v1)) and is tracked as
follow-up work — matching the [Flutter SDK](../flutter/) precedent.

The Flask adapter mirrors the upstream `apps/api` endpoint: FNV-1a ETags,
`If-None-Match` 304s, structured error responses, and content negotiation.

## License

MIT — same as upstream.
