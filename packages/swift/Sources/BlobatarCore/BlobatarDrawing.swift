/// The frozen generation-2 silhouette vocabulary.
public enum BlobatarSilhouette: String, CaseIterable, Sendable, Equatable, Hashable {
  case round
  case organic
  case boxy
  case capsule
  case nub
  case cloud
  case droplet
  case hexagon
  case sun
  case triangle
}

/// A point in Blobatar's 100-by-100 drawing space.
public struct BlobatarPoint: Sendable, Equatable, Hashable {
  public let x: Double
  public let y: Double
}

/// An ellipse-shaped safe region in Blobatar's drawing space.
public struct BlobatarEllipse: Sendable, Equatable, Hashable {
  public let centerX: Double
  public let centerY: Double
  public let radiusX: Double
  public let radiusY: Double
}

/// The resolved core body before its path is traced.
public struct BlobatarBody: Sendable, Equatable, Hashable {
  public let centerX: Double
  public let centerY: Double
  public let radiusX: Double
  public let radiusY: Double
  public let exponent: Double
  public let rotationDegrees: Double
  public let radialMultipliers: [Double]
  public let polygonSides: Int?
  public let cornerRounding: Double?
}

/// One fitted eye in the resolved drawing model.
public struct BlobatarEye: Sendable, Equatable, Hashable {
  public let centerX: Double
  public let centerY: Double
  public let radiusX: Double
  public let radiusY: Double
  public let exponent: Double
  public let rotationDegrees: Double
}

/// A circular decoration unioned with the body.
public struct BlobatarPetal: Sendable, Equatable, Hashable {
  public let centerX: Double
  public let centerY: Double
  public let radius: Double
}

/// The three resolved color roles used by every renderer.
public struct BlobatarPalette: Sendable, Equatable, Hashable {
  public let background: String
  public let head: String
  public let eye: String
}

/// Optional geometry painted behind the figure.
public struct BlobatarBackdropDrawing: Sendable, Equatable, Hashable {
  public let path: BlobatarPath
  public let color: String
}

/// One immutable, renderer-neutral Blobatar figure.
///
/// All values use a 100-by-100 drawing space. Renderers consume this model
/// directly and must not recalculate geometry, palette choices, or defaults.
public struct BlobatarDrawing: Sendable, Equatable, Hashable {
  public let silhouette: BlobatarSilhouette
  public let body: BlobatarBody
  public let face: BlobatarEllipse
  public let eyes: [BlobatarEye]
  public let petals: [BlobatarPetal]
  public let extraPaths: [BlobatarPath]
  public let bodyPath: BlobatarPath
  public let eyePaths: [BlobatarPath]
  public let palette: BlobatarPalette
  public let backdrop: BlobatarBackdropDrawing?
  /// A rigid vertical translation applied to the figure but not its backdrop.
  public let bodyOffsetY: Double
}
