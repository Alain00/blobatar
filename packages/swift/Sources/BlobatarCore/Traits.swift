struct TraitReader {
  let state: UInt32
  private let overrides: [String: BlobatarTraitOverride]

  init(
    name: String,
    normalize: Bool = true,
    overrides: [String: BlobatarTraitOverride] = [:]
  ) {
    state = seedState(name, normalize: normalize)
    self.overrides = overrides
  }

  func value(_ key: String) -> Double {
    let override: Double?
    switch overrides[key] {
    case .pinned(let value):
      override = value
    case .narrowed(let values) where !values.isEmpty:
      let index = Int((stream(state: state, key: key) * Double(values.count)).rounded(.down))
      override = values[index]
    case .narrowed, nil:
      override = nil
    }

    guard let override else { return stream(state: state, key: key) }
    if override > 0 {
      return override < 1 ? override : 0.999_999
    }
    return 0
  }

  func number(_ key: String, min: Double, max: Double) -> Double {
    min + value(key) * (max - min)
  }

  func integer(_ key: String, min: Int, max: Int) -> Int {
    min + Int((value(key) * Double(max - min + 1)).rounded(.down))
  }

  func pick<Value>(_ key: String, from values: [Value]) -> Value {
    values[Int((value(key) * Double(values.count)).rounded(.down))]
  }

  func boolean(_ key: String, probability: Double = 0.5) -> Bool {
    value(key) < probability
  }

  func jitter(_ key: String, amount: Double) -> Double {
    (value(key) * 2 - 1) * amount
  }
}
