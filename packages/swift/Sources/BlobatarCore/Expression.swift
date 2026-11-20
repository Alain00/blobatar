/// The frozen generation-2 expression roster.
///
/// Expressions change only the existing eye geometry, body offset, and
/// palette. They never add marks or alter the selected silhouette.
public enum BlobatarExpression: String, CaseIterable, Sendable, Equatable, Hashable {
  case idle
  case happy
  case sad
  case mad
  case surprised
  case wink
  case sleepy
  case smug
  case unsure
  case scared
  case love
  case shy
  case sick
  case thinking
}

struct BlobatarPose: Sendable, Equatable, Hashable {
  let eyeScaleX: Double
  let eyeScaleY: Double
  let tiltDegrees: Double
  let eyeOffsetY: Double
  let eyeSeparation: Double
  let secondEyeScaleX: Double
  let secondEyeScaleY: Double
  let secondEyeTiltDegrees: Double
  let secondEyeOffsetY: Double
  let leanLock: Double
  let heat: Double
  let shake: Double
  let rock: Double
  let bodyOffsetY: Double

  init(
    eyeScaleX: Double = 1,
    eyeScaleY: Double = 1,
    tiltDegrees: Double = 0,
    eyeOffsetY: Double = 0,
    eyeSeparation: Double = 0,
    secondEyeScaleX: Double = 0,
    secondEyeScaleY: Double = 0,
    secondEyeTiltDegrees: Double = 0,
    secondEyeOffsetY: Double = 0,
    leanLock: Double = 0,
    heat: Double = 0,
    shake: Double = 0,
    rock: Double = 0,
    bodyOffsetY: Double = 0
  ) {
    self.eyeScaleX = eyeScaleX
    self.eyeScaleY = eyeScaleY
    self.tiltDegrees = tiltDegrees
    self.eyeOffsetY = eyeOffsetY
    self.eyeSeparation = eyeSeparation
    self.secondEyeScaleX = secondEyeScaleX
    self.secondEyeScaleY = secondEyeScaleY
    self.secondEyeTiltDegrees = secondEyeTiltDegrees
    self.secondEyeOffsetY = secondEyeOffsetY
    self.leanLock = leanLock
    self.heat = heat
    self.shake = shake
    self.rock = rock
    self.bodyOffsetY = bodyOffsetY
  }
}

extension BlobatarExpression {
  var pose: BlobatarPose {
    switch self {
    case .idle:
      BlobatarPose()
    case .happy:
      BlobatarPose(
        eyeScaleX: 1.72,
        eyeScaleY: 0.3,
        tiltDegrees: 8,
        eyeOffsetY: -1.5,
        eyeSeparation: 1.5,
        secondEyeScaleX: 0.08,
        secondEyeScaleY: 0.05,
        secondEyeTiltDegrees: -16,
        leanLock: 1,
        bodyOffsetY: -2.2
      )
    case .sad:
      BlobatarPose(
        eyeScaleX: 0.6,
        eyeScaleY: 0.56,
        tiltDegrees: 26,
        eyeOffsetY: 3.6,
        eyeSeparation: 1.9,
        secondEyeScaleX: -0.05,
        secondEyeScaleY: -0.07,
        secondEyeTiltDegrees: -7,
        leanLock: 1,
        bodyOffsetY: 2.6
      )
    case .mad:
      BlobatarPose(
        eyeScaleX: 1.85,
        eyeScaleY: 0.26,
        tiltDegrees: -33,
        eyeOffsetY: 0.4,
        eyeSeparation: 0.6,
        secondEyeScaleY: -0.03,
        secondEyeTiltDegrees: 5,
        leanLock: 1,
        heat: 0.62,
        shake: 0.55,
        bodyOffsetY: 0.8
      )
    case .surprised:
      BlobatarPose(
        eyeScaleX: 1.34,
        eyeScaleY: 1.2,
        tiltDegrees: -6,
        eyeOffsetY: -1.05,
        eyeSeparation: 0.5,
        secondEyeScaleX: 0.05,
        secondEyeScaleY: 0.07,
        secondEyeTiltDegrees: 3,
        leanLock: 1,
        bodyOffsetY: -1.4
      )
    case .wink:
      BlobatarPose(
        eyeScaleX: 1.32,
        eyeScaleY: 0.76,
        tiltDegrees: 5,
        eyeOffsetY: -0.6,
        eyeSeparation: 0.8,
        secondEyeScaleX: 0.26,
        secondEyeScaleY: -0.56,
        secondEyeTiltDegrees: -11,
        leanLock: 1,
        bodyOffsetY: -1.1
      )
    case .sleepy:
      BlobatarPose(
        eyeScaleX: 1.14,
        eyeScaleY: 0.22,
        eyeOffsetY: 2.4,
        eyeSeparation: 0.3,
        secondEyeScaleX: -0.04,
        secondEyeScaleY: 0.03,
        secondEyeTiltDegrees: 4,
        leanLock: 1,
        bodyOffsetY: 1.2
      )
    case .smug:
      BlobatarPose(
        eyeScaleX: 1.3,
        eyeScaleY: 0.42,
        tiltDegrees: 18,
        eyeOffsetY: -0.5,
        eyeSeparation: 0.5,
        secondEyeScaleX: 0.06,
        secondEyeScaleY: -0.06,
        secondEyeTiltDegrees: -36,
        leanLock: 1,
        bodyOffsetY: -1
      )
    case .unsure:
      BlobatarPose(
        eyeScaleX: 0.95,
        eyeScaleY: 1.02,
        tiltDegrees: 4,
        eyeOffsetY: -0.2,
        eyeSeparation: 0.3,
        secondEyeScaleX: 0.24,
        secondEyeScaleY: -0.44,
        secondEyeTiltDegrees: -18,
        leanLock: 1
      )
    case .scared:
      BlobatarPose(
        eyeScaleX: 0.78,
        eyeScaleY: 0.96,
        tiltDegrees: -12,
        eyeOffsetY: -1.5,
        eyeSeparation: -0.8,
        secondEyeScaleX: -0.04,
        secondEyeScaleY: 0.05,
        secondEyeTiltDegrees: 4,
        leanLock: 1,
        shake: 0.35,
        bodyOffsetY: -0.6
      )
    case .love:
      BlobatarPose(
        eyeScaleX: 0.86,
        eyeScaleY: 1.28,
        tiltDegrees: -14,
        eyeOffsetY: -0.5,
        eyeSeparation: -0.35,
        secondEyeScaleX: 0.05,
        secondEyeScaleY: 0.06,
        secondEyeTiltDegrees: 6,
        leanLock: 1,
        heat: 0.6,
        bodyOffsetY: -1.6
      )
    case .shy:
      BlobatarPose(
        eyeScaleX: 0.62,
        eyeScaleY: 0.5,
        tiltDegrees: 10,
        eyeOffsetY: 1.4,
        eyeSeparation: -0.2,
        secondEyeScaleX: -0.05,
        secondEyeScaleY: -0.04,
        secondEyeTiltDegrees: -8,
        leanLock: 1,
        heat: 0.55,
        bodyOffsetY: 0.9
      )
    case .sick:
      BlobatarPose(
        eyeScaleX: 1.25,
        eyeScaleY: 0.34,
        tiltDegrees: 20,
        eyeOffsetY: 1.8,
        eyeSeparation: 0.8,
        secondEyeScaleX: 0.05,
        secondEyeScaleY: -0.05,
        secondEyeTiltDegrees: -6,
        leanLock: 1,
        heat: 0.6,
        shake: 0.18,
        bodyOffsetY: 1.4
      )
    case .thinking:
      BlobatarPose(
        eyeScaleX: 1.15,
        eyeScaleY: 0.62,
        eyeOffsetY: 4.2,
        eyeSeparation: 0.4,
        secondEyeScaleX: 0.02,
        secondEyeScaleY: 0.06,
        secondEyeOffsetY: -8.4,
        leanLock: 1,
        rock: 0.8,
        bodyOffsetY: -0.4
      )
    }
  }

  var tint: BlobatarTint? {
    switch self {
    case .mad: .hot
    case .love: .rose
    case .shy: .blush
    case .sick: .bile
    default: nil
    }
  }
}

enum BlobatarTint: Sendable, Equatable, Hashable {
  case hot
  case rose
  case blush
  case bile

  var target: TintTarget {
    switch self {
    case .hot: TintTarget(hue: 27, lightness: 0.58, pull: 0.6, chroma: 0.18)
    case .rose: TintTarget(hue: 358, lightness: 0.72, pull: 0.55, chroma: 0.16)
    case .blush: TintTarget(hue: 12, lightness: 0.84, pull: 0.4, chroma: 0.1)
    case .bile: TintTarget(hue: 142, lightness: 0.66, pull: 0.6, chroma: 0.13)
    }
  }
}

struct TintTarget: Sendable, Equatable, Hashable {
  let hue: Double
  let lightness: Double
  let pull: Double
  let chroma: Double
}

func applyPose(_ pose: BlobatarPose, to eyes: [BlobatarEye]) -> [BlobatarEye] {
  precondition(eyes.count == 2, "Generation 2 expressions require exactly two eyes")
  return eyes.enumerated().map { index, eye in
    let isSecondEye = index == 1
    let side = isSecondEye ? 1.0 : -1.0
    return BlobatarEye(
      centerX: eye.centerX + pose.eyeSeparation * side,
      centerY: eye.centerY + pose.eyeOffsetY + (isSecondEye ? pose.secondEyeOffsetY : 0),
      radiusX: eye.radiusX * (pose.eyeScaleX + (isSecondEye ? pose.secondEyeScaleX : 0)),
      radiusY: eye.radiusY * (pose.eyeScaleY + (isSecondEye ? pose.secondEyeScaleY : 0)),
      exponent: eye.exponent,
      rotationDegrees: eye.rotationDegrees * (1 - pose.leanLock)
        + (pose.tiltDegrees + (isSecondEye ? pose.secondEyeTiltDegrees : 0)) * side
    )
  }
}

func applyExpressionPalette(
  _ expression: BlobatarExpression,
  to palette: BlobatarPalette
) -> BlobatarPalette {
  guard let tint = expression.tint else { return palette }
  let target = tinted(head: palette.head, eye: palette.eye, toward: tint.target)
  return BlobatarPalette(
    background: palette.background,
    head: mixHex(palette.head, target.head, amount: expression.pose.heat),
    eye: mixHex(palette.eye, target.eye, amount: expression.pose.heat)
  )
}
