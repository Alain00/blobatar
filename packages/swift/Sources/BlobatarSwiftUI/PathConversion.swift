import BlobatarCore
import SwiftUI

/// Converts the core's unrounded, absolute segments without changing their
/// geometry or fill rule. Tracking the current point is only needed to expand
/// horizontal and vertical segments into SwiftUI line commands.
func swiftUIPath(from source: BlobatarPath) -> Path {
  var path = Path()
  var current = CGPoint.zero
  var subpathStart = CGPoint.zero

  for segment in source.segments {
    switch segment {
    case .move(let point):
      let destination = cgPoint(point)
      path.move(to: destination)
      current = destination
      subpathStart = destination
    case .line(let point):
      let destination = cgPoint(point)
      path.addLine(to: destination)
      current = destination
    case .cubic(let control1, let control2, let point):
      let destination = cgPoint(point)
      path.addCurve(
        to: destination,
        control1: cgPoint(control1),
        control2: cgPoint(control2)
      )
      current = destination
    case .quadratic(let control, let point):
      let destination = cgPoint(point)
      path.addQuadCurve(to: destination, control: cgPoint(control))
      current = destination
    case .horizontal(let x):
      let destination = CGPoint(x: x, y: current.y)
      path.addLine(to: destination)
      current = destination
    case .vertical(let y):
      let destination = CGPoint(x: current.x, y: y)
      path.addLine(to: destination)
      current = destination
    case .close:
      path.closeSubpath()
      current = subpathStart
    }
  }

  return path
}

private func cgPoint(_ point: BlobatarPoint) -> CGPoint {
  CGPoint(x: point.x, y: point.y)
}
