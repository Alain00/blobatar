import BlobatarCore
import SwiftUI
import XCTest

@testable import BlobatarSwiftUI

final class PathConversionTests: XCTestCase {
  func testHorizontalVerticalAndCloseSegmentsBecomeTheSameContour() {
    let drawing = resolveBlobatar(
      "path-square",
      options: BlobatarOptions(background: .square)
    )
    let path = swiftUIPath(from: drawing.backdrop!.path)
    let elements = path.cgPath.elements

    XCTAssertEqual(
      elements.map(\.type),
      [.moveToPoint, .addLineToPoint, .addLineToPoint, .addLineToPoint, .closeSubpath]
    )
    XCTAssertEqual(elements[0].points, [CGPoint(x: 0, y: 0)])
    XCTAssertEqual(elements[1].points, [CGPoint(x: 100, y: 0)])
    XCTAssertEqual(elements[2].points, [CGPoint(x: 100, y: 100)])
    XCTAssertEqual(elements[3].points, [CGPoint(x: 0, y: 100)])
    XCTAssertEqual(path.boundingRect, CGRect(x: 0, y: 0, width: 100, height: 100))
  }

  func testEveryCoreSegmentKindKeepsItsCommandKind() {
    let cubic = resolveBlobatar(
      "path-cubic",
      options: BlobatarOptions(traits: ["shape": .pinned(0.1)])
    ).bodyPath
    let quadratic = resolveBlobatar(
      "path-quadratic",
      options: BlobatarOptions(traits: ["shape": .pinned(0.99)])
    ).bodyPath

    assertCommandKindsArePreserved(cubic)
    assertCommandKindsArePreserved(quadratic)
    XCTAssertTrue(cubic.segments.contains { if case .cubic = $0 { true } else { false } })
    XCTAssertTrue(
      quadratic.segments.contains { if case .quadratic = $0 { true } else { false } }
    )
  }

  private func assertCommandKindsArePreserved(
    _ source: BlobatarPath,
    file: StaticString = #filePath,
    line: UInt = #line
  ) {
    let expected = source.segments.map { segment in
      switch segment {
      case .move: CGPathElementType.moveToPoint
      case .line, .horizontal, .vertical: CGPathElementType.addLineToPoint
      case .cubic: CGPathElementType.addCurveToPoint
      case .quadratic: CGPathElementType.addQuadCurveToPoint
      case .close: CGPathElementType.closeSubpath
      }
    }
    XCTAssertEqual(
      swiftUIPath(from: source).cgPath.elements.map(\.type),
      expected,
      file: file,
      line: line
    )
  }
}

private struct PathElementSnapshot {
  let type: CGPathElementType
  let points: [CGPoint]
}

extension CGPath {
  fileprivate var elements: [PathElementSnapshot] {
    var result: [PathElementSnapshot] = []
    applyWithBlock { elementPointer in
      let element = elementPointer.pointee
      let pointCount: Int
      switch element.type {
      case .moveToPoint, .addLineToPoint:
        pointCount = 1
      case .addQuadCurveToPoint:
        pointCount = 2
      case .addCurveToPoint:
        pointCount = 3
      case .closeSubpath:
        pointCount = 0
      @unknown default:
        pointCount = 0
      }
      result.append(
        PathElementSnapshot(
          type: element.type,
          points: (0..<pointCount).map { element.points[$0] }
        )
      )
    }
    return result
  }
}
