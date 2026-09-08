import BlobatarCore
import Foundation

@MainActor
final class BlobatarAnimationDriver: ObservableObject {
  private(set) var rendering: BlobatarAnimatedRendering
  private(set) var mode: BlobatarAnimation
  private(set) var active = false
  private(set) var hovered = false
  private(set) var targetExpression: BlobatarExpression

  private var amplitude: ScalarTransition
  private var hover: ScalarTransition
  private var expression: ExpressionTransition

  init(
    rendering: BlobatarAnimatedRendering,
    expression: BlobatarExpression?,
    mode: BlobatarAnimation,
    now: Double = monotonicMilliseconds()
  ) {
    self.rendering = rendering
    self.mode = mode
    targetExpression = expression ?? .idle
    amplitude = ScalarTransition(value: 0, at: now)
    hover = ScalarTransition(value: 0, at: now)
    let state = rendering.model.expressionState(for: expression)
    self.expression = ExpressionTransition(value: state, at: now)
  }

  func updateRequest(
    rendering next: BlobatarAnimatedRendering,
    expression nextExpression: BlobatarExpression?,
    animate: Bool,
    now: Double
  ) {
    let nextExpression = nextExpression ?? .idle
    if rendering !== next {
      objectWillChange.send()
      rendering = next
      targetExpression = nextExpression
      expression = ExpressionTransition(
        value: next.model.expressionState(for: nextExpression),
        at: now
      )
      return
    }
    guard targetExpression != nextExpression else { return }
    objectWillChange.send()
    let current = expression.value(model: rendering.model, at: now)
    let target = rendering.model.expressionState(for: nextExpression)
    targetExpression = nextExpression
    guard animate else {
      expression = ExpressionTransition(value: target, at: now)
      return
    }
    let entering = nextExpression != .idle
    expression = ExpressionTransition(
      from: current,
      to: target,
      start: now,
      duration: entering
        ? BlobatarAnimationTiming.expressionEnter
        : BlobatarAnimationTiming.expressionExit,
      curve: entering ? .expressionEnter : .easeInOut
    )
  }

  func updateActivity(
    active nextActive: Bool,
    mode nextMode: BlobatarAnimation,
    hovered nextHovered: Bool,
    now: Double
  ) {
    guard active != nextActive || mode != nextMode || hovered != nextHovered else { return }
    objectWillChange.send()
    let wasActive = active
    active = nextActive
    mode = nextMode
    hovered = nextHovered
    guard nextActive else {
      amplitude = ScalarTransition(value: 0, at: now)
      hover = ScalarTransition(value: 0, at: now)
      expression = ExpressionTransition(
        value: rendering.model.expressionState(for: targetExpression),
        at: now
      )
      return
    }

    let amplitudeTarget = nextMode == .always || nextHovered ? 1.0 : 0.0
    amplitude = amplitude.retarget(
      amplitudeTarget,
      at: now,
      duration: BlobatarAnimationTiming.ambientRamp,
      curve: .easeOut,
      cut: !wasActive && amplitudeTarget == 0
    )
    hover = hover.retarget(
      nextHovered ? 1 : 0,
      at: now,
      duration: nextHovered
        ? BlobatarAnimationTiming.hoverEnter
        : BlobatarAnimationTiming.hoverExit,
      curve: .hover,
      cut: !wasActive && !nextHovered
    )
  }

  func frame(at now: Double) -> BlobatarAnimationFrame {
    rendering.model.frame(
      at: now,
      amplitude: amplitude.value(at: now),
      hover: hover.value(at: now),
      expression: expression.value(model: rendering.model, at: now)
    )
  }

  func needsContinuousFrames(at now: Double) -> Bool {
    guard active else { return false }
    if mode == .always || hovered { return true }
    if amplitude.isMoving(at: now) || hover.isMoving(at: now) || expression.isMoving(at: now) {
      return true
    }
    return expression.value(model: rendering.model, at: now).hasContinuousMotion
  }
}

enum AnimationCurve {
  case easeInOut
  case easeOut
  case hover
  case expressionEnter

  func value(_ progress: Double) -> Double {
    switch self {
    case .easeInOut: BlobatarAnimationTiming.easeInOut(progress)
    case .easeOut: BlobatarAnimationTiming.easeOut(progress)
    case .hover: BlobatarAnimationTiming.hover(progress)
    case .expressionEnter: BlobatarAnimationTiming.expressionEnter(progress)
    }
  }
}

struct ScalarTransition {
  let from: Double
  let to: Double
  let start: Double
  let duration: Double
  let curve: AnimationCurve

  init(value: Double, at now: Double) {
    from = value
    to = value
    start = now
    duration = 0
    curve = .easeInOut
  }

  init(
    from: Double,
    to: Double,
    start: Double,
    duration: Double,
    curve: AnimationCurve
  ) {
    self.from = from
    self.to = to
    self.start = start
    self.duration = duration
    self.curve = curve
  }

  func value(at now: Double) -> Double {
    guard duration > 0 else { return to }
    let progress = min(1, max(0, (now - start) / duration))
    return from * (1 - curve.value(progress)) + to * curve.value(progress)
  }

  func isMoving(at now: Double) -> Bool {
    duration > 0 && now < start + duration
  }

  func retarget(
    _ target: Double,
    at now: Double,
    duration: Double,
    curve: AnimationCurve,
    cut: Bool = false
  ) -> Self {
    if to == target { return self }
    let current = value(at: now)
    guard !cut, current != target else { return Self(value: target, at: now) }
    return Self(from: current, to: target, start: now, duration: duration, curve: curve)
  }
}

struct ExpressionTransition {
  let from: BlobatarExpressionState
  let to: BlobatarExpressionState
  let start: Double
  let duration: Double
  let curve: AnimationCurve

  init(value: BlobatarExpressionState, at now: Double) {
    from = value
    to = value
    start = now
    duration = 0
    curve = .easeInOut
  }

  init(
    from: BlobatarExpressionState,
    to: BlobatarExpressionState,
    start: Double,
    duration: Double,
    curve: AnimationCurve
  ) {
    self.from = from
    self.to = to
    self.start = start
    self.duration = duration
    self.curve = curve
  }

  func value(model: BlobatarAnimationModel, at now: Double) -> BlobatarExpressionState {
    guard duration > 0 else { return to }
    let progress = min(1, max(0, (now - start) / duration))
    return model.interpolate(from: from, to: to, progress: curve.value(progress))
  }

  func isMoving(at now: Double) -> Bool {
    duration > 0 && now < start + duration
  }
}

func monotonicMilliseconds() -> Double {
  ProcessInfo.processInfo.systemUptime * 1_000
}
