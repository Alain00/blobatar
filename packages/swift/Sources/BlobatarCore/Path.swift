import Foundation

/// One absolute command in a renderer-neutral Blobatar path.
public enum BlobatarPathSegment: Sendable, Equatable, Hashable {
  case move(to: BlobatarPoint)
  case line(to: BlobatarPoint)
  case cubic(control1: BlobatarPoint, control2: BlobatarPoint, to: BlobatarPoint)
  case quadratic(control: BlobatarPoint, to: BlobatarPoint)
  case horizontal(toX: Double)
  case vertical(toY: Double)
  case close
}

/// A structured path in Blobatar's 100-by-100 drawing space.
public struct BlobatarPath: Sendable, Equatable, Hashable {
  public let segments: [BlobatarPathSegment]

  init(_ segments: [BlobatarPathSegment]) {
    self.segments = segments
  }

  /// Exact generation-2 SVG serialization used only by the parity harness.
  var pathData: String {
    segments.map(\.pathData).joined()
  }
}

extension BlobatarPathSegment {
  fileprivate var pathData: String {
    switch self {
    case .move(let point):
      "M\(r2(point.x)) \(r2(point.y))"
    case .line(let point):
      "L\(r2(point.x)) \(r2(point.y))"
    case .cubic(let control1, let control2, let point):
      "C\(r2(control1.x)) \(r2(control1.y)) \(r2(control2.x)) \(r2(control2.y)) \(r2(point.x)) \(r2(point.y))"
    case .quadratic(let control, let point):
      "Q\(r2(control.x)) \(r2(control.y)) \(r2(point.x)) \(r2(point.y))"
    case .horizontal(let x):
      "H\(r2(x))"
    case .vertical(let y):
      "V\(r2(y))"
    case .close:
      "Z"
    }
  }
}

/// JavaScript `Math.round`, whose half values move toward positive infinity.
private func jsRound(_ value: Double) -> Double {
  floor(value + 0.5)
}

private func r2(_ value: Double) -> String {
  let rounded = jsRound(value * 100) / 100
  if rounded == 0 { return "0" }
  if rounded.rounded(.towardZero) == rounded {
    return String(Int64(rounded))
  }
  return String(rounded)
}

private func point(_ x: Double, _ y: Double) -> BlobatarPoint {
  BlobatarPoint(x: x, y: y)
}

struct Superellipse {
  let centerX: Double
  let centerY: Double
  let radiusX: Double
  let radiusY: Double
  let exponent: Double
  let rotationDegrees: Double
}

func superellipse(_ shape: Superellipse) -> BlobatarPath {
  let k = min(1, (8 * pow(2, -1 / shape.exponent) - 4) / 3)
  let a = shape.radiusX
  let b = shape.radiusY
  let ak = a * k
  let bk = b * k
  let points = [
    point(a, 0),
    point(a, bk), point(ak, b), point(0, b),
    point(-ak, b), point(-a, bk), point(-a, 0),
    point(-a, -bk), point(-ak, -b), point(0, -b),
    point(ak, -b), point(a, -bk), point(a, 0),
  ]

  let radians = shape.rotationDegrees * .pi / 180
  let cosine = cos(radians)
  let sine = sin(radians)
  func transformed(_ index: Int) -> BlobatarPoint {
    let value = points[index]
    return point(
      shape.centerX + value.x * cosine - value.y * sine,
      shape.centerY + value.x * sine + value.y * cosine
    )
  }

  var segments: [BlobatarPathSegment] = [.move(to: transformed(0))]
  for index in stride(from: 1, to: 13, by: 3) {
    segments.append(
      .cubic(
        control1: transformed(index),
        control2: transformed(index + 1),
        to: transformed(index + 2)
      )
    )
  }
  segments.append(.close)
  return BlobatarPath(segments)
}

func arc(centerX: Double, centerY: Double, width: Double, depth: Double) -> BlobatarPath {
  BlobatarPath([
    .move(to: point(centerX - width, centerY)),
    .quadratic(
      control: point(centerX, centerY + depth),
      to: point(centerX + width, centerY)
    ),
  ])
}

func blobPath(
  centerX: Double,
  centerY: Double,
  radiusX: Double,
  radiusY: Double,
  radii: [Double],
  rotationDegrees: Double = 0
) -> BlobatarPath {
  let count = radii.count
  let start = rotationDegrees * .pi / 180
  let points = radii.enumerated().map { index, multiplier in
    let angle = start + 2 * .pi * Double(index) / Double(count)
    return point(
      centerX + radiusX * multiplier * cos(angle),
      centerY + radiusY * multiplier * sin(angle)
    )
  }
  func at(_ index: Int) -> BlobatarPoint {
    points[((index % count) + count) % count]
  }

  var segments: [BlobatarPathSegment] = [.move(to: at(0))]
  for index in 0..<count {
    let p0 = at(index - 1)
    let p1 = at(index)
    let p2 = at(index + 1)
    let p3 = at(index + 2)
    segments.append(
      .cubic(
        control1: point(p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6),
        control2: point(p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6),
        to: p2
      )
    )
  }
  segments.append(.close)
  return BlobatarPath(segments)
}

func polygon(
  centerX: Double,
  centerY: Double,
  radiusX: Double,
  radiusY: Double,
  sides: Int,
  rounding: Double = 0.3,
  rotationDegrees: Double = 0
) -> BlobatarPath {
  let k = rounding > 0 ? (rounding < 1 ? rounding / 2 : 0.5) : 0
  let start = rotationDegrees * .pi / 180 - .pi / 2
  let vertices = (0..<sides).map { index in
    let angle = start + 2 * .pi * Double(index) / Double(sides)
    return point(
      centerX + radiusX * cos(angle),
      centerY + radiusY * sin(angle)
    )
  }
  func at(_ index: Int) -> BlobatarPoint {
    vertices[((index % sides) + sides) % sides]
  }
  func cut(_ from: Int, _ to: Int) -> BlobatarPoint {
    let p0 = at(from)
    let p1 = at(to)
    return point(p0.x + (p1.x - p0.x) * k, p0.y + (p1.y - p0.y) * k)
  }

  var segments: [BlobatarPathSegment] = [.move(to: cut(0, -1))]
  for index in 0..<sides {
    segments.append(.quadratic(control: at(index), to: cut(index, index + 1)))
    if k < 0.5 {
      segments.append(.line(to: cut(index + 1, index)))
    }
  }
  segments.append(.close)
  return BlobatarPath(segments)
}

func box(centerX: Double, centerY: Double, radiusX: Double, radiusY: Double) -> BlobatarPath {
  BlobatarPath([
    .move(to: point(centerX - radiusX, centerY - radiusY)),
    .horizontal(toX: centerX + radiusX),
    .vertical(toY: centerY + radiusY),
    .horizontal(toX: centerX - radiusX),
    .close,
  ])
}

func taper(
  centerX: Double,
  centerY: Double,
  radiusX: Double,
  radiusY: Double,
  tip: Double
) -> BlobatarPath {
  let distance = max(1.05, tip)
  let tangentX = radiusX * sqrt(1 - 1 / (distance * distance))
  let tangentY = centerY - radiusY / distance
  let apex = centerY - distance * radiusY
  let shoulderX = tangentX * 0.14
  let shoulderY = tangentY + 0.86 * (apex - tangentY)
  return BlobatarPath([
    .move(to: point(centerX - tangentX, tangentY)),
    .line(to: point(centerX - shoulderX, shoulderY)),
    .quadratic(
      control: point(centerX, apex),
      to: point(centerX + shoulderX, shoulderY)
    ),
    .line(to: point(centerX + tangentX, tangentY)),
    .close,
  ])
}
