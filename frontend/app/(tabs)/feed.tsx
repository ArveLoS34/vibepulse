import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { PostCard, Post } from "@/src/components/PostCard";
import { ComposeModal } from "@/src/components/ComposeModal";
import { api } from "@/src/lib/api";
import { theme, radius, spacing } from "@/src/lib/theme";

export default function FeedScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ posts: Post[] }>("/posts/feed");
      setPosts(res.posts);
      setErr(null);
    } catch (e: any) {
      setErr(e?.message || "Feed yüklenemedi");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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
