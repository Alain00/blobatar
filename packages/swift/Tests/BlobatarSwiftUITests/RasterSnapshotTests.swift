#if os(macOS)
  import AppKit
  import BlobatarCore
  import SwiftUI
  import XCTest

  @testable import BlobatarSwiftUI

  final class RasterSnapshotTests: XCTestCase {
    @MainActor
    func testFixedSizePinsTheHostedViewToASquare() {
      let host = NSHostingView(
        rootView: Blobatar(
          name: "fixed-size",
          size: 48,
          options: BlobatarOptions(background: .square)
        )
      )

      XCTAssertEqual(host.fittingSize, CGSize(width: 48, height: 48))
    }

    @MainActor
    func testRepresentativeCanvasSnapshotsAreDeterministicAndSeedDependent() throws {
      let first = try raster(Blobatar(name: "alain"), size: CGSize(width: 100, height: 100))
      let repeated = try raster(Blobatar(name: "alain"), size: CGSize(width: 100, height: 100))
      let other = try raster(Blobatar(name: "bob"), size: CGSize(width: 100, height: 100))

      XCTAssertEqual(first.bitmapBytes, repeated.bitmapBytes)
      XCTAssertNotEqual(first.bitmapBytes, other.bitmapBytes)
    }

    @MainActor
    func testSnapshotKeepsNonSquareMarginsTransparent() throws {
      let bitmap = try raster(
        Blobatar(
          name: "wide-square",
          options: BlobatarOptions(
            palette: BlobatarPaletteOverride(background: "#123456"),
            background: .square
          )
        ),
        size: CGSize(width: 160, height: 100)
      )

      assertPixel(bitmap, x: 10, y: 50, equals: nil)
      assertPixel(bitmap, x: 80, y: 2, equals: BlobatarRGB(hex: "#123456"))
      assertPixel(bitmap, x: 149, y: 50, equals: nil)
    }

    @MainActor
    func testSnapshotPaintsBackdropHeadAndEyesWithResolvedColors() throws {
      let options = BlobatarOptions(
        palette: BlobatarPaletteOverride(
          background: "#16324f",
          head: "#e07a5f",
          eye: "#f4f1de"
        ),
        traits: ["shape": .pinned(0.1)],
        background: .square
      )
      let view = Blobatar(name: "color-snapshot", options: options)
      let bitmap = try raster(view, size: CGSize(width: 100, height: 100))

      for layer in [BlobatarRenderLayer.backdrop, .body, .eye] {
        let point = try XCTUnwrap(interiorPoint(for: layer, in: view.rendering.plan))
        let expected: BlobatarRGB
        switch layer {
        case .backdrop:
          expected = BlobatarRGB(hex: "#16324f")
        case .body, .petal, .extraMark:
          expected = BlobatarRGB(hex: "#e07a5f")
        case .eye:
          expected = BlobatarRGB(hex: "#f4f1de")
        }
        assertPixel(bitmap, x: Int(point.x), y: Int(point.y), equals: expected)
      }
    }

    @MainActor
    func testExpressionEndpointReachesTheCanvas() throws {
      let idle = try raster(
        Blobatar(name: "expression-raster", options: BlobatarOptions(expression: .idle)),
        size: CGSize(width: 100, height: 100)
      )
      let happy = try raster(
        Blobatar(name: "expression-raster", options: BlobatarOptions(expression: .happy)),
        size: CGSize(width: 100, height: 100)
      )
      XCTAssertNotEqual(idle.bitmapBytes, happy.bitmapBytes)

      let mad = Blobatar(
        name: "expression-raster",
        options: BlobatarOptions(background: .square, expression: .mad)
      )
      let bitmap = try raster(mad, size: CGSize(width: 100, height: 100))
      let point = try XCTUnwrap(interiorPoint(for: .body, in: mad.rendering.plan))
      assertPixel(
        bitmap,
        x: Int(point.x),
        y: Int(point.y),
        equals: BlobatarRGB(hex: mad.rendering.drawing.palette.head)
      )
    }

    @MainActor
    func testActiveViewAppliesShapeChangeWithoutAnotherMutation() throws {
      let model = ActiveAnimatedProbeModel(shape: 0.11, active: true)
      let host = activeHost(model)
      host.frame = CGRect(x: 0, y: 0, width: 100, height: 100)
      RunLoop.main.run(until: Date().addingTimeInterval(0.05))
      let round = try raster(host)

      model.shape = 0.99
      RunLoop.main.run(until: Date().addingTimeInterval(0.05))
      let changed = try raster(host)
      let expected = try raster(
        Blobatar(name: "update-probe", options: ActiveAnimatedProbe.options(shape: 0.99)),
        size: CGSize(width: 100, height: 100)
      )

      XCTAssertNotEqual(changed.bitmapBytes, round.bitmapBytes)
      XCTAssertEqual(changed.bitmapBytes, expected.bitmapBytes)
    }

    @MainActor
    func testActiveViewBeginsExpressionChangeWithoutAnotherMutation() throws {
      let model = ActiveAnimatedProbeModel(expression: .idle, active: true)
      let host = activeHost(model)
      host.frame = CGRect(x: 0, y: 0, width: 100, height: 100)
      RunLoop.main.run(until: Date().addingTimeInterval(0.05))
      let idle = try raster(host)

      model.expression = .mad
      RunLoop.main.run(until: Date().addingTimeInterval(0.05))
      let changed = try raster(host)

      XCTAssertNotEqual(changed.bitmapBytes, idle.bitmapBytes)
    }

    @MainActor
    private func activeHost(_ model: ActiveAnimatedProbeModel) -> NSHostingView<some View> {
      NSHostingView(
        rootView: ActiveAnimatedProbe(model: model)
          .environment(\.scenePhase, .active)
      )
    }
  }

  @MainActor
  private final class ActiveAnimatedProbeModel: ObservableObject {
    @Published var shape: Double
    @Published var expression: BlobatarExpression
    @Published var active: Bool
    @Published var animation: BlobatarAnimation

    init(
      shape: Double = 0.11,
      expression: BlobatarExpression = .idle,
      active: Bool,
      animation: BlobatarAnimation = .hover
    ) {
      self.shape = shape
      self.expression = expression
      self.active = active
      self.animation = animation
    }
  }

  private struct ActiveAnimatedProbe: View {
    @ObservedObject var model: ActiveAnimatedProbeModel

    var body: some View {
      AnimatedBlobatar(
        name: "update-probe",
        options: Self.options(shape: model.shape, expression: model.expression),
        animation: model.animation,
        active: model.active
      )
    }

    static func options(
      shape: Double,
      expression: BlobatarExpression = .idle
    ) -> BlobatarOptions {
      BlobatarOptions(
        palette: BlobatarPaletteOverride(
          background: "#ffffff",
          head: "#101010",
          eye: "#ffffff"
        ),
        traits: ["shape": .pinned(shape)],
        background: .square,
        expression: expression
      )
    }
  }

  @MainActor
  private func raster<V: View>(_ view: V, size: CGSize) throws -> NSBitmapImageRep {
    let host = NSHostingView(rootView: view)
    host.frame = CGRect(origin: .zero, size: size)
    return try raster(host)
  }

  @MainActor
  private func raster<V: View>(_ host: NSHostingView<V>) throws -> NSBitmapImageRep {
    host.layoutSubtreeIfNeeded()
    guard let bitmap = host.bitmapImageRepForCachingDisplay(in: host.bounds) else {
      throw SnapshotError.cannotAllocateBitmap
    }
    host.cacheDisplay(in: host.bounds, to: bitmap)
    return bitmap
  }

  private func interiorPoint(
    for requestedLayer: BlobatarRenderLayer,
    in plan: BlobatarRenderPlan
  ) -> CGPoint? {
    func topLayer(at point: CGPoint) -> BlobatarRenderLayer? {
      plan.commands.last(where: { $0.path.contains(point) })?.layer
    }

    for y in 2..<98 {
      for x in 2..<98 {
        let point = CGPoint(x: x, y: y)
        guard topLayer(at: point) == requestedLayer else { continue }
        let neighbors = [
          CGPoint(x: x - 1, y: y), CGPoint(x: x + 1, y: y),
          CGPoint(x: x, y: y - 1), CGPoint(x: x, y: y + 1),
        ]
        if neighbors.allSatisfy({ topLayer(at: $0) == requestedLayer }) {
          return point
        }
      }
    }
    return nil
  }

  private func assertPixel(
    _ bitmap: NSBitmapImageRep,
    x: Int,
    y: Int,
    equals expected: BlobatarRGB?,
    file: StaticString = #filePath,
    line: UInt = #line
  ) {
    let scaleX = CGFloat(bitmap.pixelsWide) / CGFloat(bitmap.size.width)
    let scaleY = CGFloat(bitmap.pixelsHigh) / CGFloat(bitmap.size.height)
    let bitmapX = Int((CGFloat(x) * scaleX).rounded(.down))
    // `cacheDisplay` preserves the flipped SwiftUI/AppKit view coordinates in
    // this bitmap representation, so logical y grows downward here as well.
    let bitmapY = Int((CGFloat(y) * scaleY).rounded(.down))
    let color = bitmap.colorAt(x: bitmapX, y: bitmapY)?.usingColorSpace(.deviceRGB)
    if let expected {
      XCTAssertNotNil(color, file: file, line: line)
      XCTAssertEqual(color!.alphaComponent, 1, accuracy: 0.02, file: file, line: line)
      // Core Graphics may move an antialiased sample by a channel value at a
      // contour boundary. Probes are chosen from 3-by-3 interiors, and a 2/255
      // channel allowance is the only raster tolerance.
      XCTAssertEqual(color!.redComponent, expected.red, accuracy: 2 / 255, file: file, line: line)
      XCTAssertEqual(
        color!.greenComponent, expected.green, accuracy: 2 / 255, file: file, line: line)
      XCTAssertEqual(color!.blueComponent, expected.blue, accuracy: 2 / 255, file: file, line: line)
    } else {
      XCTAssertTrue(color == nil || color!.alphaComponent < 0.02, file: file, line: line)
    }
  }

  extension NSBitmapImageRep {
    fileprivate var bitmapBytes: Data {
      guard let bitmapData else { return Data() }
      return Data(bytes: bitmapData, count: bytesPerRow * pixelsHigh)
    }
  }

  private enum SnapshotError: Error {
    case cannotAllocateBitmap
  }

#endif
