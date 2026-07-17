import { useEffect } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/lib/api";

const PROJECT_ID = "8b323a10-2595-4ef5-923f-vibepulse0001";

export function useNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    async function registerForPushNotifications() {
      if (!user) return;

      const isExpoGo =
        Constants.appOwnership === "expo" ||
        (Constants as any).executionEnvironment === "storeClient";
      if (isExpoGo) {
        return;
      }

      try {
        const Notifications = await import("expo-notifications");

        // Set foreground notification handler so alert banner pops up on screen
        if (typeof Notifications.setNotificationHandler === "function") {
          Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowAlert: true,
              shouldPlaySound: true,
              shouldSetBadge: true,
            }),
          });
        }

        const perm: any = await Notifications.getPermissionsAsync();
        let finalStatus = perm?.status || (perm?.granted ? "granted" : "denied");

        if (finalStatus !== "granted" && typeof Notifications.requestPermissionsAsync === "function") {
          const reqPerm: any = await Notifications.requestPermissionsAsync();
          finalStatus = reqPerm?.status || (reqPerm?.granted ? "granted" : "denied");
        }

        if (finalStatus !== "granted") return;

        if (Platform.OS === "android" && typeof Notifications.setNotificationChannelAsync === "function") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "VibePulse Bildirimleri",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#F43F5E",
            sound: "default",
          });
        }

        if (typeof Notifications.getExpoPushTokenAsync === "function") {
          const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: Constants.expoConfig?.extra?.eas?.projectId || PROJECT_ID,
          });
          if (tokenData?.data) {
            await api("/users/push-token", {
              method: "POST",
              body: JSON.stringify({ push_token: tokenData.data }),
            });
          }
        }
      } catch (err) {
        // Log push error silently if device lacks Play Services
      }
    }

    registerForPushNotifications();
  }, [user?.user_id]);
}
