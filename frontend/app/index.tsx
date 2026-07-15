import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { theme } from "@/src/lib/theme";

export default function Index() {
  const { loading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/(auth)/welcome");
    } else if (!user.onboarded) {
      router.replace("/(auth)/onboarding");
    } else {
      router.replace("/(tabs)/feed");
    }
  }, [loading, user, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={theme.rose} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center" },
});
