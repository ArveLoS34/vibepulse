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
import { api } from "@/src/lib/api";
import { theme, radius, spacing } from "@/src/lib/theme";

export default function ForgotPassword() {
  const router = useRouter();
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const onRequestCode = async () => {
    if (!email) return setErr("Lütfen e-posta adresinizi girin");
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await api<{ message: string; demo_code?: string }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
        auth: false,
      });
      setMsg(
        res.demo_code
          ? `${res.message} (Demo kod: ${res.demo_code})`
          : res.message
      );
      if (res.demo_code) setCode(res.demo_code);
      setStep("reset");
    } catch (e: any) {
      setErr(e?.message || "İstek başarısız oldu");
    } finally {
      setBusy(false);
    }
  };

  const onResetPassword = async () => {
    if (!code || !newPassword) return setErr("Sıfırlama kodu ve yeni şifre gerekli");
    if (newPassword.length < 6) return setErr("Şifre en az 6 karakter olmalıdır");
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await api<{ message: string }>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim(),
          new_password: newPassword,
        }),
        auth: false,
      });
      setMsg(res.message);
      setTimeout(() => {
        router.replace("/(auth)/login");
      }, 1500);
    } catch (e: any) {
      setErr(e?.message || "Sıfırlama başarısız oldu");
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
          <Pressable onPress={() => router.back()} style={styles.back} testID="forgot-back">
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Pressable>
          <Text style={styles.h1}>Şifremi Unuttum</Text>
          <Text style={styles.sub}>
            {step === "request"
              ? "E-posta adresini gir, doğrulama kodunu gönderelim."
              : "Gelen doğrulama kodunu ve yeni şifreni gir."}
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              testID="forgot-email"
              value={email}
              onChangeText={setEmail}
              placeholder="ornek@vibepulse.app"
              placeholderTextColor={theme.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={step === "request"}
              style={styles.input}
            />
          </View>

          {step === "reset" && (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>6 Haneli Sıfırlama Kodu</Text>
                <TextInput
                  testID="forgot-code"
                  value={code}
                  onChangeText={setCode}
                  placeholder="123456"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="number-pad"
                  style={styles.input}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Yeni Şifre</Text>
                <TextInput
                  testID="forgot-new-password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="••••••••"
                  placeholderTextColor={theme.textMuted}
                  secureTextEntry
                  style={styles.input}
                />
              </View>
            </>
          )}

          {err ? <Text style={styles.err}>{err}</Text> : null}
          {msg ? <Text style={styles.msg}>{msg}</Text> : null}

          <TouchableOpacity
            onPress={step === "request" ? onRequestCode : onResetPassword}
            disabled={busy}
            testID="forgot-submit"
            style={{ marginTop: spacing.lg }}
          >
            <LinearGradient
              colors={[theme.rose, "#8B5CF6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryBtn}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryText}>
                  {step === "request" ? "Kod Gönder" : "Şifreyi Güncelle"}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.xl, flexGrow: 1 },
  back: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.card,
  },
  h1: { color: theme.text, fontSize: 32, fontWeight: "900", letterSpacing: -0.5 },
  sub: { color: theme.textDim, marginTop: 6, marginBottom: spacing.xl, fontSize: 15 },
  field: { marginBottom: spacing.md },
  label: {
    color: theme.textDim,
    fontSize: 12,
    marginBottom: 6,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    fontWeight: "700",
  },
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
  msg: { color: "#10B981", marginTop: spacing.sm, fontWeight: "600" },
  primaryBtn: { paddingVertical: 16, alignItems: "center", borderRadius: radius.pill },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
