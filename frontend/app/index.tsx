import React, { useEffect } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { theme } from "@/src/lib/theme";

export default function Index() {
  const { loading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => {
      if (!user) {
        router.replace("/(auth)/welcome");
      } else if (!user.onboarded) {
        router.replace("/(auth)/onboarding");
      } else {
        router.replace("/(tabs)/feed");
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [loading, user, router]);

  return (
    <View style={styles.container}>
      {/* Background Neon Orbs */}
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <View style={styles.logoBadge}>
        <LinearGradient
          colors={["#F43F5E", "#8B5CF6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.logoInner}
        >
          <Text style={styles.vText}>V</Text>
        </LinearGradient>
      </View>

      <Text style={styles.brandTitle}>VibePulse</Text>
      <Text style={styles.brandTagline}>Düşüncelerinle Aşık Ol ✨</Text>

      <ActivityIndicator color={theme.rose} size="large" style={{ marginTop: 32 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0C",
    alignItems: "center",
    justifyContent: "center",
  },
  orb1: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "#8B5CF6",
    opacity: 0.2,
    top: "20%",
  },
  orb2: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#F43F5E",
    opacity: 0.18,
    bottom: "25%",
  },
  logoBadge: {
    width: 100,
    height: 100,
    borderRadius: 32,
    padding: 3,
    backgroundColor: "rgba(244, 63, 94, 0.4)",
    shadowColor: "#F43F5E",
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 15,
  },
  logoInner: {
    flex: 1,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
  },
  vText: {
    color: "#ffffff",
    fontSize: 56,
    fontWeight: "900",
    fontStyle: "italic",
    letterSpacing: -2,
  },
  brandTitle: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "900",
    marginTop: 20,
    letterSpacing: -0.5,
  },
  brandTagline: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 6,
  },
});
