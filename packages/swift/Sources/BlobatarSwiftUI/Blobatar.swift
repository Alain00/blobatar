import BlobatarCore
import SwiftUI

/// Displays the deterministic generation-2 figure resolved for a name.
///
/// A fixed `size` pins both edges. When `size` is `nil`, the view expands to
/// the space offered by its parent and centers Blobatar's 100-by-100 drawing
/// space inside the largest square that fits.
///
/// The whole figure is exposed as one accessibility image. A supplied label
/// names that image; when the label is `nil`, it deliberately remains an
/// unlabeled image rather than deriving speech from the deterministic seed.
public struct Blobatar: View {
  public let name: String
  public let size: CGFloat?
  public let options: BlobatarOptions
  public let accessibilityLabel: String?

  let rendering: BlobatarRendering
  let accessibilityPolicy: BlobatarAccessibilityPolicy

  public init(
    name: String,
    size: CGFloat? = nil,
    options: BlobatarOptions = BlobatarOptions(),
    accessibilityLabel: String? = nil
  ) {
    self.name = name
    self.size = size.map { max(0, $0) }
    self.options = options
    self.accessibilityLabel = accessibilityLabel
    rendering = BlobatarRenderCache.shared.rendering(for: name, options: options)
    accessibilityPolicy =
      accessibilityLabel.map(BlobatarAccessibilityPolicy.labeled)
      ?? .unlabeled
  }

  public var body: some View {
    BlobatarCanvas(plan: rendering.plan)
      .frame(
        maxWidth: size == nil ? .infinity : nil,
        maxHeight: size == nil ? .infinity : nil
      )
      .frame(width: size, height: size)
      .accessibilityElement(children: .ignore)
      .accessibilityAddTraits(.isImage)
      .modifier(BlobatarAccessibilityModifier(policy: accessibilityPolicy))
  }
}

private struct BlobatarCanvas: View {
  let plan: BlobatarRenderPlan

  var body: some View {
    Canvas(opaque: false, rendersAsynchronously: false) { context, size in
      plan.draw(in: &context, size: size)
    }
  }
}

enum BlobatarAccessibilityPolicy: Equatable {
  case unlabeled
  case labeled(String)
}

private struct BlobatarAccessibilityModifier: ViewModifier {
  let policy: BlobatarAccessibilityPolicy

  @ViewBuilder
  func body(content: Content) -> some View {
    switch policy {
    case .unlabeled:
      content
    case .labeled(let label):
      content.accessibilityLabel(Text(label))
    }
  }
}
