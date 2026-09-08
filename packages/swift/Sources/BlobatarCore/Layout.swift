import Foundation

private struct MutableBody {
  var centerX: Double
  var centerY: Double
  var radiusX: Double
  var radiusY: Double
  var exponent: Double
  var rotationDegrees: Double
  var radialMultipliers: [Double]
  var polygonSides: Int?
  var cornerRounding: Double?

  var value: BlobatarBody {
    BlobatarBody(
      centerX: centerX,
      centerY: centerY,
      radiusX: radiusX,
      radiusY: radiusY,
      exponent: exponent,
      rotationDegrees: rotationDegrees,
      radialMultipliers: radialMultipliers,
      polygonSides: polygonSides,
      cornerRounding: cornerRounding
    )
  }
}

private struct Decoration {
  var petals: [BlobatarPetal] = []
  var extraPaths: [BlobatarPath] = []
}

private struct ShapeDefinition {
  let silhouette: BlobatarSilhouette
  let coreScale: Double

  func updateBody(_ body: inout MutableBody, traits: TraitReader) {
    switch silhouette {
    case .boxy:
      body.exponent = traits.number("body.n", min: 3.4, max: 6)
      body.rotationDegrees = traits.number("body.rot", min: -20, max: 20)
    case .capsule:
      body.radiusY *= traits.number("capsule.squat", min: 0.55, max: 0.68)
    case .droplet:
      body.centerY += 0.22 * body.radiusY
      body.exponent = 2
    case .hexagon:
      body.polygonSides = 6
      body.rotationDegrees = traits.number("body.rot", min: -12, max: 12)
      body.cornerRounding = traits.number("poly.round", min: 0.24, max: 0.5)
    case .triangle:
      body.polygonSides = 3
      body.rotationDegrees = traits.number("body.rot", min: -5, max: 5)
      body.cornerRounding = traits.number("poly.round", min: 0.24, max: 0.5)
    case .round, .organic, .nub, .cloud, .sun:
      break
    }
  }

  func face(for body: MutableBody) -> BlobatarEllipse {
    switch silhouette {
    case .organic, .cloud:
      let scale = body.radialMultipliers.min()! * 0.95
      return ellipse(body, scale: scale)
    case .capsule:
      return ellipse(body, scale: 0.94)
    case .droplet:
      return BlobatarEllipse(
        centerX: body.centerX,
        centerY: body.centerY + body.radiusY * 0.05,
        radiusX: body.radiusX * 0.88,
        radiusY: body.radiusY * 0.88
      )
    case .hexagon:
      return ellipse(body, scale: 0.84)
    case .triangle:
      return BlobatarEllipse(
        centerX: body.centerX,
        centerY: body.centerY + body.radiusY * 0.1,
        radiusX: body.radiusX * 0.54,
        radiusY: body.radiusY * 0.36
      )
    case .round, .boxy, .nub, .sun:
      return ellipse(body, scale: 1)
    }
  }

  func decorate(_ body: MutableBody, traits: TraitReader) -> Decoration {
    var output = Decoration()
    switch silhouette {
    case .capsule:
      for side in [-1.0, 1.0] {
        output.petals.append(
          BlobatarPetal(
            centerX: body.centerX + side * (body.radiusX - body.radiusY),
            centerY: body.centerY,
            radius: body.radiusY
          )
        )
      }
    case .nub:
      let count = traits.integer("nub.n", min: 1, max: 2)
      for index in 0..<count {
        let angle = traits.number("nub.a\(index)", min: 0, max: 2 * .pi)
        output.petals.append(
          BlobatarPetal(
            centerX: body.centerX + cos(angle) * body.radiusX * 0.88,
            centerY: body.centerY + sin(angle) * body.radiusX * 0.88,
            radius: body.radiusX * traits.number("nub.r\(index)", min: 0.24, max: 0.4)
          )
        )
      }
    case .cloud:
      let count = traits.integer("cloud.n", min: 4, max: 6)
      for index in 0..<count {
        let angle = Double.pi + Double.pi * (Double(index) + 0.5) / Double(count)
        output.petals.append(
          BlobatarPetal(
            centerX: body.centerX + cos(angle) * body.radiusX * 0.8,
            centerY: body.centerY + sin(angle) * body.radiusX * 0.5,
            radius: body.radiusX
              * traits.number("cloud.r\(index)", min: 0.44, max: 0.62)
          )
        )
      }
    case .droplet:
      output.extraPaths.append(
        taper(
          centerX: body.centerX,
          centerY: body.centerY,
          radiusX: body.radiusX,
          radiusY: body.radiusY,
          tip: traits.number("droplet.tip", min: 1.4, max: 1.65)
        )
      )
    case .sun:
      let count = traits.integer("sun.n", min: 6, max: 9)
      let distance = body.radiusX * traits.number("sun.dist", min: 1, max: 1.08)
      let radius = body.radiusX * traits.number("sun.r", min: 0.2, max: 0.26)
      let offset = traits.number("sun.rot", min: 0, max: 2 * .pi)
      for index in 0..<count {
        let angle = offset + 2 * .pi * Double(index) / Double(count)
        output.petals.append(
          BlobatarPetal(
            centerX: body.centerX + cos(angle) * distance,
            centerY: body.centerY + sin(angle) * distance,
            radius: radius
          )
        )
      }
    case .round, .organic, .boxy, .hexagon, .triangle:
      break
    }
    return output
  }

  func path(for body: MutableBody) -> BlobatarPath {
    switch silhouette {
    case .organic, .cloud:
      return blobPath(
        centerX: body.centerX,
        centerY: body.centerY,
        radiusX: body.radiusX,
        radiusY: body.radiusY,
        radii: body.radialMultipliers,
        rotationDegrees: body.rotationDegrees
      )
    case .capsule:
      return box(
        centerX: body.centerX,
        centerY: body.centerY,
        radiusX: body.radiusX - body.radiusY,
        radiusY: body.radiusY
      )
    case .hexagon, .triangle:
      return polygon(
        centerX: body.centerX,
        centerY: body.centerY,
        radiusX: body.radiusX,
        radiusY: body.radiusY,
        sides: body.polygonSides!,
        rounding: body.cornerRounding!,
        rotationDegrees: body.rotationDegrees
      )
    case .round, .boxy, .nub, .droplet, .sun:
      return superellipse(
        Superellipse(
          centerX: body.centerX,
          centerY: body.centerY,
          radiusX: body.radiusX,
          radiusY: body.radiusY,
          exponent: body.exponent,
          rotationDegrees: body.rotationDegrees
        )
      )
    }
  }
}

private let shapeBands: [(shape: ShapeDefinition, upperEdge: Double)] = [
  (ShapeDefinition(silhouette: .round, coreScale: 1), 0.22),
  (ShapeDefinition(silhouette: .organic, coreScale: 0.98), 0.48),
  (ShapeDefinition(silhouette: .boxy, coreScale: 0.86), 0.6),
  (ShapeDefinition(silhouette: .capsule, coreScale: 1.02), 0.7),
  (ShapeDefinition(silhouette: .nub, coreScale: 0.88), 0.79),
  (ShapeDefinition(silhouette: .cloud, coreScale: 0.78), 0.86),
  (ShapeDefinition(silhouette: .droplet, coreScale: 0.78), 0.915),
  (ShapeDefinition(silhouette: .hexagon, coreScale: 1.05), 0.95),
  (ShapeDefinition(silhouette: .sun, coreScale: 0.7), 0.98),
  (ShapeDefinition(silhouette: .triangle, coreScale: 1.15), 1),
]

private func ellipse(_ body: MutableBody, scale: Double) -> BlobatarEllipse {
  BlobatarEllipse(
    centerX: body.centerX,
    centerY: body.centerY,
    radiusX: body.radiusX * scale,
    radiusY: body.radiusY * scale
  )
}

private func fitEyes(
  traits: TraitReader,
  body: MutableBody,
  face: BlobatarEllipse
) -> [BlobatarEye] {
  let radiusX = body.radiusX
  let eyeRadius = traits.number("eye.rx", min: 0.075, max: 0.105) * radiusX
  let ratio = traits.number("eye.ratio", min: 1.9, max: 3.2)
  let scale = traits.number("eye.scale", min: 0.78, max: 1.24)
  let stretch = traits.number("eye.stretch", min: 0.85, max: 1.18)
  let clearance = traits.number("eye.gap", min: 0.1, max: 0.24) * radiusX
  let wide = eyeRadius * max(1, scale)
  let tall = eyeRadius * ratio * max(1, scale * stretch)
  let initialGap = wide + radiusX * 0.03 + clearance

  let gazeX = traits.jitter("gaze.x", amount: 0.09) * face.radiusX
  let gazeY = traits.number("gaze.y", min: -0.2, max: 0.08) * face.radiusY
  let deltaY = traits.jitter("eye.dy", amount: 0.04) * face.radiusY
  let reach = hypot(wide, tall)
  let need = hypot(
    (abs(gazeX) + initialGap + reach) / face.radiusX,
    (abs(gazeY) + abs(deltaY) + reach) / face.radiusY
  )
  let fit = need > 0.9 ? 0.9 / need : 1

  let fittedRadius = eyeRadius * fit
  let fittedRadiusY = fittedRadius * ratio
  let gap = initialGap * fit
  let room = max(0, min(1, clearance / tall))
  let bound = min(12, asin(room) * 180 / .pi)
  let lean = traits.number("eye.lean", min: -1, max: 1) * bound
  let secondLean = max(-12, min(12, lean + traits.jitter("eye.lean2", amount: 3.5)))

  let centerX = face.centerX + gazeX * fit
  let centerY = face.centerY + gazeY * fit
  let exponent = traits.number("eye.n", min: 3.5, max: 6)
  return [
    BlobatarEye(
      centerX: centerX - gap,
      centerY: centerY,
      radiusX: fittedRadius,
      radiusY: fittedRadiusY,
      exponent: exponent,
      rotationDegrees: lean
    ),
    BlobatarEye(
      centerX: centerX + gap,
      centerY: centerY + deltaY * fit,
      radiusX: fittedRadius * scale,
      radiusY: fittedRadiusY * scale * stretch,
      exponent: exponent,
      rotationDegrees: secondLean
    ),
  ]
}

struct ResolvedLayout {
  let silhouette: BlobatarSilhouette
  let body: BlobatarBody
  let face: BlobatarEllipse
  let eyes: [BlobatarEye]
  let petals: [BlobatarPetal]
  let extraPaths: [BlobatarPath]
  let bodyPath: BlobatarPath
}

func resolveLayout(traits: TraitReader) -> ResolvedLayout {
  let shapeValue = traits.value("shape")
  let shape =
    shapeBands.first(where: { shapeValue < $0.upperEdge })?.shape
    ?? shapeBands.last!.shape
  let radius = traits.number("body.r", min: 31, max: 38) * shape.coreScale
  let pointCount = traits.integer("body.pts", min: 6, max: 8)
  var body = MutableBody(
    centerX: 50 + traits.jitter("body.x", amount: 1.5),
    centerY: 50 + traits.jitter("body.y", amount: 1.5),
    radiusX: radius,
    radiusY: radius * traits.number("body.ratio", min: 0.92, max: 1.08),
    exponent: traits.number("body.n", min: 1.9, max: 2.5),
    rotationDegrees: 0,
    radialMultipliers: (0..<pointCount).map {
      1 + traits.jitter("body.r\($0)", amount: 0.16)
    },
    polygonSides: nil,
    cornerRounding: nil
  )
  shape.updateBody(&body, traits: traits)
  let face = shape.face(for: body)
  let decoration = shape.decorate(body, traits: traits)
  let eyes = fitEyes(traits: traits, body: body, face: face)
  return ResolvedLayout(
    silhouette: shape.silhouette,
    body: body.value,
    face: face,
    eyes: eyes,
    petals: decoration.petals,
    extraPaths: decoration.extraPaths,
    bodyPath: shape.path(for: body)
  )
}

func eyePath(_ eye: BlobatarEye) -> BlobatarPath {
  superellipse(
    Superellipse(
      centerX: eye.centerX,
      centerY: eye.centerY,
      radiusX: eye.radiusX,
      radiusY: eye.radiusY,
      exponent: eye.exponent,
      rotationDegrees: eye.rotationDegrees
    )
  )
}
