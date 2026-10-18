/// Metadata for the frozen Blobatar contract implemented by this package.
///
/// Keeping the reference version distinct from the package version matters:
/// the generation-2 seed-to-look mapping was frozen at Blobatar 2.4.0 and is
/// unchanged by later 2.x package releases.
public enum BlobatarContract: Sendable {
  /// The released TypeScript implementation that produced the parity vectors.
  public static let referenceVersion = "2.4.0"

  /// The frozen seed-to-look generation implemented by this package major.
  public static let generation = "gen2"
}
