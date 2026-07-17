import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { PostCard, Post } from "@/src/components/PostCard";
import { ComposeModal } from "@/src/components/ComposeModal";
import { Avatar } from "@/src/components/Avatar";
import { api } from "@/src/lib/api";
import { theme, radius, spacing } from "@/src/lib/theme";

const HASHTAGS = ["Tüm", "Yazılım", "Urfa", "Müzik", "Kahve", "Gece", "Sanat", "Eğlence"];

export default function FeedScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [signals, setSignals] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string>("Tüm");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const url = selectedTag && selectedTag !== "Tüm"
        ? `/posts/feed?tag=${encodeURIComponent(selectedTag)}`
        : "/posts/feed";
      const res = await api<{ posts: Post[] }>(url);
      setPosts(res.posts);

      const sigRes = await api<{ signals: any[] }>("/signals");
      setSignals(sigRes.signals || []);

      const storyRes = await api<{ stories_feed: any[] }>("/stories");
      setStories(storyRes.stories_feed || []);

      setErr(null);
    } catch (e: any) {
      setErr(e?.message || "Feed yüklenemedi");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedTag]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    load();
  }, [load]);

  const [speedModalOpen, setSpeedModalOpen] = useState(false);
  const [speedStatus, setSpeedStatus] = useState<"waiting" | "matched" | "idle">("idle");
  const [speedTimerSec, setSpeedTimerSec] = useState(0);
  const speedPollRef = useRef<any>(null);
  const speedTimerRef = useRef<any>(null);

  const joinSpeedDating = async () => {
    const now = new Date();
    const hour = now.getHours();

    if (hour !== 21) {
      alert("Etkinlik henüz başlamadı! ⌛\n\nSesli Hızlı Eşleşme Seansı her akşam sadece saat 21:00 - 22:00 arasında gerçekleşmektedir.");
      return;
    }

    try {
      setSpeedModalOpen(true);
      setSpeedStatus("waiting");
      setSpeedTimerSec(0);

      const res = await api<{ matched: boolean; session?: any; message?: string }>("/speed-dating/join", {
        method: "POST",
        body: JSON.stringify({ preferred_gender: "everyone" }),
      });

      if (res.matched && res.session) {
        setSpeedStatus("matched");
        setTimeout(() => {
          setSpeedModalOpen(false);
          router.push({ pathname: "/chat/[matchId]", params: { matchId: res.session.match_id } });
        }, 1200);
      }
    } catch (e: any) {
      setSpeedModalOpen(false);
      alert(e?.message || "Etkinlik henüz başlamadı! ⌛");
    }
  };

  const leaveSpeedDating = async () => {
    try {
      await api("/speed-dating/leave", { method: "POST" });
    } catch {}
    setSpeedModalOpen(false);
    setSpeedStatus("idle");
    clearInterval(speedPollRef.current);
    clearInterval(speedTimerRef.current);
  };

  useEffect(() => {
    if (!speedModalOpen || speedStatus === "matched") return;

    speedTimerRef.current = setInterval(() => {
      setSpeedTimerSec((s) => s + 1);
    }, 1000);

    speedPollRef.current = setInterval(async () => {
      try {
        const res = await api<{ status: string; session?: any }>("/speed-dating/status");
        if (res.status === "matched" && res.session) {
          setSpeedStatus("matched");
          clearInterval(speedPollRef.current);
          clearInterval(speedTimerRef.current);
          setTimeout(() => {
            setSpeedModalOpen(false);
            router.push({ pathname: "/chat/[matchId]", params: { matchId: res.session.match_id } });
          }, 1200);
        }
      } catch {}
    }, 2000);

    return () => {
      clearInterval(speedPollRef.current);
      clearInterval(speedTimerRef.current);
    };
  }, [speedModalOpen, speedStatus]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top"]}>
      <View style={styles.header} testID="feed-header">
        <View style={styles.brandRow}>
          <LinearGradient
            colors={[theme.rose, "#8B5CF6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logo}
          >
            <Ionicons name="flash" size={16} color="#fff" />
          </LinearGradient>
          <Text style={styles.brand}>VibePulse</Text>
        </View>

        {/* 24h Vibe Stories Circles Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: spacing.sm }}
          contentContainerStyle={{ gap: 14, paddingRight: spacing.md }}
        >
          {stories.map((st, i) => (
            <View key={i} style={styles.storyWrap}>
              <LinearGradient
                colors={[theme.rose, "#8B5CF6"]}
                style={styles.storyRing}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Avatar uri={st.user?.avatar} name={st.user?.name || "?"} size={48} />
              </LinearGradient>
              <Text style={styles.storyName} numberOfLines={1}>
                {st.user?.name?.split(" ")[0] || "Vibe"}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* B4: Hashtag Chip Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipBar}
          contentContainerStyle={{ gap: 8, paddingRight: spacing.md }}
        >
          {HASHTAGS.map((tag) => {
            const active = selectedTag === tag;
            return (
              <TouchableOpacity
                key={tag}
                onPress={() => setSelectedTag(tag)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {tag === "Tüm" ? "Tümü" : `#${tag}`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* v2 Feature 1: Blind Speed Dating Event Banner */}
        <TouchableOpacity
          onPress={joinSpeedDating}
          style={styles.speedDatingBanner}
          testID="speed-dating-btn"
        >
          <LinearGradient
            colors={["rgba(139,92,246,0.3)", "rgba(244,63,94,0.3)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.speedDatingInner}
          >
            <Ionicons name="mic-circle" size={22} color="#F59E0B" />
            <View style={{ flex: 1 }}>
              <Text style={styles.speedTitle}>🎙️ 21:00 Sesli Hızlı Eşleşme</Text>
              <Text style={styles.speedSub}>3 dakikalık anonim sesli aramaya katıl.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Feature 3: Hangout Signals */}
        {signals.length > 0 && (
          <View style={styles.signalsSection}>
            <Text style={styles.signalsTitle}>📍 Canlı Buluşma Sinyalleri (6 Sa)</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingTop: 6 }}
            >
              {signals.map((s) => (
                <View key={s.signal_id} style={styles.signalCard}>
                  <Text style={styles.signalLoc}>📍 {s.location_name || "Kadıköy"}</Text>
                  <Text style={styles.signalText} numberOfLines={2}>{s.title}</Text>
                  <Text style={styles.signalAuthor}>@{s.author?.handle || "kullanıcı"}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.rose} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.post_id}
          renderItem={({ item }) => <PostCard post={item} />}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.rose} />}
          ListEmptyComponent={
            <View style={styles.empty} testID="feed-empty">
              <Ionicons name="planet-outline" size={48} color={theme.textMuted} />
              <Text style={styles.emptyTitle}>Feed sessiz</Text>
              <Text style={styles.emptyText}>İlk vibe'ı sen paylaş.</Text>
              {err ? <Text style={styles.err}>{err}</Text> : null}
            </View>
          }
        />
      )}

      <TouchableOpacity
        onPress={() => setComposeOpen(true)}
        testID="feed-compose-fab"
        style={styles.fab}
      >
        <LinearGradient
          colors={[theme.rose, "#8B5CF6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabInner}
        >
          <Ionicons name="add" size={30} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      <ComposeModal visible={composeOpen} onClose={() => setComposeOpen(false)} onPosted={load} />

      {/* v2 Feature 1: Speed Dating Radar / Lobi Modal */}
      <Modal visible={speedModalOpen} animationType="fade" transparent onRequestClose={leaveSpeedDating}>
        <View style={styles.speedBackdrop}>
          <View style={styles.speedSheet}>
            <View style={styles.radarCircle}>
              <Ionicons name="radio" size={48} color={speedStatus === "matched" ? "#10B981" : "#F59E0B"} />
            </View>

            <Text style={styles.speedLobbyTitle}>
              {speedStatus === "matched" ? "✨ Eşleşme Bulundu!" : "🎙️ Sesli Hızlı Eşleşme Lobi"}
            </Text>

            <Text style={styles.speedLobbySub}>
              {speedStatus === "matched"
                ? "3 dakikalık sesli sohbet pencerene aktarılıyorsun..."
                : `Benzer müzik/vibe zevklerine sahip partner aranıyor (${Math.floor(speedTimerSec / 60)}:${String(speedTimerSec % 60).padStart(2, "0")})`}
            </Text>

            {speedStatus === "waiting" && (
              <ActivityIndicator color={theme.rose} style={{ marginVertical: 12 }} />
            )}

            <TouchableOpacity onPress={leaveSpeedDating} style={styles.leaveSpeedBtn} testID="leave-speed-btn">
              <Text style={{ color: theme.danger, fontWeight: "700" }}>Sıradan Çık</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
    backgroundColor: "rgba(10,10,11,0.9)",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  logo: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  brand: { color: theme.text, fontWeight: "800", fontSize: 18, letterSpacing: -0.3 },
  storyWrap: { alignItems: "center", width: 56 },
  storyRing: { padding: 2, borderRadius: 28 },
  storyName: { color: theme.textDim, fontSize: 11, fontWeight: "600", marginTop: 4 },
  chipBar: { marginTop: spacing.sm },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  chipActive: {
    backgroundColor: theme.rose,
    borderColor: theme.rose,
  },
  chipText: { color: theme.textDim, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  speedDatingBanner: { marginTop: spacing.sm, borderRadius: radius.md, overflow: "hidden" },
  speedDatingInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
    borderRadius: radius.md,
  },
  speedTitle: { color: "#F59E0B", fontSize: 13, fontWeight: "800" },
  speedSub: { color: theme.textDim, fontSize: 11, marginTop: 1 },
  signalsSection: { marginTop: spacing.md },
  signalsTitle: { color: theme.rose, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8 },
  signalCard: {
    backgroundColor: theme.card,
    borderRadius: radius.md,
    padding: 10,
    width: 150,
    borderWidth: 1,
    borderColor: "rgba(244,63,94,0.3)",
  },
  signalLoc: { color: theme.cyan, fontSize: 11, fontWeight: "700" },
  signalText: { color: theme.text, fontSize: 12, fontWeight: "600", marginTop: 4, lineHeight: 16 },
  signalAuthor: { color: theme.textMuted, fontSize: 11, marginTop: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", padding: spacing.xxl, marginTop: 60, gap: 8 },
  emptyTitle: { color: theme.text, fontSize: 18, fontWeight: "700", marginTop: spacing.md },
  emptyText: { color: theme.textDim, fontSize: 14, textAlign: "center" },
  err: { color: theme.danger, marginTop: spacing.md },
  fab: { position: "absolute", right: 20, bottom: 20 },
  fabInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.rose,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  speedBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10,10,11,0.9)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  speedSheet: {
    width: "100%",
    backgroundColor: theme.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.4)",
  },
  radarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(245,158,11,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: "rgba(245,158,11,0.5)",
  },
  speedLobbyTitle: { color: theme.text, fontSize: 20, fontWeight: "900", textAlign: "center" },
  speedLobbySub: { color: theme.textDim, fontSize: 13, textAlign: "center", marginTop: 6 },
  leaveSpeedBtn: {
    marginTop: spacing.md,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: "rgba(239,68,68,0.12)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
  },
});
