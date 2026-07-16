import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { PostCard, Post } from "@/src/components/PostCard";
import { ComposeModal } from "@/src/components/ComposeModal";
import { Avatar } from "@/src/components/Avatar";
import { api } from "@/src/lib/api";
import { theme, radius, spacing } from "@/src/lib/theme";

const HASHTAGS = ["Tüm", "Yazılım", "Urfa", "Müzik", "Kahve", "Gece", "Sanat", "Eğlence"];

export default function FeedScreen() {
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
});
