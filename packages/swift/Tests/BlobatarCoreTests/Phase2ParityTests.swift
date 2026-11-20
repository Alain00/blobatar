import Foundation
import XCTest

@testable import BlobatarCore

final class Phase2ParityTests: XCTestCase {
  private static let fixture: Phase2Fixture = try! loadPhase2Fixture()

  func testEveryHashAndStreamVectorMatchesExactly() {
    for vector in Self.fixture.hash {
      XCTAssertEqual(normalizeSeed(vector.seed), vector.normalized, "normalize \(vector.seed)")
      let state = seedState(vector.seed)
      XCTAssertEqual(Int64(Int32(bitPattern: state)), vector.state, "state \(vector.seed)")
      for (key, expected) in vector.streams {
        XCTAssertEqual(stream(state: state, key: key), expected, "stream \(vector.seed) \(key)")
      }
    }
  }

  func testEveryPinnedAndNarrowedOverrideVectorMatchesExactly() {
    for vector in Self.fixture.overrides {
      let traits = TraitReader(
        name: vector.seed,
        overrides: vector.overrides.mapValues(\.coreValue)
      )
      for (key, expected) in vector.values {
        XCTAssertEqual(traits.value(key), expected, "override \(vector.seed) \(key)")
      }
    }
  }

  func testEveryPaletteVectorMatchesThePinnedRamp() {
    for vector in Self.fixture.palette {
      let palette = makePalette(
        hue: vector.hue,
        tone: vector.tone,
        enforceContrast: true
      )
      XCTAssertEqual(palette.background, vector.hex["bg"], "palette bg \(vector)")
      XCTAssertEqual(palette.head, vector.hex["head"], "palette head \(vector)")
      XCTAssertEqual(palette.eye, vector.hex["eye"], "palette eye \(vector)")

      let ramp = makeRamp(hue: vector.hue, tone: vector.tone, enforceContrast: false)
      for key in ["bg", "head", "eye"] {
        let actual = ramp[key]!
        let expected = vector.rampUnenforced[key]!
        XCTAssertTrue(closeEnough(actual.lightness, expected.lightness), "\(key).l \(vector)")
        XCTAssertTrue(closeEnough(actual.chroma, expected.chroma), "\(key).c \(vector)")
        XCTAssertTrue(closeEnough(actual.hue, expected.hue), "\(key).h \(vector)")
      }
    }
  }

  func testEveryGenerationTwoLayoutAndPathVectorMatches() {
    var firstFailure: String?
    var failures = 0
    for vector in Self.fixture.cases {
      if let failure = compare(vector) {
        failures += 1
        if firstFailure == nil {
          firstFailure = "seed=\(vector.seed), options=\(vector.options): \(failure)"
        }
      }
    }
    XCTAssertEqual(failures, 0, firstFailure ?? "")
  }
}

private func compare(_ expected: FixtureCase) -> String? {
  let actual = resolveBlobatar(expected.seed, options: expected.options.coreValue)
  if actual.silhouette.rawValue != expected.shape { return "silhouette" }

  if !closeEnough(actual.body.centerX, expected.body.cx) { return "body.centerX" }
  if !closeEnough(actual.body.centerY, expected.body.cy) { return "body.centerY" }
  if !closeEnough(actual.body.radiusX, expected.body.rx) { return "body.radiusX" }
  if !closeEnough(actual.body.radiusY, expected.body.ry) { return "body.radiusY" }
  if !closeEnough(actual.body.exponent, expected.body.n) { return "body.exponent" }
  if !closeEnough(actual.body.rotationDegrees, expected.body.rot) { return "body.rotation" }
  if actual.body.radialMultipliers.count != expected.body.radii.count { return "body.radii.count" }
  for index in expected.body.radii.indices {
    if !closeEnough(actual.body.radialMultipliers[index], expected.body.radii[index]) {
      return "body.radii[\(index)]"
    }
  }
  if actual.body.polygonSides != expected.body.sides { return "body.sides" }
  if !closeOptional(actual.body.cornerRounding, expected.body.round) { return "body.round" }

  if let failure = compare(actual.face, expected.face, label: "face") { return failure }
  if actual.eyes.count != expected.eyes.count { return "eyes.count" }
  for index in expected.eyes.indices {
    let eye = actual.eyes[index]
    let fixture = expected.eyes[index]
    if !closeEnough(eye.centerX, fixture.cx) { return "eyes[\(index)].centerX" }
    if !closeEnough(eye.centerY, fixture.cy) { return "eyes[\(index)].centerY" }
    if !closeEnough(eye.radiusX, fixture.rx) { return "eyes[\(index)].radiusX" }
    if !closeEnough(eye.radiusY, fixture.ry) { return "eyes[\(index)].radiusY" }
    if !closeEnough(eye.exponent, fixture.n) { return "eyes[\(index)].exponent" }
    if !closeEnough(eye.rotationDegrees, fixture.rot) { return "eyes[\(index)].rotation" }
  }

  if actual.petals.count != expected.petals.count { return "petals.count" }
  for index in expected.petals.indices {
    let petal = actual.petals[index]
    let fixture = expected.petals[index]
    if !closeEnough(petal.centerX, fixture.cx) { return "petals[\(index)].centerX" }
    if !closeEnough(petal.centerY, fixture.cy) { return "petals[\(index)].centerY" }
    if !closeEnough(petal.radius, fixture.r) { return "petals[\(index)].radius" }
  }

  if actual.extraPaths.map(\.pathData) != expected.extra { return "extraPaths" }
  if actual.bodyPath.pathData != expected.bodyPath { return "bodyPath" }
  if actual.eyePaths.map(\.pathData) != expected.eyePaths { return "eyePaths" }
  if actual.palette.background != expected.palette["bg"] { return "palette.background" }
  if actual.palette.head != expected.palette["head"] { return "palette.head" }
  if actual.palette.eye != expected.palette["eye"] { return "palette.eye" }
  return nil
}

private func compare(
  _ actual: BlobatarEllipse,
  _ expected: FixtureEllipse,
  label: String
) -> String? {
  if !closeEnough(actual.centerX, expected.cx) { return "\(label).centerX" }
  if !closeEnough(actual.centerY, expected.cy) { return "\(label).centerY" }
  if !closeEnough(actual.radiusX, expected.rx) { return "\(label).radiusX" }
  if !closeEnough(actual.radiusY, expected.ry) { return "\(label).radiusY" }
  return nil
}

private func closeEnough(_ actual: Double, _ expected: Double) -> Bool {
  abs(actual - expected) <= 1e-9 * max(1, abs(actual), abs(expected))
}

private func closeOptional(_ actual: Double?, _ expected: Double?) -> Bool {
  switch (actual, expected) {
  case (nil, nil): true
  case (.some(let actual), .some(let expected)): closeEnough(actual, expected)
  default: false
  }
}

private struct Phase2Fixture: Decodable {
  let hash: [HashVector]
  let overrides: [OverrideVector]
  let palette: [PaletteVector]
  let cases: [FixtureCase]
}

private struct HashVector: Decodable {
  let seed: String
  let normalized: String
  let state: Int64
  let streams: [String: Double]
}

private struct OverrideVector: Decodable {
  let seed: String
  let overrides: [String: FixtureTraitOverride]
  let values: [String: Double]
}

private enum FixtureTraitOverride: Decodable, CustomStringConvertible {
  case pinned(Double)
  case narrowed([Double])

  init(from decoder: Decoder) throws {
    let value = try decoder.singleValueContainer()
    if let pinned = try? value.decode(Double.self) {
      self = .pinned(pinned)
    } else {
      self = .narrowed(try value.decode([Double].self))
    }
  }

  var coreValue: BlobatarTraitOverride {
    switch self {
    case .pinned(let value): .pinned(value)
    case .narrowed(let values): .narrowed(values)
    }
  }

  var description: String {
    switch self {
    case .pinned(let value): String(value)
    case .narrowed(let values): String(describing: values)
    }
  }
}

private struct PaletteVector: Decodable, CustomStringConvertible {
  let hue: Double
  let tone: Double
  let rampUnenforced: [String: FixtureOklch]
  let hex: [String: String]

  var description: String { "hue=\(hue), tone=\(tone)" }
}

private struct FixtureOklch: Decodable {
  let lightness: Double
  let chroma: Double
  let hue: Double

  private enum CodingKeys: String, CodingKey {
    case lightness = "l"
    case chroma = "c"
    case hue = "h"
  }
}

private struct FixtureCase: Decodable {
  let seed: String
  let options: FixtureOptions
  let shape: String
  let body: FixtureBody
  let face: FixtureEllipse
  let eyes: [FixtureEye]
  let petals: [FixturePetal]
  let extra: [String]
  let bodyPath: String
  let eyePaths: [String]
  let palette: [String: String]
}

private struct FixtureOptions: Decodable, CustomStringConvertible {
  let palette: [String: String]?
  let hue: Double?
  let tone: Double?
  let traits: [String: FixtureTraitOverride]?
  let normalize: Bool?
  let contrast: Bool?

  var coreValue: BlobatarOptions {
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
      contrast: contrast ?? true
    )
  }

  var description: String {
    "hue=\(String(describing: hue)), tone=\(String(describing: tone)), traits=\(String(describing: traits))"
  }
}

private struct FixtureBody: Decodable {
  let cx: Double
  let cy: Double
  let rx: Double
  let ry: Double
  let n: Double
  let rot: Double
  let radii: [Double]
  let sides: Int?
  let round: Double?
}

private struct FixtureEllipse: Decodable {
  let cx: Double
  let cy: Double
  let rx: Double
  let ry: Double
}

private struct FixtureEye: Decodable {
  let cx: Double
  let cy: Double
  let rx: Double
  let ry: Double
  let n: Double
  let rot: Double
}

private struct FixturePetal: Decodable {
  let cx: Double
  let cy: Double
  let r: Double
}

private func loadPhase2Fixture() throws -> Phase2Fixture {
  var directory = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
  while directory.path != "/" {
    let manifest = directory.appendingPathComponent("Package.swift")
    if FileManager.default.fileExists(atPath: manifest.path) {
      let fixture = directory.appendingPathComponent("fixtures/blobatar-v2.4.0.json")
      return try JSONDecoder().decode(Phase2Fixture.self, from: Data(contentsOf: fixture))
    }
    directory.deleteLastPathComponent()
  }
  throw FixtureLoadingError.packageRootNotFound
}

private enum FixtureLoadingError: Error {
  case packageRootNotFound
}
