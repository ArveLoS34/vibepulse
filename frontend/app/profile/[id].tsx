import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/src/lib/api";
import { PostCard, Post } from "@/src/components/PostCard";
import { Avatar } from "@/src/components/Avatar";
import { theme, radius, spacing } from "@/src/lib/theme";
import type { VibeUser } from "@/src/context/AuthContext";

export default function PublicProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<(VibeUser & { top_post?: any }) | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const u = await api<{ user: any }>(`/users/${id}`);
      setUser(u.user);
      const p = await api<{ posts: Post[] }>(`/posts/user/${id}`);
      setPosts(p.posts);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const sendVibe = async () => {
    if (!user) return;
    try {
      const res = await api<{ matched: boolean; match: any }>("/swipes", {
        method: "POST",
        body: JSON.stringify({ target_user_id: user.user_id, action: "like" }),
      });
      if (res.matched && res.match) {
        router.push({ pathname: "/chat/[matchId]", params: { matchId: res.match.match_id } });
      } else {
        router.back();
      }
    } catch {}
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="profile-back">
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{user?.name || "Profil"}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading || !user ? (
        <View style={styles.center}><ActivityIndicator color={theme.rose} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          <LinearGradient
            colors={["rgba(244,63,94,0.25)", "transparent"]}
            style={styles.banner}
          />
          <View style={styles.head}>
            <Avatar uri={user.photos?.[0]} name={user.name || ""} size={110} ring />
            <Text style={styles.name}>
              {user.name}{user.age ? <Text style={styles.age}>, {user.age}</Text> : null}
            </Text>
            <Text style={styles.handle}>@{user.handle}</Text>
            {user.vibe_status ? (
              <View style={styles.vibePill}>
                <Text style={styles.vibeText}>✨ {user.vibe_status}</Text>
              </View>
            ) : null}
            {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
            <View style={styles.metaRow}>
              {typeof user.distance_km === "number" ? (
                <Text style={styles.meta}>
                  <Ionicons name="location" size={12} color={theme.cyan} /> {user.distance_km} km
                </Text>
              ) : user.city ? (
                <Text style={styles.meta}>
                  <Ionicons name="location" size={12} color={theme.cyan} /> {user.city}
                </Text>
              ) : null}
            </View>
            {user.interests && user.interests.length > 0 ? (
              <View style={styles.interestsRow}>
                {user.interests.map((i: string) => (
                  <View key={i} style={styles.interestChip}>
                    <Text style={styles.interestText}>{i}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Pressable onPress={sendVibe} testID="send-vibe-btn" style={{ marginTop: spacing.lg }}>
              <LinearGradient
                colors={[theme.rose, "#8B5CF6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.vibeBtn}
              >
                <Ionicons name="flash" size={18} color="#fff" />
                <Text style={styles.vibeBtnText}>Vibe Gönder</Text>
              </LinearGradient>
            </Pressable>
          </View>

          {user.photos && user.photos.length > 1 ? (
            <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
              <Text style={styles.section}>Fotoğraflar</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {user.photos.map((p: string, i: number) => (
                  <Image key={i} source={{ uri: p }} style={styles.gridPhoto} />
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
            <Text style={styles.section}>Vibe'ları</Text>
          </View>
          {posts.map((p) => <PostCard key={p.post_id} post={p} />)}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, justifyContent: "space-between" },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: theme.text, fontSize: 17, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  banner: { position: "absolute", top: 0, left: 0, right: 0, height: 160 },
  head: { alignItems: "center", paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg },
  name: { color: theme.text, fontSize: 26, fontWeight: "900", marginTop: spacing.md, letterSpacing: -0.5 },
  age: { fontWeight: "400", color: theme.textDim },
  handle: { color: theme.textDim, marginTop: 2 },
  vibePill: {
    marginTop: 10, paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill,
    backgroundColor: "rgba(244,63,94,0.12)", borderWidth: 1, borderColor: "rgba(244,63,94,0.3)",
  },
  vibeText: { color: theme.rose, fontWeight: "700", fontSize: 13 },
  bio: { color: theme.text, textAlign: "center", marginTop: spacing.md, fontSize: 15, lineHeight: 22 },
  metaRow: { flexDirection: "row", gap: 12, marginTop: spacing.md },
  meta: { color: theme.textDim, fontSize: 13 },
  interestsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.md, justifyContent: "center" },
  interestChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
  interestText: { color: theme.text, fontSize: 12, fontWeight: "600" },
  vibeBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 22, paddingVertical: 12, borderRadius: radius.pill },
  vibeBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  section: { color: theme.textDim, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: spacing.sm },
  gridPhoto: { width: 130, height: 170, borderRadius: radius.md, backgroundColor: theme.card },
});
