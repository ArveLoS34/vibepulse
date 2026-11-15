import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme, spacing, gradients } from "@/src/lib/theme";
import { Button } from "@/src/components/ui/Button";
import { useTranslation } from "@/src/i18n/LanguageContext";
import { LanguageSelectorModal } from "@/src/components/LanguageSelectorModal";

export default function Welcome() {
  const router = useRouter();
  const { t } = useTranslation();
  const [langOpen, setLangOpen] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top", "bottom"]}>
      <View style={styles.wrap}>
        <View style={styles.orb} />
        <View style={styles.orb2} />
        <View style={styles.header}>
          <View style={styles.topRow}>
            <LinearGradient colors={gradients.brand} style={styles.logo} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={{ color: "#fff", fontSize: 36, fontWeight: "900", fontStyle: "italic", letterSpacing: -1 }}>V</Text>
            </LinearGradient>
            <TouchableOpacity onPress={() => setLangOpen(true)} style={styles.langBtn} testID="welcome-lang-btn">
              <Ionicons name="globe-outline" size={20} color={theme.text} />
            </TouchableOpacity>
          </View>
          <Text style={styles.brand}>VibePulse</Text>
          <Text style={styles.tagline}>{t("tagline")}</Text>
        </View>

        <View style={styles.copy}>
          <Text style={styles.h1}>{t("welcome_title")}</Text>
          <Text style={styles.p}>{t("welcome_sub")}</Text>
        </View>

        <View style={styles.actions}>
          <Button
            title={t("welcome_join")}
            onPress={() => router.push("/(auth)/register")}
            testID="cta-signup"
          />
          <Button
            title={t("welcome_google")}
            icon="logo-google"
            variant="secondary"
            onPress={() => router.push("/(auth)/login")}
            testID="cta-google-login"
          />
          <Button
            title={t("welcome_login")}
            variant="ghost"
            onPress={() => router.push("/(auth)/login")}
            testID="cta-login"
          />
        </View>
      </View>

      <LanguageSelectorModal visible={langOpen} onClose={() => setLangOpen(false)} />
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
  topRow: { width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  langBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: "center",
    justifyContent: "center",
  },
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
});
