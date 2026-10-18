import Foundation
import XCTest

@testable import BlobatarCore

final class MotionParityTests: XCTestCase {
  private static let fixture = try! loadMotionFixture()

  func testSeededMotionAndFixedFramesMatchTypeScriptVectors() {
    for vector in Self.fixture.motion.cases {
      let actualSeeds = resolveBlobatarMotion(vector.seed, options: vector.options.coreValue)
      XCTAssertEqual(actualSeeds.phase, vector.seeds.phase, vector.seed)
      XCTAssertEqual(actualSeeds.bob, vector.seeds.bob, vector.seed)
      XCTAssertEqual(actualSeeds.blink, vector.seeds.blink, vector.seed)
      XCTAssertEqual(actualSeeds.blinkPhase, vector.seeds.blinkPhase, vector.seed)
      XCTAssertEqual(actualSeeds.saccade, vector.seeds.saccade, vector.seed)
      XCTAssertEqual(actualSeeds.saccadePhase, vector.seeds.saccadePhase, vector.seed)
      XCTAssertEqual(actualSeeds.lookX, vector.seeds.lookX, vector.seed)
      XCTAssertEqual(actualSeeds.lookY, vector.seeds.lookY, vector.seed)
      XCTAssertEqual(actualSeeds.lookMagnitudeX, vector.seeds.lookMX, vector.seed)
      XCTAssertEqual(actualSeeds.lookMagnitudeY, vector.seeds.lookMY, vector.seed)

      for sample in vector.frames {
        let actual = blobatarMotionFrame(
          seeds: actualSeeds,
          elapsedMilliseconds: sample.elapsedMilliseconds,
          amplitude: sample.amplitude,
          shake: sample.shake
        )
        assertMotionFrame(actual, equals: sample.frame, label: vector.seed)
      }
    }
  }

  func testPoseAndTintMorphsMatchTypeScriptVectors() {
    for vector in Self.fixture.motion.morphs {
      let model = BlobatarAnimationModel(name: vector.seed)
      let from = model.expressionState(for: BlobatarExpression(rawValue: vector.from))
      let to = model.expressionState(for: BlobatarExpression(rawValue: vector.to))
      for sample in vector.samples {
        let actual = model.interpolate(from: from, to: to, progress: sample.eased)
        XCTAssertEqual(actual.pose, sample.pose.coreValue, vector.seed)
        XCTAssertEqual(actual.headColor, sample.head, vector.seed)
        XCTAssertEqual(actual.eyeColor, sample.eye, vector.seed)
      }
    }
  }

  func testSeededPhasesAreIndependentAndSaccadesHold() {
    let baseline = resolveBlobatarMotion("independent")
    let phaseOnly = resolveBlobatarMotion(
      "independent",
      options: BlobatarOptions(traits: ["motion.phase": .pinned(0.99)])
    )
    XCTAssertNotEqual(baseline.phase, phaseOnly.phase)
    XCTAssertEqual(baseline.bob, phaseOnly.bob)
    XCTAssertEqual(baseline.blink, phaseOnly.blink)
    XCTAssertEqual(baseline.saccade, phaseOnly.saccade)

    let first = blobatarMotionFrame(
      seeds: baseline,
      elapsedMilliseconds: 0.2 * Double(baseline.saccade) - Double(baseline.saccadePhase),
      amplitude: 1
    )
    let held = blobatarMotionFrame(
      seeds: baseline,
      elapsedMilliseconds: 0.3 * Double(baseline.saccade) - Double(baseline.saccadePhase),
      amplitude: 1
    )
    XCTAssertEqual(first.saccadeX, held.saccadeX, accuracy: 1e-12)
    XCTAssertEqual(first.saccadeY, held.saccadeY, accuracy: 1e-12)
  }

  func testBlinkAndWrapRemainBounded() {
    for index in 0..<100 {
      let seeds = resolveBlobatarMotion("bounds-\(index)")
      for step in 0...200 {
        let frame = blobatarMotionFrame(
          seeds: seeds,
          elapsedMilliseconds: Double(step) * 37,
          amplitude: 1
        )
        XCTAssertGreaterThanOrEqual(frame.blinkScaleY, 0.08 - 1e-9)
        XCTAssertLessThanOrEqual(frame.blinkScaleY, 1 + 1e-9)
        XCTAssertGreaterThan(frame.wrap.magnitudeX + frame.wrap.sideX + 1, 0.9)
        XCTAssertGreaterThan(frame.wrap.magnitudeX - frame.wrap.sideX + 1, 0.9)
      }
    }
  }

  func testZeroAmplitudeStartsFromStaticGeometryAndPalette() {
    let options = BlobatarOptions(background: .squircle, expression: .idle)
    let model = BlobatarAnimationModel(name: "same-start", options: options)
    let staticDrawing = resolveBlobatar("same-start", options: options)
    let frame = model.frame(
      at: 0,
      amplitude: 0,
      expression: model.expressionState(for: .idle)
    )

    XCTAssertEqual(model.drawing, staticDrawing)
    XCTAssertEqual(frame.headColor, staticDrawing.palette.head)
    XCTAssertEqual(frame.eyeColor, staticDrawing.palette.eye)
    XCTAssertEqual(frame.root, .identity)
    XCTAssertEqual(frame.hover, .identity)
    XCTAssertEqual(frame.breathe, .identity)
    XCTAssertEqual(frame.body, .identity)
    XCTAssertEqual(frame.eyePair, .identity)
  }
}

private func assertMotionFrame(
  _ actual: BlobatarMotionFrame,
  equals expected: FixtureMotionFrame,
  label: String
) {
  func equal(_ actual: Double, _ expected: Double, _ field: String) {
    XCTAssertEqual(actual, expected, accuracy: 1e-9, "\(label).\(field)")
  }
  equal(actual.shakeX, expected.shake[0], "shakeX")
  equal(actual.shakeY, expected.shake[1], "shakeY")
  equal(actual.breatheScaleX, expected.breathe[0], "breatheX")
  equal(actual.breatheScaleY, expected.breathe[1], "breatheY")
  equal(actual.bobY, expected.bob, "bob")
  equal(actual.saccadeX, expected.saccade[0], "saccadeX")
  equal(actual.saccadeY, expected.saccade[1], "saccadeY")
  equal(actual.thinkingPhase, expected.rockp, "rockp")
  equal(actual.blinkScaleY, expected.blink, "blink")
  equal(actual.wrap.magnitudeX, expected.wrap.mx, "wrap.mx")
  equal(actual.wrap.sideX, expected.wrap.side, "wrap.side")
  equal(actual.wrap.scaleY, expected.wrap.sy, "wrap.sy")
  equal(actual.wrap.rotationDegrees, expected.wrap.rot, "wrap.rot")
}

private struct MotionFixture: Decodable {
  let motion: FixtureMotion
}

private struct FixtureMotion: Decodable {
  let cases: [FixtureMotionCase]
  let morphs: [FixtureMorphCase]
}

private struct FixtureMotionCase: Decodable {
  let seed: String
  let options: FixtureMotionOptions
  let seeds: FixtureMotionSeeds
  let frames: [FixtureMotionSample]
}

private struct FixtureMotionSeeds: Decodable {
  let phase: Int
  let bob: Int
  let blink: Int
  let blinkPhase: Int
  let saccade: Int
  let saccadePhase: Int
  let lookX: Double
  let lookY: Double
  let lookMX: Double
  let lookMY: Double
}

private struct FixtureMotionSample: Decodable {
  let elapsedMilliseconds: Double
  let amplitude: Double
  let shake: Double
  let frame: FixtureMotionFrame
}

private struct FixtureMotionFrame: Decodable {
  let shake: [Double]
  let breathe: [Double]
  let bob: Double
  let saccade: [Double]
  let rockp: Double
  let blink: Double
  let wrap: FixtureMotionWrap
}

private struct FixtureMotionWrap: Decodable {
  let mx: Double
  let side: Double
  let sy: Double
  let rot: Double
}

private struct FixtureMorphCase: Decodable {
  let seed: String
  let from: String
  let to: String
  let samples: [FixtureMorphSample]
}

private struct FixtureMorphSample: Decodable {
  let eased: Double
  let pose: FixtureMotionPose
  let head: String
  let eye: String
}

private struct FixtureMotionPose: Decodable {
  let esx: Double
  let esy: Double
  let tilt: Double
  let edy: Double
  let edx: Double
  let esx2: Double
  let esy2: Double
  let tilt2: Double
  let edy2: Double
  let lock: Double
  let heat: Double
  let shake: Double
  let rock: Double
  let bdy: Double

  var coreValue: BlobatarPose {
    BlobatarPose(
      eyeScaleX: esx,
      eyeScaleY: esy,
      tiltDegrees: tilt,
      eyeOffsetY: edy,
      eyeSeparation: edx,
      secondEyeScaleX: esx2,
      secondEyeScaleY: esy2,
      secondEyeTiltDegrees: tilt2,
      secondEyeOffsetY: edy2,
      leanLock: lock,
      heat: heat,
      shake: shake,
      rock: rock,
      bodyOffsetY: bdy
    )
  }
}

private struct FixtureMotionOptions: Decodable {
  let traits: [String: FixtureMotionTrait]?
  let normalize: Bool?

  var coreValue: BlobatarOptions {
    BlobatarOptions(
      traits: traits?.mapValues(\.coreValue) ?? [:],
      normalize: normalize ?? true
    )
  }
}

private enum FixtureMotionTrait: Decodable {
  case pinned(Double)
  case narrowed([Double])

  init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()
    if let number = try? container.decode(Double.self) {
      self = .pinned(number)
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

private func loadMotionFixture() throws -> MotionFixture {
  var directory = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
  while directory.path != "/" {
    let fixture =
      directory
      .appendingPathComponent("fixtures")
      .appendingPathComponent("blobatar-v2.4.0.json")
    if FileManager.default.fileExists(atPath: fixture.path) {
      return try JSONDecoder().decode(MotionFixture.self, from: Data(contentsOf: fixture))
    }
    directory.deleteLastPathComponent()
  }
  throw CocoaError(.fileNoSuchFile)
}
