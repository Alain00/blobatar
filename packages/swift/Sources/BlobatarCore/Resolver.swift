/// Resolves a name and options into one immutable, renderer-neutral figure.
///
/// The name is normalized and hashed once. Every omitted visual decision then
/// comes from an independently keyed stream, preserving generation-2's frozen
/// seed-to-look mapping.
public func resolveBlobatar(
  _ name: String,
  options: BlobatarOptions = BlobatarOptions()
) -> BlobatarDrawing {
  let traits = TraitReader(
    name: name,
    normalize: options.normalize,
    overrides: options.traits
  )
  return resolveBlobatar(traits: traits, options: options, expression: options.expression)
}

func resolveBlobatar(
  traits: TraitReader,
  options: BlobatarOptions,
  expression: BlobatarExpression?
) -> BlobatarDrawing {
  var palette = makePalette(
    hue: options.hue ?? traits.number("hue", min: 0, max: 360),
    tone: options.tone ?? traits.value("tone"),
    enforceContrast: options.contrast
  )
  if let override = options.palette {
    palette = BlobatarPalette(
      background: override.background ?? palette.background,
      head: override.head ?? palette.head,
      eye: override.eye ?? palette.eye
    )
  }

  let layout = resolveLayout(traits: traits)
  let pose = expression?.pose ?? BlobatarPose()
  let eyes = applyPose(pose, to: layout.eyes)
  if let expression {
    palette = applyExpressionPalette(expression, to: palette)
  }
  return BlobatarDrawing(
    silhouette: layout.silhouette,
    body: layout.body,
    face: layout.face,
    eyes: eyes,
    petals: layout.petals,
    extraPaths: layout.extraPaths,
    bodyPath: layout.bodyPath,
    eyePaths: eyes.map(eyePath),
    palette: palette,
    backdrop: resolveBackdrop(options.background, palette: palette),
    bodyOffsetY: pose.bodyOffsetY
  )
}

private func resolveBackdrop(
  _ requested: BlobatarBackdrop?,
  palette: BlobatarPalette
) -> BlobatarBackdropDrawing? {
  switch requested ?? .none {
  case .none:
    return nil
  case .square:
    return BlobatarBackdropDrawing(
      path: box(centerX: 50, centerY: 50, radiusX: 50, radiusY: 50),
      color: palette.background
    )
  case .circle:
    return BlobatarBackdropDrawing(
      path: superellipse(
        Superellipse(
          centerX: 50,
          centerY: 50,
          radiusX: 50,
          radiusY: 50,
          exponent: 2,
          rotationDegrees: 0
        )
      ),
      color: palette.background
    )
  case .squircle:
    return BlobatarBackdropDrawing(
      path: superellipse(
        Superellipse(
          centerX: 50,
          centerY: 50,
          radiusX: 50,
          radiusY: 50,
          exponent: 6,
          rotationDegrees: 0
        )
      ),
      color: palette.background
    )
  }
}
