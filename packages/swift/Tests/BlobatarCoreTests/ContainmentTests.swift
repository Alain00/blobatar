import Foundation
import XCTest

@testable import BlobatarCore

final class ContainmentTests: XCTestCase {
  func testSixThousandSeedSweepStaysInsideTheFaceBodyAndFrame() {
    let drawings = (0..<6_000).map { resolveBlobatar("seed-\($0)") }
    for (index, drawing) in drawings.enumerated() {
      if let failure = containmentFailure(in: drawing) {
        XCTFail("seed-\(index) \(drawing.silhouette.rawValue): \(failure)")
        return
      }
    }

    let counts = Dictionary(grouping: drawings, by: \.silhouette).mapValues(\.count)
    XCTAssertEqual(Set(counts.keys), Set(BlobatarSilhouette.allCases))
    let everyday =
      Double(counts[.round, default: 0] + counts[.organic, default: 0])
      / Double(drawings.count)
    let loud =
      Double(
        counts[.triangle, default: 0] + counts[.sun, default: 0]
          + counts[.hexagon, default: 0] + counts[.droplet, default: 0]
      ) / Double(drawings.count)
    XCTAssertGreaterThan(everyday, 0.4)
    XCTAssertLessThan(loud, 0.2)
  }

  func testExtremeAndRandomTraitOverrideSweepRetainsContainment() {
    for (index, overrides) in overrideSweep().enumerated() {
      let drawing = resolveBlobatar("cfg", options: BlobatarOptions(traits: overrides))
      if let failure = containmentFailure(in: drawing) {
        XCTFail("override \(index) \(drawing.silhouette.rawValue): \(failure)")
        return
      }
    }
  }
}

private func containmentFailure(in drawing: BlobatarDrawing) -> String? {
  for path in [drawing.bodyPath] + drawing.eyePaths + drawing.extraPaths {
    for coordinate in coordinates(path) where coordinate < -0.01 || coordinate > 100.01 {
      return "path coordinate \(coordinate) escaped the viewBox"
    }
  }
  for petal in drawing.petals {
    if petal.centerX - petal.radius < -0.01 || petal.centerX + petal.radius > 100.01
      || petal.centerY - petal.radius < -0.01 || petal.centerY + petal.radius > 100.01
    {
      return "petal escaped the viewBox"
    }
    let distance = hypot(
      petal.centerX - drawing.body.centerX,
      petal.centerY - drawing.body.centerY
    )
    if distance >= drawing.body.radiusX * 0.95 + petal.radius {
      return "petal detached from the body"
    }
  }

  guard drawing.eyes.count == 2 else { return "expected two eyes" }
  for eye in drawing.eyes {
    for corner in corners(of: eye) {
      if ellipseMeasure(corner, in: drawing.face, exponent: 2) >= 1 {
        return "eye corner escaped the safe face"
      }
      if !isInBody(corner, drawing: drawing) {
        return "eye corner escaped the body"
      }
    }
  }

  let first = drawing.eyes[0]
  let second = drawing.eyes[1]
  func horizontalReach(_ eye: BlobatarEye) -> Double {
    let angle = eye.rotationDegrees * .pi / 180
    return abs(eye.radiusX * cos(angle)) + abs(eye.radiusY * sin(angle))
  }
  if abs(second.centerX - first.centerX) <= horizontalReach(first) + horizontalReach(second) {
    return "eyes overlap"
  }

  for path in drawing.extraPaths {
    guard case .move(let start)? = path.segments.first else {
      return "extra path has no starting point"
    }
    let bodyEllipse = BlobatarEllipse(
      centerX: drawing.body.centerX,
      centerY: drawing.body.centerY,
      radiusX: drawing.body.radiusX,
      radiusY: drawing.body.radiusY
    )
    if abs(ellipseMeasure(start, in: bodyEllipse, exponent: 2) - 1) >= 0.01 {
      return "taper does not meet the body"
    }
    if drawing.body.exponent != 2 { return "taper body is not elliptical" }
  }
  return nil
}

private func corners(of eye: BlobatarEye) -> [BlobatarPoint] {
  let angle = eye.rotationDegrees * .pi / 180
  let cosine = cos(angle)
  let sine = sin(angle)
  return [(1.0, 1.0), (1, -1), (-1, 1), (-1, -1)].map { x, y in
    BlobatarPoint(
      x: eye.centerX + x * eye.radiusX * cosine - y * eye.radiusY * sine,
      y: eye.centerY + x * eye.radiusX * sine + y * eye.radiusY * cosine
    )
  }
}

private func ellipseMeasure(
  _ point: BlobatarPoint,
  in ellipse: BlobatarEllipse,
  exponent: Double
) -> Double {
  pow(abs((point.x - ellipse.centerX) / ellipse.radiusX), exponent)
    + pow(abs((point.y - ellipse.centerY) / ellipse.radiusY), exponent)
}

private func isInBody(_ point: BlobatarPoint, drawing: BlobatarDrawing) -> Bool {
  let body = drawing.body
  switch drawing.silhouette {
  case .triangle, .hexagon:
    return isInConvexPolygon(point, vertices: cutHull(body))
  case .capsule:
    let half = body.radiusX - body.radiusY
    let deltaX = max(0, abs(point.x - body.centerX) - half)
    return hypot(deltaX, point.y - body.centerY) <= body.radiusY
  default:
    let shrink: Double
    if drawing.silhouette == .organic || drawing.silhouette == .cloud {
      shrink = body.radialMultipliers.min()! * 0.95
    } else {
      shrink = 1
    }
    let angle = -body.rotationDegrees * .pi / 180
    let deltaX = point.x - body.centerX
    let deltaY = point.y - body.centerY
    let unrotated = BlobatarPoint(
      x: body.centerX + deltaX * cos(angle) - deltaY * sin(angle),
      y: body.centerY + deltaX * sin(angle) + deltaY * cos(angle)
    )
    let conservativeBody = BlobatarEllipse(
      centerX: body.centerX,
      centerY: body.centerY,
      radiusX: body.radiusX * shrink,
      radiusY: body.radiusY * shrink
    )
    return ellipseMeasure(unrotated, in: conservativeBody, exponent: min(body.exponent, 2)) < 1
  }
}

private func cutHull(_ body: BlobatarBody) -> [BlobatarPoint] {
  let rounding = body.cornerRounding!
  let k = rounding > 0 ? (rounding < 1 ? rounding / 2 : 0.5) : 0
  let sides = body.polygonSides!
  let start = body.rotationDegrees * .pi / 180 - .pi / 2
  let vertices = (0..<sides).map { index in
    let angle = start + 2 * .pi * Double(index) / Double(sides)
    return BlobatarPoint(
      x: body.centerX + body.radiusX * cos(angle),
      y: body.centerY + body.radiusY * sin(angle)
    )
  }
  func at(_ index: Int) -> BlobatarPoint {
    vertices[((index % sides) + sides) % sides]
  }

  var hull: [BlobatarPoint] = []
  for index in 0..<sides {
    for neighbor in [index - 1, index + 1] {
      let vertex = at(index)
      let other = at(neighbor)
      hull.append(
        BlobatarPoint(
          x: vertex.x + (other.x - vertex.x) * k,
          y: vertex.y + (other.y - vertex.y) * k
        )
      )
    }
  }
  return hull.sorted {
    atan2($0.y - body.centerY, $0.x - body.centerX)
      < atan2($1.y - body.centerY, $1.x - body.centerX)
  }
}

private func isInConvexPolygon(_ point: BlobatarPoint, vertices: [BlobatarPoint]) -> Bool {
  var hasNegative = false
  var hasPositive = false
  for index in vertices.indices {
    let start = vertices[index]
    let end = vertices[(index + 1) % vertices.count]
    let cross =
      (end.x - start.x) * (point.y - start.y)
      - (end.y - start.y) * (point.x - start.x)
    if cross > 1e-9 { hasPositive = true }
    if cross < -1e-9 { hasNegative = true }
  }
  return !(hasPositive && hasNegative)
}

private func coordinates(_ path: BlobatarPath) -> [Double] {
  path.segments.flatMap { segment -> [Double] in
    return switch segment {
    case .move(let point), .line(let point):
      [point.x, point.y]
    case .cubic(let control1, let control2, let point):
      [control1.x, control1.y, control2.x, control2.y, point.x, point.y]
    case .quadratic(let control, let point):
      [control.x, control.y, point.x, point.y]
    case .horizontal(let x):
      [x]
    case .vertical(let y):
      [y]
    case .close:
      []
    }
  }
}

private let traitKeys = [
  "shape", "hue", "tone", "body.r", "body.ratio", "body.x", "body.y", "body.n",
  "body.rot", "body.pts", "body.r0", "body.r1", "body.r2", "body.r3", "body.r4",
  "body.r5", "body.r6", "body.r7", "gaze.x", "gaze.y", "eye.rx", "eye.ratio",
  "eye.scale", "eye.stretch", "eye.gap", "eye.n", "eye.lean", "eye.lean2", "eye.dy",
  "sun.n", "sun.dist", "sun.r", "sun.rot", "cloud.n", "cloud.r0", "cloud.r1",
  "cloud.r2", "cloud.r3", "cloud.r4", "cloud.r5", "nub.n", "nub.a0", "nub.a1",
  "nub.r0", "nub.r1", "poly.round", "capsule.squat", "droplet.tip",
]

private func overrideSweep() -> [[String: BlobatarTraitOverride]] {
  var output: [[String: BlobatarTraitOverride]] = []
  for value in [0.0, 0.5, 0.999_999] {
    let all: [String: BlobatarTraitOverride] = Dictionary(
      uniqueKeysWithValues: traitKeys.map { ($0, BlobatarTraitOverride.pinned(value)) }
    )
    output.append(all)
    for key in traitKeys {
      var low = all
      low[key] = .pinned(0)
      output.append(low)
      var high = all
      high[key] = .pinned(0.999_999)
      output.append(high)
    }
  }
  for shape in [0.1, 0.35, 0.55, 0.65, 0.75, 0.82, 0.89, 0.93, 0.96, 0.99] {
    for value in [0.0, 0.5, 0.999_999] {
      var all: [String: BlobatarTraitOverride] = Dictionary(
        uniqueKeysWithValues: traitKeys.map { ($0, BlobatarTraitOverride.pinned(value)) }
      )
      all["shape"] = .pinned(shape)
      output.append(all)
    }
  }

  var state: UInt32 = 1
  for _ in 0..<400 {
    var random: [String: BlobatarTraitOverride] = [:]
    for key in traitKeys {
      state = state &* 1_664_525 &+ 1_013_904_223
      random[key] = .pinned(Double(state) / 4_294_967_296)
    }
    output.append(random)
  }
  return output
}
