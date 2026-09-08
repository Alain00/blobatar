import Foundation

private let hashSeparator: UInt8 = 0xff

/// ECMAScript's trim set, expressed explicitly so hashing does not inherit a
/// platform Foundation release's idea of whitespace.
private func isJavaScriptWhitespace(_ scalar: Unicode.Scalar) -> Bool {
  switch scalar.value {
  case 0x0009...0x000D, 0x0020, 0x00A0, 0x1680, 0x2000...0x200A, 0x2028, 0x2029,
    0x202F, 0x205F, 0x3000, 0xFEFF:
    true
  default:
    false
  }
}

private func isCaseIgnorable(_ scalar: Unicode.Scalar) -> Bool {
  (0x0300...0x036F).contains(scalar.value) || scalar.value == 0x00AD
    || scalar.value == 0x200B
}

private func isCased(_ scalar: Unicode.Scalar) -> Bool {
  let value = scalar.value
  return (0x41...0x5A).contains(value)
    || (0x61...0x7A).contains(value)
    || ((0xC0...0x24F).contains(value) && value != 0xD7 && value != 0xF7)
    || (0x370...0x3FF).contains(value)
    || (0x400...0x4FF).contains(value)
    || (0x1E00...0x1FFF).contains(value)
}

private func isPrecededByCased(_ scalars: [Unicode.Scalar], at index: Int) -> Bool {
  guard index > 0 else { return false }
  for candidate in scalars[..<index].reversed() {
    if isCased(candidate) { return true }
    if !isCaseIgnorable(candidate) { return false }
  }
  return false
}

private func isFollowedByCased(_ scalars: [Unicode.Scalar], at index: Int) -> Bool {
  guard index + 1 < scalars.count else { return false }
  for candidate in scalars[(index + 1)...] {
    if isCased(candidate) { return true }
    if !isCaseIgnorable(candidate) { return false }
  }
  return false
}

/// NFC, ECMAScript trim, and JavaScript-compatible full lowercase mapping.
func normalizeSeed(_ seed: String) -> String {
  let composed = seed.precomposedStringWithCanonicalMapping
  let scalars = Array(composed.unicodeScalars)
  guard let first = scalars.firstIndex(where: { !isJavaScriptWhitespace($0) }) else {
    return ""
  }
  let last = scalars.lastIndex(where: { !isJavaScriptWhitespace($0) })!
  let trimmed = Array(scalars[first...last])

  var mapped = ""
  mapped.reserveCapacity(composed.utf8.count)
  for (index, scalar) in trimmed.enumerated() {
    if scalar.value == 0x0130 {
      mapped.unicodeScalars.append(Unicode.Scalar(0x0069)!)
      mapped.unicodeScalars.append(Unicode.Scalar(0x0307)!)
    } else if scalar.value == 0x03A3 && isPrecededByCased(trimmed, at: index)
      && !isFollowedByCased(trimmed, at: index)
    {
      mapped.unicodeScalars.append(Unicode.Scalar(0x03C2)!)
    } else {
      mapped.unicodeScalars.append(scalar)
    }
  }
  return mapped.lowercased()
}

private func feed(_ initial: UInt32, bytes: some Sequence<UInt8>) -> UInt32 {
  var hash = initial
  for byte in bytes {
    hash = (hash ^ UInt32(byte)) &* 3_432_918_353
    hash = (hash << 13) | (hash >> 19)
  }
  return hash
}

private func finalize(_ initial: UInt32) -> UInt32 {
  var hash = initial
  hash = (hash ^ (hash >> 16)) &* 2_246_822_507
  hash = (hash ^ (hash >> 13)) &* 3_266_489_909
  return hash ^ (hash >> 16)
}

func seedState(_ seed: String, normalize: Bool = true) -> UInt32 {
  let value = normalize ? normalizeSeed(seed) : seed
  let initial = UInt32(1_779_033_703) ^ UInt32(truncatingIfNeeded: value.utf16.count)
  return feed(initial, bytes: value.utf8)
}

func stream(state: UInt32, key: String) -> Double {
  let separated = feed(state, bytes: CollectionOfOne(hashSeparator))
  return Double(finalize(feed(separated, bytes: key.utf8))) / 4_294_967_296
}
