import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { api } from "@/src/lib/api";
import { Avatar } from "@/src/components/Avatar";
import { theme, radius, spacing } from "@/src/lib/theme";

type Pin = {
  id: string;
  type: "signal" | "user";
  title: string;
  category?: string;
  location_name?: string;
  lat: number;
  lng: number;
  author?: any;
  user?: any;
};

export default function VibeMapScreen() {
  const router = useRouter();
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ map_pins: Pin[] }>("/map/vibes");
      setPins(res.map_pins || []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} testID="map-back">
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={styles.title}>🗺️ Vibe Map — Canlı Harita</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.rose} /></View>
      ) : (
        <View style={{ flex: 1, padding: spacing.lg }}>
          <Text style={styles.sub}>
            Etrafındaki anlık buluşma sinyalleri ve aktif Vibe kullanıcıları.
          </Text>

          <FlatList
            data={pins}
            keyExtractor={(p) => p.id}
            contentContainerStyle={{ gap: 12, paddingTop: spacing.md }}
            renderItem={({ item }) => {
              const isSignal = item.type === "signal";
              return (
                <TouchableOpacity
                  onPress={() => setSelectedPin(item)}
                  style={[styles.pinCard, isSignal ? styles.signalBorder : null]}
                  testID={`map-pin-${item.id}`}
                >
                  <View style={styles.pinHeader}>
                    <View style={styles.pinTypeWrap}>
                      <Ionicons
                        name={isSignal ? "navigate-circle" : "person-circle"}
                        size={20}
                        color={isSignal ? theme.rose : theme.cyan}
                      />
                      <Text style={[styles.pinType, { color: isSignal ? theme.rose : theme.cyan }]}>
                        {isSignal ? "Buluşma Sinyali" : "Aktif Kullanıcı"}
                      </Text>
                    </View>
                    <Text style={styles.pinLoc}>📍 {item.location_name || "Yakınında"}</Text>
                  </View>

                  <Text style={styles.pinTitle} numberOfLines={2}>
                    "{item.title}"
                  </Text>

                  {item.user ? (
                    <View style={styles.userRow}>
                      <Avatar uri={item.user.photos?.[0]} name={item.user.name || "?"} size={28} />
                      <Text style={styles.userName}>{item.user.name}</Text>
                      {item.user.music_compatibility_pct ? (
                        <Text style={styles.musicTag}>%{item.user.music_compatibility_pct} Uyum</Text>
                      ) : null}
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {selectedPin && (
        <View style={styles.bottomSheet}>
          <Text style={styles.sheetTitle}>{selectedPin.title}</Text>
          <TouchableOpacity
            onPress={() => {
              const targetId = selectedPin.user?.user_id || selectedPin.author?.user_id;
              if (targetId) {
                router.push({ pathname: "/profile/[id]", params: { id: targetId } });
              }
              setSelectedPin(null);
            }}
            style={styles.sheetBtn}
          >
            <LinearGradient
              colors={[theme.rose, "#8B5CF6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.btnInner}
            >
              <Text style={styles.btnText}>Profile Git & Vibe Gönder</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
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
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { color: theme.text, fontSize: 17, fontWeight: "800" },
  sub: { color: theme.textDim, fontSize: 13, textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  pinCard: {
    backgroundColor: theme.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
  signalBorder: { borderColor: "rgba(244,63,94,0.4)" },
  pinHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pinTypeWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  pinType: { fontSize: 12, fontWeight: "700" },
  pinLoc: { color: theme.textMuted, fontSize: 12 },
  pinTitle: { color: theme.text, fontSize: 15, fontWeight: "600", marginTop: 8 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  userName: { color: theme.text, fontSize: 13, fontWeight: "700" },
  musicTag: { color: theme.rose, fontSize: 11, fontWeight: "700", marginLeft: "auto" },
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.surface,
    padding: spacing.xl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderColor: theme.border,
    gap: spacing.md,
  },
  sheetTitle: { color: theme.text, fontSize: 16, fontWeight: "700" },
  sheetBtn: { borderRadius: radius.pill, overflow: "hidden" },
  btnInner: { paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
