import Foundation
import SwiftUI

enum WebSeedMark: String, CaseIterable, Identifiable {
  case claude = "Claude"
  case codex = "Codex"

  var id: Self { self }
}

struct StudioEasterEgg: Identifiable {
  static let all = [
    StudioEasterEgg(seed: "claude", mark: .claude),
    StudioEasterEgg(seed: "codex", mark: .codex),
  ]

  let seed: String
  let mark: WebSeedMark

  var id: WebSeedMark { mark }
}

private let webSeedMarks: [String: WebSeedMark] = [
  "b0d11833": .claude,
  "d4cde064": .codex,
  "e1fc8517": .claude,
  "ede616c3": .codex,
]

func webSeedMarkFor(_ name: String) -> WebSeedMark? {
  webSeedMarks[webSeedKey(name)]
}

func webSeedKey(_ name: String) -> String {
  let normalized = name
    .precomposedStringWithCanonicalMapping
    .trimmingCharacters(in: .whitespacesAndNewlines)
    .split(whereSeparator: \.isWhitespace)
    .joined(separator: " ")
    .lowercased()
  var hash: UInt32 = 0x811c_9dc5
  for codeUnit in normalized.utf16 {
    hash = (hash ^ UInt32(codeUnit)) &* 0x0100_0193
  }
  return String(format: "%08x", hash)
}

struct WebSeedMarkView: View {
  let mark: WebSeedMark
  let size: CGFloat
  let accessibilityLabel: String

  init(
    mark: WebSeedMark,
    size: CGFloat,
    accessibilityLabel: String
  ) {
    self.mark = mark
    self.size = max(0, size)
    self.accessibilityLabel = accessibilityLabel
  }

  var body: some View {
    Canvas(opaque: false, rendersAsynchronously: false) { context, canvasSize in
      let scale = min(canvasSize.width, canvasSize.height) / 100
      context.translateBy(
        x: (canvasSize.width - 100 * scale) / 2,
        y: (canvasSize.height - 100 * scale) / 2
      )
      context.scaleBy(x: scale, y: scale)
      switch mark {
      case .claude:
        drawClaude(in: &context)
      case .codex:
        drawCodex(in: &context)
      }
    }
    .frame(width: size, height: size)
    .accessibilityElement(children: .ignore)
    .accessibilityAddTraits(.isImage)
    .accessibilityLabel(Text(accessibilityLabel))
  }
}

private let claudeColor = Color(
  .sRGB,
  red: 217 / 255,
  green: 119 / 255,
  blue: 87 / 255,
  opacity: 1
)

private let claudePixels = [
  "..##########..",
  "..##########..",
  "..##.####.##..",
  "..##.####.##..",
  ".############.",
  ".############.",
  "..##########..",
  "..##########..",
  "...#.#..#.#...",
]

private func drawClaude(in context: inout GraphicsContext) {
  let cell = 90.0 / 14
  let originX = 5.0
  let originY = (100 - Double(claudePixels.count) * cell) / 2
  var figure = Path()

  for (row, pixels) in claudePixels.enumerated() {
    var start: Int?
    for column in 0...pixels.count {
      let filled =
        column < pixels.count
        && pixels[pixels.index(pixels.startIndex, offsetBy: column)] == "#"
      if filled && start == nil {
        start = column
      } else if !filled, let runStart = start {
        figure.addRect(
          CGRect(
            x: originX + Double(runStart) * cell,
            y: originY + Double(row) * cell,
            width: Double(column - runStart) * cell,
            height: cell
          )
        )
        start = nil
      }
    }
  }

  context.fill(figure, with: .color(claudeColor))
}

private let codexCircles: [(x: Double, y: Double, radius: Double)] = [
  (50, 52, 30),
  (33, 33, 18),
  (58, 27, 20),
  (75, 42, 19),
  (74, 66, 18),
  (52, 77, 20),
  (29, 68, 18),
  (23, 49, 17),
]

private func drawCodex(in context: inout GraphicsContext) {
  var cloud = Path()
  for circle in codexCircles {
    cloud.addEllipse(
      in: CGRect(
        x: circle.x - circle.radius,
        y: circle.y - circle.radius,
        width: circle.radius * 2,
        height: circle.radius * 2
      )
    )
  }
  context.fill(
    cloud,
    with: .linearGradient(
      Gradient(colors: [
        Color(.sRGB, red: 179 / 255, green: 164 / 255, blue: 1, opacity: 1),
        Color(.sRGB, red: 122 / 255, green: 0, blue: 1, opacity: 1),
      ]),
      startPoint: CGPoint(x: 50, y: 0),
      endPoint: CGPoint(x: 50, y: 100)
    )
  )

  var prompt = Path()
  prompt.move(to: CGPoint(x: 36, y: 34))
  prompt.addLine(to: CGPoint(x: 50, y: 50))
  prompt.addLine(to: CGPoint(x: 36, y: 66))
  prompt.move(to: CGPoint(x: 55, y: 64))
  prompt.addLine(to: CGPoint(x: 72, y: 64))
  context.stroke(
    prompt,
    with: .color(.white),
    style: StrokeStyle(lineWidth: 8.5, lineCap: .round, lineJoin: .round)
  )
}
