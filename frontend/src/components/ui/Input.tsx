import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, radius } from "@/src/lib/theme";

type Props = TextInputProps & {
  label?: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  error?: boolean;
};

/**
 * Shared text field: label on top, optional leading icon, rose focus ring and — for password
 * fields (secureTextEntry) — a show/hide eye button. All TextInput props (incl. testID) pass through.
 */
export function Input({ label, icon, error, secureTextEntry, style, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const isPassword = !!secureTextEntry;

  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.box,
          focused && styles.boxFocused,
          error && styles.boxError,
        ]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={focused ? theme.rose : theme.textMuted}
            style={{ marginRight: 10 }}
          />
        ) : null}
        <TextInput
          placeholderTextColor={theme.textMuted}
          selectionColor={theme.rose}
          {...rest}
          secureTextEntry={isPassword && hidden}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, style]}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Şifreyi göster" : "Şifreyi gizle"}
          >
            <Ionicons name={hidden ? "eye-off-outline" : "eye-outline"} size={20} color={theme.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 14 },
  label: {
    color: theme.textDim,
    fontSize: 12,
    marginBottom: 6,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  box: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.card,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: theme.border,
    paddingHorizontal: 16,
    minHeight: 54,
  },
  boxFocused: {
    borderColor: theme.rose,
    backgroundColor: theme.cardAlt,
    shadowColor: theme.rose,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  boxError: { borderColor: theme.danger },
  input: {
    flex: 1,
    color: theme.text,
    fontSize: 15,
    paddingVertical: 14,
    // Web only: the container already draws the focus ring, hide the browser's own outline.
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null),
  },
});
