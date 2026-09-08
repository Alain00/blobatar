import Foundation
import XCTest

@testable import BlobatarCore

final class ExpressionParityTests: XCTestCase {
  private static let fixture = try! loadExpressionFixture()

  func testCompleteExpressionRosterAndPoseChannelsMatchExactly() {
    let actualNames = Set(BlobatarExpression.allCases.map(\.rawValue))
    XCTAssertEqual(actualNames, Set(Self.fixture.expressions.keys))
    XCTAssertEqual(actualNames.count, 14)

    for expression in BlobatarExpression.allCases {
      XCTAssertEqual(
        expression.pose,
        Self.fixture.expressions[expression.rawValue]!.pose.coreValue,
        expression.rawValue
      )
    }
  }

  func testEveryExpressionCaseMatchesGeometryPathsOffsetsAndPalette() {
    for expression in BlobatarExpression.allCases {
      let vector = Self.fixture.expressions[expression.rawValue]!
      for expected in vector.cases {
        let drawing = resolveBlobatar(
          expected.seed,
          options: expected.options.coreValue(expression: expression)
        )

        XCTAssertEqual(drawing.silhouette.rawValue, expected.shape, expression.rawValue)
        XCTAssertEqual(drawing.bodyPath.pathData, expected.bodyPath, expression.rawValue)
        XCTAssertEqual(drawing.eyePaths.map(\.pathData), expected.eyePaths, expression.rawValue)
        XCTAssertEqual(drawing.bodyOffsetY, vector.pose.bodyOffsetY, expression.rawValue)
        XCTAssertEqual(drawing.palette.background, expected.palette["bg"], expression.rawValue)
        XCTAssertEqual(drawing.palette.head, expected.palette["head"], expression.rawValue)
        XCTAssertEqual(drawing.palette.eye, expected.palette["eye"], expression.rawValue)
        XCTAssertEqual(drawing.eyes.count, expected.eyes.count, expression.rawValue)
        for index in expected.eyes.indices {
          assertEye(
            drawing.eyes[index],
            equals: expected.eyes[index],
            expression: expression,
            index: index
          )
        }
      }
    }
  }

  func testOmittedExpressionIsExactlyIdle() {
    for index in 0..<200 {
      let name = "idle-\(index)"
      let options = BlobatarOptions(background: index.isMultiple(of: 2) ? .squircle : nil)
      let idleOptions = BlobatarOptions(
        background: index.isMultiple(of: 2) ? .squircle : nil,
        expression: .idle
      )
      XCTAssertEqual(
        resolveBlobatar(name, options: options),
        resolveBlobatar(name, options: idleOptions),
        name
      )
    }
  }

  func testSecondEyeDifferentialsAndLeanLockStayOneSided() {
    let base = resolveBlobatar("expression-differentials")
    let wink = resolveBlobatar(
      "expression-differentials",
      options: BlobatarOptions(expression: .wink)
    )
    let winkPose = BlobatarExpression.wink.pose

    XCTAssertEqual(
      wink.eyes[0].radiusX / base.eyes[0].radiusX,
      winkPose.eyeScaleX,
      accuracy: 1e-12
    )
    XCTAssertEqual(
      wink.eyes[1].radiusX / base.eyes[1].radiusX,
      winkPose.eyeScaleX + winkPose.secondEyeScaleX,
      accuracy: 1e-12
    )
    XCTAssertEqual(
      wink.eyes[0].radiusY / base.eyes[0].radiusY,
      winkPose.eyeScaleY,
      accuracy: 1e-12
    )
    XCTAssertEqual(
      wink.eyes[1].radiusY / base.eyes[1].radiusY,
      winkPose.eyeScaleY + winkPose.secondEyeScaleY,
      accuracy: 1e-12
    )

    let sleepy = resolveBlobatar(
      "expression-differentials",
      options: BlobatarOptions(expression: .sleepy)
    )
    XCTAssertEqual(sleepy.eyes[0].rotationDegrees, 0)
    XCTAssertEqual(sleepy.eyes[1].rotationDegrees, 4)
  }

  func testTintingExpressionsRetainContrastAndStartFromPaletteOverrides() {
    for expression in BlobatarExpression.allCases where expression.tint != nil {
      for index in 0..<100 {
        let drawing = resolveBlobatar(
          "tint-\(index)",
          options: BlobatarOptions(expression: expression)
        )
        XCTAssertGreaterThanOrEqual(
          contrast(fromHex(drawing.palette.eye), fromHex(drawing.palette.head)),
          4.5,
          "\(expression.rawValue) tint-\(index)"
        )
      }
    }

    let overridden = resolveBlobatar(
      "override-tint",
      options: BlobatarOptions(
        palette: BlobatarPaletteOverride(head: "#335577", eye: "#ffffff"),
        expression: .mad
      )
    )
    let target = tinted(
      head: "#335577",
      eye: "#ffffff",
      toward: BlobatarTint.hot.target
    )
    XCTAssertEqual(
      overridden.palette.head,
      mixHex("#335577", target.head, amount: BlobatarExpression.mad.pose.heat)
    )
    XCTAssertEqual(
      overridden.palette.eye,
      mixHex("#ffffff", target.eye, amount: BlobatarExpression.mad.pose.heat)
    )
  }

  func testExpressionExtremesKeepPathsInFrameAndEyesSeparate() {
    for expression in BlobatarExpression.allCases {
      for index in 0..<800 {
        let drawing = resolveBlobatar(
          "expression-\(index)",
          options: BlobatarOptions(expression: expression)
        )
        let offset = drawing.bodyOffsetY
        for path in [drawing.bodyPath] + drawing.eyePaths + drawing.extraPaths {
          for point in points(in: path) {
            XCTAssertGreaterThanOrEqual(point.x, -0.01, expression.rawValue)
            XCTAssertLessThanOrEqual(point.x, 100.01, expression.rawValue)
            XCTAssertGreaterThanOrEqual(point.y + offset, -0.01, expression.rawValue)
            XCTAssertLessThanOrEqual(point.y + offset, 100.01, expression.rawValue)
          }
        }
        for petal in drawing.petals {
          XCTAssertGreaterThanOrEqual(petal.centerX - petal.radius, -0.01, expression.rawValue)
          XCTAssertLessThanOrEqual(petal.centerX + petal.radius, 100.01, expression.rawValue)
          XCTAssertGreaterThanOrEqual(
            petal.centerY - petal.radius + offset,
            -0.01,
            expression.rawValue
          )
          XCTAssertLessThanOrEqual(
            petal.centerY + petal.radius + offset,
            100.01,
            expression.rawValue
          )
        }

        let left = drawing.eyes[0]
        let right = drawing.eyes[1]
        XCTAssertGreaterThan(
          abs(right.centerX - left.centerX),
          horizontalReach(left) + horizontalReach(right),
          "\(expression.rawValue) expression-\(index)"
        )
      }
    }
  }

  private func assertEye(
    _ actual: BlobatarEye,
    equals expected: FixtureExpressionEye,
    expression: BlobatarExpression,
    index: Int
  ) {
    let label = "\(expression.rawValue).eyes[\(index)]"
    XCTAssertTrue(closeEnough(actual.centerX, expected.centerX), "\(label).centerX")
    XCTAssertTrue(closeEnough(actual.centerY, expected.centerY), "\(label).centerY")
    XCTAssertTrue(closeEnough(actual.radiusX, expected.radiusX), "\(label).radiusX")
    XCTAssertTrue(closeEnough(actual.radiusY, expected.radiusY), "\(label).radiusY")
    XCTAssertTrue(closeEnough(actual.exponent, expected.exponent), "\(label).exponent")
    XCTAssertTrue(
      closeEnough(actual.rotationDegrees, expected.rotationDegrees), "\(label).rotation")
  }
}

private func horizontalReach(_ eye: BlobatarEye) -> Double {
  let angle = eye.rotationDegrees * .pi / 180
  return abs(eye.radiusX * cos(angle)) + abs(eye.radiusY * sin(angle))
}

private func points(in path: BlobatarPath) -> [BlobatarPoint] {
  var points: [BlobatarPoint] = []
  var current = BlobatarPoint(x: 0, y: 0)
  var start = current
  for segment in path.segments {
    switch segment {
    case .move(let point), .line(let point):
      points.append(point)
      current = point
      if case .move = segment { start = point }
    case .cubic(let control1, let control2, let point):
      points.append(contentsOf: [control1, control2, point])
      current = point
    case .quadratic(let control, let point):
      points.append(contentsOf: [control, point])
      current = point
    case .horizontal(let x):
      current = BlobatarPoint(x: x, y: current.y)
      points.append(current)
    case .vertical(let y):
      current = BlobatarPoint(x: current.x, y: y)
      points.append(current)
    case .close:
      current = start
    }
  }
  return points
}

private func closeEnough(_ actual: Double, _ expected: Double) -> Bool {
  abs(actual - expected) <= 1e-9 * max(1, abs(actual), abs(expected))
}

private struct ExpressionFixture: Decodable {
  let expressions: [String: FixtureExpressionVector]
}

private struct FixtureExpressionVector: Decodable {
  let pose: FixtureExpressionPose
  let cases: [FixtureExpressionCase]
}

private struct FixtureExpressionPose: Decodable {
  let eyeScaleX: Double
  let eyeScaleY: Double
  let tiltDegrees: Double
  let eyeOffsetY: Double
  let eyeSeparation: Double
  let secondEyeScaleX: Double
  let secondEyeScaleY: Double
  let secondEyeTiltDegrees: Double
  let secondEyeOffsetY: Double
  let leanLock: Double
  let heat: Double
  let shake: Double
  let rock: Double
  let bodyOffsetY: Double

  private enum CodingKeys: String, CodingKey {
    case eyeScaleX = "esx"
    case eyeScaleY = "esy"
    case tiltDegrees = "tilt"
    case eyeOffsetY = "edy"
    case eyeSeparation = "edx"
    case secondEyeScaleX = "esx2"
    case secondEyeScaleY = "esy2"
    case secondEyeTiltDegrees = "tilt2"
    case secondEyeOffsetY = "edy2"
    case leanLock = "lock"
    case heat
    case shake
    case rock
    case bodyOffsetY = "bdy"
  }

  var coreValue: BlobatarPose {
    BlobatarPose(
      eyeScaleX: eyeScaleX,
      eyeScaleY: eyeScaleY,
      tiltDegrees: tiltDegrees,
      eyeOffsetY: eyeOffsetY,
      eyeSeparation: eyeSeparation,
      secondEyeScaleX: secondEyeScaleX,
      secondEyeScaleY: secondEyeScaleY,
      secondEyeTiltDegrees: secondEyeTiltDegrees,
      secondEyeOffsetY: secondEyeOffsetY,
      leanLock: leanLock,
      heat: heat,
      shake: shake,
      rock: rock,
      bodyOffsetY: bodyOffsetY
    )
  }
}

private struct FixtureExpressionCase: Decodable {
  let seed: String
  let options: FixtureExpressionOptions
  let shape: String
  let eyes: [FixtureExpressionEye]
  let bodyPath: String
  let eyePaths: [String]
  let palette: [String: String]
}

private struct FixtureExpressionEye: Decodable {
  let centerX: Double
  let centerY: Double
  let radiusX: Double
  let radiusY: Double
  let exponent: Double
  let rotationDegrees: Double

  private enum CodingKeys: String, CodingKey {
    case centerX = "cx"
    case centerY = "cy"
    case radiusX = "rx"
    case radiusY = "ry"
    case exponent = "n"
    case rotationDegrees = "rot"
  }
}

private struct FixtureExpressionOptions: Decodable {
  let palette: [String: String]?
  let hue: Double?
  let tone: Double?
  let traits: [String: FixtureExpressionTrait]?
  let normalize: Bool?
  let contrast: Bool?
  let background: String?

  func coreValue(expression: BlobatarExpression) -> BlobatarOptions {
    BlobatarOptions(
      palette: palette.map {
        BlobatarPaletteOverride(
          background: $0["bg"],
          head: $0["head"],
          eye: $0["eye"]
        )
      },
      hue: hue,
      tone: tone,
      traits: traits?.mapValues(\.coreValue) ?? [:],
      normalize: normalize ?? true,
      contrast: contrast ?? true,
      background: background.flatMap(BlobatarBackdrop.init(rawValue:)),
      expression: expression
    )
  }
}

private enum FixtureExpressionTrait: Decodable {
  case pinned(Double)
  case narrowed([Double])

  init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()
    if let pinned = try? container.decode(Double.self) {
      self = .pinned(pinned)
    } else {
      self = .narrowed(try container.decode([Double].self))
    }
  }

  var coreValue: BlobatarTraitOverride {
    switch self {
    case .pinned(let value): .pinned(value)
    case .narrowed(let values): .narrowed(values)
    }
  }
}

private func loadExpressionFixture() throws -> ExpressionFixture {
  var directory = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
  while directory.path != "/" {
    if FileManager.default.fileExists(
      atPath: directory.appendingPathComponent("Package.swift").path)
    {
      let fixture = directory.appendingPathComponent("fixtures/blobatar-v2.4.0.json")
      return try JSONDecoder().decode(ExpressionFixture.self, from: Data(contentsOf: fixture))
    }
    directory.deleteLastPathComponent()
  }
  throw ExpressionFixtureError.packageRootNotFound
}

private enum ExpressionFixtureError: Error {
  case packageRootNotFound
}
