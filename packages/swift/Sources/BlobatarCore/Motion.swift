import Foundation

/// How ambient motion becomes active in `AnimatedBlobatar`.
public enum BlobatarAnimation: String, CaseIterable, Sendable, Equatable, Hashable {
  case hover
  case always
}

/// The fixed generation-2 motion timings, in milliseconds.
public enum BlobatarAnimationTiming {
  public static let breathe = 2_800.0
  public static let bob = 3_400.0
  public static let rock = 900.0
  public static let shake = 112.0
  public static let ambientRamp = 400.0
  public static let hoverEnter = 220.0
  public static let hoverExit = 160.0
  public static let expressionEnter = 300.0
  public static let expressionExit = 400.0

  public static func easeInOut(_ progress: Double) -> Double {
    cubicBezier(progress, 0.42, 0, 0.58, 1)
  }

  public static func easeIn(_ progress: Double) -> Double {
    cubicBezier(progress, 0.42, 0, 1, 1)
  }

  public static func easeOut(_ progress: Double) -> Double {
    cubicBezier(progress, 0, 0, 0.58, 1)
  }

  public static func hover(_ progress: Double) -> Double {
    cubicBezier(progress, 0.23, 1, 0.32, 1)
  }

  public static func expressionEnter(_ progress: Double) -> Double {
    cubicBezier(progress, 0.45, 0.05, 0.5, 1)
  }
}

/// Seeded periods, offsets, and gaze magnitudes for one identity.
public struct BlobatarMotionSeeds: Sendable, Equatable, Hashable {
  public let phase: Int
  public let bob: Int
  public let blink: Int
  public let blinkPhase: Int
  public let saccade: Int
  public let saccadePhase: Int
  public let lookX: Double
  public let lookY: Double
  public let lookMagnitudeX: Double
  public let lookMagnitudeY: Double
}

/// Saccade foreshortening shared by the two eyes.
public struct BlobatarMotionWrap: Sendable, Equatable, Hashable {
  public let magnitudeX: Double
  public let sideX: Double
  public let scaleY: Double
  public let rotationDegrees: Double
}

/// One deterministic sample of the generation-2 idle loops.
public struct BlobatarMotionFrame: Sendable, Equatable, Hashable {
  public let shakeX: Double
  public let shakeY: Double
  public let breatheScaleX: Double
  public let breatheScaleY: Double
  public let bobY: Double
  public let saccadeX: Double
  public let saccadeY: Double
  public let thinkingPhase: Double
  public let blinkScaleY: Double
  public let wrap: BlobatarMotionWrap
}

/// A renderer-neutral affine transform in Blobatar's drawing space.
public struct BlobatarTransform: Sendable, Equatable, Hashable {
  public let a: Double
  public let b: Double
  public let c: Double
  public let d: Double
  public let tx: Double
  public let ty: Double

  public static let identity = BlobatarTransform(a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0)

  static func translation(x: Double, y: Double) -> Self {
    Self(a: 1, b: 0, c: 0, d: 1, tx: x, ty: y)
  }

  static func scale(x: Double, y: Double) -> Self {
    Self(a: x, b: 0, c: 0, d: y, tx: 0, ty: 0)
  }

  static func rotation(degrees: Double) -> Self {
    let radians = degrees * .pi / 180
    return Self(
      a: cos(radians), b: sin(radians), c: -sin(radians), d: cos(radians), tx: 0, ty: 0
    )
  }

  static func around(x: Double, y: Double, _ transform: Self) -> Self {
    translation(x: x, y: y) * transform * translation(x: -x, y: -y)
  }

  static func * (lhs: Self, rhs: Self) -> Self {
    Self(
      a: lhs.a * rhs.a + lhs.c * rhs.b,
      b: lhs.b * rhs.a + lhs.d * rhs.b,
      c: lhs.a * rhs.c + lhs.c * rhs.d,
      d: lhs.b * rhs.c + lhs.d * rhs.d,
      tx: lhs.a * rhs.tx + lhs.c * rhs.ty + lhs.tx,
      ty: lhs.b * rhs.tx + lhs.d * rhs.ty + lhs.ty
    )
  }
}

/// An opaque pose and tint endpoint suitable for interruption-safe morphing.
public struct BlobatarExpressionState: Sendable, Equatable, Hashable {
  public let headColor: String
  public let eyeColor: String
  let pose: BlobatarPose

  public var hasContinuousMotion: Bool {
    pose.shake != 0 || pose.rock != 0
  }
}

/// The two transform levels applied to one cached eye path.
public struct BlobatarEyeAnimationFrame: Sendable, Equatable, Hashable {
  public let pose: BlobatarTransform
  public let glance: BlobatarTransform
}

/// All changing values required to draw one frame over cached geometry.
public struct BlobatarAnimationFrame: Sendable, Equatable, Hashable {
  public let root: BlobatarTransform
  public let hover: BlobatarTransform
  public let breathe: BlobatarTransform
  public let body: BlobatarTransform
  public let eyePair: BlobatarTransform
  public let eyes: [BlobatarEyeAnimationFrame]
  public let headColor: String
  public let eyeColor: String
}

/// Cached geometry plus pure elapsed-time evaluation for one Blobatar request.
public struct BlobatarAnimationModel: Sendable, Equatable, Hashable {
  public let drawing: BlobatarDrawing
  public let motionSeeds: BlobatarMotionSeeds

  public init(name: String, options: BlobatarOptions = BlobatarOptions()) {
    let traits = TraitReader(
      name: name,
      normalize: options.normalize,
      overrides: options.traits
    )
    drawing = resolveBlobatar(traits: traits, options: options, expression: nil)
    motionSeeds = resolveMotionSeeds(traits)
  }

  public func expressionState(
    for expression: BlobatarExpression?
  ) -> BlobatarExpressionState {
    let expression = expression ?? .idle
    let palette = applyExpressionPalette(expression, to: drawing.palette)
    return BlobatarExpressionState(
      headColor: palette.head,
      eyeColor: palette.eye,
      pose: expression.pose
    )
  }

  public func interpolate(
    from: BlobatarExpressionState,
    to: BlobatarExpressionState,
    progress: Double
  ) -> BlobatarExpressionState {
    let progress = min(1, max(0, progress))
    return BlobatarExpressionState(
      headColor: fadeHex(from.headColor, to.headColor, progress),
      eyeColor: fadeHex(from.eyeColor, to.eyeColor, progress),
      pose: interpolatePose(from.pose, to.pose, progress)
    )
  }

  public func frame(
    at elapsedMilliseconds: Double,
    amplitude: Double,
    hover: Double = 0,
    expression: BlobatarExpressionState
  ) -> BlobatarAnimationFrame {
    let idle = motionFrame(
      seeds: motionSeeds,
      elapsedMilliseconds: elapsedMilliseconds,
      amplitude: min(1, max(0, amplitude)),
      shake: expression.pose.shake
    )
    let pose = expression.pose
    let hover = min(1, max(0, hover))
    let eyes = drawing.eyes.enumerated().map { index, eye in
      let side = index == 0 ? -1.0 : 1.0
      let selected = index == 0 ? 0.0 : 1.0
      let phase =
        selected * (1 - pose.rock)
        + pose.rock * ((1 + side * idle.thinkingPhase) / 2)
      let posedX = eye.centerX + pose.eyeSeparation * side
      let posedY = eye.centerY + pose.eyeOffsetY + phase * pose.secondEyeOffsetY
      let rotation =
        (pose.tiltDegrees + selected * pose.secondEyeTiltDegrees) * side
        + eye.rotationDegrees * (1 - pose.leanLock)
      let poseTransform =
        BlobatarTransform.translation(x: posedX, y: posedY)
        * .rotation(degrees: rotation)
        * .scale(
          x: pose.eyeScaleX + selected * pose.secondEyeScaleX,
          y: pose.eyeScaleY + selected * pose.secondEyeScaleY
        )
        * .rotation(degrees: -eye.rotationDegrees)
        * .translation(x: -eye.centerX, y: -eye.centerY)
      let glanceTransform =
        BlobatarTransform.translation(x: eye.centerX, y: eye.centerY)
        * .rotation(degrees: idle.wrap.rotationDegrees * side)
        * .scale(
          x: 1 + idle.wrap.magnitudeX + idle.wrap.sideX * side,
          y: 1 + idle.wrap.scaleY
        )
        * .rotation(degrees: eye.rotationDegrees)
        * .scale(x: 1, y: idle.blinkScaleY)
        * .rotation(degrees: -eye.rotationDegrees)
        * .translation(x: -eye.centerX, y: -eye.centerY)
      return BlobatarEyeAnimationFrame(pose: poseTransform, glance: glanceTransform)
    }

    return BlobatarAnimationFrame(
      root: .translation(x: idle.shakeX, y: idle.shakeY),
      hover: .translation(x: 0, y: -1.5 * hover)
        * .around(x: 50, y: 50, .scale(x: 1 + 0.04 * hover, y: 1 + 0.04 * hover)),
      breathe: .around(
        x: 50,
        y: 50,
        .scale(x: idle.breatheScaleX, y: idle.breatheScaleY)
      ),
      body: .translation(x: 0, y: pose.bodyOffsetY + idle.bobY),
      eyePair: .translation(x: idle.saccadeX, y: idle.saccadeY),
      eyes: eyes,
      headColor: expression.headColor,
      eyeColor: expression.eyeColor
    )
  }
}

public func resolveBlobatarMotion(
  _ name: String,
  options: BlobatarOptions = BlobatarOptions()
) -> BlobatarMotionSeeds {
  resolveMotionSeeds(
    TraitReader(name: name, normalize: options.normalize, overrides: options.traits)
  )
}

public func blobatarMotionFrame(
  seeds: BlobatarMotionSeeds,
  elapsedMilliseconds: Double,
  amplitude: Double,
  shake: Double = 0
) -> BlobatarMotionFrame {
  motionFrame(
    seeds: seeds,
    elapsedMilliseconds: elapsedMilliseconds,
    amplitude: amplitude,
    shake: shake
  )
}

private let saccadeStops = [
  [0, 0, 0], [0.15, 0, 0], [0.165, -0.8, -0.9], [0.31, -0.8, -0.9],
  [0.325, 1, 0.1], [0.47, 1, 0.1], [0.485, -0.15, 0.85],
  [0.63, -0.15, 0.85], [0.645, 0.75, -0.8], [0.79, 0.75, -0.8],
  [0.805, -1, -0.15], [0.985, -1, -0.15], [1, 0, 0],
]

private let wrapStops = [
  [0, 0, 0, 0, 0], [0.15, 0, 0, 0, 0],
  [0.165, -0.0176, 0.008, -0.027, 0.648], [0.31, -0.0176, 0.008, -0.027, 0.648],
  [0.325, -0.022, -0.01, -0.003, 0.09], [0.47, -0.022, -0.01, -0.003, 0.09],
  [0.485, -0.0033, 0.0015, -0.0255, -0.115],
  [0.63, -0.0033, 0.0015, -0.0255, -0.115],
  [0.645, -0.0165, -0.0075, -0.024, -0.54],
  [0.79, -0.0165, -0.0075, -0.024, -0.54],
  [0.805, -0.022, 0.01, -0.0045, 0.135], [0.985, -0.022, 0.01, -0.0045, 0.135],
  [1, 0, 0, 0, 0],
]

private let shakeStops = [
  [0, 0.62, -0.34], [0.25, -0.7, 0.22], [0.5, 0.38, 0.66],
  [0.75, -0.44, -0.6], [1, 0.62, -0.34],
]

private func resolveMotionSeeds(_ traits: TraitReader) -> BlobatarMotionSeeds {
  let blink = jsRound(traits.number("motion.blink", min: 3_500, max: 6_500))
  let saccade = jsRound(traits.number("motion.saccade", min: 4_200, max: 7_600))
  let lookX = round2(traits.number("motion.lookX", min: 1, max: 2.2))
  let lookY = round2(traits.number("motion.lookY", min: 0.8, max: 1.7))
  return BlobatarMotionSeeds(
    phase: jsRound(traits.number("motion.phase", min: 0, max: 2_800)),
    bob: jsRound(traits.number("motion.bob", min: 0, max: 3_400)),
    blink: blink,
    blinkPhase: jsRound(traits.number("motion.blinkPhase", min: 0, max: Double(blink))),
    saccade: saccade,
    saccadePhase: jsRound(
      traits.number("motion.saccadePhase", min: 0, max: Double(saccade))
    ),
    lookX: traits.boolean("motion.lookXFlip") ? -lookX : lookX,
    lookY: traits.boolean("motion.lookYFlip") ? -lookY : lookY,
    lookMagnitudeX: lookX,
    lookMagnitudeY: lookY
  )
}

private func motionFrame(
  seeds: BlobatarMotionSeeds,
  elapsedMilliseconds: Double,
  amplitude: Double,
  shake: Double
) -> BlobatarMotionFrame {
  let breathe = BlobatarAnimationTiming.easeInOut(
    alternate(elapsedMilliseconds, Double(seeds.phase), BlobatarAnimationTiming.breathe)
  )
  let bob = BlobatarAnimationTiming.easeInOut(
    alternate(elapsedMilliseconds, Double(seeds.bob), BlobatarAnimationTiming.bob)
  )
  let saccade = cycle(
    elapsedMilliseconds,
    Double(seeds.saccadePhase),
    Double(seeds.saccade)
  )
  let shakePhase = cycle(elapsedMilliseconds, 0, BlobatarAnimationTiming.shake)
  let rockPhase = cycle(elapsedMilliseconds, 0, BlobatarAnimationTiming.rock)
  let thinkingPhase =
    rockPhase < 0.5
    ? 1 - 2 * BlobatarAnimationTiming.easeInOut(rockPhase * 2)
    : -1 + 2 * BlobatarAnimationTiming.easeInOut(rockPhase * 2 - 1)
  let blinkPhase = cycle(
    elapsedMilliseconds,
    Double(seeds.blinkPhase),
    Double(seeds.blink)
  )
  let blink: Double
  if blinkPhase < 0.972 {
    blink = 1
  } else if blinkPhase < 0.986 {
    blink =
      1 - 0.92 * amplitude
      * BlobatarAnimationTiming.easeIn((blinkPhase - 0.972) / 0.014)
  } else {
    blink =
      1 - 0.92 * amplitude
      * (1 - BlobatarAnimationTiming.easeOut((blinkPhase - 0.986) / 0.014))
  }

  return BlobatarMotionFrame(
    shakeX: stops(shakePhase, shakeStops, 1) * shake,
    shakeY: stops(shakePhase, shakeStops, 2) * shake,
    breatheScaleX: 1 + 0.022 * amplitude * breathe,
    breatheScaleY: 1 - 0.018 * amplitude * breathe,
    bobY: -1.1 * amplitude * bob,
    saccadeX: stops(saccade, saccadeStops, 1) * seeds.lookX * amplitude,
    saccadeY: stops(saccade, saccadeStops, 2) * seeds.lookY * amplitude,
    thinkingPhase: thinkingPhase,
    blinkScaleY: blink,
    wrap: BlobatarMotionWrap(
      magnitudeX: stops(saccade, wrapStops, 1) * seeds.lookMagnitudeX * amplitude,
      sideX: stops(saccade, wrapStops, 2) * seeds.lookX * amplitude,
      scaleY: stops(saccade, wrapStops, 3) * seeds.lookMagnitudeY * amplitude,
      rotationDegrees: stops(saccade, wrapStops, 4)
        * seeds.lookX * seeds.lookY * amplitude
    )
  )
}

private func cycle(_ elapsed: Double, _ phase: Double, _ period: Double) -> Double {
  let value = (elapsed + phase) / period
  return value - floor(value)
}

private func alternate(_ elapsed: Double, _ phase: Double, _ period: Double) -> Double {
  let value = (elapsed + phase) / period
  let iteration = floor(value)
  let fraction = value - iteration
  return Int(iteration) % 2 == 0 ? fraction : 1 - fraction
}

private func stops(_ progress: Double, _ table: [[Double]], _ column: Int) -> Double {
  for index in table.indices.reversed() where progress >= table[index][0] {
    let row = table[index]
    guard index + 1 < table.count else { return row[column] }
    let next = table[index + 1]
    let span = next[0] - row[0]
    return span <= 0
      ? row[column]
      : row[column] + (next[column] - row[column]) * ((progress - row[0]) / span)
  }
  return table[0][column]
}

private func cubicBezier(
  _ progress: Double,
  _ x1: Double,
  _ y1: Double,
  _ x2: Double,
  _ y2: Double
) -> Double {
  let cx = 3 * x1
  let bx = 3 * (x2 - x1) - cx
  let ax = 1 - cx - bx
  let cy = 3 * y1
  let by = 3 * (y2 - y1) - cy
  let ay = 1 - cy - by
  var value = progress
  for _ in 0..<8 {
    let error = ((ax * value + bx) * value + cx) * value - progress
    if abs(error) < 1e-5 { break }
    let derivative = (3 * ax * value + 2 * bx) * value + cx
    if abs(derivative) < 1e-6 { break }
    value -= error / derivative
  }
  return ((ay * value + by) * value + cy) * value
}

private func interpolatePose(
  _ from: BlobatarPose,
  _ to: BlobatarPose,
  _ progress: Double
) -> BlobatarPose {
  func value(_ from: Double, _ to: Double) -> Double {
    from * (1 - progress) + to * progress
  }
  return BlobatarPose(
    eyeScaleX: value(from.eyeScaleX, to.eyeScaleX),
    eyeScaleY: value(from.eyeScaleY, to.eyeScaleY),
    tiltDegrees: value(from.tiltDegrees, to.tiltDegrees),
    eyeOffsetY: value(from.eyeOffsetY, to.eyeOffsetY),
    eyeSeparation: value(from.eyeSeparation, to.eyeSeparation),
    secondEyeScaleX: value(from.secondEyeScaleX, to.secondEyeScaleX),
    secondEyeScaleY: value(from.secondEyeScaleY, to.secondEyeScaleY),
    secondEyeTiltDegrees: value(from.secondEyeTiltDegrees, to.secondEyeTiltDegrees),
    secondEyeOffsetY: value(from.secondEyeOffsetY, to.secondEyeOffsetY),
    leanLock: value(from.leanLock, to.leanLock),
    heat: value(from.heat, to.heat),
    shake: value(from.shake, to.shake),
    rock: value(from.rock, to.rock),
    bodyOffsetY: value(from.bodyOffsetY, to.bodyOffsetY)
  )
}

private func fadeHex(_ from: String, _ to: String, _ progress: Double) -> String {
  let start = hexBytes(from)
  let end = hexBytes(to)
  return "#"
    + zip(start, end).map { left, right in
      String(
        format: "%02x",
        jsRound(Double(left) + Double(right - left) * progress)
      )
    }.joined()
}

private func hexBytes(_ value: String) -> [Int] {
  stride(from: 1, to: 7, by: 2).map { index in
    let start = value.index(value.startIndex, offsetBy: index)
    let end = value.index(start, offsetBy: 2)
    return Int(value[start..<end], radix: 16)!
  }
}

private func jsRound(_ value: Double) -> Int {
  Int(floor(value + 0.5))
}

private func round2(_ value: Double) -> Double {
  Double(jsRound(value * 100)) / 100
}
