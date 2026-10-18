import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:blobatar/blobatar.dart';
import 'package:test/test.dart';

/// The cross-language fixture, exported once from the TypeScript
/// implementation at blobatar 2.4.0 by `tools/export-reference-vectors.ts`.
/// It lives at the repository root and is shared with the Swift port.
final Map<String, dynamic> vectors = loadVectors();

Map<String, dynamic> loadVectors() {
  final file = File('../../fixtures/blobatar-v2.4.0.json');
  return jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
}

/// Relative comparison per `meta.comparisonRules`: trig-derived layout floats
/// may differ across engines by ULPs; the fixture documents 1e-9.
///
/// Named `closeEnough` to stay clear of matcher's `closeTo`.
bool closeEnough(double actual, double expected, [double tol = 1e-9]) {
  if (identical(actual, expected)) return true;
  if (actual.isNaN && expected.isNaN) return true;
  final double scale = math.max(1.0, math.max(actual.abs(), expected.abs()));
  return (actual - expected).abs() <= tol * scale;
}

void expectEllipse(
  double cx,
  double cy,
  double rx,
  double ry,
  Map<String, dynamic> expected,
  String what,
) {
  expect(closeEnough(cx, (expected['cx'] as num).toDouble()), isTrue,
      reason: '$what.cx');
  expect(closeEnough(cy, (expected['cy'] as num).toDouble()), isTrue,
      reason: '$what.cy');
  expect(closeEnough(rx, (expected['rx'] as num).toDouble()), isTrue,
      reason: '$what.rx');
  expect(closeEnough(ry, (expected['ry'] as num).toDouble()), isTrue,
      reason: '$what.ry');
}

void expectEye(Eye actual, Map<String, dynamic> expected, String what) {
  expectEllipse(
    actual.cx,
    actual.cy,
    actual.rx,
    actual.ry,
    expected,
    what,
  );
  expect(closeEnough(actual.n, (expected['n'] as num).toDouble()), isTrue,
      reason: '$what.n');
  expect(closeEnough(actual.rot, (expected['rot'] as num).toDouble()), isTrue,
      reason: '$what.rot');
}

/// Rebuilds [BlobatarOptions] from a fixture case's `options` object.
BlobatarOptions optionsFromJson(Map<String, dynamic> json) {
  Map<String, Object>? traits;
  if (json['traits'] != null) {
    traits = (json['traits'] as Map<String, dynamic>).map((k, v) {
      if (v is List) {
        return MapEntry(k, [for (final e in v) (e as num).toDouble()]);
      }
      return MapEntry(k, (v as num).toDouble());
    });
  }
  return BlobatarOptions(
    traits: traits,
    hue: (json['hue'] as num?)?.toDouble(),
    tone: (json['tone'] as num?)?.toDouble(),
    contrast: json['contrast'] as bool? ?? true,
    normalize: json['normalize'] as bool? ?? true,
  );
}
