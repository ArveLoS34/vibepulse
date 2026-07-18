import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
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
  const { user, updateProfile, verifySelfie } = useAuth();
  const { t } = useTranslation();
  const [name, setName] = useState(user?.name || "");
  const [handle, setHandle] = useState(user?.handle || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [vibeStatus, setVibeStatus] = useState(user?.vibe_status || "");
  const [city, setCity] = useState(user?.city || "");
  const [relationshipGoal, setRelationshipGoal] = useState<string>(user?.relationship_goal || "Arkadaşlık & Vibe ☕");
  const [instagramHandle, setInstagramHandle] = useState(user?.instagram_handle || "");
  const [spotifyArtist, setSpotifyArtist] = useState(user?.spotify_favorite_artist || "");
  const [spotifySong, setSpotifySong] = useState(user?.spotify_favorite_song || "");
  const [selectedTheme, setSelectedTheme] = useState<string>(user?.theme_id || "rose_purple");
  const [photos, setPhotos] = useState<string[]>(user?.photos || []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Selfie modal state
  const [selfieModalOpen, setSelfieModalOpen] = useState(false);
  const [selfieMedia, setSelfieMedia] = useState<string | null>(null);
  const [selfieBusy, setSelfieBusy] = useState(false);

  const THEMES = [
    { id: "rose_purple", key: "theme_rose_purple" as const, colors: ["#F43F5E", "#8B5CF6"] },
    { id: "cyberpunk_gold", key: "theme_cyber_gold" as const, colors: ["#F59E0B", "#EF4444"] },
    { id: "sakura_blossom", key: "theme_sakura" as const, colors: ["#EC4899", "#F43F5E"] },
    { id: "midnight_emerald", key: "theme_emerald" as const, colors: ["#10B981", "#06B6D4"] },
  ];

  const INTENTS = [
    "Ciddi İlişki 💍",
    "Arkadaşlık & Vibe ☕",
    "Sadece Sohbet 💬",
    "Eğlence & Etkinlik 🎉",
  ];

  const pickSelfie = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!libPerm.granted) return alert("Kamera izni gerekli");
    }

    const res = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!res.canceled && res.assets[0]?.base64) {
      setSelfieMedia(`data:image/jpeg;base64,${res.assets[0].base64}`);
    }
  };

  const handleVerifySelfieSubmit = async () => {
    if (!selfieMedia) return alert("Lütfen selfie çekin.");
    setSelfieBusy(true);
    try {
      await verifySelfie(selfieMedia);
      alert("Tebrikler! Biyometrik selfie doğrulamanız onaylandı. Mavi Tik (🔵 Onaylı Hesap) rozeti tanımlandı! ✨");
      setSelfieModalOpen(false);
      setSelfieMedia(null);
    } catch (e: any) {
      alert(e?.message || "Doğrulama başarısız. Yüzünüzün net göründüğü bir selfie yükleyin.");
    } finally {
      setSelfieBusy(false);
    }
  };

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
      await updateProfile({
        name,
        handle,
        bio,
        vibe_status: vibeStatus,
        relationship_goal: relationshipGoal,
        instagram_handle: instagramHandle.replace(/^@+/, "").trim(),
        spotify_favorite_artist: spotifyArtist.trim(),
        spotify_favorite_song: spotifySong.trim(),
        city,
        photos,
        theme_id: selectedTheme,
      });
      router.back();
    } catch (e: any) {
      setErr(e?.message || "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  const changesLeft = user?.handle_changes_left ?? 2;

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
          {/* Blue Badge Verification Button */}
          <TouchableOpacity
            onPress={user?.is_verified ? undefined : () => setSelfieModalOpen(true)}
            style={[styles.verifyBanner, user?.is_verified && styles.verifiedBanner]}
          >
            <Ionicons
              name={user?.is_verified ? "checkmark-circle" : "shield-checkmark"}
              size={20}
              color={user?.is_verified ? "#10B981" : "#06B6D4"}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.verifyTitle}>
                {user?.is_verified ? "🔵 Mavi Tik Doğrulandı" : "🔵 Mavi Tik Al (Canlı Selfie Doğrulama)"}
              </Text>
              <Text style={styles.verifySub}>
                {user?.is_verified ? "Profiliniz kimlik doğrulamalı güvenli hesaptır." : "Kamera ile selfie çek ve güvenilir profil rozeti kazan."}
              </Text>
            </View>
            {!user?.is_verified ? <Ionicons name="chevron-forward" size={18} color="#06B6D4" /> : null}
          </TouchableOpacity>

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

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.lg }}>
            <Text style={[styles.label, { marginTop: 0 }]}>Kullanıcı Adı (@kullanici_adi)</Text>
            <Text style={{ color: theme.rose, fontSize: 11, fontWeight: "700" }}>
              Günde 2 kez hakkınız var (Kalan: {changesLeft})
            </Text>
          </View>
          <TextInput
            testID="edit-handle"
            value={handle}
            onChangeText={setHandle}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            placeholder="kullanici_adi"
            placeholderTextColor={theme.textMuted}
          />

          <Text style={styles.label}>🎯 Niyet & Beklenti (Relationship Goal)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 4 }}>
            {INTENTS.map((intent) => {
              const active = relationshipGoal === intent;
              return (
                <TouchableOpacity
                  key={intent}
                  onPress={() => setRelationshipGoal(intent)}
                  style={[styles.intentChip, active && styles.intentChipActive]}
                >
                  <Text style={[styles.intentText, active && styles.intentTextActive]}>{intent}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Social & Music Integration Inputs */}
          <Text style={styles.label}>📸 Instagram Kullanıcı Adı</Text>
          <TextInput
            value={instagramHandle}
            onChangeText={setInstagramHandle}
            autoCapitalize="none"
            placeholder="instagram_kullaniciniz"
            placeholderTextColor={theme.textMuted}
            style={styles.input}
          />

          <Text style={styles.label}>🎵 Spotify En Sevdiğin Şarkı / Sanatçı</Text>
          <View style={{ gap: 8 }}>
            <TextInput
              value={spotifyArtist}
              onChangeText={setSpotifyArtist}
              placeholder="En sevdiğin sanatçı (Örn: The Weeknd)"
              placeholderTextColor={theme.textMuted}
              style={styles.input}
            />
            <TextInput
              value={spotifySong}
              onChangeText={setSpotifySong}
              placeholder="Favori parçan (Örn: Starboy)"
              placeholderTextColor={theme.textMuted}
              style={styles.input}
            />
          </View>

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

      {/* Biometric Selfie Verification Modal */}
      <Modal visible={selfieModalOpen} animationType="slide" onRequestClose={() => setSelfieModalOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>🔵 Mavi Tik - Selfie Doğrulama</Text>
            <TouchableOpacity onPress={() => setSelfieModalOpen(false)} style={{ padding: 6 }}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <View style={{ padding: spacing.xl, gap: spacing.lg, alignItems: "center" }}>
            <Text style={{ color: theme.textDim, fontSize: 14, textAlign: "center", lineHeight: 20 }}>
              Yapay Zeka ve Biyometrik yüz doğrulaması için kameranıza bakarak canlı bir selfie çekin. Profilinize Mavi Tik (🔵 Onaylı Hesap) rozeti tanımlansın!
            </Text>

            {selfieMedia ? (
              <View style={styles.selfieBox}>
                <Image source={{ uri: selfieMedia }} style={styles.selfieImg} />
                <TouchableOpacity onPress={() => setSelfieMedia(null)} style={styles.retakeSelfieBtn}>
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>Tekrar Çek 📷</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={pickSelfie} style={styles.cameraTriggerBtn}>
                <Ionicons name="camera" size={48} color={theme.cyan} />
                <Text style={{ color: theme.cyan, fontWeight: "800", marginTop: 8 }}>Canlı Selfie Çek 📷</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handleVerifySelfieSubmit}
              disabled={selfieBusy || !selfieMedia}
              style={[styles.selfieSubmitBtn, (selfieBusy || !selfieMedia) ? { opacity: 0.5 } : null]}
            >
              <LinearGradient
                colors={["#06B6D4", "#3B82F6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ paddingVertical: 14, paddingHorizontal: 32, borderRadius: radius.pill, width: "100%", alignItems: "center" }}
              >
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15 }}>
                  {selfieBusy ? "Biyometrik Yüz Analizi Yapılıyor..." : "Selfie'yi Onaya Gönder & Mavi Tik Al ✨"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
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
  verifyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: "rgba(6, 182, 212, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(6, 182, 212, 0.4)",
    marginBottom: spacing.md,
  },
  verifiedBanner: { backgroundColor: "rgba(16, 185, 129, 0.12)", borderColor: "rgba(16, 185, 129, 0.4)" },
  verifyTitle: { color: "#06B6D4", fontWeight: "800", fontSize: 14 },
  verifySub: { color: theme.textDim, fontSize: 11, marginTop: 2 },
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
  intentChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  intentChipActive: { borderColor: theme.rose, backgroundColor: "rgba(244,63,94,0.15)" },
  intentText: { color: theme.textDim, fontSize: 13, fontWeight: "600" },
  intentTextActive: { color: theme.rose, fontWeight: "800" },
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
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalTitle: { color: theme.text, fontSize: 18, fontWeight: "800" },
  cameraTriggerBtn: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: theme.cyan,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(6,182,212,0.1)",
    marginVertical: spacing.lg,
  },
  selfieBox: { position: "relative", width: 220, height: 220, borderRadius: 110, overflow: "hidden", marginVertical: spacing.lg, borderWidth: 3, borderColor: theme.cyan },
  selfieImg: { width: "100%", height: "100%", resizeMode: "cover" },
  retakeSelfieBtn: { position: "absolute", bottom: 10, alignSelf: "center", backgroundColor: "rgba(0,0,0,0.8)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  selfieSubmitBtn: { width: "100%", marginTop: spacing.md },
});
