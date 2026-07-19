import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

  // IBAN modal state
  const [ibanModal, setIbanModal] = useState(false);
  const [ibanInfo, setIbanInfo] = useState<any>(null);
  const [senderName, setSenderName] = useState("");
  const [referenceNote, setReferenceNote] = useState("");
  const [receiptBusy, setReceiptBusy] = useState(false);

  const loadIbanInfo = async () => {
    try {
      const res = await api<any>("/subscription/iban-info");
      setIbanInfo(res);
    } catch {}
  };

  useEffect(() => {
    loadIbanInfo();
  }, []);

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
      if (res.url && res.url.startsWith("http")) {
        setMsg("Stripe Ödeme Sayfasına Yönlendiriliyorsunuz...");
      } else {
        setMsg(res.message || "Ödeme isteğiniz alındı.");
      }
      await refresh();
    } catch (e: any) {
      // If card payment is not configured, automatically show IBAN option
      setIbanModal(true);
    } finally {
      setBusy(false);
    }
  };

  const onSubmitReceipt = async () => {
    if (!senderName.trim()) return alert("Lütfen ödemeyi yapan hesap sahibinin adını soyadını girin.");
    setReceiptBusy(true);
    try {
      const res = await api<{ message: string }>("/subscription/submit-bank-receipt", {
        method: "POST",
        body: JSON.stringify({ sender_name: senderName.trim(), reference_note: referenceNote.trim() }),
      });
      alert(res.message);
      setIbanModal(false);
      setSenderName("");
      setReferenceNote("");
    } catch (e: any) {
      alert(e?.message || "Makbuz bildirimi iletilemedi.");
    } finally {
      setReceiptBusy(false);
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
              <Text style={styles.featureTitle}>Sınırsız Beğeni & Kaydırma</Text>
              <Text style={styles.featureSub}>Günlük eşleşme ve beğeni sınırına takılmadan sınırsız profili sağa kaydırın.</Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <Ionicons name="refresh" size={24} color="#10B981" />
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>Geri Alma (Rewind ↺)</Text>
              <Text style={styles.featureSub}>Yanlışlıkla sola kaydırdığınız (pas geçtiğiniz) profilleri tek tıkla geri getirin.</Text>
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
                  {user?.is_premium ? "Premium Üyesiniz ✨" : "Kredi Kartı / Google Pay (₺299/Ay)"}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {!user?.is_premium && (
            <TouchableOpacity onPress={() => setIbanModal(true)} style={styles.ibanOptBtn}>
              <Ionicons name="card-outline" size={18} color="#fff" />
              <Text style={styles.ibanOptText}>Havale / EFT ile Öde (Resmi IBAN)</Text>
            </TouchableOpacity>
          )}

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

      {/* IBAN Payment Modal */}
      <Modal visible={ibanModal} animationType="slide" onRequestClose={() => setIbanModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>🏦 Resmi Havale / EFT Bilgileri</Text>
            <TouchableOpacity onPress={() => setIbanModal(false)} style={{ padding: 6 }}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
            {ibanInfo ? (
              <View style={styles.ibanCard}>
                <Text style={styles.ibanBank}>{ibanInfo.bank}</Text>
                <Text style={styles.ibanHolder}>Alıcı: {ibanInfo.holder}</Text>
                <View style={styles.ibanBox}>
                  <Text style={styles.ibanCode}>{ibanInfo.iban}</Text>
                </View>
                <Text style={styles.ibanPrice}>Aylık Abonelik Ücreti: {ibanInfo.price_try}</Text>
                <Text style={styles.ibanNotice}>⚠️ {ibanInfo.instructions}</Text>
              </View>
            ) : (
              <ActivityIndicator color={theme.rose} />
            )}

            <View style={styles.formBox}>
              <Text style={styles.formTitle}>📝 Ödeme Bildirimi Gönder</Text>
              <Text style={styles.formSub}>Ödemeyi yaptıktan sonra adınızı ve dekont notunuzu girin:</Text>

              <TextInput
                value={senderName}
                onChangeText={setSenderName}
                placeholder="Gönderen Adı Soyadı"
                placeholderTextColor={theme.textMuted}
                style={styles.input}
              />

              <TextInput
                value={referenceNote}
                onChangeText={setReferenceNote}
                placeholder="Açıklama / Dekont No (İsteğe bağlı)"
                placeholderTextColor={theme.textMuted}
                style={styles.input}
              />

              <TouchableOpacity
                onPress={onSubmitReceipt}
                disabled={receiptBusy || !senderName.trim()}
                style={[styles.submitBtn, (receiptBusy || !senderName.trim()) ? { opacity: 0.5 } : null]}
              >
                <LinearGradient
                  colors={[theme.rose, "#8B5CF6"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ paddingVertical: 14, alignItems: "center", borderRadius: radius.pill }}
                >
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>
                    {receiptBusy ? "Gönderiliyor..." : "Ödeme Bildirimini Onaya Gönder 🚀"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  ibanOptBtn: {
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radius.pill,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  ibanOptText: { color: "#fff", fontWeight: "700", fontSize: 14 },
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
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalTitle: { color: theme.text, fontSize: 18, fontWeight: "800" },
  ibanCard: {
    backgroundColor: theme.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(244,63,94,0.4)",
    gap: 8,
  },
  ibanBank: { color: theme.text, fontSize: 18, fontWeight: "800" },
  ibanHolder: { color: theme.textDim, fontSize: 14, fontWeight: "600" },
  ibanBox: {
    backgroundColor: "#000",
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    marginVertical: 4,
  },
  ibanCode: { color: theme.rose, fontSize: 16, fontWeight: "900", textAlign: "center", letterSpacing: 1 },
  ibanPrice: { color: "#10B981", fontWeight: "800", fontSize: 15 },
  ibanNotice: { color: "#F59E0B", fontSize: 12, lineHeight: 18, marginTop: 4 },
  formBox: { gap: 12, marginTop: spacing.md },
  formTitle: { color: theme.text, fontSize: 16, fontWeight: "800" },
  formSub: { color: theme.textDim, fontSize: 13 },
  input: {
    backgroundColor: theme.card,
    color: theme.text,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    fontSize: 15,
  },
  submitBtn: { marginTop: 6 },
});
