import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/src/lib/api";
import { useTranslation } from "@/src/i18n/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";
import { PostCard, Post } from "@/src/components/PostCard";
import { Avatar } from "@/src/components/Avatar";
import { theme, radius, spacing } from "@/src/lib/theme";
import type { VibeUser } from "@/src/context/AuthContext";

export default function PublicProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { user: me } = useAuth();
  const [user, setUser] = useState<(VibeUser & { top_post?: any; now_playing?: any }) | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [askOpen, setAskOpen] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [askBusy, setAskBusy] = useState(false);

  // Active Story state for this profile
  const [userStoryGroup, setUserStoryGroup] = useState<any | null>(null);
  const [storyModalOpen, setStoryModalOpen] = useState(false);
  const [activeStoryIdx, setActiveStoryIdx] = useState(0);
  const [replyText, setReplyText] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);

  const [aiReportModal, setAiReportModal] = useState(false);
  const [aiReportData, setAiReportData] = useState<any>(null);
  const [aiReportBusy, setAiReportBusy] = useState(false);

  const loadAiReport = async () => {
    if (!user) return;
    setAiReportBusy(true);
    try {
      const res = await api<{ compatibility_score: number; report: any }>(`/compatibility-report/${user.user_id}`, { method: "POST" });
      setAiReportData(res);
      setAiReportModal(true);
    } catch {
      alert("AI Uyum Raporu hazırlanamadı");
    } finally {
      setAiReportBusy(false);
    }
  };

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const u = await api<{ user: any }>(`/users/${id}`);
      setUser(u.user);
      const p = await api<{ posts: Post[] }>(`/posts/user/${id}`);
      setPosts(p.posts);

      // Check active stories for this profile
      try {
        const stRes = await api<{ has_active_story: boolean; stories_group: any }>(`/stories/user/${id}`);
        if (stRes.has_active_story && stRes.stories_group) {
          setUserStoryGroup(stRes.stories_group);
        }
      } catch {}
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const toggleLikeActiveStory = async () => {
    if (!userStoryGroup || !userStoryGroup.stories[activeStoryIdx]) return;
    const stId = userStoryGroup.stories[activeStoryIdx].story_id;
    try {
      await api(`/stories/${stId}/like`, { method: "POST" });
      alert("Hikaye beğenildi! 💖");
    } catch {}
  };

  const sendStoryReply = async () => {
    if (!userStoryGroup || !userStoryGroup.stories[activeStoryIdx] || !replyText.trim()) return;
    const stId = userStoryGroup.stories[activeStoryIdx].story_id;
    setReplyBusy(true);
    try {
      const res = await api<{ message: string; match_id: string }>(`/stories/${stId}/reply`, {
        method: "POST",
        body: JSON.stringify({ reply_text: replyText.trim() }),
      });
      alert(res.message || "Yanıtınız özel mesaj olarak iletildi! 📩");
      setReplyText("");
      setStoryModalOpen(false);
    } catch (e: any) {
      alert(e?.message || "Yanıt iletilemedi");
    } finally {
      setReplyBusy(false);
    }
  };

  const sendVibe = async () => {
    if (!user) return;
    try {
      const res = await api<{ matched: boolean; match: any }>("/swipes", {
        method: "POST",
        body: JSON.stringify({ target_user_id: user.user_id, action: "like" }),
      });
      if (res.matched && res.match) {
        alert("🎉 Vibe Eşleşmesi Sağlandı! Sohbete yönlendiriliyorsunuz.");
        router.push({ pathname: "/chat/[matchId]", params: { matchId: res.match.match_id } });
      } else {
        alert("✨ Vibe Gönderildi! Karşı taraf da beğendiğinde sohbetiniz açılacak.");
      }
    } catch (e: any) {
      alert(e?.message || "Vibe gönderilemedi");
    }
  };

  const sendAnonymousQuestion = async () => {
    if (!questionText.trim() || !user) return;
    setAskBusy(true);
    try {
      await api(`/users/${user.user_id}/ask-anonymous`, {
        method: "POST",
        body: JSON.stringify({ text: questionText.trim() }),
      });
      alert("Anonim sorunuz gönderildi! 🙈");
      setQuestionText("");
      setAskOpen(false);
    } catch (e: any) {
      alert(e?.message || "Soru gönderilemedi");
    } finally {
      setAskBusy(false);
    }
  };

  const blockUser = async () => {
    if (!user) return;
    try {
      await api(`/users/${user.user_id}/block`, { method: "POST" });
      router.back();
    } catch {}
  };

  const reportUser = async () => {
    if (!user) return;
    try {
      await api("/reports", {
        method: "POST",
        body: JSON.stringify({ target_user_id: user.user_id, reason: "Uygunsuz içerik" }),
      });
      alert("Şikayetiniz moderasyon ekibimize iletildi. Teşekkürler.");
    } catch {}
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="profile-back">
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{user?.name || "Profil"}</Text>
        <View style={{ flexDirection: "row", gap: 4 }}>
          <Pressable onPress={reportUser} style={styles.iconBtn} testID="profile-report">
            <Ionicons name="flag-outline" size={18} color={theme.textDim} />
          </Pressable>
          <Pressable onPress={blockUser} style={styles.iconBtn} testID="profile-block">
            <Ionicons name="ban-outline" size={18} color={theme.danger} />
          </Pressable>
        </View>
      </View>

      {loading || !user ? (
        <View style={styles.center}><ActivityIndicator color={theme.rose} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          <LinearGradient
            colors={["rgba(244,63,94,0.25)", "transparent"]}
            style={styles.banner}
          />
          <View style={styles.head}>
            <TouchableOpacity
              onPress={() => userStoryGroup ? setStoryModalOpen(true) : null}
              disabled={!userStoryGroup}
              style={{ position: "relative" }}
            >
              <Avatar uri={user.photos?.[0]} name={user.name || ""} size={110} ring={!!userStoryGroup} />
              {userStoryGroup ? (
                <View style={styles.storyBadge}>
                  <Text style={styles.storyBadgeText}>24Sa Hikaye</Text>
                </View>
              ) : null}
            </TouchableOpacity>

            <Text style={styles.name}>
              {user.name}{user.age ? <Text style={styles.age}>, {user.age}</Text> : null}
            </Text>
            <Text style={styles.handle}>@{user.handle}</Text>
            {user.vibe_status ? (
              <View style={styles.vibePill}>
                <Text style={styles.vibeText}>✨ {user.vibe_status}</Text>
              </View>
            ) : null}

            {/* Feature 3: Live Spotify Widget */}
            {user.now_playing ? (
              <View style={styles.spotifyWidget}>
                <Ionicons name="musical-note" size={16} color="#1DB954" />
                <Text style={styles.spotifyText}>
                  {t("now_playing")}: {user.now_playing.song_title} — {user.now_playing.artist_name}
                </Text>
              </View>
            ) : null}

            {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

            {/* Feature 2: Anonymous Question Button & Card */}
            <TouchableOpacity onPress={() => setAskOpen(!askOpen)} style={styles.askBtn} testID="ask-anonymous-btn">
              <Ionicons name="eye-off-outline" size={16} color="#fff" />
              <Text style={styles.askBtnText}>{t("ask_ama_btn")}</Text>
            </TouchableOpacity>

            {/* AI Compatibility Report Button */}
            <TouchableOpacity onPress={loadAiReport} disabled={aiReportBusy} style={styles.aiReportBtn} testID="ai-report-btn">
              <Ionicons name="sparkles" size={16} color="#F59E0B" />
              <Text style={styles.aiReportText}>
                {aiReportBusy ? t("ai_report_loading") : t("ai_report_btn")}
              </Text>
            </TouchableOpacity>

            {askOpen && (
              <View style={styles.askBox}>
                <Text style={styles.askBoxTitle}>🙈 {user.name} kullanıcısına gizli soru sor:</Text>
                <TextInput
                  value={questionText}
                  onChangeText={setQuestionText}
                  placeholder="Sorunu buraya yaz (kimliğin gizli tutulur)..."
                  placeholderTextColor={theme.textMuted}
                  multiline
                  maxLength={280}
                  style={styles.askInput}
                />
                <TouchableOpacity
                  onPress={sendAnonymousQuestion}
                  disabled={!questionText.trim() || askBusy}
                  style={[styles.askSubmitBtn, (!questionText.trim() || askBusy) ? { opacity: 0.5 } : null]}
                  testID="submit-anonymous-question"
                >
                  <LinearGradient
                    colors={[theme.rose, "#8B5CF6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.askSubmitInner}
                  >
                    <Text style={styles.askSubmitText}>
                      {askBusy ? "Gönderiliyor..." : "Anonim Olarak Gönder 🚀"}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.metaRow}>
              {typeof user.distance_km === "number" ? (
                <Text style={styles.meta}>
                  <Ionicons name="location" size={12} color={theme.cyan} /> {user.distance_km} km
                </Text>
              ) : user.city ? (
                <Text style={styles.meta}>
                  <Ionicons name="location" size={12} color={theme.cyan} /> {user.city}
                </Text>
              ) : null}
            </View>
            {user.interests && user.interests.length > 0 ? (
              <View style={styles.interestsRow}>
                {user.interests.map((i: string) => (
                  <View key={i} style={styles.interestChip}>
                    <Text style={styles.interestText}>{i}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Pressable onPress={sendVibe} testID="send-vibe-btn" style={{ marginTop: spacing.lg }}>
              <LinearGradient
                colors={[theme.rose, "#8B5CF6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.vibeBtn}
              >
                <Ionicons name="flash" size={18} color="#fff" />
                <Text style={styles.vibeBtnText}>{t("send_vibe_btn")}</Text>
              </LinearGradient>
            </Pressable>
          </View>

          {user.photos && user.photos.length > 1 ? (
            <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
              <Text style={styles.section}>Fotoğraflar</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {user.photos.map((p: string, i: number) => (
                  <Image key={i} source={{ uri: p }} style={styles.gridPhoto} />
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
            <Text style={styles.section}>Vibe'ları</Text>
          </View>
          {posts.map((p) => <PostCard key={p.post_id} post={p} />)}
        </ScrollView>
      )}

      {/* Profile Active Story Modal */}
      <Modal visible={storyModalOpen} animationType="fade" onRequestClose={() => setStoryModalOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0A0C", justifyContent: "space-between" }}>
          {userStoryGroup && (
            <>
              {/* Progress Bar */}
              <View style={styles.storyBarRow}>
                {userStoryGroup.stories.map((st: any, idx: number) => (
                  <View key={idx} style={[styles.storyBar, idx <= activeStoryIdx ? { backgroundColor: theme.rose } : null]} />
                ))}
              </View>

              {/* Author Row */}
              <View style={styles.storyAuthorRow}>
                <Avatar uri={userStoryGroup.user?.avatar} name={userStoryGroup.user?.name || ""} size={42} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>{userStoryGroup.user?.name}</Text>
                  <Text style={{ color: theme.textDim, fontSize: 12 }}>@{userStoryGroup.user?.handle}</Text>
                </View>

                <TouchableOpacity onPress={toggleLikeActiveStory} style={{ padding: 8 }}>
                  <Ionicons name="heart" size={24} color={theme.rose} />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setStoryModalOpen(false)} style={{ padding: 6 }}>
                  <Ionicons name="close" size={26} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Story Content */}
              <View style={styles.storyBody}>
                {userStoryGroup.stories[activeStoryIdx]?.image ? (
                  <Image source={{ uri: userStoryGroup.stories[activeStoryIdx].image }} style={styles.storyFullMedia} />
                ) : null}

                {userStoryGroup.stories[activeStoryIdx]?.text ? (
                  <LinearGradient
                    colors={["rgba(244,63,94,0.15)", "rgba(139,92,246,0.25)"]}
                    style={styles.storyCard}
                  >
                    <Text style={styles.storyCardText}>
                      "{userStoryGroup.stories[activeStoryIdx].text}"
                    </Text>
                  </LinearGradient>
                ) : null}
              </View>

              {/* Story Reply Box */}
              {me?.user_id !== userStoryGroup.user?.user_id && (
                <View style={styles.storyReplyBox}>
                  <TextInput
                    value={replyText}
                    onChangeText={setReplyText}
                    placeholder="Hikayeye özel mesaj gönder..."
                    placeholderTextColor={theme.textMuted}
                    style={styles.storyReplyInput}
                  />
                  <TouchableOpacity
                    onPress={sendStoryReply}
                    disabled={replyBusy || !replyText.trim()}
                    style={styles.storySendBtn}
                  >
                    <Ionicons name="paper-plane" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </SafeAreaView>
      </Modal>

      {/* AI Compatibility Report Modal */}
      <Modal visible={aiReportModal} animationType="slide" onRequestClose={() => setAiReportModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t("ai_report_title")}</Text>
            <TouchableOpacity onPress={() => setAiReportModal(false)} style={{ padding: 6 }}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {aiReportData && (
            <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
              <View style={styles.scoreCircle}>
                <Text style={styles.scoreNumber}>%{aiReportData.compatibility_score}</Text>
                <Text style={styles.scoreLabel}>{t("ai_report_score_label")}</Text>
              </View>

              <View style={styles.reportSection}>
                <Text style={styles.reportHead}>{t("ai_report_why")}</Text>
                <Text style={styles.reportBody}>{aiReportData.report.why_match}</Text>
              </View>

              <View style={styles.reportSection}>
                <Text style={styles.reportHead}>{t("ai_report_common")}</Text>
                <Text style={styles.reportBody}>{aiReportData.report.common_vibe}</Text>
              </View>

              <View style={styles.reportSection}>
                <Text style={styles.reportHead}>{t("ai_report_date")}</Text>
                <Text style={styles.reportBody}>{aiReportData.report.date_idea}</Text>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, justifyContent: "space-between" },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: theme.text, fontSize: 17, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  banner: { position: "absolute", top: 0, left: 0, right: 0, height: 160 },
  head: { alignItems: "center", paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg },
  storyBadge: {
    position: "absolute",
    bottom: -6,
    alignSelf: "center",
    backgroundColor: theme.rose,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  storyBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  name: { color: theme.text, fontSize: 26, fontWeight: "900", marginTop: spacing.md, letterSpacing: -0.5 },
  age: { fontWeight: "400", color: theme.textDim },
  handle: { color: theme.textDim, marginTop: 2 },
  vibePill: {
    marginTop: 10, paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill,
    backgroundColor: "rgba(244,63,94,0.12)", borderWidth: 1, borderColor: "rgba(244,63,94,0.3)",
  },
  vibeText: { color: theme.rose, fontWeight: "700", fontSize: 13 },
  spotifyWidget: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(29, 185, 84, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(29, 185, 84, 0.3)",
  },
  spotifyText: { color: "#1DB954", fontSize: 12, fontWeight: "700" },
  askBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
  askBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  askBox: {
    width: "100%",
    backgroundColor: theme.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.4)",
  },
  askBoxTitle: { color: theme.text, fontSize: 13, fontWeight: "700", marginBottom: 6 },
  askInput: {
    backgroundColor: theme.surface,
    color: theme.text,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: theme.border,
  },
  askSubmitBtn: { marginTop: 10, borderRadius: radius.pill, overflow: "hidden" },
  askSubmitInner: { paddingVertical: 10, alignItems: "center" },
  askSubmitText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  aiReportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
  },
  aiReportText: { color: "#F59E0B", fontSize: 13, fontWeight: "700" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalTitle: { color: theme.text, fontSize: 18, fontWeight: "800" },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(244,63,94,0.15)",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: theme.rose,
  },
  scoreNumber: { color: theme.rose, fontSize: 32, fontWeight: "900" },
  scoreLabel: { color: theme.textDim, fontSize: 11, fontWeight: "700", marginTop: 2 },
  reportSection: {
    backgroundColor: theme.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 6,
  },
  reportHead: { color: theme.text, fontSize: 15, fontWeight: "800" },
  reportBody: { color: theme.textDim, fontSize: 14, lineHeight: 22 },
  bio: { color: theme.text, textAlign: "center", marginTop: spacing.md, fontSize: 15, lineHeight: 22 },
  metaRow: { flexDirection: "row", gap: 12, marginTop: spacing.md },
  meta: { color: theme.textDim, fontSize: 13 },
  interestsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.md, justifyContent: "center" },
  interestChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
  interestText: { color: theme.text, fontSize: 12, fontWeight: "600" },
  vibeBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 22, paddingVertical: 12, borderRadius: radius.pill },
  vibeBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  section: { color: theme.textDim, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: spacing.sm },
  gridPhoto: { width: 130, height: 170, borderRadius: radius.md, backgroundColor: theme.card },
  storyBarRow: { flexDirection: "row", gap: 4, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  storyBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)" },
  storyAuthorRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  storyBody: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.md },
  storyFullMedia: { width: "100%", height: 380, borderRadius: radius.lg, resizeMode: "contain" },
  storyCard: {
    padding: spacing.xl,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(244,63,94,0.4)",
    marginTop: 12,
    width: "100%",
  },
  storyCardText: { color: "#fff", fontSize: 20, fontWeight: "800", textAlign: "center", lineHeight: 28 },
  storyReplyBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: spacing.lg },
  storyReplyInput: { flex: 1, backgroundColor: theme.card, color: theme.text, paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: theme.border, fontSize: 14 },
  storySendBtn: { backgroundColor: theme.rose, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
