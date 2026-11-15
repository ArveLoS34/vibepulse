import React, { useEffect, useState } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View } from "react-native";
import { theme, shadows } from "@/src/lib/theme";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userId = user?.user_id;
  const [unreadMsgCount, setUnreadMsgCount] = useState<number>(0);

  useEffect(() => {
    if (!userId) return;

    const fetchUnreadMsgCount = async () => {
      try {
        const res = await api<{ unread_count: number }>("/messages/unread-count");
        setUnreadMsgCount(res.unread_count || 0);
      } catch {}
    };

    fetchUnreadMsgCount();
    const interval = setInterval(fetchUnreadMsgCount, 4000);
    return () => clearInterval(interval);
  }, [userId]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.rose,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarShowLabel: false,
        tabBarItemStyle: { paddingVertical: 6 },
        // Same layout footprint as before (content is never covered), with rounded top corners.
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopWidth: 1,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor: theme.borderStrong,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
          ...shadows.card,
        },
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused}>
              <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused}>
              <Ionicons name={focused ? "flash" : "flash-outline"} size={24} color={color} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          tabBarBadge: unreadMsgCount > 0 ? unreadMsgCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: theme.rose,
            color: "#fff",
            fontSize: 10,
            fontWeight: "900",
            minWidth: 18,
            height: 18,
            borderRadius: 9,
          },
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused}>
              <Ionicons name={focused ? "chatbubbles" : "chatbubbles-outline"} size={24} color={color} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused}>
              <Ionicons name={focused ? "person" : "person-outline"} size={24} color={color} />
            </TabIcon>
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({ children, focused }: { children: React.ReactNode; focused: boolean }) {
  return (
    <View
      style={{
        width: 52,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: focused ? "rgba(244,63,94,0.16)" : "transparent",
      }}
    >
      {children}
    </View>
  );
}
