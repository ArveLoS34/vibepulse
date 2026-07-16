import { useEffect } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/lib/api";

export function useNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    async function registerForPushNotifications() {
      if (!user) return;

      // Skip push notification registration on Expo Go (SDK 53+ requirement)
      const isExpoGo =
        Constants.appOwnership === "expo" ||
        (Constants as any).executionEnvironment === "storeClient";
      if (isExpoGo) {
        return;
      }

      try {
        const Notifications = await import("expo-notifications");
        const perm: any = await Notifications.getPermissionsAsync();
        let finalStatus = perm?.status || (perm?.granted ? "granted" : "denied");

        if (finalStatus !== "granted" && typeof Notifications.requestPermissionsAsync === "function") {
          const reqPerm: any = await Notifications.requestPermissionsAsync();
          finalStatus = reqPerm?.status || (reqPerm?.granted ? "granted" : "denied");
        }

        if (finalStatus !== "granted") return;

        if (typeof Notifications.getExpoPushTokenAsync === "function") {
          const tokenData = await Notifications.getExpoPushTokenAsync();
          if (tokenData?.data) {
            await api("/users/push-token", {
              method: "POST",
              body: JSON.stringify({ push_token: tokenData.data }),
            });
          }
        }

        if (Platform.OS === "android" && typeof Notifications.setNotificationChannelAsync === "function") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "default",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#F43F5E",
          });
        }
      } catch (err) {
        // Push notification not supported in current environment
      }
    }

    registerForPushNotifications();
  }, [user?.user_id]);
}
