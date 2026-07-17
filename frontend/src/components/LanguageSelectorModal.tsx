import React from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Language } from "@/src/i18n/translations";
import { useTranslation } from "@/src/i18n/LanguageContext";
import { theme, radius, spacing } from "@/src/lib/theme";

const LANGUAGES: { code: Language; name: string; flag: string }[] = [
  { code: "tr", name: "Türkçe", flag: "🇹🇷" },
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
];

export function LanguageSelectorModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { lang, setLanguage, t } = useTranslation();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{t("select_language")}</Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.list}>
            {LANGUAGES.map((item) => {
              const active = lang === item.code;
              return (
                <TouchableOpacity
                  key={item.code}
                  onPress={async () => {
                    await setLanguage(item.code);
                    onClose();
                  }}
                  style={[styles.item, active && styles.itemActive]}
                >
                  <Text style={styles.flag}>{item.flag}</Text>
                  <Text style={[styles.name, active && styles.nameActive]}>{item.name}</Text>
                  {active && <Ionicons name="checkmark-circle" size={20} color={theme.rose} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    borderTopWidth: 1,
    borderColor: theme.border,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg },
  title: { color: theme.text, fontSize: 18, fontWeight: "800" },
  list: { gap: 10 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.card,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
  itemActive: { borderColor: theme.rose, backgroundColor: "rgba(244,63,94,0.1)" },
  flag: { fontSize: 24 },
  name: { color: theme.text, fontSize: 16, fontWeight: "600", flex: 1 },
  nameActive: { color: theme.rose, fontWeight: "800" },
});
