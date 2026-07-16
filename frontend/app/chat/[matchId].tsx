import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
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
import * as ImagePicker from "expo-image-picker";
import Constants from "expo-constants";
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
  image?: string;
  read: boolean;
  created_at: string;
};

type BlindDateInfo = {
  message_count: number;
  required_messages: number;
  is_unlocked: boolean;
  progress_pct: number;
};

export default function ChatScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [blindDate, setBlindDate] = useState<BlindDateInfo | null>(null);
  const [other, setOther] = useState<{ user_id: string; name: string; photo?: string } | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [wingmanOpen, setWingmanOpen] = useState(false);
  const [wingmanBusy, setWingmanBusy] = useState(false);
  const [wingmanSuggestions, setWingmanSuggestions] = useState<string[]>([]);
  const listRef = useRef<FlatList>(null);
  const pollRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ messages: Msg[]; blind_date?: BlindDateInfo }>(`/matches/${matchId}/messages`);
      setMessages(res.messages);
      if (res.blind_date) setBlindDate(res.blind_date);
    } catch (e: any) {
      setErr(e?.message || "Sohbet yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  const loadWingman = async () => {
    setWingmanOpen((o) => !o);
    if (wingmanSuggestions.length > 0) return;
    setWingmanBusy(true);
    try {
      const res = await api<{ suggestions: string[] }>(`/matches/${matchId}/wingman`, { method: "POST" });
      setWingmanSuggestions(res.suggestions || []);
    } catch (e: any) {
      setWingmanSuggestions(["Vibe'ındaki detay harika, hakkında ne düşünüyorsun? ✨"]);
    } finally {
      setWingmanBusy(false);
    }
  };

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

        const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest?.debuggerHost;
        let detectedIp = "";
        if (hostUri) {
          const ip = hostUri.split(":")[0];
          if (ip && ip !== "localhost" && ip !== "127.0.0.1") {
            detectedIp = `http://${ip}:8000`;
          }
        }

        const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || "https://vibepulse-tg92.onrender.com";
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

  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      const base64 = a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri;
      setSelectedImage(base64);
    }
  };

  const send = async () => {
    const body = text.trim();
    if ((!body && !selectedImage) || sending) return;
    setSending(true);
    setErr(null);
    try {
      const res = await api<{ message: Msg }>(`/matches/${matchId}/messages`, {
        method: "POST",
        body: JSON.stringify({ text: body, image: selectedImage || undefined }),
      });
      setMessages((prev) => [...prev, res.message]);
      setText("");
      setSelectedImage(null);
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
        <TouchableOpacity onPress={loadWingman} style={styles.wingmanBtn} testID="chat-ai-wingman">
          <Ionicons name="sparkles" size={16} color="#F59E0B" />
          <Text style={styles.wingmanText}>AI Wingman</Text>
        </TouchableOpacity>
      </View>

      {/* Feature 2: Blind Date Progress Banner */}
      {blindDate && (
        <View style={styles.blindDateBanner}>
          <Ionicons name={blindDate.is_unlocked ? "eye" : "eye-off"} size={16} color={theme.rose} />
          <Text style={styles.blindDateText}>
            {blindDate.is_unlocked
              ? "🙈 Kör Randevu Kilidi Açıldı! Fotoğraflar %100 net."
              : `🙈 Kör Randevu: 10 mesajda fotoğraflar açılır (${blindDate.message_count}/10 Mesaj)`}
          </Text>
        </View>
      )}

      {/* Feature 4: AI Wingman Suggestions Drawer */}
      {wingmanOpen && (
        <View style={styles.wingmanBox}>
          <Text style={styles.wingmanBoxTitle}>🤖 AI Wingman Mesaj Önerileri:</Text>
          {wingmanBusy ? (
            <ActivityIndicator color={theme.rose} style={{ marginVertical: 10 }} />
          ) : (
            wingmanSuggestions.map((s, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => {
                  setText(s);
                  setWingmanOpen(false);
                }}
                style={styles.wingmanChip}
              >
                <Text style={styles.wingmanChipText}>✨ {s}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

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
                      {item.image ? (
                        <Image source={{ uri: item.image }} style={styles.chatImage} />
                      ) : null}
                      {item.text ? <Text style={styles.textLight}>{item.text}</Text> : null}
                    </LinearGradient>
                  ) : (
                    <View style={[styles.bubble, styles.theirs]}>
                      {item.image ? (
                        <Image source={{ uri: item.image }} style={styles.chatImage} />
                      ) : null}
                      {item.text ? <Text style={styles.textDark}>{item.text}</Text> : null}
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

        {selectedImage && (
          <View style={styles.imagePreviewWrap}>
            <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
            <TouchableOpacity onPress={() => setSelectedImage(null)} style={styles.removeImageBtn}>
              <Ionicons name="close" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputBar}>
          <TouchableOpacity onPress={pickImage} style={styles.mediaBtn} testID="chat-pick-image">
            <Ionicons name="image-outline" size={22} color={theme.rose} />
          </TouchableOpacity>
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
          <TouchableOpacity
            onPress={send}
            disabled={(!text.trim() && !selectedImage) || sending}
            testID="chat-send"
          >
            <LinearGradient
              colors={[theme.rose, "#8B5CF6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.sendBtn, ((!text.trim() && !selectedImage) || sending) ? { opacity: 0.4 } : null]}
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
  wingmanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
  },
  wingmanText: { color: "#F59E0B", fontSize: 11, fontWeight: "700" },
  blindDateBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
    backgroundColor: "rgba(244,63,94,0.12)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(244,63,94,0.25)",
  },
  blindDateText: { color: theme.rose, fontSize: 12, fontWeight: "700" },
  wingmanBox: {
    backgroundColor: theme.card,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    gap: 8,
  },
  wingmanBoxTitle: { color: theme.text, fontSize: 13, fontWeight: "700" },
  wingmanChip: {
    backgroundColor: "rgba(139,92,246,0.15)",
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.3)",
  },
  wingmanChipText: { color: theme.text, fontSize: 13, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  bubbleWrap: { width: "100%" },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, maxWidth: "80%" },
  mine: { borderRadius: 18, borderBottomRightRadius: 4 },
  theirs: { backgroundColor: theme.card, borderRadius: 18, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: theme.border },
  textLight: { color: "#fff", fontSize: 15, lineHeight: 21 },
  textDark: { color: theme.text, fontSize: 15, lineHeight: 21 },
  chatImage: { width: 200, height: 200, borderRadius: radius.md, marginBottom: 6 },
  imagePreviewWrap: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, position: "relative" },
  imagePreview: { width: 70, height: 70, borderRadius: radius.md },
  removeImageBtn: {
    position: "absolute",
    top: 4,
    left: 60,
    backgroundColor: "rgba(0,0,0,0.8)",
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  mediaBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: "center",
    justifyContent: "center",
  },
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
