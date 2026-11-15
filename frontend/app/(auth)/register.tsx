import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { theme, spacing } from "@/src/lib/theme";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";

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
          <Text style={styles.sub}>Vibe&apos;ını dünyaya göster.</Text>

          <Input
            label="Ad"
            icon="person-outline"
            testID="register-name"
            value={name}
            onChangeText={setName}
            placeholder="Adın"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="words"
          />

          <Input
            label="Email"
            icon="mail-outline"
            testID="register-email"
            value={email}
            onChangeText={setEmail}
            placeholder="ornek@vibepulse.app"
            placeholderTextColor={theme.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Input
            label="Şifre (en az 6)"
            icon="lock-closed-outline"
            testID="register-password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={theme.textMuted}
            secureTextEntry
          />

          {err ? <Text style={styles.err}>{err}</Text> : null}

          <Button
            title="Kayıt Ol"
            onPress={submit}
            loading={busy}
            testID="register-submit"
            style={{ marginTop: spacing.lg }}
          />

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
  err: { color: theme.danger, marginTop: spacing.sm },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.xl },
  footerText: { color: theme.textDim },
  link: { color: theme.rose, fontWeight: "700" },
});
