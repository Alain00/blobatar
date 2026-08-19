# Changelog

What changed, and — where it matters — what it costs to upgrade.

The library's changelog states churn in the seed → look mapping; this one
never will, because the CLI does not own a mapping. It renders through the
published package majors — `--gen` pins one — so faces move only when your
lockfile moves a blobatar major, never on a CLI release.

## 0.1.0

**No mapping changes.** This package renders through `blobatar@2` and the
frozen `blobatar-v1` alias, and touches neither.

Initial release: the terminal surface of the endpoint's param table.

### Added

- `blobatar <name>` prints SVG to stdout; `-o` writes `.svg`/`.png`;
  `--stdin -d` renders a batch with collision-safe, deterministic filenames.
- The endpoint's params as flags, parsed by the shared table: `--size`,
  `--background`, `--hue`, `--tone`, `--expression`, `--title`, `--gen` —
  same values, same ranges, same error messages as `?param=` in a URL.
- `--no-normalize` keeps a name's case and spacing — the one flag a URL has
  no spelling of.
- The shared table clamps `tone=1` just inside its half-open top bucket, so
  the documented 0–1 range ends in the last swatch instead of wrapping back
  to the first — in both string surfaces and both generations.
