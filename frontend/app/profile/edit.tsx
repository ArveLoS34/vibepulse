import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/src/context/AuthContext";
import { useTranslation } from "@/src/i18n/LanguageContext";
import { theme, radius, spacing } from "@/src/lib/theme";

export default function EditProfile() {
  const router = useRouter();
  const { user, updateProfile } = useAuth();
  const { t } = useTranslation();
  const [name, setName] = useState(user?.name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [vibeStatus, setVibeStatus] = useState(user?.vibe_status || "");
  const [city, setCity] = useState(user?.city || "");
  const [selectedTheme, setSelectedTheme] = useState<string>(user?.theme_id || "rose_purple");
  const [photos, setPhotos] = useState<string[]>(user?.photos || []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const THEMES = [
    { id: "rose_purple", key: "theme_rose_purple" as const, colors: ["#F43F5E", "#8B5CF6"] },
    { id: "cyberpunk_gold", key: "theme_cyber_gold" as const, colors: ["#F59E0B", "#EF4444"] },
    { id: "sakura_blossom", key: "theme_sakura" as const, colors: ["#EC4899", "#F43F5E"] },
    { id: "midnight_emerald", key: "theme_emerald" as const, colors: ["#10B981", "#06B6D4"] },
  ];

  const pickImage = async () => {
    if (photos.length >= 6) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setErr("Galeri izni gerekli");
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.4,
      base64: true,
    });
    if (!res.canceled && res.assets[0]?.base64) {
      setPhotos([...photos, `data:image/jpeg;base64,${res.assets[0].base64}`]);
    }
  };

  const removePhoto = (i: number) => setPhotos(photos.filter((_, idx) => idx !== i));

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await updateProfile({ name, bio, vibe_status: vibeStatus, city, photos, theme_id: selectedTheme });
      router.back();
    } catch (e: any) {
      setErr(e?.message || "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="edit-back">
          <Ionicons name="close" size={22} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Profili Düzenle</Text>
        <TouchableOpacity disabled={busy} onPress={save} testID="edit-save">
          <LinearGradient colors={[theme.rose, "#8B5CF6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.saveBtn}>
            {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveText}>Kaydet</Text>}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
          <Text style={styles.label}>Fotoğraflar</Text>
          <View style={styles.photoGrid}>
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const uri = photos[i];
              return (
                <TouchableOpacity
                  key={i}
                  testID={`edit-photo-${i}`}
                  style={styles.photoSlot}
                  onPress={uri ? () => removePhoto(i) : pickImage}
                >
                  {uri ? (
                    <>
                      <Image source={{ uri }} style={StyleSheet.absoluteFill as any} />
                      <View style={styles.removeBadge}>
                        <Ionicons name="close" size={14} color="#fff" />
                      </View>
                    </>
                  ) : (
                    <Ionicons name="add" size={30} color={theme.textDim} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Ad</Text>
          <TextInput testID="edit-name" value={name} onChangeText={setName} style={styles.input} placeholderTextColor={theme.textMuted} />

          <Text style={styles.label}>Anlık Mood</Text>
          <TextInput
            testID="edit-vibe"
            value={vibeStatus}
            onChangeText={setVibeStatus}
            maxLength={40}
            style={styles.input}
            placeholder="✨ chaotic good"
            placeholderTextColor={theme.textMuted}
          />

          <Text style={styles.label}>Bio</Text>
          <TextInput
            testID="edit-bio"
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={280}
            style={[styles.input, { minHeight: 120, textAlignVertical: "top" }]}
            placeholder="Vibe'ını anlat..."
            placeholderTextColor={theme.textMuted}
          />

          <Text style={styles.label}>{t("profile_theme_title")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, marginTop: 4 }}>
            {THEMES.map((th) => {
              const active = selectedTheme === th.id;
              return (
                <TouchableOpacity
                  key={th.id}
                  onPress={() => setSelectedTheme(th.id)}
                  style={[styles.themeChip, active && styles.themeChipActive]}
                >
                  <LinearGradient
                    colors={th.colors as [string, string]}
                    style={{ width: 20, height: 20, borderRadius: 10 }}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                  <Text style={[styles.themeChipText, active && styles.themeChipTextActive]}>{t(th.key)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.label}>Şehir</Text>
          <TextInput testID="edit-city" value={city} onChangeText={setCity} style={styles.input} placeholderTextColor={theme.textMuted} />

          {err ? <Text style={styles.err}>{err}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: theme.text, fontSize: 16, fontWeight: "700" },
  saveBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: radius.pill },
  saveText: { color: "#fff", fontWeight: "800" },
  label: { color: theme.textDim, fontSize: 12, marginTop: spacing.lg, marginBottom: 6, letterSpacing: 0.5, textTransform: "uppercase", fontWeight: "700" },
  input: {
    backgroundColor: theme.card,
    color: theme.text,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    fontSize: 15,
  },
  themeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  themeChipActive: { borderColor: theme.rose, backgroundColor: "rgba(244,63,94,0.12)" },
  themeChipText: { color: theme.textDim, fontSize: 13, fontWeight: "600" },
  themeChipTextActive: { color: "#fff", fontWeight: "800" },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.sm },
  photoSlot: {
    width: "31%",
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.borderStrong,
    backgroundColor: theme.card,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  removeBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  err: { color: theme.danger, marginTop: spacing.md },
});
