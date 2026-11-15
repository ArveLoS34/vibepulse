import React, { useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { theme, radius, gradients, shadows } from "@/src/lib/theme";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  testID?: string;
  style?: StyleProp<ViewStyle>;
  /** Slightly smaller button for dense layouts. */
  compact?: boolean;
};

/**
 * Shared button. Gives every screen the same look: gradient + glow for the main action,
 * outlined for secondary, plain text for ghost. Shrinks slightly on press and gives a light
 * haptic tick (silently ignored where haptics aren't supported, e.g. web).
 */
export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  icon,
  testID,
  style,
  compact = false,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const inactive = disabled || loading;

  const animate = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  const handlePress = () => {
    if (inactive) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress?.();
  };

  const height = compact ? 46 : 56;
  const textColor = variant === "ghost" ? theme.textDim : "#fff";
  const content = loading ? (
    <ActivityIndicator color="#fff" />
  ) : (
    <View style={styles.row}>
      {icon ? <Ionicons name={icon} size={20} color={textColor} style={{ marginRight: 8 }} /> : null}
      <Text style={[styles.text, { color: textColor, fontSize: compact ? 14 : 16 }]}>{title}</Text>
    </View>
  );

  let body: React.ReactNode;
  if (variant === "primary") {
    body = (
      <LinearGradient
        colors={gradients.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.base, { height }, shadows.glow]}
      >
        {content}
      </LinearGradient>
    );
  } else {
    const variantStyle =
      variant === "secondary"
        ? styles.secondary
        : variant === "danger"
          ? styles.danger
          : styles.ghost;
    body = <View style={[styles.base, { height }, variantStyle]}>{content}</View>;
  }

  return (
    <Animated.View style={[{ transform: [{ scale }], opacity: inactive && !loading ? 0.5 : 1 }, style]}>
      <Pressable
        onPress={handlePress}
        onPressIn={() => !inactive && animate(0.97)}
        onPressOut={() => animate(1)}
        disabled={inactive}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled: inactive, busy: loading }}
        style={{ borderRadius: radius.pill }}
      >
        {body}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  text: { fontWeight: "800", letterSpacing: 0.2 },
  secondary: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: theme.borderStrong,
  },
  danger: {
    backgroundColor: "rgba(239,68,68,0.14)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.45)",
  },
  ghost: { backgroundColor: "transparent" },
});
