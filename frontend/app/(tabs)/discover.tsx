import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import { theme, radius, spacing } from "@/src/lib/theme";
import { Avatar } from "@/src/components/Avatar";
import type { VibeUser } from "@/src/context/AuthContext";

type Card = VibeUser & { top_post?: { post_id: string; text: string; image?: string } | null };

const { width: W } = Dimensions.get("window");
const SWIPE_THRESHOLD = W * 0.28;

const DISTANCES = [
  { label: "Tüm Mesafeler", value: null },
  { label: "10 km", value: 10 },
  { label: "25 km", value: 25 },
  { label: "50 km", value: 50 },
  { label: "100 km", value: 100 },
];

export default function DiscoverScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDistance, setSelectedDistance] = useState<number | null>(null);
  const [squadsActive, setSquadsActive] = useState(false);
  const [matchInfo, setMatchInfo] = useState<{ matchId: string; user: Card } | null>(null);
  const [lastSwipedCard, setLastSwipedCard] = useState<Card | null>(null);
  const pan = useRef(new Animated.ValueXY()).current;
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = selectedDistance !== null
        ? `/discover?max_distance_km=${selectedDistance}`
        : "/discover";
      const res = await api<{ cards: Card[] }>(url);
      setCards(res.cards);
    } finally {
      setLoading(false);
    }
  }, [selectedDistance]);

  useEffect(() => {
    load();
  }, [load]);

  const top = cards[0];

  const swipe = useCallback(
    async (action: "like" | "pass" | "super", targetX: number) => {
      if (!top || busy) return;
      setBusy(true);
      try {
        Haptics.selectionAsync();
      } catch {}

      const isWeb = Platform.OS === "web";

      Animated.timing(pan, {
        toValue: { x: targetX, y: 0 },
        duration: 220,
        useNativeDriver: !isWeb,
      }).start(async () => {
        const targetId = top.user_id;
        setLastSwipedCard(top);
        setCards((c) => c.slice(1));
        pan.setValue({ x: 0, y: 0 });
        try {
          const res = await api<{ matched: boolean; match: any; other_user: Card | null }>("/swipes", {
            method: "POST",
            body: JSON.stringify({ target_user_id: targetId, action }),
          });
          if (res.matched && res.other_user && res.match) {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {}
            setMatchInfo({ matchId: res.match.match_id, user: res.other_user });
          }
        } catch {} finally {
          setBusy(false);
        }
      });
    },
    [top, busy, pan]
  );

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 5,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, g) => {
        if (g.dx > SWIPE_THRESHOLD) swipe("like", W * 1.2);
        else if (g.dx < -SWIPE_THRESHOLD) swipe("pass", -W * 1.2);
        else Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: Platform.OS !== "web", friction: 6 }).start();
      },
    })
  ).current;

  const rewind = () => {
    if (!user?.is_premium && !user?.is_admin) {
      alert("↺ Geri Alma (Rewind) Özelliği\n\nPas geçtiğin son profili geri getirmek için VibePulse Premium üyesi olmalısın!");
      router.push("/premium");
      return;
    }
    if (lastSwipedCard) {
      setCards((c) => [lastSwipedCard, ...c]);
      setLastSwipedCard(null);
      alert("Pas geçilen son profil geri getirildi! ↺");
    } else {
      alert("Geri alınacak son profil bulunamadı.");
    }
  };
  const rotate = pan.x.interpolate({ inputRange: [-W, 0, W], outputRange: ["-15deg", "0deg", "15deg"] });
  const likeOpacity = pan.x.interpolate({ inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 1], extrapolate: "clamp" });
  const nopeOpacity = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={styles.title}>Keşfet</Text>
            <Text style={styles.subtitle}>Vibe'ları oku · Ruh eşini seç</Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              const next = !squadsActive;
              setSquadsActive(next);
              alert(next ? "Squads Modu Aktif Edildi! Çiftli eşleşme ve arkadaş grupları açıldı 👯" : "Squads Modu İptal Edildi. Standart eşleşme moduna dönüldü. 👯");
            }}
            style={[styles.squadBtn, squadsActive && styles.squadBtnActive]}
            testID="squads-btn"
          >
            <Text style={[styles.squadText, squadsActive && { color: "#fff" }]}>
              {squadsActive ? "👯 Squads (Aktif)" : "👯 Squads"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.stage}>
        {loading ? (
          <ActivityIndicator color={theme.rose} />
        ) : cards.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="sparkles-outline" size={48} color={theme.textMuted} />
            <Text style={styles.emptyTitle}>Şu an kimse yok</Text>
            <Text style={styles.emptyText}>Yakında yeni vibe'lar geliyor. Sonra tekrar dene.</Text>
            <TouchableOpacity style={styles.reloadBtn} onPress={load} testID="discover-reload">
              <Text style={styles.reloadText}>Yenile</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {cards[1] && <SwipeCard card={cards[1]} back />}
            {top && (
              <Animated.View
                {...responder.panHandlers}
                style={[
                  styles.cardAbs,
                  { transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }] },
                ]}
              >
                <SwipeCard card={top} />
                <Animated.View style={[styles.badge, styles.likeBadge, { opacity: likeOpacity }]}>
                  <Text style={styles.badgeText}>LIKE</Text>
                </Animated.View>
                <Animated.View style={[styles.badge, styles.nopeBadge, { opacity: nopeOpacity }]}>
                  <Text style={styles.badgeText}>NOPE</Text>
                </Animated.View>
              </Animated.View>
            )}
          </>
        )}
      </View>

      {top && !loading && (
        <View style={styles.controls}>
          <TouchableOpacity
            testID="swipe-rewind"
            style={[styles.ctrl, styles.ctrlRewind]}
            onPress={rewind}
          >
            <Ionicons name="refresh" size={24} color="#F59E0B" />
          </TouchableOpacity>
          <TouchableOpacity
            testID="swipe-pass"
            style={[styles.ctrl, styles.ctrlPass]}
            onPress={() => swipe("pass", -W * 1.2)}
          >
            <Ionicons name="close" size={30} color={theme.danger} />
          </TouchableOpacity>
          <TouchableOpacity
            testID="swipe-super"
            style={[styles.ctrl, styles.ctrlSuper]}
            onPress={() => swipe("super", W * 1.2)}
          >
            <Ionicons name="flash" size={26} color={theme.cyan} />
          </TouchableOpacity>
          <TouchableOpacity
            testID="swipe-like"
            style={[styles.ctrl, styles.ctrlLike]}
            onPress={() => swipe("like", W * 1.2)}
          >
            <Ionicons name="heart" size={30} color={theme.rose} />
          </TouchableOpacity>
        </View>
      )}

      {matchInfo && (
        <View style={styles.matchOverlay} testID="match-modal">
          <LinearGradient
            colors={["rgba(244,63,94,0.4)", "rgba(139,92,246,0.4)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.matchInner}>
            <Text style={styles.matchTitle}>VIBE MATCH ✨</Text>
            <View style={{ flexDirection: "row", gap: -16, marginVertical: spacing.xl }}>
              <Avatar uri={matchInfo.user.photos?.[0]} name={matchInfo.user.name || ""} size={110} ring />
            </View>
            <Text style={styles.matchName}>{matchInfo.user.name} ile vibe tuttunuz</Text>
            <View style={{ flexDirection: "row", gap: 12, marginTop: spacing.xl }}>
              <TouchableOpacity
                testID="match-continue"
                style={styles.matchGhostBtn}
                onPress={() => setMatchInfo(null)}
              >
                <Text style={styles.matchGhostText}>Kaydırmaya devam</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="match-chat"
                onPress={() => {
                  const id = matchInfo.matchId;
                  setMatchInfo(null);
                  router.push({ pathname: "/chat/[matchId]", params: { matchId: id } });
                }}
              >
                <LinearGradient
                  colors={[theme.rose, "#8B5CF6"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.matchBtn}
                >
                  <Text style={styles.matchBtnText}>Sohbete Başla</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function SwipeCard({ card, back }: { card: Card; back?: boolean }) {
  const uri = card.photos?.[0];
  return (
    <View style={[styles.card, back ? styles.cardBack : null]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill as any} />
      ) : (
        <LinearGradient
          colors={["#4C1D95", theme.rose, "#8B5CF6"]}
          style={StyleSheet.absoluteFill as any}
        />
      )}
      <LinearGradient
        colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.7)", "rgba(0,0,0,0.95)"]}
        style={StyleSheet.absoluteFill as any}
      />
      {card.top_post ? (
        <View style={styles.topPostBox}>
          <Text style={styles.topPostLabel}>SON VIBE</Text>
          <Text style={styles.topPostText} numberOfLines={4}>"{card.top_post.text}"</Text>
        </View>
      ) : null}
      <View style={styles.cardBottom}>
        {card.music_compatibility_pct ? (
          <View style={styles.musicMatchBadge}>
            <Ionicons name="musical-notes" size={14} color="#fff" />
            <Text style={styles.musicMatchText}>
              Müzik Uyumu: %{card.music_compatibility_pct} ✨
            </Text>
          </View>
        ) : null}
        <Text style={styles.cardName}>
          {card.name}{card.age ? <Text style={styles.cardAge}>, {card.age}</Text> : null}
        </Text>
        {card.vibe_status ? (
          <View style={styles.vibePill}>
            <Text style={styles.vibeText}>✨ {card.vibe_status}</Text>
          </View>
        ) : null}
        <View style={styles.metaRow}>
          {typeof card.distance_km === "number" ? (
            <Text style={styles.meta}>
              <Ionicons name="location" size={12} color={theme.cyan} /> {card.distance_km} km
            </Text>
          ) : card.city ? (
            <Text style={styles.meta}>
              <Ionicons name="location" size={12} color={theme.cyan} /> {card.city}
            </Text>
          ) : null}
        </View>
        {card.interests && card.interests.length > 0 ? (
          <View style={styles.interestsRow}>
            {card.interests.slice(0, 4).map((i) => (
              <View key={i} style={styles.interestChip}>
                <Text style={styles.interestText}>{i}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  squadBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: "rgba(139,92,246,0.15)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.4)",
  },
  squadBtnActive: {
    backgroundColor: "#8B5CF6",
    borderColor: theme.rose,
  },
  squadText: { color: "#8B5CF6", fontWeight: "700", fontSize: 12 },
  title: { color: theme.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.5 },
  subtitle: { color: theme.textDim, marginTop: 4, fontSize: 13 },
  stage: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  cardAbs: { position: "absolute", width: "100%", height: "95%", alignItems: "center", justifyContent: "center" },
  card: {
    width: "100%",
    height: "100%",
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardBack: { transform: [{ scale: 0.94 }], opacity: 0.6, position: "absolute" },
  topPostBox: {
    position: "absolute",
    top: spacing.xl,
    left: spacing.lg,
    right: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  topPostLabel: { color: theme.cyan, fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
  topPostText: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 6, lineHeight: 24 },
  cardBottom: { position: "absolute", bottom: 0, left: 0, right: 0, padding: spacing.xl },
  musicMatchBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(139, 92, 246, 0.4)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.6)",
  },
  musicMatchText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  cardName: { color: "#fff", fontSize: 30, fontWeight: "900", letterSpacing: -0.5 },
  cardAge: { fontWeight: "400", fontSize: 26, color: "#E4E4E7" },
  vibePill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(244,63,94,0.25)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginTop: 6,
    borderWidth: 1,
    borderColor: theme.rose,
  },
  vibeText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  metaRow: { flexDirection: "row", gap: 12, marginTop: 6 },
  meta: { color: "#E4E4E7", fontSize: 13, fontWeight: "600" },
  interestsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.md },
  interestChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  interestText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  badge: {
    position: "absolute",
    top: 40,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 3,
    transform: [{ rotate: "-15deg" }],
  },
  likeBadge: { right: 30, borderColor: theme.green },
  nopeBadge: { left: 30, borderColor: theme.danger, transform: [{ rotate: "15deg" }] },
  badgeText: { color: "#fff", fontWeight: "900", fontSize: 24 },
  controls: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    paddingVertical: spacing.md,
    paddingBottom: spacing.md,
  },
  ctrl: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  ctrlPass: { borderColor: theme.danger },
  ctrlRewind: { borderColor: "#F59E0B", width: 52, height: 52, borderRadius: 26 },
  ctrlSuper: { borderColor: theme.cyan, width: 52, height: 52, borderRadius: 26 },
  ctrlLike: { borderColor: theme.rose },
  empty: { alignItems: "center", gap: 10 },
  emptyTitle: { color: theme.text, fontSize: 18, fontWeight: "700", marginTop: spacing.md },
  emptyText: { color: theme.textDim, fontSize: 14, textAlign: "center" },
  reloadBtn: {
    marginTop: spacing.lg,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: theme.rose,
  },
  reloadText: { color: "#fff", fontWeight: "700" },
  matchOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(10,10,11,0.94)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  matchInner: { alignItems: "center" },
  matchTitle: {
    color: theme.rose,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  matchName: { color: theme.text, fontSize: 18, fontWeight: "700", marginTop: 4, textAlign: "center" },
  matchBtn: { paddingVertical: 14, paddingHorizontal: 22, borderRadius: radius.pill },
  matchBtnText: { color: "#fff", fontWeight: "800" },
  matchGhostBtn: {
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: theme.borderStrong,
  },
  matchGhostText: { color: theme.text, fontWeight: "700" },
});
