import React, { useState } from "react";
import {
  ActivityIndicator,
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
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { theme, radius, spacing } from "@/src/lib/theme";

const GENDERS = [
  { key: "female", label: "Kadın" },
  { key: "male", label: "Erkek" },
  { key: "nonbinary", label: "Nonbinary" },
  { key: "other", label: "Diğer" },
];

const ORIENTATIONS = [
  { key: "female", label: "Kadınları" },
  { key: "male", label: "Erkekleri" },
  { key: "everyone", label: "Herkesi" },
];

const INTEREST_SUGGESTIONS = [
  "Müzik", "Sinema", "Kitap", "Konser", "Yoga", "Kahve", "Dans", "Fotoğraf",
  "Yürüyüş", "Bisiklet", "Vegan", "Seyahat", "Yemek", "Sanat", "Teknoloji", "Oyun",
];

export default function Onboarding() {
  const router = useRouter();
  const { user, updateProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [bio, setBio] = useState(user?.bio || "");
  const [age, setAge] = useState<string>(user?.age ? String(user.age) : "");
  const [gender, setGender] = useState<string>(user?.gender || "");
  const [orientation, setOrientation] = useState<string>(user?.orientation || "");
  const [vibeStatus, setVibeStatus] = useState<string>(user?.vibe_status || "");
  const [interests, setInterests] = useState<string[]>(user?.interests || []);
  const [photos, setPhotos] = useState<string[]>(user?.photos || []);
  const [city, setCity] = useState<string>(user?.city || "");

  const toggleInterest = (i: string) =>
    setInterests((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : prev.length < 6 ? [...prev, i] : prev));

  const pickImage = async () => {
    if (photos.length >= 6) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setErr("Galeri izni gerekli. Ayarlardan aç.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.4,
      base64: true,
    });
    if (!res.canceled && res.assets[0]?.base64) {
      const uri = `data:image/jpeg;base64,${res.assets[0].base64}`;
      setPhotos([...photos, uri]);
    }
  };

  const removePhoto = (idx: number) => setPhotos(photos.filter((_, i) => i !== idx));

  const finish = async () => {
    setBusy(true);
    setErr(null);
    try {
      await updateProfile({
        bio: bio.trim(),
        age: age ? parseInt(age, 10) : undefined,
        gender: (gender || undefined) as any,
        orientation: (orientation || undefined) as any,
        vibe_status: vibeStatus.trim(),
        interests,
        photos,
        city: city.trim(),
        onboarded: true,
      });
      router.replace("/(tabs)/feed");
    } catch (e: any) {
      setErr(e?.message || "Bir hata oluştu");
    } finally {
      setBusy(false);
    }
  };

  const canNext = () => {
    if (step === 1) return !!age && parseInt(age, 10) >= 18 && !!gender && !!orientation;
    if (step === 2) return bio.trim().length > 0 && vibeStatus.trim().length > 0;
    if (step === 3) return interests.length >= 2;
    if (step === 4) return photos.length >= 1;
    return true;
  };

  const next = () => {
    if (!canNext()) return setErr("Bu adımı tamamla");
    setErr(null);
    if (step < 4) setStep(step + 1);
    else finish();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.progressRow}>
          {[1, 2, 3, 4].map((n) => (
            <View key={n} style={[styles.progressDot, n <= step ? styles.progressActive : null]} />
          ))}
        </View>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          {step === 1 && (
            <View>
              <Text style={styles.h1}>Sen kimsin?</Text>
              <Text style={styles.sub}>Temel bilgiler — sonra düzenleyebilirsin.</Text>

              <Text style={styles.label}>Yaş</Text>
              <TextInput
                testID="onb-age"
                value={age}
                onChangeText={setAge}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="18+"
                placeholderTextColor={theme.textMuted}
                style={styles.input}
              />

              <Text style={styles.label}>Şehir (opsiyonel)</Text>
              <TextInput
                testID="onb-city"
                value={city}
                onChangeText={setCity}
                placeholder="Kadıköy, İstanbul"
                placeholderTextColor={theme.textMuted}
                style={styles.input}
              />

              <Text style={styles.label}>Cinsiyet</Text>
              <View style={styles.chipsRow}>
                {GENDERS.map((g) => (
                  <TouchableOpacity
                    key={g.key}
                    onPress={() => setGender(g.key)}
                    testID={`onb-gender-${g.key}`}
                    style={[styles.chip, gender === g.key ? styles.chipActive : null]}
                  >
                    <Text style={[styles.chipText, gender === g.key ? styles.chipTextActive : null]}>{g.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Kimi görmek istiyorsun?</Text>
              <View style={styles.chipsRow}>
                {ORIENTATIONS.map((o) => (
                  <TouchableOpacity
                    key={o.key}
                    onPress={() => setOrientation(o.key)}
                    testID={`onb-ori-${o.key}`}
                    style={[styles.chip, orientation === o.key ? styles.chipActive : null]}
                  >
                    <Text style={[styles.chipText, orientation === o.key ? styles.chipTextActive : null]}>{o.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {step === 2 && (
            <View>
              <Text style={styles.h1}>Vibe'ını anlat.</Text>
              <Text style={styles.sub}>Kısa ve öz. Kişiliğini yansıt.</Text>

              <Text style={styles.label}>Anlık Mood (1 kelime/emoji)</Text>
              <TextInput
                testID="onb-vibe"
                value={vibeStatus}
                onChangeText={setVibeStatus}
                placeholder="✨ chaotic good"
                placeholderTextColor={theme.textMuted}
                maxLength={40}
                style={styles.input}
              />

              <Text style={styles.label}>Bio (max 280)</Text>
              <TextInput
                testID="onb-bio"
                value={bio}
                onChangeText={setBio}
                placeholder="Kendini anlat, komik ol, orijinal ol..."
                placeholderTextColor={theme.textMuted}
                multiline
                maxLength={280}
                style={[styles.input, { minHeight: 120, textAlignVertical: "top" }]}
              />
              <Text style={styles.counter}>{280 - bio.length}</Text>
            </View>
          )}

          {step === 3 && (
            <View>
              <Text style={styles.h1}>İlgi alanların?</Text>
              <Text style={styles.sub}>2-6 arasında seç.</Text>
              <View style={styles.chipsWrap}>
                {INTEREST_SUGGESTIONS.map((i) => {
                  const active = interests.includes(i);
                  return (
                    <TouchableOpacity
                      key={i}
                      onPress={() => toggleInterest(i)}
                      testID={`onb-int-${i}`}
                      style={[styles.chip, active ? styles.chipActive : null]}
                    >
                      <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{i}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={[styles.counter, { textAlign: "left", marginTop: spacing.md }]}>
                {interests.length}/6 seçildi
              </Text>
            </View>
          )}

          {step === 4 && (
            <View>
              <Text style={styles.h1}>Fotoğraflar</Text>
              <Text style={styles.sub}>1-6 fotoğraf yükle. En iyi vibe'ını göster.</Text>

              <View style={styles.photoGrid}>
                {[0, 1, 2, 3, 4, 5].map((i) => {
                  const uri = photos[i];
                  return (
                    <TouchableOpacity
                      key={i}
                      testID={`onb-photo-${i}`}
                      onPress={uri ? () => removePhoto(i) : pickImage}
                      style={styles.photoSlot}
                    >
                      {uri ? (
                        <>
                          <View style={[styles.photoSlot, { position: "absolute" }]}>
                            <Text />
                          </View>
                          <ImagePreview uri={uri} />
                          <View style={styles.removeBadge}>
                            <Ionicons name="close" size={14} color="#fff" />
                          </View>
                        </>
                      ) : (
                        <Ionicons name="add" size={32} color={theme.textDim} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {err ? <Text style={styles.err}>{err}</Text> : null}
        </ScrollView>

        <View style={styles.footerRow}>
          {step > 1 && (
            <Pressable onPress={() => setStep(step - 1)} testID="onb-back" style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color={theme.text} />
            </Pressable>
          )}
          <TouchableOpacity onPress={next} disabled={busy} testID="onb-next" style={{ flex: 1 }}>
            <LinearGradient
              colors={[theme.rose, "#8B5CF6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryBtn}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryText}>{step < 4 ? "Devam" : "Bitir"}</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ImagePreview({ uri }: { uri: string }) {
  const { Image } = require("react-native");
  return <Image source={{ uri }} style={{ width: "100%", height: "100%", borderRadius: radius.md }} />;
}

const styles = StyleSheet.create({
  progressRow: { flexDirection: "row", gap: 6, paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: theme.card },
  progressActive: { backgroundColor: theme.rose },
  wrap: { padding: spacing.xl, paddingBottom: 40, flexGrow: 1 },
  h1: { color: theme.text, fontSize: 28, fontWeight: "900", letterSpacing: -0.5, marginTop: spacing.md },
  sub: { color: theme.textDim, marginTop: 6, marginBottom: spacing.xl, fontSize: 14 },
  label: { color: theme.textDim, fontSize: 12, marginTop: spacing.md, marginBottom: 6, letterSpacing: 0.5, textTransform: "uppercase", fontWeight: "700" },
  input: {
    backgroundColor: theme.card,
    color: theme.text,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    fontSize: 15,
  },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.sm },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  chipActive: { borderColor: theme.rose, backgroundColor: "rgba(244,63,94,0.12)" },
  chipText: { color: theme.textDim, fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: theme.rose },
  counter: { color: theme.textDim, textAlign: "right", marginTop: 6, fontSize: 12 },
  err: { color: theme.danger, marginTop: spacing.md },
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
  footerRow: { flexDirection: "row", gap: 12, padding: spacing.xl, paddingTop: spacing.sm },
  backBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: theme.card, alignItems: "center", justifyContent: "center" },
  primaryBtn: { paddingVertical: 16, alignItems: "center", borderRadius: radius.pill, height: 52, justifyContent: "center" },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
