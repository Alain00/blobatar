// swift-tools-version: 6.0

import PackageDescription

let package = Package(
  name: "BlobatarConsumerSmoke",
  platforms: [
    .iOS(.v15),
    .macOS(.v12),
  ],
  dependencies: [
    .package(path: "../../../..")
  ],
  targets: [
    .executableTarget(
      name: "BlobatarConsumerSmoke",
      dependencies: [
        .product(name: "BlobatarCore", package: "blobatar"),
        .product(name: "BlobatarSwiftUI", package: "blobatar"),
      ]
    )
  ]
)
