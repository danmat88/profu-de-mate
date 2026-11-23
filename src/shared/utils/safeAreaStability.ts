export type SafeAreaInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type SafeAreaFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SafeAreaMetricsSnapshot = {
  insets: SafeAreaInsets;
  frame: SafeAreaFrame;
};

export type SafeAreaStabilityOptions = {
  /**
   * True on Android where the navigation bar is configured hidden in immersive
   * mode, so transient or resumed system bars overlay instead of shifting UI.
   */
  immersiveBottom: boolean;
};

const DIMENSION_EPSILON = 1;
const ORIGIN_EPSILON = 0.5;
const MATERIAL_HEIGHT_CHANGE_DP = 96;

function sameInsets(a: SafeAreaInsets, b: SafeAreaInsets): boolean {
  return a.top === b.top
    && a.right === b.right
    && a.bottom === b.bottom
    && a.left === b.left;
}

function sameFrame(a: SafeAreaFrame, b: SafeAreaFrame): boolean {
  return a.x === b.x
    && a.y === b.y
    && a.width === b.width
    && a.height === b.height;
}

function sanitizeInset(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Filters transient Android safe-area and viewport fluctuations triggered when
 * minimizing, resuming from Recents, swiping system bars, or opening native
 * pickers and sheets, while still adapting immediately to real resizes such as
 * split-screen, foldables, or soft-keyboard layout changes.
 */
export function stabilizeSafeAreaMetrics(
  previous: SafeAreaMetricsSnapshot,
  live: SafeAreaMetricsSnapshot,
  options: SafeAreaStabilityOptions,
): SafeAreaMetricsSnapshot {
  if (
    !Number.isFinite(live.frame.width)
    || !Number.isFinite(live.frame.height)
    || live.frame.width <= 0
    || live.frame.height <= 0
  ) {
    return previous;
  }

  const liveInsets: SafeAreaInsets = {
    top: sanitizeInset(live.insets.top),
    right: sanitizeInset(live.insets.right),
    bottom: sanitizeInset(live.insets.bottom),
    left: sanitizeInset(live.insets.left),
  };

  const widthChanged = Math.abs(live.frame.width - previous.frame.width) >= DIMENSION_EPSILON;
  const heightDelta = live.frame.height - previous.frame.height;
  const materialHeightChange = Math.abs(heightDelta) >= MATERIAL_HEIGHT_CHANGE_DP;
  // Allow cold-launch viewport expansion once Android finishes hiding the nav bar,
  // while ignoring temporary shrinks (< 96dp) caused by resumed system bars.
  const expandedToFullHeight = !materialHeightChange && heightDelta >= DIMENSION_EPSILON;

  const nextFrame = widthChanged || materialHeightChange || expandedToFullHeight
    ? live.frame
    : previous.frame;

  const isTopAnchoredWindow = nextFrame.y <= ORIGIN_EPSILON;
  const stabilizeBottom = (prevBottom: number, incomingBottom: number) => (
    options.immersiveBottom ? Math.min(prevBottom, incomingBottom) : incomingBottom
  );

  let nextInsets: SafeAreaInsets;

  if (widthChanged) {
    nextInsets = {
      top: isTopAnchoredWindow && liveInsets.top === 0 && previous.insets.top > 0
        ? previous.insets.top
        : liveInsets.top,
      right: liveInsets.right,
      bottom: stabilizeBottom(previous.insets.bottom, liveInsets.bottom),
      left: liveInsets.left,
    };
  } else if (materialHeightChange) {
    // Split-screen bottom panes legitimately have top = 0 (frame.y > 0); top-anchored
    // windows (including soft-keyboard resize) keep their established status-bar top.
    nextInsets = {
      top: isTopAnchoredWindow
        ? (liveInsets.top > 0 ? liveInsets.top : previous.insets.top)
        : liveInsets.top,
      right: liveInsets.right,
      bottom: stabilizeBottom(previous.insets.bottom, liveInsets.bottom),
      left: liveInsets.left,
    };
  } else {
    nextInsets = {
      top: Math.max(previous.insets.top, liveInsets.top),
      right: Math.max(previous.insets.right, liveInsets.right),
      bottom: stabilizeBottom(previous.insets.bottom, liveInsets.bottom),
      left: Math.max(previous.insets.left, liveInsets.left),
    };
  }

  const resolvedFrame = sameFrame(previous.frame, nextFrame) ? previous.frame : nextFrame;
  const resolvedInsets = sameInsets(previous.insets, nextInsets) ? previous.insets : nextInsets;

  if (resolvedFrame === previous.frame && resolvedInsets === previous.insets) {
    return previous;
  }

  return {
    frame: resolvedFrame,
    insets: resolvedInsets,
  };
}
