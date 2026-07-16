import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "@/src/lib/theme";

type Props = {
  uri?: string | null;
  name?: string;
  size?: number;
  ring?: boolean;
};

export function Avatar({ uri, name = "?", size = 44, ring = false }: Props) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || "")
    .join("") || "V";
  const inner = size - (ring ? 4 : 0);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden" }}>
      {ring ? (
        <LinearGradient
          colors={[theme.rose, "#8B5CF6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: size, height: size, borderRadius: size / 2, padding: 2 }}
        >
          <View style={[styles.core, { width: inner, height: inner, borderRadius: inner / 2 }]}>
            {uri ? (
              <Image source={{ uri }} style={{ width: inner, height: inner, borderRadius: inner / 2 }} />
            ) : (
              <Text style={[styles.initials, { fontSize: inner * 0.4 }]}>{initials}</Text>
            )}
          </View>
        </LinearGradient>
      ) : (
        <View style={[styles.core, { width: size, height: size, borderRadius: size / 2 }]}>
          {uri ? (
            <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
          ) : (
            <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{initials}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  core: {
    backgroundColor: theme.cardAlt,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  initials: {
    color: theme.text,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
