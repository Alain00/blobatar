import BlobatarCore
import Combine
import SwiftUI
import XCTest

@testable import BlobatarSwiftUI

@MainActor
final class AnimationDriverTests: XCTestCase {
  func testActivityChangeInvalidatesAPausedTimelineAndStartsMotion() {
    let rendering = BlobatarAnimatedRendering(model: BlobatarAnimationModel(name: "activation"))
    let driver = BlobatarAnimationDriver(
      rendering: rendering,
      expression: .idle,
      mode: .always,
      now: 0
    )
    var invalidations = 0
    let observation = driver.objectWillChange.sink { invalidations += 1 }
    let staticFrame = driver.frame(at: 10)

    driver.updateActivity(active: true, mode: .always, hovered: false, now: 10)

    XCTAssertGreaterThan(invalidations, 0)
    XCTAssertTrue(driver.needsContinuousFrames(at: 10))
    XCTAssertNotEqual(driver.frame(at: 210), staticFrame)
    withExtendedLifetime(observation) {}
  }

  func testHoverAndAmbientRampsUseTheirDirectionalDurations() {
    let rendering = BlobatarAnimatedRendering(model: BlobatarAnimationModel(name: "hover"))
    let driver = BlobatarAnimationDriver(
      rendering: rendering,
      expression: .idle,
      mode: .hover,
      now: 0
    )
    driver.updateActivity(active: true, mode: .hover, hovered: true, now: 0)

    let entered = driver.frame(at: 220)
    XCTAssertEqual(entered.hover.a, 1.04, accuracy: 1e-9)
    XCTAssertEqual(entered.hover.tx, -2, accuracy: 1e-9)
    XCTAssertEqual(entered.hover.ty, -3.5, accuracy: 1e-9)
    XCTAssertTrue(driver.needsContinuousFrames(at: 220))

    driver.updateActivity(active: true, mode: .hover, hovered: false, now: 220)
    let exitEnd = driver.frame(at: 380)
    XCTAssertEqual(exitEnd.hover, .identity)
    XCTAssertTrue(driver.needsContinuousFrames(at: 380))
    XCTAssertFalse(driver.needsContinuousFrames(at: 621))
  }

  func testExpressionInterruptionStartsFromTheVisibleFrame() {
    let rendering = BlobatarAnimatedRendering(model: BlobatarAnimationModel(name: "interrupt"))
    let driver = BlobatarAnimationDriver(
      rendering: rendering,
      expression: .idle,
      mode: .hover,
      now: 0
    )
    driver.updateActivity(active: true, mode: .hover, hovered: false, now: 0)
    driver.updateRequest(rendering: rendering, expression: .mad, animate: true, now: 0)
    let beforeInterruption = driver.frame(at: 150)

    driver.updateRequest(rendering: rendering, expression: .happy, animate: true, now: 150)
    let interrupted = driver.frame(at: 150)
    XCTAssertEqual(interrupted.headColor, beforeInterruption.headColor)
    XCTAssertEqual(interrupted.eyeColor, beforeInterruption.eyeColor)

    let settled = driver.frame(at: 450)
    let target = rendering.model.expressionState(for: .happy)
    XCTAssertEqual(settled.headColor, target.headColor)
    XCTAssertEqual(settled.eyeColor, target.eyeColor)
  }

  func testIdentityChangesCutInsteadOfMorphingAcrossGeometry() {
    let first = BlobatarAnimatedRendering(model: BlobatarAnimationModel(name: "first"))
    let second = BlobatarAnimatedRendering(model: BlobatarAnimationModel(name: "second"))
    let driver = BlobatarAnimationDriver(
      rendering: first,
      expression: .mad,
      mode: .always,
      now: 0
    )
    driver.updateActivity(active: true, mode: .always, hovered: false, now: 0)
    driver.updateRequest(rendering: second, expression: .happy, animate: true, now: 20)

    XCTAssertTrue(driver.rendering === second)
    XCTAssertEqual(
      driver.frame(at: 20).headColor, second.model.expressionState(for: .happy).headColor)
  }

  func testExplicitActivitySceneAndReducedMotionAllStopTimelines() {
    XCTAssertFalse(
      blobatarAnimationIsActive(
        explicitlyActive: false,
        scenePhase: .active,
        reduceMotion: false,
        respectsReducedMotion: true
      )
    )
    XCTAssertFalse(
      blobatarAnimationIsActive(
        explicitlyActive: true,
        scenePhase: .inactive,
        reduceMotion: false,
        respectsReducedMotion: true
      )
    )
    XCTAssertFalse(
      blobatarAnimationIsActive(
        explicitlyActive: true,
        scenePhase: .active,
        reduceMotion: true,
        respectsReducedMotion: true
      )
    )
    XCTAssertTrue(
      blobatarAnimationIsActive(
        explicitlyActive: true,
        scenePhase: .active,
        reduceMotion: true,
        respectsReducedMotion: false
      )
    )

    let rendering = BlobatarAnimatedRendering(model: BlobatarAnimationModel(name: "inactive"))
    let driver = BlobatarAnimationDriver(
      rendering: rendering,
      expression: .thinking,
      mode: .always,
      now: 0
    )
    driver.updateActivity(active: false, mode: .always, hovered: false, now: 0)
    XCTAssertFalse(driver.needsContinuousFrames(at: 0))
  }

  func testViewReuseAndCrowdFramesDoNotResolveGeometryAgain() {
    let cache = BlobatarAnimatedRenderCache(countLimit: 32)
    let names = (0..<12).map { "crowd-\($0)" }
    let renderings = names.map { cache.rendering(for: $0, options: BlobatarOptions()) }
    XCTAssertEqual(cache.resolutionCount, 12)

    for _ in 0..<120 {
      for rendering in renderings {
        _ = rendering.model.frame(
          at: 1_234,
          amplitude: 1,
          expression: rendering.model.expressionState(for: .idle)
        )
      }
    }
    XCTAssertEqual(cache.resolutionCount, 12)
    XCTAssertTrue(
      cache.rendering(for: names[0], options: BlobatarOptions()) === renderings[0]
    )
    XCTAssertEqual(cache.resolutionCount, 12)
  }

  func testExpressionChangesReuseBaseGeometry() {
    let cache = BlobatarAnimatedRenderCache(countLimit: 4)
    let idle = cache.rendering(
      for: "same",
      options: BlobatarOptions(background: .circle, expression: .idle)
    )
    let mad = cache.rendering(
      for: "same",
      options: BlobatarOptions(background: .circle, expression: .mad)
    )
    let changedBackdrop = cache.rendering(
      for: "same",
      options: BlobatarOptions(background: .square, expression: .mad)
    )

    XCTAssertTrue(idle === mad)
    XCTAssertFalse(idle === changedBackdrop)
  }
}
