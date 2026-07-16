import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/lib/api";

export function useNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    async function registerForPushNotifications() {
      if (!user) return;

      try {
        const perm: any = await Notifications.getPermissionsAsync();
        let finalStatus = perm?.status || (perm?.granted ? "granted" : "denied");

        if (finalStatus !== "granted") {
          const reqPerm: any = await Notifications.requestPermissionsAsync();
          finalStatus = reqPerm?.status || (reqPerm?.granted ? "granted" : "denied");
        }

        if (finalStatus !== "granted") return;

        const tokenData = await Notifications.getExpoPushTokenAsync();
        if (tokenData?.data) {
          await api("/users/push-token", {
            method: "POST",
            body: JSON.stringify({ push_token: tokenData.data }),
          });
        }

        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "default",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#F43F5E",
          });
        }
      } catch (err) {
        // Push permissions or environment error ignored gracefully
      }
    }

    registerForPushNotifications();
  }, [user?.user_id]);
}

