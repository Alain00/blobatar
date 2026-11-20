import BlobatarCore
import XCTest

@testable import BlobatarStudio

final class StudioConfigurationTests: XCTestCase {
  func testConfigurationForwardsEveryPublicOption() throws {
    var configuration = StudioConfiguration()
    configuration.name = "  Ada  "
    configuration.shape = .triangle
    configuration.expression = .thinking
    configuration.backdrop = .squircle
    configuration.eyeGap = .varied
    configuration.overridesHue = true
    configuration.hue = 140
    configuration.overridesTone = true
    configuration.tone = 0.72
    configuration.usesPaletteOverride = true
    configuration.normalize = false
    configuration.contrast = false

    let options = configuration.options
    XCTAssertEqual(options.palette?.background, "#d9e4ff")
    XCTAssertEqual(options.palette?.head, "#315c9b")
    XCTAssertEqual(options.palette?.eye, "#ffffff")
    XCTAssertEqual(options.hue, 140)
    XCTAssertEqual(options.tone, 0.72)
    XCTAssertFalse(options.normalize)
    XCTAssertFalse(options.contrast)
    XCTAssertEqual(options.background, .squircle)
    XCTAssertEqual(options.expression, .thinking)

    guard case .pinned(let shape)? = options.traits["shape"] else {
      return XCTFail("Shape control must produce a pinned trait")
    }
    XCTAssertEqual(shape, 0.99)
    guard case .narrowed(let eyeGap)? = options.traits["eye.gap"] else {
      return XCTFail("Eye-gap control must produce a narrowed trait")
    }
    XCTAssertEqual(eyeGap, [0.12, 0.5, 0.88])
  }

  func testReenteringTheSameNameAndOptionsReproducesTheFigure() {
    var configuration = StudioConfiguration()
    configuration.name = "Grace Hopper"
    configuration.shape = .organic
    configuration.expression = .love
    configuration.backdrop = .circle
    configuration.eyeGap = .compact
    configuration.overridesHue = true
    configuration.hue = 275

    let first = resolveBlobatar(configuration.name, options: configuration.options)
    configuration.name = "temporary"
    _ = resolveBlobatar(configuration.name, options: configuration.options)
    configuration.name = "Grace Hopper"
    let reentered = resolveBlobatar(configuration.name, options: configuration.options)

    XCTAssertEqual(reentered, first)
  }

  func testShapeControlCoversEverySilhouetteThroughPinnedPublicTraits() {
    let expected = Dictionary(
      uniqueKeysWithValues: StudioShape.allCases.compactMap { shape in
        shape.pinnedValue.map { value in (shape, value) }
      }
    )
    XCTAssertEqual(expected.count, BlobatarSilhouette.allCases.count)

    for (shape, value) in expected {
      let drawing = resolveBlobatar(
        "shape-control",
        options: BlobatarOptions(traits: ["shape": .pinned(value)])
      )
      XCTAssertEqual(drawing.silhouette.rawValue, shape.rawValue.lowercased())
    }
  }

  func testNarrowedControlResolvesToOneOfItsPinnedCandidates() throws {
    for gap in StudioEyeGap.allCases where gap != .automatic {
      let values = try XCTUnwrap(gap.narrowedValues)
      let narrowed = resolveBlobatar(
        "narrowed-control",
        options: BlobatarOptions(traits: ["eye.gap": .narrowed(values)])
      )
      let candidates = values.map { value in
        resolveBlobatar(
          "narrowed-control",
          options: BlobatarOptions(traits: ["eye.gap": .pinned(value)])
        )
      }
      XCTAssertTrue(candidates.contains(narrowed), gap.rawValue)
    }
  }

  func testMotionPolicyHonorsModeHoverAndReducedMotion() {
    XCTAssertFalse(
      StudioMotionMode.staticPreview.isActive(isHovered: true, reduceMotion: false)
    )
    XCTAssertFalse(StudioMotionMode.hover.isActive(isHovered: false, reduceMotion: false))
    XCTAssertTrue(StudioMotionMode.hover.isActive(isHovered: true, reduceMotion: false))
    XCTAssertTrue(StudioMotionMode.always.isActive(isHovered: false, reduceMotion: false))

    for mode in StudioMotionMode.allCases {
      XCTAssertFalse(mode.isActive(isHovered: true, reduceMotion: true))
    }
  }

  func testEasterEggSeedsAndAliasesMatchTheFlutterStudio() {
    XCTAssertEqual(StudioEasterEgg.all.map(\.seed), ["claude", "codex"])
    XCTAssertEqual(webSeedMarkFor(" Claude "), .claude)
    XCTAssertEqual(webSeedMarkFor("anthropic"), .claude)
    XCTAssertEqual(webSeedMarkFor("CODEX"), .codex)
    XCTAssertEqual(webSeedMarkFor("openai"), .codex)
    XCTAssertNil(webSeedMarkFor("Ada"))
    XCTAssertEqual(webSeedKey("claude"), "e1fc8517")
    XCTAssertEqual(webSeedKey("anthropic"), "b0d11833")
    XCTAssertEqual(webSeedKey("codex"), "d4cde064")
    XCTAssertEqual(webSeedKey("openai"), "ede616c3")
  }

  func testCrowdCatalogIsIndependentOfPreviewControls() {
    var configuration = StudioConfiguration()
    let baseline = configuration.crowdEntries

    configuration.name = "a different preview"
    configuration.shape = .triangle
    configuration.expression = .thinking
    configuration.backdrop = .squircle
    configuration.eyeGap = .wide
    configuration.motion = .always
    configuration.overridesHue = true
    configuration.hue = 22
    configuration.overridesTone = true
    configuration.tone = 0.82
    configuration.usesPaletteOverride = true
    configuration.normalize = false
    configuration.contrast = false

    let changed = configuration.crowdEntries
    XCTAssertEqual(
      changed.map { resolveBlobatar($0.name, options: $0.options) },
      baseline.map { resolveBlobatar($0.name, options: $0.options) }
    )
  }

  func testCrowdCatalogCoversEveryShapeAndShowsVisualDiversity() {
    let entries = StudioConfiguration().crowdEntries
    XCTAssertEqual(entries.count, 12)
    XCTAssertEqual(Set(entries.map(\.name)).count, entries.count)
    XCTAssertEqual(
      Set(entries.map { resolveBlobatar($0.name, options: $0.options).silhouette }),
      Set(BlobatarSilhouette.allCases)
    )
    XCTAssertEqual(
      Set(entries.compactMap { $0.options.background }),
      Set(BlobatarBackdrop.allCases)
    )
    XCTAssertEqual(
      Set(entries.compactMap { $0.options.expression }).count,
      entries.count
    )
  }
}
