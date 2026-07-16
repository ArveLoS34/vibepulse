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
import { useRouter } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { theme, radius, spacing } from "@/src/lib/theme";

export default function Register() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!name || !email || password.length < 6) return setErr("Adın, email ve en az 6 karakter şifre gerekli");
    setBusy(true);
    setErr(null);
    try {
      await register(email.trim().toLowerCase(), password, name.trim());
      router.replace("/(auth)/onboarding");
    } catch (e: any) {
      setErr(e?.message || "Kayıt başarısız");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} style={styles.back} testID="register-back">
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Pressable>
          <Text style={styles.h1}>Hesap Oluştur</Text>
          <Text style={styles.sub}>Vibe'ını dünyaya göster.</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Ad</Text>
            <TextInput
              testID="register-name"
              value={name}
              onChangeText={setName}
              placeholder="Adın"
              placeholderTextColor={theme.textMuted}
              style={styles.input}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              testID="register-email"
              value={email}
              onChangeText={setEmail}
              placeholder="ornek@vibepulse.app"
              placeholderTextColor={theme.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Şifre (en az 6)</Text>
            <TextInput
              testID="register-password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={theme.textMuted}
              secureTextEntry
              style={styles.input}
            />
          </View>

          {err ? <Text style={styles.err}>{err}</Text> : null}

          <TouchableOpacity onPress={submit} disabled={busy} testID="register-submit" style={{ marginTop: spacing.lg }}>
            <LinearGradient
              colors={[theme.rose, "#8B5CF6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryBtn}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Kayıt Ol</Text>}
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Zaten hesabın var mı?</Text>
            <TouchableOpacity onPress={() => router.replace("/(auth)/login")} testID="go-login">
              <Text style={styles.link}> Giriş Yap</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.xl, flexGrow: 1 },
  back: { marginTop: spacing.sm, marginBottom: spacing.lg, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: theme.card },
  h1: { color: theme.text, fontSize: 32, fontWeight: "900", letterSpacing: -0.5 },
  sub: { color: theme.textDim, marginTop: 6, marginBottom: spacing.xl, fontSize: 15 },
  field: { marginBottom: spacing.md },
  label: { color: theme.textDim, fontSize: 12, marginBottom: 6, letterSpacing: 0.5, textTransform: "uppercase", fontWeight: "700" },
  input: {
    backgroundColor: theme.card,
    color: theme.text,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    fontSize: 15,
  },
  err: { color: theme.danger, marginTop: spacing.sm },
  primaryBtn: { paddingVertical: 16, alignItems: "center", borderRadius: radius.pill },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.xl },
  footerText: { color: theme.textDim },
  link: { color: theme.rose, fontWeight: "700" },
});
