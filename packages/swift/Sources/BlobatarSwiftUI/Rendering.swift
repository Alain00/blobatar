import BlobatarCore
import Foundation
import SwiftUI

enum BlobatarRenderLayer: Int, CaseIterable {
  case backdrop
  case petal
  case extraMark
  case body
  case eye
}

struct BlobatarRenderCommand {
  let layer: BlobatarRenderLayer
  let path: Path
  let fill: BlobatarRGB
}

struct BlobatarRenderPlan {
  let commands: [BlobatarRenderCommand]

  init(drawing: BlobatarDrawing) {
    let head = BlobatarRGB(hex: drawing.palette.head)
    let eye = BlobatarRGB(hex: drawing.palette.eye)
    let bodyOffsetY = drawing.bodyOffsetY
    let bodyTransform = CGAffineTransform(translationX: 0, y: bodyOffsetY)
    func bodyPath(_ path: BlobatarPath) -> Path {
      swiftUIPath(from: path).applying(bodyTransform)
    }
    var commands: [BlobatarRenderCommand] = []

    if let backdrop = drawing.backdrop {
      commands.append(
        BlobatarRenderCommand(
          layer: .backdrop,
          path: swiftUIPath(from: backdrop.path),
          fill: BlobatarRGB(hex: backdrop.color)
        )
      )
    }
    commands.append(
      contentsOf: drawing.petals.map { petal in
        BlobatarRenderCommand(
          layer: .petal,
          path: Path(
            ellipseIn: CGRect(
              x: petal.centerX - petal.radius,
              y: petal.centerY - petal.radius + bodyOffsetY,
              width: petal.radius * 2,
              height: petal.radius * 2
            )
          ),
          fill: head
        )
      }
    )
    commands.append(
      contentsOf: drawing.extraPaths.map {
        BlobatarRenderCommand(layer: .extraMark, path: bodyPath($0), fill: head)
      }
    )
    commands.append(
      BlobatarRenderCommand(layer: .body, path: bodyPath(drawing.bodyPath), fill: head)
    )
    commands.append(
      contentsOf: drawing.eyePaths.map {
        BlobatarRenderCommand(layer: .eye, path: bodyPath($0), fill: eye)
      }
    )

    self.commands = commands
  }

  func draw(in context: inout GraphicsContext, size: CGSize) {
    let viewport = BlobatarViewport(size: size)
    guard viewport.scale > 0 else { return }

    context.translateBy(x: viewport.origin.x, y: viewport.origin.y)
    context.scaleBy(x: viewport.scale, y: viewport.scale)
    for command in commands {
      context.fill(command.path, with: .color(command.fill.color))
    }
  }
}

struct BlobatarViewport: Equatable {
  let origin: CGPoint
  let side: CGFloat
  let scale: CGFloat

  init(size: CGSize) {
    side = max(0, min(size.width, size.height))
    origin = CGPoint(
      x: (size.width - side) / 2,
      y: (size.height - side) / 2
    )
    scale = side / 100
  }
}

struct BlobatarRGB: Equatable, Hashable {
  let red: Double
  let green: Double
  let blue: Double

  init(hex: String) {
    guard
      hex.count == 7,
      hex.first == "#",
      let value = UInt32(hex.dropFirst(), radix: 16)
    else {
      preconditionFailure("Blobatar palette colors must use #rrggbb notation")
    }
    red = Double((value >> 16) & 0xff) / 255
    green = Double((value >> 8) & 0xff) / 255
    blue = Double(value & 0xff) / 255
  }

  var color: Color {
    Color(red: red, green: green, blue: blue)
  }
}

final class BlobatarRendering {
  let drawing: BlobatarDrawing
  let plan: BlobatarRenderPlan

  init(drawing: BlobatarDrawing) {
    self.drawing = drawing
    plan = BlobatarRenderPlan(drawing: drawing)
  }
}

final class BlobatarRenderCache: @unchecked Sendable {
  static let shared = BlobatarRenderCache()

  private let lock = NSLock()
  private let storage = NSCache<BlobatarRequestReference, BlobatarRendering>()

  init(countLimit: Int = 512) {
    storage.countLimit = countLimit
  }

  func rendering(for name: String, options: BlobatarOptions) -> BlobatarRendering {
    let key = BlobatarRequestKey(name: name, options: options)
    let reference = BlobatarRequestReference(key)

    lock.lock()
    defer { lock.unlock() }
    if let cached = storage.object(forKey: reference) {
      return cached
    }

    let rendering = BlobatarRendering(drawing: resolveBlobatar(name, options: options))
    storage.setObject(rendering, forKey: reference)
    return rendering
  }
}

final class BlobatarRequestReference: NSObject {
  let value: BlobatarRequestKey

  init(_ value: BlobatarRequestKey) {
    self.value = value
  }

  override var hash: Int { value.hashValue }

  override func isEqual(_ object: Any?) -> Bool {
    guard let other = object as? BlobatarRequestReference else { return false }
    return value == other.value
  }
}

struct BlobatarRequestKey: Hashable {
  let name: String
  let palette: BlobatarPaletteOverride?
  let hue: UInt64?
  let tone: UInt64?
  let traits: [TraitEntry]
  let normalize: Bool
  let contrast: Bool
  let background: BlobatarBackdrop?
  let expression: BlobatarExpression?

  init(name: String, options: BlobatarOptions, includeExpression: Bool = true) {
    self.name = name
    palette = options.palette
    hue = options.hue?.bitPattern
    tone = options.tone?.bitPattern
    traits = options.traits.map { key, value in
      TraitEntry(name: key, value: TraitValue(value))
    }.sorted { $0.name < $1.name }
    normalize = options.normalize
    contrast = options.contrast
    background = options.background
    expression = includeExpression ? options.expression : nil
  }
}

struct TraitEntry: Hashable {
  let name: String
  let value: TraitValue
}

enum TraitValue: Hashable {
  case pinned(UInt64)
  case narrowed([UInt64])

  init(_ value: BlobatarTraitOverride) {
    switch value {
    case .pinned(let number):
      self = .pinned(number.bitPattern)
    case .narrowed(let numbers):
      self = .narrowed(numbers.map(\.bitPattern))
    }
  }
}
