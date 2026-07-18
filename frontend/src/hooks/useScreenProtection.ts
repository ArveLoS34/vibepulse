import { useEffect } from "react";

export function useScreenProtection() {
  useEffect(() => {
    let isMounted = true;

    async function enableProtection() {
      try {
        const ScreenCapture = await import("expo-screen-capture");
        if (isMounted && typeof ScreenCapture.preventScreenCaptureAsync === "function") {
          await ScreenCapture.preventScreenCaptureAsync();
        }
      } catch (err) {
        // Silently handle environment limitations
      }
    }

    enableProtection();

    return () => {
      isMounted = false;
      async function disableProtection() {
        try {
          const ScreenCapture = await import("expo-screen-capture");
          if (typeof ScreenCapture.allowScreenCaptureAsync === "function") {
            await ScreenCapture.allowScreenCaptureAsync();
          }
        } catch (err) {}
      }
      disableProtection();
    };
  }, []);
}
