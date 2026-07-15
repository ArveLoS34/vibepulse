import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/lib/api";
import { Avatar } from "@/src/components/Avatar";
import { theme, radius, spacing } from "@/src/lib/theme";
import type { VibeUser } from "@/src/context/AuthContext";

type MatchRow = {
  match_id: string;
  created_at: string;
  other_user: VibeUser;
  last_message?: { text: string; created_at: string; from_user_id: string } | null;
};

export default function MatchesScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api<{ matches: MatchRow[] }>("/matches");
      setRows(res.matches);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => { load(); }, [load]);

  const newMatches = rows.filter((r) => !r.last_message);
  const conversations = rows.filter((r) => !!r.last_message);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Mesajlar</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.rose} />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.empty} testID="matches-empty">
          <Ionicons name="chatbubbles-outline" size={48} color={theme.textMuted} />
          <Text style={styles.emptyTitle}>Henüz eşleşme yok</Text>
          <Text style={styles.emptyText}>Keşfet sekmesinde vibe'ları oku ve kaydır.</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(m) => m.match_id}
          ListHeaderComponent={
            newMatches.length > 0 ? (
              <View style={styles.newSection}>
                <Text style={styles.sectionTitle}>Yeni Eşleşmeler</Text>
                <FlatList
                  horizontal
                  data={newMatches}
                  keyExtractor={(m) => m.match_id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 14 }}
                  renderItem={({ item }) => (
                    <Pressable
                      testID={`new-match-${item.match_id}`}
                      onPress={() =>
                        router.push({ pathname: "/chat/[matchId]", params: { matchId: item.match_id } })
                      }
                      style={{ alignItems: "center", width: 74 }}
                    >
                      <Avatar uri={item.other_user.photos?.[0]} name={item.other_user.name || ""} size={64} ring />
                      <Text style={styles.newName} numberOfLines={1}>{item.other_user.name}</Text>
                    </Pressable>
                  )}
                />
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              testID={`match-row-${item.match_id}`}
              onPress={() => router.push({ pathname: "/chat/[matchId]", params: { matchId: item.match_id } })}
              style={styles.row}
            >
              <Avatar uri={item.other_user.photos?.[0]} name={item.other_user.name || ""} size={54} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={styles.rowName}>{item.other_user.name}</Text>
                  <Text style={styles.rowTime}>{timeAgo(item.last_message?.created_at)}</Text>
                </View>
                <Text style={styles.rowPreview} numberOfLines={1}>
                  {item.last_message?.text || "Sohbete başla ✨"}
                </Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            conversations.length === 0 ? (
              <View style={{ padding: spacing.xxl, alignItems: "center" }}>
                <Text style={styles.emptyText}>İlk mesajı yollamak sende.</Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

function timeAgo(iso?: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso).getTime();
    const diff = Math.max(0, Date.now() - d) / 1000;
    if (diff < 60) return "şimdi";
    if (diff < 3600) return `${Math.floor(diff / 60)}dk`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}sa`;
    return `${Math.floor(diff / 86400)}g`;
  } catch { return ""; }
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { color: theme.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.5 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", padding: spacing.xxl, marginTop: 60 },
  emptyTitle: { color: theme.text, fontSize: 18, fontWeight: "700", marginTop: spacing.md },
  emptyText: { color: theme.textDim, fontSize: 14, textAlign: "center", marginTop: 6 },
  newSection: { paddingTop: spacing.sm, paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border, marginBottom: spacing.sm },
  sectionTitle: { color: theme.textDim, fontSize: 12, fontWeight: "700", paddingHorizontal: spacing.lg, marginBottom: spacing.sm, textTransform: "uppercase", letterSpacing: 1 },
  newName: { color: theme.text, fontSize: 12, marginTop: 6, textAlign: "center", maxWidth: 74 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
  rowName: { color: theme.text, fontWeight: "700", fontSize: 15 },
  rowTime: { color: theme.textMuted, fontSize: 12 },
  rowPreview: { color: theme.textDim, fontSize: 13, marginTop: 3 },
});
