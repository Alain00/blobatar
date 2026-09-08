import BlobatarCore
import Foundation
import SwiftUI

struct BlobatarAnimatedRenderPlan {
  let backdrop: BlobatarRenderCommand?
  let headPaths: [Path]
  let eyePaths: [Path]

  init(drawing: BlobatarDrawing) {
    backdrop = drawing.backdrop.map {
      BlobatarRenderCommand(
        layer: .backdrop,
        path: swiftUIPath(from: $0.path),
        fill: BlobatarRGB(hex: $0.color)
      )
    }
    headPaths =
      drawing.petals.map { petal in
        Path(
          ellipseIn: CGRect(
            x: petal.centerX - petal.radius,
            y: petal.centerY - petal.radius,
            width: petal.radius * 2,
            height: petal.radius * 2
          )
        )
      } + drawing.extraPaths.map(swiftUIPath) + [swiftUIPath(from: drawing.bodyPath)]
    eyePaths = drawing.eyePaths.map(swiftUIPath)
  }

  func draw(
    frame: BlobatarAnimationFrame,
    in context: inout GraphicsContext,
    size: CGSize
  ) {
    let viewport = BlobatarViewport(size: size)
    guard viewport.scale > 0 else { return }

    context.translateBy(x: viewport.origin.x, y: viewport.origin.y)
    context.scaleBy(x: viewport.scale, y: viewport.scale)
    if let backdrop {
      context.fill(backdrop.path, with: .color(backdrop.fill.color))
    }

    var figure = context
    figure.concatenate(frame.root.cgAffineTransform)
    figure.concatenate(frame.hover.cgAffineTransform)
    figure.concatenate(frame.breathe.cgAffineTransform)
    figure.concatenate(frame.body.cgAffineTransform)

    let head = BlobatarRGB(hex: frame.headColor).color
    for path in headPaths {
      figure.fill(path, with: .color(head))
    }

    var eyePair = figure
    eyePair.concatenate(frame.eyePair.cgAffineTransform)
    let eye = BlobatarRGB(hex: frame.eyeColor).color
    for (index, path) in eyePaths.enumerated() where index < frame.eyes.count {
      var eyeContext = eyePair
      eyeContext.concatenate(frame.eyes[index].pose.cgAffineTransform)
      eyeContext.concatenate(frame.eyes[index].glance.cgAffineTransform)
      eyeContext.fill(path, with: .color(eye))
    }
  }
}

final class BlobatarAnimatedRendering {
  let model: BlobatarAnimationModel
  let plan: BlobatarAnimatedRenderPlan

  init(model: BlobatarAnimationModel) {
    self.model = model
    plan = BlobatarAnimatedRenderPlan(drawing: model.drawing)
  }
}

final class BlobatarAnimatedRenderCache: @unchecked Sendable {
  static let shared = BlobatarAnimatedRenderCache()

  private let lock = NSLock()
  private let storage = NSCache<BlobatarRequestReference, BlobatarAnimatedRendering>()
  private(set) var resolutionCount = 0

  init(countLimit: Int = 512) {
    storage.countLimit = countLimit
  }

  func rendering(for name: String, options: BlobatarOptions) -> BlobatarAnimatedRendering {
    let key = BlobatarRequestKey(name: name, options: options, includeExpression: false)
    let reference = BlobatarRequestReference(key)

    lock.lock()
    defer { lock.unlock() }
    if let cached = storage.object(forKey: reference) {
      return cached
    }

    let rendering = BlobatarAnimatedRendering(
      model: BlobatarAnimationModel(name: name, options: options)
    )
    resolutionCount += 1
    storage.setObject(rendering, forKey: reference)
    return rendering
  }
}

extension BlobatarTransform {
  var cgAffineTransform: CGAffineTransform {
    CGAffineTransform(a: a, b: b, c: c, d: d, tx: tx, ty: ty)
  }
}
