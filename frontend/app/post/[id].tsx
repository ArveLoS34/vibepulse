import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { PostCard, Post } from "@/src/components/PostCard";
import { Avatar } from "@/src/components/Avatar";
import { api } from "@/src/lib/api";
import { theme, radius, spacing } from "@/src/lib/theme";

type Comment = { comment_id: string; text: string; created_at: string; author: any };

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const feed = await api<{ posts: Post[] }>("/posts/feed");
      const p = feed.posts.find((x) => x.post_id === id);
      if (p) setPost(p);
      const c = await api<{ comments: Comment[] }>(`/posts/${id}/comments`);
      setComments(c.comments);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    const body = text.trim();
    if (!body || !id || sending) return;
    setSending(true);
    try {
      const r = await api<{ comment: Comment }>(`/posts/${id}/comments`, {
        method: "POST",
        body: JSON.stringify({ text: body }),
      });
      setComments((prev) => [...prev, r.comment]);
      setText("");
    } catch {} finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="post-back">
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Vibe</Text>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={theme.rose} /></View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(c) => c.comment_id}
            ListHeaderComponent={
              post ? (
                <View>
                  <PostCard post={post} onChange={(p) => setPost(p)} />
                  <Text style={styles.section}>Yorumlar</Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <View style={styles.commentRow}>
                <TouchableOpacity
                  onPress={() =>
                    item.author?.user_id &&
                    router.push({ pathname: "/profile/[id]", params: { id: item.author.user_id } })
                  }
                >
                  <Avatar uri={item.author.avatar} name={item.author.name} size={36} />
                </TouchableOpacity>

                <View style={{ flex: 1 }}>
                  <TouchableOpacity
                    onPress={() =>
                      item.author?.user_id &&
                      router.push({ pathname: "/profile/[id]", params: { id: item.author.user_id } })
                    }
                  >
                    <Text style={styles.commentName}>
                      {item.author.name} <Text style={styles.commentHandle}>@{item.author.handle}</Text>
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.commentText}>{item.text}</Text>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={{ padding: spacing.xl, alignItems: "center" }}>
                <Text style={{ color: theme.textDim }}>İlk yorumu sen yaz.</Text>
              </View>
            }
          />
        )}

        <View style={styles.inputBar}>
          <TextInput
            testID="comment-input"
            value={text}
            onChangeText={setText}
            placeholder="Yorumla..."
            placeholderTextColor={theme.textMuted}
            style={styles.input}
            multiline
            maxLength={280}
          />
          <TouchableOpacity onPress={submit} disabled={!text.trim() || sending} testID="comment-send">
            <Ionicons name="send" size={22} color={text.trim() ? theme.rose : theme.textMuted} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: theme.text, fontSize: 17, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  section: { color: theme.textDim, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.2, padding: spacing.lg, paddingBottom: spacing.sm },
  commentRow: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  commentName: { color: theme.text, fontWeight: "700", fontSize: 14 },
  commentHandle: { color: theme.textMuted, fontWeight: "400", fontSize: 13 },
  commentText: { color: theme.text, fontSize: 14, marginTop: 2, lineHeight: 20 },
  inputBar: { flexDirection: "row", alignItems: "center", gap: 10, padding: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
  input: { flex: 1, backgroundColor: theme.card, color: theme.text, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: Platform.OS === "ios" ? 10 : 8, maxHeight: 100, fontSize: 14, borderWidth: 1, borderColor: theme.border },
});
