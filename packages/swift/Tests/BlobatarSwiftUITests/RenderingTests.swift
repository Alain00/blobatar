import BlobatarCore
import SwiftUI
import XCTest

@testable import BlobatarSwiftUI

final class RenderingTests: XCTestCase {
  func testViewportUsesTheLargestCenteredSquare() {
    assertViewport(CGSize(width: 48, height: 48), origin: .zero, side: 48, scale: 0.48)
    assertViewport(
      CGSize(width: 180, height: 100), origin: CGPoint(x: 40, y: 0), side: 100, scale: 1)
    assertViewport(
      CGSize(width: 80, height: 140), origin: CGPoint(x: 0, y: 30), side: 80, scale: 0.8)
    XCTAssertEqual(BlobatarViewport(size: .zero).scale, 0)
  }

  func testRenderCommandsFollowTheFrozenLayerOrder() {
    let cases = [
      resolveBlobatar("user-43", options: BlobatarOptions(background: .squircle)),
      resolveBlobatar(
        "droplet",
        options: BlobatarOptions(traits: ["shape": .pinned(0.9)], background: .square)
      ),
    ]

    for drawing in cases {
      let layers = BlobatarRenderPlan(drawing: drawing).commands.map(\.layer)
      var expected: [BlobatarRenderLayer] = drawing.backdrop == nil ? [] : [.backdrop]
      expected.append(contentsOf: Array(repeating: .petal, count: drawing.petals.count))
      expected.append(contentsOf: Array(repeating: .extraMark, count: drawing.extraPaths.count))
      expected.append(.body)
      expected.append(contentsOf: Array(repeating: .eye, count: drawing.eyePaths.count))
      XCTAssertEqual(layers, expected, "Unexpected order for \(drawing.silhouette)")
      XCTAssertEqual(layers, layers.sorted { $0.rawValue < $1.rawValue })
    }
  }

  func testAllBackdropModesReachThePlanWithoutInventedDefaults() {
    for backdrop in BlobatarBackdrop.allCases {
      let drawing = resolveBlobatar(
        "backdrop-\(backdrop.rawValue)",
        options: BlobatarOptions(background: backdrop)
      )
      let plan = BlobatarRenderPlan(drawing: drawing)
      let backdrops = plan.commands.filter { $0.layer == .backdrop }

      if backdrop == .none {
        XCTAssertNil(drawing.backdrop)
        XCTAssertTrue(backdrops.isEmpty)
      } else {
        XCTAssertEqual(backdrops.count, 1)
        XCTAssertEqual(backdrops[0].fill, BlobatarRGB(hex: drawing.palette.background))
        XCTAssertEqual(
          backdrops[0].path.boundingRect,
          CGRect(x: 0, y: 0, width: 100, height: 100)
        )
      }
    }
  }

  func testCacheReusesGeometryAndPathsUntilNameOrOptionsChange() {
    let cache = BlobatarRenderCache(countLimit: 16)
    let options = BlobatarOptions(
      palette: BlobatarPaletteOverride(
        background: "#102030",
        head: "#405060",
        eye: "#f0e0d0"
      ),
      hue: 210,
      tone: 0.5,
      traits: ["shape": .narrowed([0.11, 0.965]), "eye.gap": .pinned(0.7)],
      normalize: false,
      contrast: false,
      background: .squircle
    )
    let first = cache.rendering(for: "  Alain  ", options: options)
    let same = cache.rendering(for: "  Alain  ", options: options)
    let otherName = cache.rendering(for: "Alain", options: options)
    let otherOptions = cache.rendering(
      for: "  Alain  ",
      options: BlobatarOptions(hue: 211, background: .squircle)
    )

    XCTAssertTrue(first === same)
    XCTAssertFalse(first === otherName)
    XCTAssertFalse(first === otherOptions)
    XCTAssertEqual(first.drawing, resolveBlobatar("  Alain  ", options: options))
  }

  func testCacheKeyIsIndependentOfTraitDictionaryInsertionOrder() {
    let cache = BlobatarRenderCache(countLimit: 4)
    let first = BlobatarOptions(
      traits: ["shape": .pinned(0.9), "eye.gap": .narrowed([0.2, 0.7])]
    )
    let second = BlobatarOptions(
      traits: ["eye.gap": .narrowed([0.2, 0.7]), "shape": .pinned(0.9)]
    )
    XCTAssertTrue(
      cache.rendering(for: "ordered", options: first)
        === cache.rendering(for: "ordered", options: second)
    )
  }

  @MainActor
  func testStaticViewOwnsFixedFlexibleAndAccessibilityConfiguration() {
    let fixed = Blobatar(name: "alain", size: 64, accessibilityLabel: "Avatar of Alain")
    XCTAssertEqual(fixed.size, 64)
    XCTAssertEqual(fixed.accessibilityPolicy, .labeled("Avatar of Alain"))

    let flexible = Blobatar(name: "alain")
    XCTAssertNil(flexible.size)
    XCTAssertEqual(flexible.accessibilityPolicy, .unlabeled)

    XCTAssertEqual(Blobatar(name: "alain", size: -10).size, 0)
  }

  @MainActor
  func testViewReusesCachedRenderingAcrossOrdinaryReconstruction() {
    let first = Blobatar(name: "same", options: BlobatarOptions(background: .circle))
    let second = Blobatar(name: "same", options: BlobatarOptions(background: .circle))
    let updated = Blobatar(name: "same", options: BlobatarOptions(background: .square))
    let expressed = Blobatar(
      name: "same",
      options: BlobatarOptions(background: .circle, expression: .happy)
    )

    XCTAssertTrue(first.rendering === second.rendering)
    XCTAssertFalse(first.rendering === updated.rendering)
    XCTAssertFalse(first.rendering === expressed.rendering)
  }

  func testStaticRenderPlanAppliesBodyOffsetOutsideTheBackdrop() throws {
    let plain = BlobatarRenderPlan(
      drawing: resolveBlobatar(
        "offset",
        options: BlobatarOptions(background: .square)
      )
    )
    let happyDrawing = resolveBlobatar(
      "offset",
      options: BlobatarOptions(background: .square, expression: .happy)
    )
    let happy = BlobatarRenderPlan(drawing: happyDrawing)
    let plainBackdrop = try XCTUnwrap(plain.commands.first { $0.layer == .backdrop })
    let happyBackdrop = try XCTUnwrap(happy.commands.first { $0.layer == .backdrop })
    let plainBody = try XCTUnwrap(plain.commands.first { $0.layer == .body })
    let happyBody = try XCTUnwrap(happy.commands.first { $0.layer == .body })

    XCTAssertEqual(happyBackdrop.path.boundingRect, plainBackdrop.path.boundingRect)
    XCTAssertEqual(happyBody.path.boundingRect.minX, plainBody.path.boundingRect.minX)
    XCTAssertEqual(
      happyBody.path.boundingRect.minY,
      plainBody.path.boundingRect.minY + happyDrawing.bodyOffsetY,
      accuracy: 1e-5
    )
  }

  private func assertViewport(
    _ size: CGSize,
    origin: CGPoint,
    side: CGFloat,
    scale: CGFloat,
    file: StaticString = #filePath,
    line: UInt = #line
  ) {
    let viewport = BlobatarViewport(size: size)
    XCTAssertEqual(viewport.origin, origin, file: file, line: line)
    XCTAssertEqual(viewport.side, side, file: file, line: line)
    XCTAssertEqual(viewport.scale, scale, file: file, line: line)
  }
}
