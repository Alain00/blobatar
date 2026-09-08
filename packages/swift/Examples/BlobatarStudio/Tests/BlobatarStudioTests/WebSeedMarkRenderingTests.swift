#if os(macOS)
  import AppKit
  import SwiftUI
  import XCTest

  @testable import BlobatarStudio

  final class WebSeedMarkRenderingTests: XCTestCase {
    @MainActor
    func testClaudeMarkPaintsTheAuthoredPixelSilhouetteAndColor() throws {
      let bitmap = try raster(
        WebSeedMarkView(mark: .claude, size: 100, accessibilityLabel: "Claude mark")
      )

      assertPixel(
        bitmap, x: 50, y: 50,
        equals: NSColor(srgbRed: 217 / 255, green: 119 / 255, blue: 87 / 255, alpha: 1))
      assertPixel(
        bitmap, x: 27, y: 37,
        equals: NSColor(srgbRed: 217 / 255, green: 119 / 255, blue: 87 / 255, alpha: 1))
      assertPixel(bitmap, x: 34, y: 37, equals: nil)
      assertPixel(bitmap, x: 2, y: 50, equals: nil)
      assertPixel(bitmap, x: 50, y: 84, equals: nil)
    }

    @MainActor
    func testCodexMarkPaintsTheAuthoredCloudGradientAndPrompt() throws {
      let bitmap = try raster(
        WebSeedMarkView(mark: .codex, size: 100, accessibilityLabel: "Codex mark")
      )

      assertPixel(bitmap, x: 50, y: 50, equals: .white)
      assertOpaqueNonWhitePixel(bitmap, x: 52, y: 80)
      assertPixel(bitmap, x: 2, y: 2, equals: nil)
      assertPixel(bitmap, x: 98, y: 98, equals: nil)
    }
  }

  @MainActor
  private func raster<V: View>(_ view: V) throws -> NSBitmapImageRep {
    let host = NSHostingView(rootView: view)
    host.frame = CGRect(x: 0, y: 0, width: 100, height: 100)
    host.layoutSubtreeIfNeeded()
    guard let bitmap = host.bitmapImageRepForCachingDisplay(in: host.bounds) else {
      throw MarkSnapshotError.cannotAllocateBitmap
    }
    host.cacheDisplay(in: host.bounds, to: bitmap)
    return bitmap
  }

  private func assertPixel(
    _ bitmap: NSBitmapImageRep,
    x: Int,
    y: Int,
    equals expected: NSColor?,
    file: StaticString = #filePath,
    line: UInt = #line
  ) {
    let color = colorAt(bitmap, x: x, y: y)
    guard let expected = expected?.usingColorSpace(.deviceRGB) else {
      XCTAssertTrue(color == nil || color!.alphaComponent < 0.02, file: file, line: line)
      return
    }
    XCTAssertNotNil(color, file: file, line: line)
    XCTAssertEqual(
      color!.alphaComponent, expected.alphaComponent, accuracy: 0.02, file: file, line: line)
    XCTAssertEqual(
      color!.redComponent, expected.redComponent, accuracy: 2 / 255, file: file, line: line)
    XCTAssertEqual(
      color!.greenComponent, expected.greenComponent, accuracy: 2 / 255, file: file, line: line)
    XCTAssertEqual(
      color!.blueComponent, expected.blueComponent, accuracy: 2 / 255, file: file, line: line)
  }

  private func assertOpaqueNonWhitePixel(
    _ bitmap: NSBitmapImageRep,
    x: Int,
    y: Int,
    file: StaticString = #filePath,
    line: UInt = #line
  ) {
    let color = colorAt(bitmap, x: x, y: y)
    XCTAssertNotNil(color, file: file, line: line)
    XCTAssertGreaterThan(color!.alphaComponent, 0.98, file: file, line: line)
    XCTAssertLessThan(color!.greenComponent, 0.9, file: file, line: line)
  }

  private func colorAt(_ bitmap: NSBitmapImageRep, x: Int, y: Int) -> NSColor? {
    let scaleX = CGFloat(bitmap.pixelsWide) / bitmap.size.width
    let scaleY = CGFloat(bitmap.pixelsHigh) / bitmap.size.height
    return bitmap.colorAt(
      x: Int((CGFloat(x) * scaleX).rounded(.down)),
      y: Int((CGFloat(y) * scaleY).rounded(.down))
    )?.usingColorSpace(.deviceRGB)
  }

  private enum MarkSnapshotError: Error {
    case cannotAllocateBitmap
  }
#endif
