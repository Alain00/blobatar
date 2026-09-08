/// A deterministic override for one generation-2 trait key.
///
/// Values use the same normalized `[0, 1)` units as the keyed hash stream.
/// A pinned value chooses one position. A narrowed value lets the trait's own
/// hash choose stably among the supplied positions. Empty narrowed values are
/// equivalent to omitting the key.
public enum BlobatarTraitOverride: Sendable {
  case pinned(Double)
  case narrowed([Double])
}

/// Overrides for the three authored color roles.
///
/// Supplied colors are used verbatim and intentionally bypass the generated
/// palette's contrast correction, matching the generation-2 contract.
public struct BlobatarPaletteOverride: Sendable, Equatable, Hashable {
  public let background: String?
  public let head: String?
  public let eye: String?

  public init(
    background: String? = nil,
    head: String? = nil,
    eye: String? = nil
  ) {
    self.background = background
    self.head = head
    self.eye = eye
  }
}

/// The optional plate drawn behind a Blobatar figure.
public enum BlobatarBackdrop: String, CaseIterable, Sendable, Equatable, Hashable {
  case none
  case square
  case circle
  case squircle
}

/// Inputs to generation-2 resolution.
///
/// A name still controls every option omitted here. Hue and tone take
/// precedence over trait overrides for the corresponding keyed values. An
/// expression changes only the resolved pose and palette, never seed choices.
public struct BlobatarOptions: Sendable {
  public let palette: BlobatarPaletteOverride?
  public let hue: Double?
  public let tone: Double?
  public let traits: [String: BlobatarTraitOverride]
  public let normalize: Bool
  public let contrast: Bool
  public let background: BlobatarBackdrop?
  public let expression: BlobatarExpression?

  public init(
    palette: BlobatarPaletteOverride? = nil,
    hue: Double? = nil,
    tone: Double? = nil,
    traits: [String: BlobatarTraitOverride] = [:],
    normalize: Bool = true,
    contrast: Bool = true,
    background: BlobatarBackdrop? = nil,
    expression: BlobatarExpression? = nil
  ) {
    self.palette = palette
    self.hue = hue
    self.tone = tone
    self.traits = traits
    self.normalize = normalize
    self.contrast = contrast
    self.background = background
    self.expression = expression
  }
}
