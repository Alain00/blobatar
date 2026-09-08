import Foundation
import XCTest

@testable import BlobatarCore

final class ReferenceFixtureTests: XCTestCase {
  func testContractMetadataMatchesCanonicalFixture() throws {
    let fixture = try loadFixture()
    let metadata = try XCTUnwrap(fixture["meta"] as? [String: Any])

    XCTAssertEqual(metadata["schemaVersion"] as? Int, 3)
    XCTAssertEqual(metadata["version"] as? String, BlobatarContract.referenceVersion)
    XCTAssertEqual(metadata["generation"] as? String, BlobatarContract.generation)
    XCTAssertEqual(metadata["caseCount"] as? Int, 1_570)
    XCTAssertEqual(metadata["expressionCaseCount"] as? Int, 42)
    XCTAssertEqual(metadata["motionCaseCount"] as? Int, 4)
    XCTAssertEqual(metadata["motionFrameCount"] as? Int, 24)

    XCTAssertEqual((fixture["cases"] as? [Any])?.count, 1_570)
    XCTAssertEqual((fixture["hash"] as? [Any])?.count, 31)
    XCTAssertEqual((fixture["overrides"] as? [Any])?.count, 9)
    XCTAssertEqual((fixture["palette"] as? [Any])?.count, 112)
    XCTAssertEqual((fixture["expressions"] as? [String: Any])?.count, 14)
  }

  func testFixtureDeclaresExactAndTolerantComparisonRules() throws {
    let fixture = try loadFixture()
    let metadata = try XCTUnwrap(fixture["meta"] as? [String: Any])
    let rules = try XCTUnwrap(metadata["comparisonRules"] as? [String: Any])
    let exact = try XCTUnwrap(rules["exact"] as? [String])
    let relative = try XCTUnwrap(rules["relativeTolerance"] as? [String: Any])

    XCTAssertEqual(
      Set(exact),
      Set([
        "hash-state", "stream-floats", "palette-hex", "path-strings", "shape-names",
        "motion-seeds", "motion-colors",
      ])
    )
    XCTAssertEqual(relative["layout"] as? Double, 1e-9)
    XCTAssertEqual(relative["motion"] as? Double, 1e-9)
  }

  func testFixtureCoversEveryGenerationTwoSilhouette() throws {
    let fixture = try loadFixture()
    let metadata = try XCTUnwrap(fixture["meta"] as? [String: Any])
    let counts = try XCTUnwrap(metadata["shapeCounts"] as? [String: Int])

    XCTAssertEqual(
      Set(counts.keys),
      Set([
        "round", "organic", "boxy", "capsule", "nub",
        "cloud", "droplet", "hexagon", "sun", "triangle",
      ])
    )
    XCTAssertTrue(counts.values.allSatisfy { $0 >= 25 })
  }

  func testFlutterWorkstreamFixtureIsByteIdenticalWhenPresent() throws {
    let canonical = try Data(contentsOf: fixtureURL())
    let flutter = try packageRootURL()
      .appendingPathComponent("packages/flutter/test/fixtures/reference-vectors.json")

    guard FileManager.default.fileExists(atPath: flutter.path) else {
      return
    }

    XCTAssertEqual(try Data(contentsOf: flutter), canonical)
  }

  private func loadFixture() throws -> [String: Any] {
    let data = try Data(contentsOf: fixtureURL())
    return try XCTUnwrap(
      JSONSerialization.jsonObject(with: data) as? [String: Any]
    )
  }

  private func fixtureURL() throws -> URL {
    let fixture = try packageRootURL()
      .appendingPathComponent("fixtures")
      .appendingPathComponent("blobatar-v2.4.0.json")
    return try XCTUnwrap(
      FileManager.default.fileExists(atPath: fixture.path) ? fixture : nil,
      "Missing canonical reference fixture at \(fixture.path)"
    )
  }

  private func packageRootURL() throws -> URL {
    var directory = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
    let fileManager = FileManager.default

    while directory.path != "/" {
      let manifest = directory.appendingPathComponent("Package.swift")
      if fileManager.fileExists(atPath: manifest.path) {
        return directory
      }
      directory.deleteLastPathComponent()
    }

    throw FixtureError.packageRootNotFound
  }
}

private enum FixtureError: Error {
  case packageRootNotFound
}
