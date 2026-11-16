import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import { theme, radius, spacing, gradients, shadows } from "@/src/lib/theme";
import { Button } from "@/src/components/ui/Button";
import { Avatar } from "@/src/components/Avatar";
import type { VibeUser } from "@/src/context/AuthContext";

type Card = VibeUser & { top_post?: { post_id: string; text: string; image?: string } | null };

const { width: W } = Dimensions.get("window");
const SWIPE_THRESHOLD = W * 0.28;

export default function DiscoverScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDistance] = useState<number | null>(null);
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


      Animated.timing(pan, {
        toValue: { x: targetX, y: 0 },
        duration: 220,
        useNativeDriver: false,
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
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,
      onPanResponderMove: (_, g) => {
        pan.setValue({ x: g.dx, y: g.dy });
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > SWIPE_THRESHOLD) swipe("like", W * 1.2);
        else if (g.dx < -SWIPE_THRESHOLD) swipe("pass", -W * 1.2);
        else Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 6 }).start();
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
            <Text style={styles.subtitle}>Vibe&apos;ları oku · Ruh eşini seç</Text>
          </View>
          <Pressable
            onPress={() => {
              const next = !squadsActive;
              setSquadsActive(next);
              alert(next ? "Squads Modu Aktif Edildi! Çiftli eşleşme ve arkadaş grupları açıldı 👯" : "Squads Modu İptal Edildi. Standart eşleşme moduna dönüldü. 👯");
            }}
            style={[styles.squadBtn, squadsActive && styles.squadBtnActive]}
            testID="squads-btn"
          >
            <Ionicons name="people" size={15} color={squadsActive ? "#fff" : "#A78BFA"} />
            <Text style={[styles.squadText, squadsActive && { color: "#fff" }]}>
              {squadsActive ? "Squads · Aktif" : "Squads"}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.stage}>
        {loading ? (
          <ActivityIndicator color={theme.rose} />
        ) : cards.length === 0 ? (
          <View style={styles.empty}>
            <LinearGradient colors={gradients.brandSoft} style={styles.emptyIcon}>
              <Ionicons name="sparkles" size={38} color={theme.rose} />
            </LinearGradient>
            <Text style={styles.emptyTitle}>Şu an kimse yok</Text>
            <Text style={styles.emptyText}>Yakında yeni vibe&apos;lar geliyor. Sonra tekrar dene.</Text>
            <Button
              title="Yenile"
              icon="refresh"
              compact
              onPress={load}
              testID="discover-reload"
              style={{ marginTop: spacing.lg, minWidth: 160 }}
            />
          </View>
        ) : (
          <>
            {cards[1] && (
              <View style={styles.cardAbs} pointerEvents="none">
                <SwipeCard card={cards[1]} back />
              </View>
            )}
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
          <ControlButton
            testID="swipe-rewind"
            icon={(user?.is_premium || user?.is_admin) ? "refresh" : "lock-closed"}
            color={theme.amber}
            size={50}
            iconSize={21}
            dim={!user?.is_premium && !user?.is_admin}
            onPress={rewind}
          />
          <ControlButton
            testID="swipe-pass"
            icon="close"
            color={theme.danger}
            size={64}
            iconSize={32}
            onPress={() => swipe("pass", -W * 1.2)}
          />
          <ControlButton
            testID="swipe-super"
            icon="flash"
            color={theme.cyan}
            size={50}
            iconSize={24}
            onPress={() => swipe("super", W * 1.2)}
          />
          <ControlButton
            testID="swipe-like"
            icon="heart"
            color={theme.rose}
            size={64}
            iconSize={32}
            onPress={() => swipe("like", W * 1.2)}
          />
        </View>
      )}

      {matchInfo && (
        <View style={styles.matchOverlay} testID="match-modal">
          <LinearGradient
            colors={gradients.brandSoft}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.matchInner}>
            <Text style={styles.matchTitle}>VIBE MATCH ✨</Text>
            <View style={{ flexDirection: "row", gap: -16, marginVertical: spacing.xl }}>
              <Avatar uri={matchInfo.user.photos?.[0]} name={matchInfo.user.name || ""} size={110} ring />
            </View>
            <Text style={styles.matchName}>{matchInfo.user.name} ile vibe tuttunuz</Text>
            <View style={styles.matchActions}>
              <Button
                title="Kaydırmaya devam"
                variant="secondary"
                compact
                testID="match-continue"
                onPress={() => setMatchInfo(null)}
                style={{ flex: 1 }}
              />
              <Button
                title="Sohbete Başla"
                compact
                testID="match-chat"
                onPress={() => {
                  const id = matchInfo.matchId;
                  setMatchInfo(null);
                  router.push({ pathname: "/chat/[matchId]", params: { matchId: id } });
                }}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function ControlButton({
  icon,
  color,
  size,
  iconSize,
  testID,
  onPress,
  dim,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
  size: number;
  iconSize: number;
  testID: string;
  onPress: () => void;
  dim?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 8 }).start();
  return (
    <Animated.View style={{ transform: [{ scale }], opacity: dim ? 0.55 : 1 }}>
      <Pressable
        testID={testID}
        onPress={onPress}
        onPressIn={() => to(0.88)}
        onPressOut={() => to(1)}
        style={[
          styles.ctrl,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: color + "99",
            backgroundColor: color + "1F",
            shadowColor: color,
          },
        ]}
      >
        <Ionicons name={icon} size={iconSize} color={color} />
      </Pressable>
    </Animated.View>
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
          <Text style={styles.topPostText} numberOfLines={4}>&quot;{card.top_post.text}&quot;</Text>
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
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: "rgba(139,92,246,0.15)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.4)",
  },
  squadBtnActive: {
    backgroundColor: "#8B5CF6",
    borderColor: theme.rose,
  },
  squadText: { color: "#A78BFA", fontWeight: "700", fontSize: 12 },
  title: { color: theme.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.5 },
  subtitle: { color: theme.textDim, marginTop: 4, fontSize: 13 },
  stage: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  cardAbs: { position: "absolute", left: spacing.lg, right: spacing.lg, height: "95%", alignItems: "center", justifyContent: "center" },
  card: {
    width: "100%",
    height: "100%",
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.borderStrong,
    ...shadows.card,
  },
  cardBack: { transform: [{ scale: 0.94 }], opacity: 0.6 },
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
    top: 44,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 3,
    transform: [{ rotate: "-14deg" }],
  },
  likeBadge: { right: 28, borderColor: theme.green, backgroundColor: "rgba(34,197,94,0.22)" },
  nopeBadge: {
    left: 28,
    borderColor: theme.danger,
    backgroundColor: "rgba(239,68,68,0.22)",
    transform: [{ rotate: "14deg" }],
  },
  badgeText: { color: "#fff", fontWeight: "900", fontSize: 26, letterSpacing: 2 },
  controls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 18,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  ctrl: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  empty: { alignItems: "center", gap: 10 },
  emptyTitle: { color: theme.text, fontSize: 18, fontWeight: "700", marginTop: spacing.md },
  emptyText: { color: theme.textDim, fontSize: 14, textAlign: "center" },
  emptyIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(244,63,94,0.3)",
  },
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
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  matchName: { color: theme.text, fontSize: 18, fontWeight: "700", marginTop: 4, textAlign: "center" },
  matchActions: { flexDirection: "row", gap: 12, marginTop: spacing.xl, width: "100%" },
});
