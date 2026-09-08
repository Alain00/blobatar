import BlobatarCore
import SwiftUI

/// Displays a Blobatar with deterministic, elapsed-time generation-2 motion.
///
/// Geometry is resolved and converted once per request. Timeline ticks only
/// update affine transforms and the two expression-tinted fills.
public struct AnimatedBlobatar: View {
  public let name: String
  public let size: CGFloat?
  public let options: BlobatarOptions
  public let animation: BlobatarAnimation
  public let active: Bool
  public let respectsReducedMotion: Bool
  public let accessibilityLabel: String?

  private let rendering: BlobatarAnimatedRendering
  private let requestKey: BlobatarRequestKey

  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(\.scenePhase) private var scenePhase
  @StateObject private var driver: BlobatarAnimationDriver
  @State private var hovered = false
  @State private var refreshToken = UUID()

  public init(
    name: String,
    size: CGFloat? = nil,
    options: BlobatarOptions = BlobatarOptions(),
    animation: BlobatarAnimation = .hover,
    active: Bool = true,
    respectsReducedMotion: Bool = true,
    accessibilityLabel: String? = nil
  ) {
    self.name = name
    self.size = size.map { max(0, $0) }
    self.options = options
    self.animation = animation
    self.active = active
    self.respectsReducedMotion = respectsReducedMotion
    self.accessibilityLabel = accessibilityLabel
    let rendering = BlobatarAnimatedRenderCache.shared.rendering(for: name, options: options)
    self.rendering = rendering
    requestKey = BlobatarRequestKey(name: name, options: options)
    _driver = StateObject(
      wrappedValue: BlobatarAnimationDriver(
        rendering: rendering,
        expression: options.expression,
        mode: animation
      )
    )
  }

  public var body: some View {
    let request = synchronizationRequest
    Group {
      if request.active {
        TimelineView(
          .animation(
            minimumInterval: 1.0 / 60.0,
            paused: !driver.needsContinuousFrames(at: monotonicMilliseconds())
          )
        ) { _ in
          Canvas(opaque: false, rendersAsynchronously: false) { context, canvasSize in
            var context = context
            driver.rendering.plan.draw(
              frame: driver.frame(at: monotonicMilliseconds()),
              in: &context,
              size: canvasSize
            )
          }
        }
      } else {
        Blobatar(name: name, options: options)
      }
    }
    .frame(
      maxWidth: size == nil ? .infinity : nil,
      maxHeight: size == nil ? .infinity : nil
    )
    .frame(width: size, height: size)
    .contentShape(Rectangle())
    .onHover { next in
      hovered = next
      synchronize(request, hovered: next)
    }
    .onAppear { synchronize(request, hovered: hovered) }
    .onChange(of: request) { next in synchronize(next, hovered: hovered) }
    .accessibilityElement(children: .ignore)
    .accessibilityAddTraits(.isImage)
    .modifier(
      AnimatedBlobatarAccessibilityModifier(
        label: accessibilityLabel
      )
    )
  }

  private var isEffectivelyActive: Bool {
    blobatarAnimationIsActive(
      explicitlyActive: active,
      scenePhase: scenePhase,
      reduceMotion: reduceMotion,
      respectsReducedMotion: respectsReducedMotion
    )
  }

  private var synchronizationRequest: BlobatarSynchronizationRequest {
    BlobatarSynchronizationRequest(
      key: requestKey,
      rendering: rendering,
      expression: options.expression,
      mode: animation,
      active: isEffectivelyActive
    )
  }

  @MainActor
  private func synchronize(
    _ request: BlobatarSynchronizationRequest,
    hovered: Bool
  ) {
    let now = monotonicMilliseconds()
    driver.updateRequest(
      rendering: request.rendering,
      expression: request.expression,
      animate: request.active,
      now: now
    )
    driver.updateActivity(
      active: request.active,
      mode: request.mode,
      hovered: hovered,
      now: now
    )
    scheduleFinalRefresh(after: 0.45)
  }

  @MainActor
  private func scheduleFinalRefresh(after seconds: Double) {
    let token = UUID()
    refreshToken = token
    Task { @MainActor in
      try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
      guard refreshToken == token else { return }
      refreshToken = UUID()
    }
  }
}

private struct BlobatarSynchronizationRequest: Equatable {
  let key: BlobatarRequestKey
  let rendering: BlobatarAnimatedRendering
  let expression: BlobatarExpression?
  let mode: BlobatarAnimation
  let active: Bool

  static func == (_ lhs: Self, _ rhs: Self) -> Bool {
    lhs.key == rhs.key
      && lhs.mode == rhs.mode
      && lhs.active == rhs.active
  }
}

func blobatarAnimationIsActive(
  explicitlyActive: Bool,
  scenePhase: ScenePhase,
  reduceMotion: Bool,
  respectsReducedMotion: Bool
) -> Bool {
  explicitlyActive
    && scenePhase == .active
    && !(respectsReducedMotion && reduceMotion)
}

private struct AnimatedBlobatarAccessibilityModifier: ViewModifier {
  let label: String?

  @ViewBuilder
  func body(content: Content) -> some View {
    if let label {
      content.accessibilityLabel(Text(label))
    } else {
      content
    }
  }
}
