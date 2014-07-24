/**
 * Copyright 2014 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

function timing_test_impl(callback, desc) {
  console.log('RUNNING: ' + desc);
  var svgFragmentList = document.querySelectorAll('svg');

  var expectationList = [];
  var expectationIndex = -1;

  var numExpectationMatches = 0;

  // Control debug logging.
  var verbose = false;

  function setTime(millis) {
    for (var fragmentIndex = 0;
         fragmentIndex < svgFragmentList.length;
         ++fragmentIndex) {
      svgFragmentList[fragmentIndex].pauseAnimations();
      svgFragmentList[fragmentIndex].setCurrentTime(millis / 1000);
    }
    document.timeline._pauseAnimationsForTesting(millis);
  }

  function readAttribute(element, propertyName) {
    if (typeof element == 'string' || element instanceof String) {
      // Specifying elements by id is useful when they may not initially exist.
      element = document.getElementById(element);
    }

    var attribute;
    switch (propertyName) {
      case 'targetElement':
        return element.targetElement;
      case 'simpleDuration':
        return element.getSimpleDuration();
      case 'startTime':
        return element.getStartTime();
      case 'currentTime':
        return element.getCurrentTime();
      case 'css-transform':
        return getComputedStyle(element).transform;
      default:
        // FIXME: getAttribute(expectation.propertyName) does not return
        // animated value for polyfillAnimatedElement but does for
        // nativeAnimatedElement.
        attribute = element.attributes[propertyName];
        if (attribute) {
          return attribute.value;
        } else {
          // This occurs with transform of SVG native elements.
          return undefined;
        }
    }
  }

  function roughlyEqual(first, second) {
    return Math.abs(first - second) < 1E-6;
  }

  function verifyExpectation() {
    var expectation = expectationList[expectationIndex];
    if (expectation.command) {
      expectation.command();
      ++numExpectationMatches;
      scheduleNext();
      return;
    }
    var expectedValue = expectation.expectedValue;

    var polyfillAnimatedValue = readAttribute(
        expectation.polyfillAnimatedElement, expectation.propertyName);
    var nativeAnimatedValue = readAttribute(
        expectation.nativeAnimatedElement, expectation.propertyName);

    var matched = false;
    if (Array.isArray(expectedValue)) {
      if (expectedValue[0] === polyfillAnimatedValue &&
          expectedValue[1] === nativeAnimatedValue) {
        matched = true;
      }
    } else {
      if (typeof expectedValue == 'number') {
        if (roughlyEqual(parseFloat(polyfillAnimatedValue), expectedValue) &&
            roughlyEqual(parseFloat(nativeAnimatedValue), expectedValue)) {
          matched = true;
        }
      } else if (polyfillAnimatedValue === expectedValue &&
                 nativeAnimatedValue === expectedValue) {
        matched = true;
      }
    }

    if (verbose || !matched) {
      console.log(expectation.millis + 'ms ' + expectation.propertyName +
          ' expected=' + expectedValue +
          ' ' + expectation.polyfillAnimatedElement.id +
          '=' + polyfillAnimatedValue +
          ' ' + expectation.nativeAnimatedElement.id +
          '=' + nativeAnimatedValue + '.');
    }

    if (matched) {
      ++numExpectationMatches;
    }
    scheduleNext();
  }

  function scheduleNext() {
    ++expectationIndex;
    if (expectationIndex < expectationList.length) {
      var expectation = expectationList[expectationIndex];
      setTime(expectation.millis);
      window.requestAnimationFrame(verifyExpectation);
    } else if (numExpectationMatches === expectationList.length) {
      console.log('PASSED: ' + desc);
    } else {
      console.log('FAILED: ' + desc);
    }
  }

  var original_at = window.at;
  var original_executeAt = window.executeAt;
  window.at = function(millis, propertyName, expectedValue,
                       polyfillAnimatedElement, nativeAnimatedElement) {
    expectationList.push({
      millis: millis,
      propertyName: propertyName,
      expectedValue: expectedValue,
      polyfillAnimatedElement: polyfillAnimatedElement,
      nativeAnimatedElement: nativeAnimatedElement
    });
  };
  window.executeAt = function(millis, command) {
    expectationList.push({
      millis: millis,
      command: command
    });
  };
  callback();
  window.at = original_at;
  window.executeAt = original_executeAt;

  scheduleNext();
}

// FIXME: support a sequence of timing tests.
// For now, timing_test may only be called once.
function timing_test(callback, desc) {
  window.addEventListener('load', function() {
    timing_test_impl(callback, desc);
  });
}
