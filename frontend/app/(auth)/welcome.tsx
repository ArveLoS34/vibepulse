import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme, radius, spacing } from "@/src/lib/theme";

export default function Welcome() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top", "bottom"]}>
      <View style={styles.wrap}>
        <View style={styles.orb} />
        <View style={styles.orb2} />
        <View style={styles.header}>
          <LinearGradient colors={[theme.rose, "#8B5CF6"]} style={styles.logo} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Ionicons name="flash" size={32} color="#fff" />
          </LinearGradient>
          <Text style={styles.brand}>VibePulse</Text>
          <Text style={styles.tagline}>Sadece görünüş değil. Zeka. Mizah. Vibe.</Text>
        </View>

        <View style={styles.copy}>
          <Text style={styles.h1}>Düşünceleriyle{"\n"}Aşık Ol.</Text>
          <Text style={styles.p}>
            Klasik flört uygulamalarını unut. Burada insanların düşüncelerine, esprilerine ve müziklerine göre eşleşirsin.
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={() => router.push("/(auth)/register")}
            testID="cta-signup"
            style={{ borderRadius: radius.pill, overflow: "hidden" }}
          >
            <LinearGradient
              colors={[theme.rose, "#8B5CF6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryText}>Hemen Katıl</Text>
            </LinearGradient>
          </Pressable>
          <Pressable onPress={() => router.push("/(auth)/login")} testID="cta-login" style={styles.secondaryBtn}>
            <Text style={styles.secondaryText}>Giriş Yap</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: spacing.xl, justifyContent: "space-between", overflow: "hidden" },
  orb: {
    position: "absolute",
    top: -80,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: theme.rose,
    opacity: 0.16,
  },
  orb2: {
    position: "absolute",
    bottom: 80,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#8B5CF6",
    opacity: 0.18,
  },
  header: { alignItems: "flex-start", marginTop: spacing.xl },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  brand: { color: theme.text, fontSize: 30, fontWeight: "800", letterSpacing: -0.5 },
  tagline: { color: theme.textDim, marginTop: 4, fontSize: 14 },
  copy: { marginVertical: spacing.xxl },
  h1: { color: theme.text, fontSize: 44, fontWeight: "900", letterSpacing: -1, lineHeight: 48 },
  p: { color: theme.textDim, fontSize: 16, marginTop: spacing.md, lineHeight: 24 },
  actions: { gap: spacing.md, marginBottom: spacing.xl },
  primaryBtn: { paddingVertical: 16, alignItems: "center", borderRadius: radius.pill },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  secondaryBtn: {
    paddingVertical: 16,
    alignItems: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: theme.borderStrong,
  },
  secondaryText: { color: theme.text, fontSize: 16, fontWeight: "700" },
});
