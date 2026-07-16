import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, TOKEN_KEY } from "@/src/lib/api";
import { storage } from "@/src/utils/storage";
import { useAuth } from "@/src/context/AuthContext";
import { Avatar } from "@/src/components/Avatar";
import { theme, radius, spacing } from "@/src/lib/theme";

type Msg = {
  message_id: string;
  match_id: string;
  from_user_id: string;
  to_user_id: string;
  text: string;
  read: boolean;
  created_at: string;
};

export default function ChatScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [other, setOther] = useState<{ user_id: string; name: string; photo?: string } | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const pollRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ messages: Msg[] }>(`/matches/${matchId}/messages`);
      setMessages(res.messages);
    } catch (e: any) {
      setErr(e?.message || "Sohbet yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  const loadOther = useCallback(async () => {
    try {
      const list = await api<{ matches: any[] }>("/matches");
      const m = list.matches.find((x: any) => x.match_id === matchId);
      if (m) setOther({ user_id: m.other_user.user_id, name: m.other_user.name, photo: m.other_user.photos?.[0] });
    } catch {}
  }, [matchId]);

  useEffect(() => {
    load();
    loadOther();
  }, [load, loadOther]);

  // B3: WebSocket Realtime Connection + Polling Fallback
  useEffect(() => {
    async function initWs() {
      try {
        const token = await storage.secureGet<string>(TOKEN_KEY, "");
        if (!token) return;
        const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || "";
        const wsUrl = backendUrl.replace(/^http/, "ws") + `/api/ws/chat/${matchId}?token=${encodeURIComponent(token)}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === "new_message" && data.message) {
              setMessages((prev) => {
                if (prev.some((m) => m.message_id === data.message.message_id)) return prev;
                return [...prev, data.message];
              });
              setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
            }
          } catch {}
        };
      } catch {}
    }

    initWs();

    pollRef.current = setInterval(load, 5000);
    return () => {
      clearInterval(pollRef.current);
      wsRef.current?.close();
    };
  }, [matchId, load]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setErr(null);
    try {
      const res = await api<{ message: Msg }>(`/matches/${matchId}/messages`, {
        method: "POST",
        body: JSON.stringify({ text: body }),
      });
      setMessages((prev) => [...prev, res.message]);
      setText("");
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (e: any) {
      setErr(e?.message || "Mesaj gönderilemedi");
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="chat-back">
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </Pressable>
        <Avatar uri={other?.photo} name={other?.name || "?"} size={38} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{other?.name || "Sohbet"}</Text>
          <Text style={styles.status}>çevrimiçi ~ vibe modu ✨</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={theme.rose} /></View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.message_id}
            contentContainerStyle={{ padding: spacing.lg, gap: 8 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              const mine = item.from_user_id === user?.user_id;
              return (
                <View style={[styles.bubbleWrap, { alignItems: mine ? "flex-end" : "flex-start" }]}>
                  {mine ? (
                    <LinearGradient
                      colors={[theme.rose, "#8B5CF6"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[styles.bubble, styles.mine]}
                    >
                      <Text style={styles.textLight}>{item.text}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[styles.bubble, styles.theirs]}>
                      <Text style={styles.textDark}>{item.text}</Text>
                    </View>
                  )}
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={{ padding: spacing.xxl, alignItems: "center" }}>
                <Ionicons name="sparkles" size={32} color={theme.rose} />
                <Text style={styles.emptyTitle}>İlk mesaj sende</Text>
                <Text style={styles.emptyText}>
                  Vibe'ında olan bir konu ile başla, klasik "selam"a hayır.
                </Text>
              </View>
            }
          />
        )}

        {err ? <Text style={styles.err}>{err}</Text> : null}

        <View style={styles.inputBar}>
          <TextInput
            testID="chat-input"
            value={text}
            onChangeText={setText}
            placeholder="Mesajını yaz..."
            placeholderTextColor={theme.textMuted}
            style={styles.input}
            multiline
            maxLength={500}
          />
          <TouchableOpacity onPress={send} disabled={!text.trim() || sending} testID="chat-send">
            <LinearGradient
              colors={[theme.rose, "#8B5CF6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.sendBtn, (!text.trim() || sending) ? { opacity: 0.4 } : null]}
            >
              <Ionicons name="send" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  name: { color: theme.text, fontWeight: "700", fontSize: 16 },
  status: { color: theme.cyan, fontSize: 11, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  bubbleWrap: { width: "100%" },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, maxWidth: "80%" },
  mine: { borderRadius: 18, borderBottomRightRadius: 4 },
  theirs: { backgroundColor: theme.card, borderRadius: 18, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: theme.border },
  textLight: { color: "#fff", fontSize: 15, lineHeight: 21 },
  textDark: { color: theme.text, fontSize: 15, lineHeight: 21 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
  },
  input: {
    flex: 1,
    backgroundColor: theme.card,
    color: theme.text,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    maxHeight: 120,
    fontSize: 15,
    borderWidth: 1,
    borderColor: theme.border,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: theme.text, fontSize: 18, fontWeight: "700", marginTop: spacing.md },
  emptyText: { color: theme.textDim, fontSize: 14, textAlign: "center", marginTop: 6, maxWidth: 260 },
  err: { color: theme.danger, textAlign: "center", padding: spacing.sm },
});
