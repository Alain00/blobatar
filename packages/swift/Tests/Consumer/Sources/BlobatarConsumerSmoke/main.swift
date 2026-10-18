import BlobatarCore
import BlobatarSwiftUI

precondition(BlobatarContract.referenceVersion == "2.4.0")
precondition(BlobatarContract.generation == "gen2")

let drawing = resolveBlobatar(
  "alain",
  options: BlobatarOptions(
    palette: BlobatarPaletteOverride(head: "#112233"),
    traits: ["shape": .pinned(0.99)],
    background: .square
  )
)
precondition(drawing.silhouette == .triangle)
precondition(drawing.palette.head == "#112233")
precondition(drawing.eyes.count == 2)
precondition(drawing.backdrop != nil)

let view = Blobatar(
  name: "alain",
  size: 64,
  options: BlobatarOptions(background: .square, expression: .happy),
  accessibilityLabel: "Avatar of Alain"
)
precondition(view.name == "alain")
precondition(view.size == 64)

let animated = AnimatedBlobatar(
  name: "alain",
  size: 64,
  options: BlobatarOptions(expression: .thinking),
  animation: .always,
  active: true,
  accessibilityLabel: "Animated avatar of Alain"
)
precondition(animated.animation == .always)
precondition(animated.active)

let motion = resolveBlobatarMotion("alain")
let frame = blobatarMotionFrame(
  seeds: motion,
  elapsedMilliseconds: 1_234,
  amplitude: 1
)
precondition(frame.blinkScaleY > 0)

print(
  "Blobatar Swift consumer resolved and presented a generation-2 \(drawing.silhouette.rawValue)")
