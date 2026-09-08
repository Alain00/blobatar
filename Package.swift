// swift-tools-version: 6.0

import PackageDescription

let package = Package(
  name: "Blobatar",
  platforms: [
    .iOS(.v15),
    .macOS(.v12),
  ],
  products: [
    .library(name: "BlobatarCore", targets: ["BlobatarCore"]),
    .library(name: "BlobatarSwiftUI", targets: ["BlobatarSwiftUI"]),
  ],
  targets: [
    .target(
      name: "BlobatarCore",
      path: "packages/swift/Sources/BlobatarCore"
    ),
    .target(
      name: "BlobatarSwiftUI",
      dependencies: ["BlobatarCore"],
      path: "packages/swift/Sources/BlobatarSwiftUI"
    ),
    .testTarget(
      name: "BlobatarCoreTests",
      dependencies: ["BlobatarCore"],
      path: "packages/swift/Tests/BlobatarCoreTests"
    ),
    .testTarget(
      name: "BlobatarSwiftUITests",
      dependencies: ["BlobatarCore", "BlobatarSwiftUI"],
      path: "packages/swift/Tests/BlobatarSwiftUITests"
    ),
  ]
)
