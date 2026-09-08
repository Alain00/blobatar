// swift-tools-version: 6.0

import PackageDescription

let package = Package(
  name: "BlobatarStudio",
  platforms: [
    .iOS(.v15),
    .macOS(.v12),
  ],
  dependencies: [
    .package(path: "../../../..")
  ],
  targets: [
    .executableTarget(
      name: "BlobatarStudio",
      dependencies: [
        .product(name: "BlobatarCore", package: "blobatar"),
        .product(name: "BlobatarSwiftUI", package: "blobatar"),
      ]
    ),
    .testTarget(
      name: "BlobatarStudioTests",
      dependencies: ["BlobatarStudio"]
    ),
  ]
)
