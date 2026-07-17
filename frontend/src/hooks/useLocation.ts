import { useEffect } from "react";
import * as Location from "expo-location";
import { useAuth } from "@/src/context/AuthContext";

export function useLocation() {
  const { user, updateProfile } = useAuth();

  useEffect(() => {
    async function syncLocation() {
      if (!user) return;

      try {
        if (!Location || typeof Location.requestForegroundPermissionsAsync !== "function") return;
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const newLoc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };

        if (!user.location || Math.abs(user.location.lat - newLoc.lat) > 0.01) {
          await updateProfile({ location: newLoc });
        }
      } catch (err) {
        // Location permission or service disabled
      }
    }

    syncLocation();
  }, [user?.user_id]);
}
