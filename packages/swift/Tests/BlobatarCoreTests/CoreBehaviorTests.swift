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

  func testFinalSigmaUsesUnicodeCasedAndCaseIgnorableProperties() {
    // Expected states come from the TypeScript `seedState`, where the
    // JavaScript engine's own Final_Sigma handling decides the mapping.
    let cases: [(String, String, UInt32)] = [
      ("AΣ'A", "aσ'a", 300_958_747),
      ("AΣ\u{2019}A", "aσ\u{2019}a", 33_739_173),
      ("AΣ.A", "aσ.a", 3_270_872_828),
      ("AΣ:A", "aσ:a", 50_477_190),
      ("\u{531}Σ", "\u{561}ς", 782_133_757),
      ("\u{FF21}Σ", "\u{FF41}ς", 3_630_730_654),
      ("AΣ\u{5B0}", "aς\u{5B0}", 3_492_215_416),
      ("\u{AB70}Σ", "\u{AB70}ς", 3_321_446_600),
      ("ΑΣ'", "ας'", 3_585_492_738),
      ("A\u{2019}Σ", "a\u{2019}ς", 225_370_491),
    ]
    for (name, normalized, state) in cases {
      XCTAssertEqual(normalizeSeed(name), normalized, name)
      XCTAssertEqual(seedState(name), state, name)
    }
  }

  func testBackgroundColorJoinsContrastFloorsLikeTypeScript() throws {
    // Expected palettes come from the TypeScript `palette(hue, true, tone, bg)`.
    // The plate comes back expanded to `#rrggbb`, which the renderer requires.
    let cases: [(Double, Double, String, String, String)] = [
      (0, 0, "#000", "#ffbbcf", "#170c0f"),
      (137.5, 0.5, "#000000", "#7dbb64", "#0b1109"),
      (210, 0.7, "#ffffff", "#0097aa", "#051214"),
      (300, 0.95, "#1a1a2e", "#3b3448", "#f6f3fc"),
      (45, 0.85, "#F5C518", "#ffe1d3", "#170d08"),
      (90, 0.3, "#808080", "#e5deca", "#130f06"),
    ]
    for (hue, tone, plate, head, eye) in cases {
      let expanded = try XCTUnwrap(plateHex(plate))
      XCTAssertEqual(
        makePalette(hue: hue, tone: tone, enforceContrast: true, plate: expanded),
        BlobatarPalette(background: expanded, head: head, eye: eye),
        plate
      )
    }
    XCTAssertEqual(plateHex("#AbC"), "#AAbbCC")
    XCTAssertNil(plateHex("red"))
    XCTAssertNil(plateHex("#abcd"))
    XCTAssertNil(plateHex("#+12345"))
  }

  func testBackgroundColorOnlyAppliesToADrawnBackdrop() {
    let plain = resolveBlobatar("alain")
    XCTAssertEqual(
      resolveBlobatar("alain", options: BlobatarOptions(backgroundColor: "#000")).palette,
      plain.palette
    )
    XCTAssertEqual(
      resolveBlobatar("alain", options: BlobatarOptions(background: .circle, backgroundColor: ""))
        .palette,
      resolveBlobatar("alain", options: BlobatarOptions(background: .circle)).palette
    )

    let plated = resolveBlobatar(
      "alain",
      options: BlobatarOptions(background: .squircle, backgroundColor: "#000")
    )
    XCTAssertEqual(plated.palette.background, "#000000")
    XCTAssertEqual(plated.backdrop?.color, "#000000")

    let overridden = resolveBlobatar(
      "alain",
      options: BlobatarOptions(
        palette: BlobatarPaletteOverride(background: "#123456"),
        background: .square,
        backgroundColor: "#000"
      )
    )
    XCTAssertEqual(overridden.palette.background, "#123456")
    XCTAssertEqual(overridden.palette.head, plated.palette.head)
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
