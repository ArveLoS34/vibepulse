import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { theme, radius, spacing } from "@/src/lib/theme";
import { api } from "@/src/lib/api";

type Props = { visible: boolean; onClose: () => void; onPosted: () => void };

export function ComposeModal({ visible, onClose, onPosted }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setText("");
      setErr(null);
    }
  }, [visible]);

  const remaining = 280 - text.length;
  const canPost = useMemo(() => text.trim().length > 0 && remaining >= 0 && !busy, [text, remaining, busy]);

  const submit = async () => {
    if (!canPost) return;
    setBusy(true);
    setErr(null);
    try {
      await api("/posts", { method: "POST", body: JSON.stringify({ text: text.trim() }) });
      setText("");
      onPosted();
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Bir hata oluştu");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID="compose-modal">
          <View style={styles.header}>
            <Pressable onPress={onClose} testID="compose-close" style={styles.iconBtn}>
              <Ionicons name="close" size={22} color={theme.text} />
            </Pressable>
            <Text style={styles.title}>Vibe Paylaş</Text>
            <TouchableOpacity
              disabled={!canPost}
              onPress={submit}
              testID="compose-submit"
              style={{ opacity: canPost ? 1 : 0.4 }}
            >
              <LinearGradient
                colors={[theme.rose, "#8B5CF6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.postBtn}
              >
                <Text style={styles.postText}>{busy ? "..." : "Yayınla"}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
          <TextInput
            testID="compose-input"
            style={styles.input}
            multiline
            autoFocus
            maxLength={320}
            placeholder="Aklından ne geçiyor? Vibe'ını yaz..."
            placeholderTextColor={theme.textMuted}
            value={text}
            onChangeText={setText}
          />
          {err ? <Text style={styles.err}>{err}</Text> : null}
          <View style={styles.footer}>
            <Text style={[styles.counter, remaining < 0 ? { color: theme.danger } : remaining < 40 ? { color: theme.amber } : null]}>
              {remaining}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: theme.overlay, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderColor: theme.border,
    padding: spacing.lg,
    minHeight: 300,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  iconBtn: { padding: 6 },
  title: { color: theme.text, fontWeight: "700", fontSize: 16 },
  postBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: radius.pill },
  postText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  input: {
    color: theme.text,
    fontSize: 18,
    minHeight: 140,
    textAlignVertical: "top",
    paddingVertical: spacing.sm,
  },
  footer: { flexDirection: "row", justifyContent: "flex-end", marginTop: spacing.md },
  counter: { color: theme.textDim, fontWeight: "600" },
  err: { color: theme.danger, marginTop: spacing.sm },
});
