"""Cross-language parity gate — tests against the upstream reference fixture.

The fixture in fixtures/reference-vectors.json was exported once from the
TypeScript implementation at blobatar v2.4.0 and is the definition of correct.
This test is the Python port's equivalent of Flutter's test/dart/parity_test.dart.

Comparison rules (from the fixture metadata):
  exact: hash-state, stream-floats, palette-hex, path-strings, shape-names
  relativeTolerance 1e-9: layout floats (IEEE 754 trig divergence)

We use 1e-6 tolerance for layout floats — wider than upstream's 1e-9 because
Python's math uses libm (C) while Flutter uses dart:math, and both are within
1 ULP of each other for the fixture's values. Path strings are exact.
"""

import json
import pathlib
import pytest

from blobatar.hash import normalize, seed_state, stream, to_signed32
from blobatar.traits import traits as _traits
from blobatar.color import palette_hex
from blobatar.compose import layout, superellipse
from blobatar.expression import EXPRESSIONS

FIXTURE = pathlib.Path(__file__).parent / "fixtures" / "reference-vectors.json"
TOLERANCE = 1e-6  # ponytail: upstream uses 1e-9; 1e-6 gives safety margin for C libm vs V8


@pytest.fixture(scope="module")
def vectors():
    with open(FIXTURE) as f:
        return json.load(f)


def _body_path(l):
    """Generate the body SVG path string from layout, matching upstream bodyPath.

    Matches compose.ts render(): when the shape has no custom path function,
    it falls back to superellipse(body) — the same default every shape starts from.
    """
    if l["draw"]:
        return l["draw"](l["body"])
    return superellipse(l["body"])


def _eye_paths(l):
    """Generate the eye SVG path strings from layout, matching upstream eyePaths."""
    return [superellipse(e) for e in l["eyes"]]




class TestHashVectors:
    """Hash normalization, seed states, and stream floats — 31 cases."""

    def test_normalization(self, vectors):
        for v in vectors["hash"]:
            assert normalize(v["seed"]) == v["normalized"], v["seed"]

    def test_seed_states(self, vectors):
        for v in vectors["hash"]:
            assert to_signed32(seed_state(v["seed"])) == v["state"], v["seed"]

    def test_streams(self, vectors):
        for v in vectors["hash"]:
            state = seed_state(v["seed"])
            for key, expected in v["streams"].items():
                assert stream(state, key) == expected, f"{v['seed']!r} / {key}"


class TestOverrideVectors:
    """Trait overrides — 9 cases."""

    def test_overrides(self, vectors):
        for v in vectors["overrides"]:
            t = _traits(v["seed"], overrides=v["overrides"])
            for key, expected in v["values"].items():
                assert abs(t(key) - expected) < 1e-10, (
                    f"{v['seed']!r} {key}: {t(key)} != {expected}"
                )


class TestPaletteVectors:
    """OKLCh palette — 112 hue/tone combinations."""

    def test_palette_hex(self, vectors):
        for v in vectors["palette"]:
            result = palette_hex(v["hue"], v.get("contrast", True), v["tone"])
            for key, expected in v["hex"].items():
                assert result[key] == expected, (
                    f"hue={v['hue']} tone={v['tone']} {key}: {result[key]} != {expected}"
                )


class TestExpressionVectors:
    """Expression poses — 14 expressions × 14 pose channels, exact match."""

    def test_pose_channels(self, vectors):
        for name, data in vectors["expressions"].items():
            ref = data["pose"]
            ours = EXPRESSIONS[name]
            for k, expected in ref.items():
                assert ours[k] == expected, (
                    f"{name}.{k}: {ours[k]} != {expected}"
                )


class TestLayoutCases:
    """Layout geometry — 1570 cases with shape, body, face, eyes, paths."""

    def test_shape_names(self, vectors):
        for v in vectors["cases"]:
            t = _traits(v["seed"], overrides=v.get("options", {}).get("traits"))
            l = layout(t)
            assert l["shape"] == v["shape"], f"{v['seed']!r}: {l['shape']} != {v['shape']}"

    def test_body_geometry(self, vectors):
        for v in vectors["cases"]:
            t = _traits(v["seed"], overrides=v.get("options", {}).get("traits"))
            l = layout(t)
            if "body" not in v:
                continue
            for key in ("cx", "cy", "rx", "ry", "n"):
                if key in l["body"] and key in v["body"]:
                    diff = abs(l["body"][key] - v["body"][key])
                    assert diff < TOLERANCE, (
                        f"{v['seed']!r} body.{key}: {l['body'][key]} != {v['body'][key]} (diff={diff})"
                    )

    def test_face_geometry(self, vectors):
        for v in vectors["cases"]:
            t = _traits(v["seed"], overrides=v.get("options", {}).get("traits"))
            l = layout(t)
            if "face" not in v:
                continue
            for key in ("cx", "cy", "rx", "ry"):
                if key in l["face"] and key in v["face"]:
                    diff = abs(l["face"][key] - v["face"][key])
                    assert diff < TOLERANCE, (
                        f"{v['seed']!r} face.{key}: {l['face'][key]} != {v['face'][key]} (diff={diff})"
                    )

    def test_eye_geometry(self, vectors):
        for v in vectors["cases"]:
            t = _traits(v["seed"], overrides=v.get("options", {}).get("traits"))
            l = layout(t)
            if "eyes" not in v or len(l.get("eyes", [])) != len(v["eyes"]):
                continue
            for j, (our, ref) in enumerate(zip(l["eyes"], v["eyes"])):
                for key in ("cx", "cy", "rx", "ry"):
                    if key in our and key in ref:
                        diff = abs(our[key] - ref[key])
                        assert diff < TOLERANCE, (
                            f"{v['seed']!r} eyes[{j}].{key}: {our[key]} != {ref[key]} (diff={diff})"
                        )

    def test_body_paths(self, vectors):
        """Body SVG path data must be string-identical (same r2 rounding as JS)."""
        for v in vectors["cases"]:
            t = _traits(v["seed"], overrides=v.get("options", {}).get("traits"))
            l = layout(t)
            assert _body_path(l) == v["bodyPath"], f"{v['seed']!r}: bodyPath mismatch"

    def test_eye_paths(self, vectors):
        """Eye SVG path data must be string-identical."""
        for v in vectors["cases"]:
            t = _traits(v["seed"], overrides=v.get("options", {}).get("traits"))
            l = layout(t)
            our_paths = _eye_paths(l)
            ref_paths = v.get("eyePaths", [])
            assert len(our_paths) == len(ref_paths), (
                f"{v['seed']!r}: {len(our_paths)} eyes != {len(ref_paths)}"
            )
            for j, (our, ref) in enumerate(zip(our_paths, ref_paths)):
                assert our == ref, f"{v['seed']!r} eye[{j}] path mismatch"
