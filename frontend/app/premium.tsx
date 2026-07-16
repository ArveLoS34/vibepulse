import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import { theme, radius, spacing } from "@/src/lib/theme";

export default function PremiumScreen() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [boostBusy, setBoostBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onSubscribe = async () => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await api<{ message?: string; url?: string; is_premium?: boolean }>(
        "/subscription/create-checkout-session",
        {
          method: "POST",
          body: JSON.stringify({ price_id: "price_premium_monthly" }),
        }
      );
      setMsg(res.message || "Premium başarıyla aktif edildi! ✨");
      await refresh();
    } catch (e: any) {
      setErr(e?.message || "Ödeme başlatılamadı");
    } finally {
      setBusy(false);
    }
  };

  const onActivateBoost = async () => {
    setBoostBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await api<{ message: string }>("/users/boost", { method: "POST" });
      setMsg(res.message);
      await refresh();
    } catch (e: any) {
      setErr(e?.message || "Boost aktifleştirilemedi");
    } finally {
      setBoostBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.back} testID="premium-back">
            <Ionicons name="close" size={24} color={theme.text} />
          </Pressable>
          <View style={styles.badgeWrap}>
            <LinearGradient
              colors={[theme.rose, "#8B5CF6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconCircle}
            >
              <Ionicons name="star" size={36} color="#fff" />
            </LinearGradient>
          </View>
          <Text style={styles.h1}>VibePulse Premium</Text>
          <Text style={styles.sub}>
            Aşk tesadüfleri sever ama öncelik ayrıcalık katar.
          </Text>
        </View>

        <View style={styles.features}>
          <View style={styles.featureRow}>
            <Ionicons name="heart" size={24} color={theme.rose} />
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>Beni Kim Beğendi?</Text>
              <Text style={styles.featureSub}>Seni beğenen tüm kullanıcıları sansürsüz gör.</Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <Ionicons name="flash" size={24} color="#F59E0B" />
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>Sınırsız Super Vibe</Text>
              <Text style={styles.featureSub}>Aşırı beğendiğin kişilerin ekranında ilk sırada çık.</Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <Ionicons name="rocket" size={24} color="#8B5CF6" />
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>Profil Öne Çıkarma (Boost)</Text>
              <Text style={styles.featureSub}>Profilini 30 dakika boyunca konumdaki herkese önce göster.</Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <Ionicons name="infinite" size={24} color={theme.cyan} />
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>Sınırsız Kaydırma</Text>
              <Text style={styles.featureSub}>Günlük eşleşme ve beğeni sınırına takılma.</Text>
            </View>
          </View>
        </View>

        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
        {err ? <Text style={styles.err}>{err}</Text> : null}

        <View style={styles.actions}>
          <TouchableOpacity onPress={onSubscribe} disabled={busy} testID="premium-subscribe">
            <LinearGradient
              colors={[theme.rose, "#8B5CF6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryBtn}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryText}>
                  {user?.is_premium ? "Premium Üyesiniz ✨" : "Premium'a Geç — ₺299/Ay"}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onActivateBoost}
            disabled={boostBusy}
            style={styles.boostBtn}
            testID="premium-boost"
          >
            {boostBusy ? (
              <ActivityIndicator color="#F59E0B" />
            ) : (
              <View style={styles.boostRow}>
                <Ionicons name="rocket" size={18} color="#F59E0B" />
                <Text style={styles.boostText}>Profilini 30 Dk Boost Et</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.xl, flexGrow: 1, justifyContent: "space-between" },
  header: { alignItems: "center" },
  back: { alignSelf: "flex-end", padding: 8 },
  badgeWrap: { marginVertical: spacing.md },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.rose,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  h1: { color: theme.text, fontSize: 28, fontWeight: "900", textAlign: "center" },
  sub: { color: theme.textDim, fontSize: 14, textAlign: "center", marginTop: 6, maxWidth: 280 },
  features: { gap: spacing.lg, marginVertical: spacing.xl },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: theme.card,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.border,
  },
  featureTitle: { color: theme.text, fontSize: 16, fontWeight: "700" },
  featureSub: { color: theme.textDim, fontSize: 13, marginTop: 2 },
  msg: { color: "#10B981", textAlign: "center", fontSize: 14, fontWeight: "600" },
  err: { color: theme.danger, textAlign: "center", fontSize: 14 },
  actions: { gap: spacing.md, marginTop: spacing.lg },
  primaryBtn: { paddingVertical: 16, alignItems: "center", borderRadius: radius.pill },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  boostBtn: {
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: radius.pill,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
  },
  boostRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  boostText: { color: "#F59E0B", fontSize: 15, fontWeight: "700" },
});
