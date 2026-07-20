import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "@/src/lib/api";
import { theme, radius, spacing } from "@/src/lib/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  onPostFortune?: () => void;
};

type WheelStatus = {
  today: string;
  is_premium: boolean;
  max_spins: number;
  used_spins: number;
  remaining_spins: number;
  seconds_until_reset: number;
  last_outcome?: string | null;
};

function formatCountdown(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function DailyWheelModal({ visible, onClose, onPostFortune }: Props) {
  const [status, setStatus] = useState<WheelStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [currentOutcome, setCurrentOutcome] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [shareBusy, setShareBusy] = useState(false);

  const rotateAnim = useRef(new Animated.Value(0)).current;
  const countdownTimerRef = useRef<any>(null);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const res = await api<WheelStatus>("/vibe-wheel/status");
      setStatus(res);
      setSecondsLeft(res.seconds_until_reset || 0);
      if (res.last_outcome && res.remaining_spins === 0) {
        setCurrentOutcome(res.last_outcome);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      setCurrentOutcome(null);
      loadStatus();
    }
  }, [visible]);

  useEffect(() => {
    if (secondsLeft > 0) {
      countdownTimerRef.current = setInterval(() => {
        setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else {
      clearInterval(countdownTimerRef.current);
    }
    return () => clearInterval(countdownTimerRef.current);
  }, [secondsLeft]);

  const spinWheel = async () => {
    if (spinning || !status || status.remaining_spins <= 0) return;
    setSpinning(true);
    setCurrentOutcome(null);

    // Start 2.5 second spin animation
    rotateAnim.setValue(0);
    Animated.timing(rotateAnim, {
      toValue: 10, // 10 full turns
      duration: 2500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    try {
      const res = await api<{ outcome: string; remaining_spins: number; seconds_until_reset: number }>("/vibe-wheel/spin", {
        method: "POST",
      });

      setTimeout(() => {
        setCurrentOutcome(res.outcome);
        setSpinning(false);
        setSecondsLeft(res.seconds_until_reset);
        setStatus((prev: any) => (prev ? { ...prev, remaining_spins: res.remaining_spins, used_spins: prev.used_spins + 1 } : prev));
      }, 2500);

    } catch (e: any) {
      setSpinning(false);
      alert(e?.message || "Çark çevrilemedi.");
    }
  };

  const shareOutcomeToFeed = async () => {
    if (!currentOutcome) return;
    setShareBusy(true);
    try {
      await api("/posts", {
        method: "POST",
        body: JSON.stringify({
          text: `🎡 Günlük Vibe Kehanetim:\n\n"${currentOutcome}"`,
        }),
      });
      alert("Günün Kehaneti Vibe Akışında Paylaşıldı! 🌟");
      onPostFortune?.();
      onClose();
    } catch (e: any) {
      alert(e?.message || "Paylaşılamadı");
    } finally {
      setShareBusy(false);
    }
  };

  const spinInterpolate = rotateAnim.interpolate({
    inputRange: [0, 10],
    outputRange: ["0deg", "3600deg"],
  });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 24 }}>🎡</Text>
            <View>
              <Text style={styles.title}>Günlük Vibe Çarkı</Text>
              <Text style={styles.subTitle}>Günün Aşk & Vibe Kehanetini Keşfet</Text>
            </View>
          </View>

          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={theme.rose} size="large" /></View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, alignItems: "center" }}>
            {/* Spin Counter Badge */}
            <View style={styles.spinBadge}>
              <Ionicons name="sparkles" size={16} color="#F59E0B" />
              <Text style={styles.spinBadgeText}>
                Günün Çevirme Hakkı: <Text style={{ color: theme.rose, fontWeight: "900" }}>{status?.remaining_spins}/{status?.max_spins}</Text>
                {status?.is_premium ? " (⭐ VIP 2 Hak)" : " (1 Hak)"}
              </Text>
            </View>

            {/* Wheel Graphics */}
            <View style={styles.wheelWrapper}>
              <View style={styles.wheelPointer}>
                <Ionicons name="caret-down" size={32} color={theme.rose} />
              </View>

              <Animated.View style={[styles.wheelCircle, { transform: [{ rotate: spinInterpolate }] }]}>
                <LinearGradient
                  colors={[theme.rose, "#8B5CF6", "#06B6D4", "#10B981", "#F59E0B", "#EC4899"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.wheelInnerGradient}
                >
                  <Text style={styles.wheelCenterEmoji}>🔮</Text>
                </LinearGradient>
              </Animated.View>
            </View>

            {/* Outcome Card */}
            {currentOutcome ? (
              <View style={styles.outcomeCard}>
                <Text style={styles.outcomeTitle}>✨ Günün Kehaneti Belirdi:</Text>
                <Text style={styles.outcomeText}>"{currentOutcome}"</Text>

                <TouchableOpacity
                  onPress={shareOutcomeToFeed}
                  disabled={shareBusy}
                  style={styles.shareBtn}
                >
                  <LinearGradient
                    colors={[theme.rose, "#8B5CF6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ paddingVertical: 12, paddingHorizontal: 20, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", gap: 6 }}
                  >
                    <Ionicons name="paper-plane" size={16} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>
                      {shareBusy ? "Paylaşılıyor..." : "Kehaneti Vibe Akışımda Paylaş 🚀"}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Spin Trigger Button OR Exhausted Countdown Box */}
            {status && status.remaining_spins > 0 ? (
              <TouchableOpacity
                onPress={spinWheel}
                disabled={spinning}
                style={styles.spinActionBtn}
              >
                <LinearGradient
                  colors={["#F59E0B", theme.rose]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.spinActionInner}
                >
                  <Text style={styles.spinActionText}>
                    {spinning ? "Çark Dönüyor... 🎡" : "🎡 Çarkı Çevir & Kehaneti Gör!"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <View style={styles.exhaustedBox}>
                <Ionicons name="timer-outline" size={26} color="#F59E0B" />
                <Text style={styles.exhaustedTitle}>Bugünkü Çevirme Hakkınız Doldu!</Text>
                <Text style={styles.exhaustedSub}>Haklarınızın yenilenmesine kalan süre:</Text>
                <Text style={styles.timerText}>⏳ {formatCountdown(secondsLeft)}</Text>

                {!status?.is_premium ? (
                  <View style={styles.vipPromoBox}>
                    <Text style={styles.vipPromoText}>
                      ⭐ <Text style={{ fontWeight: "900", color: "#F59E0B" }}>VibePulse Premium</Text> ile günde 2 kere çark çevirme hakkı elde edebilirsiniz!
                    </Text>
                  </View>
                ) : null}
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  title: { color: theme.text, fontSize: 18, fontWeight: "900" },
  subTitle: { color: theme.textDim, fontSize: 12, marginTop: 1 },
  closeBtn: { padding: 6 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  spinBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(245,158,11,0.15)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.4)",
  },
  spinBadgeText: { color: theme.text, fontSize: 13, fontWeight: "700" },
  wheelWrapper: {
    position: "relative",
    width: 220,
    height: 220,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: spacing.md,
  },
  wheelPointer: {
    position: "absolute",
    top: -15,
    zIndex: 20,
  },
  wheelCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: "hidden",
    borderWidth: 4,
    borderColor: theme.rose,
  },
  wheelInnerGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  wheelCenterEmoji: { fontSize: 44 },
  outcomeCard: {
    width: "100%",
    backgroundColor: theme.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.4)",
    alignItems: "center",
    gap: 10,
  },
  outcomeTitle: { color: theme.cyan, fontWeight: "800", fontSize: 13 },
  outcomeText: { color: "#fff", fontSize: 16, fontWeight: "800", textAlign: "center", lineHeight: 22 },
  shareBtn: { marginTop: 4 },
  spinActionBtn: { width: "100%", marginTop: spacing.md, borderRadius: radius.pill, overflow: "hidden" },
  spinActionInner: { paddingVertical: 16, alignItems: "center" },
  spinActionText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  exhaustedBox: {
    width: "100%",
    backgroundColor: theme.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: "center",
    gap: 6,
  },
  exhaustedTitle: { color: theme.text, fontWeight: "800", fontSize: 15 },
  exhaustedSub: { color: theme.textDim, fontSize: 12 },
  timerText: { color: "#F59E0B", fontSize: 24, fontWeight: "900", letterSpacing: 2, marginTop: 4 },
  vipPromoBox: {
    marginTop: 10,
    backgroundColor: "rgba(245,158,11,0.12)",
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.3)",
  },
  vipPromoText: { color: theme.text, fontSize: 12, textAlign: "center", lineHeight: 18 },
});
