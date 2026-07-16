import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View } from "react-native";
import { theme } from "@/src/lib/theme";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.rose,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: "rgba(10,10,11,0.95)",
          borderTopColor: theme.border,
          borderTopWidth: 1,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
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
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      {children}
      <View
        style={{
          width: 4,
          height: 4,
          borderRadius: 2,
          marginTop: 4,
          backgroundColor: focused ? theme.rose : "transparent",
        }}
      />
    </View>
  );
}
