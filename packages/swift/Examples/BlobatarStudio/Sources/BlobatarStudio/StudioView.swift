import BlobatarCore
import BlobatarSwiftUI
import SwiftUI

struct StudioView: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var configuration = StudioConfiguration()
  @State private var previewHovered = false

  private let columns = [
    GridItem(.adaptive(minimum: 112, maximum: 150), spacing: 16)
  ]

  var body: some View {
    NavigationView {
      ScrollView {
        VStack(alignment: .leading, spacing: 24) {
          introduction
          preview
          controls
          easterEggs
          crowd
        }
        .frame(maxWidth: 920)
        .padding()
      }
      .navigationTitle("Blobatar Studio")
    }
    #if os(macOS)
      .frame(minWidth: 760, minHeight: 720)
    #endif
  }

  private var introduction: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text("Deterministic geometric avatars from any string.")
        .font(.title2.weight(.semibold))
      Text(
        "Edit the same public options an application uses, then check one identity or a whole population."
      )
      .foregroundStyle(.secondary)
    }
  }

  private var preview: some View {
    GroupBox("Preview") {
      VStack(spacing: 16) {
        if let mark = currentEasterEgg {
          WebSeedMarkView(
            mark: mark,
            size: 260,
            accessibilityLabel: "\(mark.rawValue) mark"
          )
          .frame(maxWidth: .infinity)
        } else {
          AnimatedBlobatar(
            name: configuration.name,
            size: 260,
            options: configuration.options,
            animation: configuration.motion.animation,
            active: configuration.motion != .staticPreview,
            accessibilityLabel: "\(displayName) Blobatar"
          )
          .frame(maxWidth: .infinity)
        }

        VStack(spacing: 4) {
          Text(displayName)
            .font(.headline)
            .lineLimit(1)
          Text(
            currentEasterEgg.map { "\($0.rawValue) web Easter egg · locked" }
              ?? "\(configuration.shape.rawValue) · \(configuration.expression.rawValue)"
          )
          .font(.caption)
          .foregroundStyle(.secondary)
        }

        if currentEasterEgg == nil {
          motionStatus
        }
      }
      .padding(.vertical, 8)
      .contentShape(Rectangle())
      .onHover { previewHovered = $0 }
    }
  }

  private var motionStatus: some View {
    let active = configuration.motion.isActive(
      isHovered: previewHovered,
      reduceMotion: reduceMotion
    )
    let detail: String
    if reduceMotion && configuration.motion != .staticPreview {
      detail = "Reduced Motion makes this endpoint static"
    } else if configuration.motion == .hover && !previewHovered {
      detail = "Move the pointer over the preview to activate"
    } else if active {
      detail =
        configuration.motion == .always
        ? "Seeded ambient motion is always active"
        : "Hover reaction and seeded ambient motion are active"
    } else {
      detail = "Static endpoint"
    }

    return HStack(spacing: 8) {
      Circle()
        .fill(active ? Color.green : Color.secondary)
        .frame(width: 8, height: 8)
      Text(detail)
        .font(.caption)
        .foregroundStyle(.secondary)
    }
    .accessibilityElement(children: .combine)
  }

  private var controls: some View {
    GroupBox("Controls") {
      VStack(alignment: .leading, spacing: 18) {
        TextField("Seed name", text: $configuration.name)
          .textFieldStyle(.roundedBorder)

        VStack(alignment: .leading, spacing: 18) {
          pickerRow("Shape", selection: $configuration.shape) {
            ForEach(StudioShape.allCases) { shape in
              Text(shape.rawValue).tag(shape)
            }
          }

          pickerRow("Expression", selection: $configuration.expression) {
            ForEach(BlobatarExpression.allCases, id: \.rawValue) { expression in
              Text(expression.rawValue.capitalized).tag(expression)
            }
          }

          pickerRow("Backdrop", selection: $configuration.backdrop) {
            ForEach(BlobatarBackdrop.allCases, id: \.rawValue) { backdrop in
              Text(backdrop.rawValue.capitalized).tag(backdrop)
            }
          }

          pickerRow("Narrow eye gap", selection: $configuration.eyeGap) {
            ForEach(StudioEyeGap.allCases) { gap in
              Text(gap.rawValue).tag(gap)
            }
          }

          pickerRow("Motion", selection: $configuration.motion) {
            ForEach(StudioMotionMode.allCases) { mode in
              Text(mode.rawValue).tag(mode)
            }
          }

          Divider()

          Toggle("Override hue", isOn: $configuration.overridesHue)
          if configuration.overridesHue {
            valueSlider(
              "Hue",
              value: $configuration.hue,
              range: 0...360,
              formattedValue: "\(Int(configuration.hue.rounded()))°"
            )
          }

          Toggle("Override tone", isOn: $configuration.overridesTone)
          if configuration.overridesTone {
            valueSlider(
              "Tone",
              value: $configuration.tone,
              range: 0...1,
              formattedValue: configuration.tone.formatted(
                .number.precision(.fractionLength(2)))
            )
          }

          Toggle("Use example palette override", isOn: $configuration.usesPaletteOverride)
          Toggle("Normalize seed", isOn: $configuration.normalize)
          Toggle("Correct generated contrast", isOn: $configuration.contrast)
        }
        .disabled(currentEasterEgg != nil)

        if currentEasterEgg != nil {
          Text("Easter egg appearance controls are intentionally locked.")
            .font(.caption)
            .foregroundStyle(.secondary)
        }
      }
      .padding(.vertical, 8)
    }
  }

  private var easterEggs: some View {
    GroupBox("Blobatar Easter eggs") {
      VStack(alignment: .leading, spacing: 12) {
        Text("These example-only seeded marks mirror blobatar.dev and the Flutter Studio.")
          .font(.caption)
          .foregroundStyle(.secondary)
        LazyVGrid(columns: columns, spacing: 16) {
          ForEach(StudioEasterEgg.all) { easterEgg in
            Button {
              configuration.name = easterEgg.seed
            } label: {
              VStack(spacing: 8) {
                WebSeedMarkView(
                  mark: easterEgg.mark,
                  size: 82,
                  accessibilityLabel: "\(easterEgg.mark.rawValue) mark"
                )
                Text(easterEgg.mark.rawValue)
                Text("shape + expression locked")
                  .font(.caption2)
                  .foregroundStyle(.secondary)
              }
              .frame(maxWidth: .infinity)
            }
            .buttonStyle(.plain)
            .accessibilityHint("Use \(easterEgg.seed) as the preview seed")
          }
        }
      }
      .padding(.vertical, 8)
    }
  }

  private var crowd: some View {
    StudioCrowdView()
      .equatable()
  }

  private var displayName: String {
    configuration.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      ? "Empty seed"
      : configuration.name
  }

  private var currentEasterEgg: WebSeedMark? {
    webSeedMarkFor(configuration.name)
  }

  private func pickerRow<Selection: Hashable, Content: View>(
    _ title: String,
    selection: Binding<Selection>,
    @ViewBuilder content: () -> Content
  ) -> some View {
    HStack {
      Text(title)
      Spacer()
      Picker(title, selection: selection, content: content)
        .labelsHidden()
        .pickerStyle(.menu)
    }
  }

  private func valueSlider(
    _ title: String,
    value: Binding<Double>,
    range: ClosedRange<Double>,
    formattedValue: String
  ) -> some View {
    VStack(alignment: .leading, spacing: 4) {
      HStack {
        Text(title)
        Spacer()
        Text(formattedValue)
          .foregroundStyle(.secondary)
          .monospacedDigit()
      }
      Slider(value: value, in: range)
    }
  }
}

private struct StudioCrowdView: View, Equatable {
  private let columns = [
    GridItem(.adaptive(minimum: 112, maximum: 150), spacing: 16)
  ]

  // This view intentionally has no preview inputs. Equality keeps control-state
  // updates from traversing and reconstructing the static grid.
  nonisolated static func == (_ lhs: Self, _ rhs: Self) -> Bool { true }

  var body: some View {
    GroupBox("Crowd check") {
      VStack(alignment: .leading, spacing: 14) {
        Text("Twelve stable, independent examples spanning every silhouette.")
          .font(.caption)
          .foregroundStyle(.secondary)
        LazyVGrid(columns: columns, spacing: 18) {
          ForEach(StudioConfiguration.crowdCatalog) { entry in
            VStack(spacing: 7) {
              Blobatar(
                name: entry.name,
                size: 78,
                options: entry.options,
                accessibilityLabel: "\(entry.name) Blobatar"
              )
              Text(entry.name)
                .font(.caption)
                .lineLimit(1)
            }
          }
        }
      }
      .padding(.vertical, 8)
    }
  }
}
