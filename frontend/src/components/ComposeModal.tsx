import React, { useEffect, useMemo, useState, useRef } from "react";
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
  const [recording, setRecording] = useState(false);
  const [voiceUri, setVoiceUri] = useState<string | null>(null);
  const [recordingSec, setRecordingSec] = useState(0);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (visible) {
      setText("");
      setVoiceUri(null);
      setErr(null);
      setRecordingSec(0);
    }
  }, [visible]);

  const startRecording = async () => {
    setRecording(true);
    setRecordingSec(0);
    setVoiceUri("data:audio/mp3;base64,mock_voice_note");

    timerRef.current = setInterval(() => {
      setRecordingSec((s) => {
        if (s >= 14) {
          stopRecording();
          return 15;
        }
        return s + 1;
      });
    }, 1000);
  };

  const stopRecording = async () => {
    clearInterval(timerRef.current);
    setRecording(false);
  };

  const remaining = 280 - text.length;
  const canPost = useMemo(
    () => (text.trim().length > 0 || voiceUri !== null) && remaining >= 0 && !busy,
    [text, voiceUri, remaining, busy]
  );

  const submit = async () => {
    if (!canPost) return;
    setBusy(true);
    setErr(null);
    try {
      await api("/posts", {
        method: "POST",
        body: JSON.stringify({
          text: text.trim() || "🎙️ Voice Vibe paylaştı.",
          voice_note: voiceUri || undefined,
        }),
      });
      setText("");
      setVoiceUri(null);
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

          {/* Voice Vibe Recording UI */}
          {voiceUri ? (
            <View style={styles.voicePreview}>
              <Ionicons name="mic" size={18} color={theme.rose} />
              <Text style={styles.voicePreviewText}>Voice Vibe hazır (15 Saniye)</Text>
              <TouchableOpacity onPress={() => setVoiceUri(null)} style={styles.removeVoiceBtn}>
                <Ionicons name="close" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.footer}>
            <TouchableOpacity
              onPress={recording ? () => stopRecording() : startRecording}
              style={[styles.micBtn, recording ? styles.micBtnActive : null]}
              testID="compose-mic"
            >
              <Ionicons name={recording ? "stop" : "mic-outline"} size={20} color={recording ? "#fff" : theme.rose} />
              {recording ? <Text style={styles.recText}>{recordingSec}s / 15s</Text> : null}
            </TouchableOpacity>

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
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md },
  counter: { color: theme.textDim, fontWeight: "600" },
  err: { color: theme.danger, marginTop: spacing.sm },
  voicePreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(244,63,94,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  voicePreviewText: { color: theme.rose, fontSize: 13, fontWeight: "600", flex: 1 },
  removeVoiceBtn: { padding: 4 },
  micBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  micBtnActive: { backgroundColor: theme.rose, borderColor: theme.rose },
  recText: { color: "#fff", fontWeight: "700", fontSize: 12 },
});
