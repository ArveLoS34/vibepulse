import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { useTranslation } from "@/src/i18n/LanguageContext";
import { LanguageSelectorModal } from "@/src/components/LanguageSelectorModal";
import { api } from "@/src/lib/api";
import type { Post } from "@/src/components/PostCard";
import { PostCard } from "@/src/components/PostCard";
import { theme, radius, spacing } from "@/src/lib/theme";
import { Avatar } from "@/src/components/Avatar";

export default function MeScreen() {
  const router = useRouter();
  const { user, refresh, logout, deleteAccount } = useAuth();
  const { t } = useTranslation();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [questionsModalOpen, setQuestionsModalOpen] = useState(false);
  const [langModalOpen, setLangModalOpen] = useState(false);
  const [myQuestions, setMyQuestions] = useState<any[]>([]);
  const [replyText, setReplyText] = useState("");
  const [selectedQId, setSelectedQId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api<{ posts: Post[] }>(`/posts/user/${user.user_id}`);
      setPosts(res.posts);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadQuestions = async () => {
    try {
      const res = await api<{ questions: any[] }>("/users/me/questions");
      setMyQuestions(res.questions || []);
      setQuestionsModalOpen(true);
    } catch {}
  };

  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [targetEmail, setTargetEmail] = useState("");
  const [adminStatsData, setAdminStatsData] = useState<any>(null);
  const [promoteBusy, setPromoteBusy] = useState(false);

  const openAdminConsole = async () => {
    try {
      const res = await api<{ stats: any }>("/admin/stats");
      setAdminStatsData(res.stats);
      setAdminModalOpen(true);
    } catch {
      alert("Yönetici istatistikleri yüklenemedi");
    }
  };

  const handlePromoteUser = async () => {
    if (!targetEmail.trim()) return alert("Lütfen kullanıcı e-postası girin");
    setPromoteBusy(true);
    try {
      const res = await api<{ message: string }>("/admin/promote-user", {
        method: "POST",
        body: JSON.stringify({
          target_email: targetEmail.trim().toLowerCase(),
          make_admin: true,
          make_premium: true,
        }),
      });
      alert(res.message);
      setTargetEmail("");
    } catch (e: any) {
      alert(e?.message || "Yetki tanımlanamadı");
    } finally {
      setPromoteBusy(false);
    }
  };

  const answerQuestion = async (qId: string) => {
    if (!replyText.trim()) return;
    try {
      await api(`/questions/${qId}/answer`, {
        method: "POST",
        body: JSON.stringify({ answer_text: replyText.trim(), publish_to_feed: true }),
      });
      alert("Yanıtınız kaydedildi ve akışınızda paylaşıldı!");
      setReplyText("");
      setSelectedQId(null);
      loadQuestions();
      load();
    } catch (e: any) {
      alert(e?.message || "Cevap gönderilemedi");
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => { load(); }, [load]);

  if (!user) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top"]}>
      <View style={styles.headerBar}>
        <TouchableOpacity
          testID="lang-select-btn"
          style={styles.iconBtn}
          onPress={() => setLangModalOpen(true)}
        >
          <Ionicons name="globe-outline" size={20} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity
          testID="edit-profile-btn"
          style={styles.iconBtn}
          onPress={() => router.push("/profile/edit")}
        >
          <Ionicons name="create-outline" size={20} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity testID="logout-btn" style={styles.iconBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={20} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        <LinearGradient
          colors={["rgba(244,63,94,0.25)", "rgba(139,92,246,0.15)", "transparent"]}
          style={styles.banner}
        />
        <View style={styles.profileHead}>
          <Avatar uri={user.photos?.[0]} name={user.name || ""} size={110} ring />
          <Text style={styles.name}>
            {user.name} {user.age ? <Text style={styles.age}>, {user.age}</Text> : null}
          </Text>
          <Text style={styles.handle}>@{user.handle}</Text>
          {user.vibe_status ? (
            <View style={styles.vibePill}>
              <Text style={styles.vibeText}>✨ {user.vibe_status}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={() => router.push("/premium")}
            style={{ width: "100%", marginVertical: spacing.md }}
            testID="me-premium-btn"
          >
            <LinearGradient
              colors={[theme.rose, "#8B5CF6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: radius.pill,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Ionicons name="star" size={18} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>
                {user.is_premium ? "VibePulse Premium Aktif ✨" : "Premium'a Yükselt — Ayrıcalıkları Gör"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* AMA Inbox Button */}
          <TouchableOpacity
            onPress={loadQuestions}
            style={styles.amaBoxBtn}
            testID="open-ama-inbox"
          >
            <Ionicons name="eye-off" size={18} color="#8B5CF6" />
            <Text style={styles.amaBoxText}>🙈 Gelen Anonim Sorular (AMA)</Text>
          </TouchableOpacity>

          {/* Admin Console Button (Only visible if user.is_admin is true) */}
          {user.is_admin ? (
            <TouchableOpacity onPress={openAdminConsole} style={styles.adminActiveBadge} testID="open-admin-console">
              <Ionicons name="shield-checkmark" size={18} color="#10B981" />
              <Text style={styles.adminActiveText}>👑 Yönetici Konsolu — Kullanıcı Yetkilendir</Text>
            </TouchableOpacity>
          ) : null}

          {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
          {user.city ? (
            <Text style={styles.meta}>
              <Ionicons name="location-outline" size={12} color={theme.cyan} /> {user.city}
            </Text>
          ) : null}

          {user.interests && user.interests.length > 0 ? (
            <View style={styles.interestsRow}>
              {user.interests.map((i) => (
                <View key={i} style={styles.interestChip}>
                  <Text style={styles.interestText}>{i}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {user.photos && user.photos.length > 1 ? (
          <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
            <Text style={styles.sectionTitle}>Fotoğraflar</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingRight: spacing.lg }}
            >
              {user.photos.map((p, i) => (
                <Image key={i} source={{ uri: p }} style={styles.gridPhoto} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 4 }}>
          <Text style={styles.sectionTitle}>Vibe'larım</Text>
        </View>
        {loading ? (
          <ActivityIndicator color={theme.rose} style={{ marginTop: 20 }} />
        ) : posts.length === 0 ? (
          <View style={{ padding: spacing.xxl, alignItems: "center" }}>
            <Text style={styles.emptyText}>Henüz paylaşım yok. Feed'e git ve ilk vibe'ını at.</Text>
          </View>
        ) : (
          posts.map((p) => <PostCard key={p.post_id} post={p} />)
        )}

        {/* Apple Store mandatory account deletion button */}
        <View style={{ paddingHorizontal: spacing.lg, marginVertical: spacing.xl }}>
          <TouchableOpacity
            onPress={deleteAccount}
            style={styles.deleteAccountBtn}
            testID="delete-account-btn"
          >
            <Ionicons name="trash-outline" size={18} color={theme.danger} />
            <Text style={styles.deleteAccountText}>Hesabımı Kalıcı Olarak Sil</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* AMA Questions Inbox Modal */}
      <Modal visible={questionsModalOpen} animationType="slide" onRequestClose={() => setQuestionsModalOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>🙈 Gelen Soru Kutusu</Text>
            <TouchableOpacity onPress={() => setQuestionsModalOpen(false)} style={{ padding: 6 }}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={myQuestions}
            keyExtractor={(q) => q.question_id}
            contentContainerStyle={{ padding: spacing.lg, gap: 12 }}
            ListEmptyComponent={
              <View style={{ padding: spacing.xxl, alignItems: "center" }}>
                <Ionicons name="eye-off-outline" size={48} color={theme.textMuted} />
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: "700", marginTop: 12 }}>
                  Henüz gelen anonim soru yok
                </Text>
                <Text style={{ color: theme.textDim, fontSize: 13, textAlign: "center", marginTop: 4 }}>
                  Profiline gelen ziyaretçiler sana gizli sorular sorabilir!
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.qCard}>
                <Text style={styles.qText}>❓ "{item.question_text}"</Text>
                {item.answer_text ? (
                  <View style={styles.aBox}>
                    <Text style={styles.aText}>💬 Cevabın: {item.answer_text}</Text>
                  </View>
                ) : (
                  selectedQId === item.question_id ? (
                    <View style={{ marginTop: 10, gap: 8 }}>
                      <TextInput
                        value={replyText}
                        onChangeText={setReplyText}
                        placeholder="Cevabını yaz..."
                        placeholderTextColor={theme.textMuted}
                        style={styles.replyInput}
                        multiline
                      />
                      <TouchableOpacity onPress={() => answerQuestion(item.question_id)} style={styles.replySubmitBtn}>
                        <Text style={{ color: "#fff", fontWeight: "700", textAlign: "center" }}>Cevapla & Akışta Paylaş 🚀</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity onPress={() => setSelectedQId(item.question_id)} style={styles.replyToggleBtn}>
                      <Text style={{ color: theme.rose, fontWeight: "700", fontSize: 13 }}>Yanıtla →</Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* Admin Management Console Modal */}
      <Modal visible={adminModalOpen} animationType="slide" onRequestClose={() => setAdminModalOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>👑 Yönetici & Yetkilendirme Konsolu</Text>
            <TouchableOpacity onPress={() => setAdminModalOpen(false)} style={{ padding: 6 }}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
            {adminStatsData && (
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statVal}>{adminStatsData.total_users}</Text>
                  <Text style={styles.statLbl}>Kullanıcı</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statVal}>{adminStatsData.total_posts}</Text>
                  <Text style={styles.statLbl}>Gönderi</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statVal}>{adminStatsData.premium_users}</Text>
                  <Text style={styles.statLbl}>VIP Üye</Text>
                </View>
              </View>
            )}

            <View style={styles.promoteBox}>
              <Text style={styles.promoteTitle}>👑 Bir Üyeye VIP / Admin Yetkisi Ver</Text>
              <Text style={styles.promoteSub}>Yetki vermek istediğin kullanıcının kayıtlı e-posta adresini gir:</Text>
              <TextInput
                value={targetEmail}
                onChangeText={setTargetEmail}
                placeholder="kullanici@email.com"
                placeholderTextColor={theme.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.promoteInput}
              />
              <TouchableOpacity
                onPress={handlePromoteUser}
                disabled={promoteBusy || !targetEmail.trim()}
                style={[styles.promoteSubmitBtn, (promoteBusy || !targetEmail.trim()) ? { opacity: 0.5 } : null]}
              >
                <LinearGradient
                  colors={[theme.rose, "#8B5CF6"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ paddingVertical: 12, alignItems: "center", borderRadius: radius.pill }}
                >
                  <Text style={{ color: "#fff", fontWeight: "800" }}>
                    {promoteBusy ? "Yetki Tanımlanıyor..." : "Kullanıcıya Tam Yetki Ver 👑"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <LanguageSelectorModal visible={langModalOpen} onClose={() => setLangModalOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerBar: { flexDirection: "row", justifyContent: "flex-end", gap: 10, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, position: "absolute", right: 0, top: 40, zIndex: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(23,23,27,0.9)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.border },
  banner: { height: 160, position: "absolute", top: 0, left: 0, right: 0 },
  profileHead: { alignItems: "center", paddingTop: 60, paddingHorizontal: spacing.xl },
  name: { color: theme.text, fontSize: 26, fontWeight: "900", marginTop: spacing.md, letterSpacing: -0.5 },
  age: { fontWeight: "400", color: theme.textDim },
  handle: { color: theme.textDim, marginTop: 2 },
  vibePill: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: "rgba(244,63,94,0.12)",
    borderWidth: 1,
    borderColor: "rgba(244,63,94,0.3)",
  },
  vibeText: { color: theme.rose, fontWeight: "700", fontSize: 13 },
  bio: { color: theme.text, textAlign: "center", marginTop: spacing.md, fontSize: 15, lineHeight: 22 },
  meta: { color: theme.textDim, marginTop: spacing.md, fontSize: 13 },
  interestsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.md, justifyContent: "center" },
  interestChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  interestText: { color: theme.text, fontSize: 12, fontWeight: "600" },
  sectionTitle: { color: theme.textDim, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: spacing.sm },
  gridPhoto: { width: 130, height: 170, borderRadius: radius.md, backgroundColor: theme.card },
  emptyText: { color: theme.textDim, textAlign: "center" },
  amaBoxBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: "rgba(139, 92, 246, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
    marginBottom: spacing.md,
  },
  amaBoxText: { color: "#8B5CF6", fontWeight: "700", fontSize: 14 },
  adminGrantBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
    marginBottom: spacing.md,
  },
  adminGrantText: { color: "#F59E0B", fontWeight: "800", fontSize: 13 },
  adminActiveBadge: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.4)",
    marginBottom: spacing.md,
  },
  adminActiveText: { color: "#10B981", fontWeight: "800", fontSize: 13 },
  statsGrid: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.border,
  },
  statVal: { color: theme.rose, fontSize: 22, fontWeight: "900" },
  statLbl: { color: theme.textDim, fontSize: 11, fontWeight: "600", marginTop: 2 },
  promoteBox: {
    backgroundColor: theme.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
    gap: 10,
  },
  promoteTitle: { color: "#F59E0B", fontSize: 16, fontWeight: "800" },
  promoteSub: { color: theme.textDim, fontSize: 13, lineHeight: 18 },
  promoteInput: {
    backgroundColor: theme.surface,
    color: theme.text,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: theme.border,
    marginTop: 4,
  },
  promoteSubmitBtn: { marginTop: 6 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalTitle: { color: theme.text, fontSize: 18, fontWeight: "800" },
  qCard: {
    backgroundColor: theme.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
  qText: { color: theme.text, fontSize: 15, fontWeight: "700" },
  aBox: { marginTop: 8, backgroundColor: "rgba(244,63,94,0.1)", padding: 8, borderRadius: radius.md },
  aText: { color: theme.rose, fontSize: 13, fontWeight: "600" },
  replyInput: {
    backgroundColor: theme.surface,
    color: theme.text,
    borderRadius: radius.md,
    padding: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  replySubmitBtn: {
    backgroundColor: theme.rose,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  replyToggleBtn: { marginTop: 8, alignSelf: "flex-end" },
  deleteAccountBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.pill,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  deleteAccountText: { color: theme.danger, fontWeight: "700", fontSize: 14 },
});
