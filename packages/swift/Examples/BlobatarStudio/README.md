# Blobatar Studio

Blobatar Studio is the iOS and macOS integration example for the Swift SDK. It
is a separate Swift package so its executable target can import only the
public `BlobatarCore` and `BlobatarSwiftUI` products.

Open `BlobatarStudio.xcodeproj` in Xcode and run the shared `BlobatarStudio`
scheme for My Mac or an iOS simulator. The project produces a real application
bundle on both platforms and resolves the repository root as a local Swift
package dependency.

![Blobatar Studio running on iOS](../../blobatar_swift_studio.png)

The sibling `Package.swift` compiles the same sources as an external-consumer
harness and owns the integration tests. From the repository root, run:

```sh
swift run --package-path packages/swift/Examples/BlobatarStudio BlobatarStudio
swift test --package-path packages/swift/Examples/BlobatarStudio
```

The motion selector demonstrates static, pointer-hover, always-on, and system
Reduced Motion activity policy using the public `AnimatedBlobatar` view. The
crowd is a separate static catalog: its twelve entries span every silhouette,
all backdrop modes, and twelve expressions without inheriting preview controls
or animation. Keeping that subtree independent also leaves control updates to
resolve only the large preview.
