import XCTest

@testable import BlobatarCore

final class CoreBehaviorTests: XCTestCase {
  func testNormalizationMatchesJavaScriptForHumanNames() {
    XCTAssertEqual(normalizeSeed("  ALAIN@Example.COM  "), "alain@example.com")
    XCTAssertEqual(normalizeSeed("cafe\u{301}"), "café")
    XCTAssertEqual(normalizeSeed("İ"), "i\u{307}")
    XCTAssertEqual(normalizeSeed("Σ"), "σ")
    XCTAssertEqual(normalizeSeed("ΣΣ"), "σς")
    XCTAssertEqual(normalizeSeed("ΟΣ"), "ος")
    XCTAssertEqual(normalizeSeed("ΟΣΔ"), "οσδ")
    XCTAssertEqual(normalizeSeed("\u{FEFF}"), "")
  }

  func testRawNamesAndAstralPlaneNamesRetainJavaScriptHashSemantics() {
    XCTAssertNotEqual(seedState("Alain", normalize: false), seedState("alain", normalize: false))
    XCTAssertEqual(seedState("café"), seedState("cafe\u{301}"))
    XCTAssertNotEqual(seedState("🦊"), seedState("🦋"))
    for name in ["日本語", "Ελλάδα", "🦊🐻", "أحمد", "🇫🇷"] {
      let value = stream(state: seedState(name), key: "hue")
      XCTAssertTrue(value >= 0 && value < 1, name)
    }
  }

  func testTraitOverridesClampAndNarrowWithoutAffectingOtherKeys() {
    let base = TraitReader(name: "alain")
    let overridden = TraitReader(
      name: "alain",
      overrides: [
        "low": .pinned(-3),
        "nan": .pinned(.nan),
        "high": .pinned(1),
        "infinite": .pinned(.infinity),
        "choice": .narrowed([0.3, 0.9]),
        "empty": .narrowed([]),
      ]
    )

    XCTAssertEqual(overridden.value("low"), 0)
    XCTAssertEqual(overridden.value("nan"), 0)
    XCTAssertEqual(overridden.value("high"), 0.999_999)
    XCTAssertEqual(overridden.value("infinite"), 0.999_999)
    XCTAssertTrue([0.3, 0.9].contains(overridden.value("choice")))
    XCTAssertEqual(overridden.value("empty"), base.value("empty"))
    XCTAssertEqual(overridden.value("shape"), base.value("shape"))
  }

  func testToneEdgesRemainHalfOpenAndContrastFloorsHold() {
    XCTAssertEqual(makeRamp(hue: 120, tone: 0.19, enforceContrast: false)["head"]!.lightness, 0.86)
    XCTAssertEqual(makeRamp(hue: 120, tone: 0.2, enforceContrast: false)["head"]!.lightness, 0.9)
    XCTAssertEqual(makeRamp(hue: 120, tone: 0.36, enforceContrast: false)["head"]!.lightness, 0.73)
    XCTAssertEqual(makeRamp(hue: 120, tone: 0.62, enforceContrast: false)["head"]!.lightness, 0.62)
    XCTAssertEqual(makeRamp(hue: 120, tone: 0.8, enforceContrast: false)["head"]!.lightness, 0.87)
    XCTAssertEqual(makeRamp(hue: 120, tone: 0.93, enforceContrast: false)["head"]!.lightness, 0.34)
    XCTAssertEqual(
      makePalette(hue: 90, tone: 1, enforceContrast: true),
      makePalette(hue: 90, tone: 0, enforceContrast: true)
    )

    for hue in stride(from: 0.0, to: 360, by: 6) {
      for tone in [0.0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 0.999] {
        let ramp = makeRamp(hue: hue, tone: tone, enforceContrast: true)
        XCTAssertGreaterThanOrEqual(contrast(ramp["head"]!, ramp["bg"]!), 1.25)
        XCTAssertGreaterThanOrEqual(contrast(ramp["eye"]!, ramp["head"]!), 4.5)
        XCTAssertGreaterThanOrEqual(contrast(ramp["head"]!, darkSurface), surfaceContrastFloor)
      }
    }
  }

  func testStructuredPrimitivesRetainExactReferenceSerialization() {
    XCTAssertEqual(
      superellipse(
        Superellipse(
          centerX: 0,
          centerY: 0,
          radiusX: 100,
          radiusY: 100,
          exponent: 2,
          rotationDegrees: 0
        )
      ).pathData.contains("55.23"),
      true
    )
    XCTAssertEqual(
      box(centerX: 50, centerY: 50, radiusX: 30, radiusY: 20).pathData,
      "M20 30H80V70H20Z"
    )
    XCTAssertEqual(
      arc(centerX: 50, centerY: 60, width: 10, depth: 6).pathData,
      "M40 60Q50 66 60 60"
    )
    XCTAssertEqual(
      blobPath(
        centerX: 50,
        centerY: 50,
        radiusX: 20,
        radiusY: 20,
        radii: [1, 1, 1, 1]
      ).pathData.hasPrefix("M70 50"),
      true
    )
    XCTAssertFalse(
      polygon(
        centerX: 50,
        centerY: 50,
        radiusX: 20,
        radiusY: 20,
        sides: 6,
        rounding: 1
      ).pathData.contains("L")
    )
  }

  func testPublicResolverOwnsDefaultsOverridesAndBackdropGeometry() {
    let first = resolveBlobatar("alain")
    XCTAssertEqual(first, resolveBlobatar("  ALAIN  "))
    XCTAssertNil(first.backdrop)

    let configured = resolveBlobatar(
      "alain",
      options: BlobatarOptions(
        palette: BlobatarPaletteOverride(
          background: "#010203",
          head: "#112233",
          eye: "#abcdef"
        ),
        hue: 210,
        tone: 0.5,
        traits: ["shape": .pinned(0.99)],
        background: .square
      )
    )
    XCTAssertEqual(configured.silhouette, .triangle)
    XCTAssertEqual(configured.palette.background, "#010203")
    XCTAssertEqual(configured.palette.head, "#112233")
    XCTAssertEqual(configured.palette.eye, "#abcdef")
    XCTAssertEqual(configured.backdrop?.color, "#010203")
    XCTAssertEqual(configured.backdrop?.path.pathData, "M0 0H100V100H0Z")

    XCTAssertNotNil(
      resolveBlobatar("alain", options: BlobatarOptions(background: .circle)).backdrop
    )
    XCTAssertNotNil(
      resolveBlobatar("alain", options: BlobatarOptions(background: .squircle)).backdrop
    )
    XCTAssertNil(
      resolveBlobatar("alain", options: BlobatarOptions(background: BlobatarBackdrop.none))
        .backdrop
    )
  }
}
