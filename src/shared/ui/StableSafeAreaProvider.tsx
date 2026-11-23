import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import {
  initialWindowMetrics,
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  useSafeAreaFrame,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { stabilizeSafeAreaMetrics, type SafeAreaMetricsSnapshot } from '../utils/safeAreaStability';

const IMMERSIVE_BOTTOM = Platform.OS === 'android';

function SafeAreaStabilizer({ children }: { children: ReactNode }) {
  const liveInsets = useSafeAreaInsets();
  const liveFrame = useSafeAreaFrame();
  const { top, right, bottom, left } = liveInsets;
  const { x, y, width, height } = liveFrame;
  const [stable, setStable] = useState<SafeAreaMetricsSnapshot>(() => ({
    insets: { top, right, bottom, left },
    frame: { x, y, width, height },
  }));

  useEffect(() => {
    setStable((previous) =>
      stabilizeSafeAreaMetrics(
        previous,
        {
          insets: { top, right, bottom, left },
          frame: { x, y, width, height },
        },
        { immersiveBottom: IMMERSIVE_BOTTOM },
      ),
    );
  }, [top, right, bottom, left, x, y, width, height]);

  return (
    <SafeAreaFrameContext.Provider value={stable.frame}>
      <SafeAreaInsetsContext.Provider value={stable.insets}>
        {children}
      </SafeAreaInsetsContext.Provider>
    </SafeAreaFrameContext.Provider>
  );
}

/**
 * Root safe-area provider that shields all screens and modals from transient
 * Android inset and frame jumps during app minimize, resume, and bar overlays.
 */
export function StableSafeAreaProvider({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <SafeAreaStabilizer>{children}</SafeAreaStabilizer>
    </SafeAreaProvider>
  );
}
