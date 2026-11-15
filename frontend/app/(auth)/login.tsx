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

export default function Login() {
  const router = useRouter();
  const { loginPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!email || !password) return setErr("Email ve şifre gerekli");
    setBusy(true);
    setErr(null);
    try {
      await loginPassword(email.trim().toLowerCase(), password);
      router.replace("/");
    } catch (e: any) {
      setErr(e?.message || "Giriş başarısız");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} style={styles.back} testID="login-back">
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Pressable>
          <Text style={styles.h1}>Tekrar hoşgeldin</Text>
          <Text style={styles.sub}>Vibe&apos;ına devam et.</Text>

          <Input
            label="Email"
            icon="mail-outline"
            testID="login-email"
            value={email}
            onChangeText={setEmail}
            placeholder="ornek@vibepulse.app"
            placeholderTextColor={theme.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Input
            label="Şifre"
            icon="lock-closed-outline"
            testID="login-password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={theme.textMuted}
            secureTextEntry
          />

          <TouchableOpacity
            onPress={() => router.push("/(auth)/forgot-password")}
            style={{ alignSelf: "flex-end", marginBottom: spacing.md }}
            testID="forgot-password-link"
          >
            <Text style={styles.forgotText}>Şifremi Unuttum?</Text>
          </TouchableOpacity>

          {err ? <Text style={styles.err}>{err}</Text> : null}

          <Button
            title="Giriş Yap"
            onPress={submit}
            loading={busy}
            testID="login-submit"
            style={{ marginTop: spacing.lg }}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Hesabın yok mu?</Text>
            <TouchableOpacity onPress={() => router.replace("/(auth)/register")} testID="go-register">
              <Text style={styles.link}> Kayıt Ol</Text>
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
  forgotText: { color: theme.rose, fontSize: 13, fontWeight: "600" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.xl },
  footerText: { color: theme.textDim },
  link: { color: theme.rose, fontWeight: "700" },
});
