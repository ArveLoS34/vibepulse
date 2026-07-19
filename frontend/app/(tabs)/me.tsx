import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { useTranslation } from "@/src/i18n/LanguageContext";
import { LanguageSelectorModal } from "@/src/components/LanguageSelectorModal";
import { ChangelogModal } from "@/src/components/ChangelogModal";
import { api } from "@/src/lib/api";
import type { Post } from "@/src/components/PostCard";
import { PostCard } from "@/src/components/PostCard";
import { theme, radius, spacing } from "@/src/lib/theme";
import { Avatar } from "@/src/components/Avatar";

export default function MeScreen() {
  const router = useRouter();
  const { user, refresh, logout, deleteAccount, sendVerificationCode, verifyEmailCode } = useAuth();
  const { t } = useTranslation();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [questionsModalOpen, setQuestionsModalOpen] = useState(false);
  const [langModalOpen, setLangModalOpen] = useState(false);
  const [myQuestions, setMyQuestions] = useState<any[]>([]);
  const [replyText, setReplyText] = useState("");
  const [selectedQId, setSelectedQId] = useState<string | null>(null);

  // Email verification state
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [codeHint, setCodeHint] = useState<string | null>(null);
  const [changelogOpen, setChangelogOpen] = useState(false);

  const handleStartVerify = async () => {
    setVerifyBusy(true);
    try {
      const code = await sendVerificationCode();
      if (code) setCodeHint(code);
      setVerifyModalOpen(true);
    } catch (e: any) {
      alert(e?.message || "Doğrulama kodu gönderilemedi");
    } finally {
      setVerifyBusy(false);
    }
  };

  const handleConfirmCode = async () => {
    if (!verifyCode.trim()) return alert("Lütfen 6 haneli kodu girin");
    setVerifyBusy(true);
    try {
      await verifyEmailCode(verifyCode.trim());
      alert("E-posta adresiniz başarıyla doğrulandı! ✅");
      setVerifyModalOpen(false);
      setVerifyCode("");
      refresh();
    } catch (e: any) {
      alert(e?.message || "Doğrulama kodu geçersiz");
    } finally {
      setVerifyBusy(false);
    }
  };

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
  const [userListModalOpen, setUserListModalOpen] = useState(false);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [userListTitle, setUserListTitle] = useState("");
  const [showInterests, setShowInterests] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const fetchAdminUsers = async (filter: "all" | "vip") => {
    try {
      setUserListTitle(filter === "vip" ? "⭐ Kayıtlı VIP Üyeler" : "👥 Tüm Kayıtlı Üyeler");
      const res = await api<{ users: any[] }>(`/admin/users?filter=${filter}`);
      setAdminUsers(res.users || []);
      setUserListModalOpen(true);
    } catch {
      alert("Kullanıcı listesi alınamadı.");
    }
  };

  const openAdminConsole = async () => {
    try {
      const res = await api<{ stats: any }>("/admin/stats");
      setAdminStatsData(res.stats);
      setAdminModalOpen(true);
    } catch {
      alert("Yönetici istatistikleri yüklenemedi");
    }
  };

  const handleUserRoleChange = async (action: "grant_vip" | "revoke_vip" | "grant_admin" | "revoke_admin") => {
    if (!targetEmail.trim()) return alert("Lütfen kullanıcı e-postası girin");
    setPromoteBusy(true);
    try {
      const payload: any = { target_email: targetEmail.trim().toLowerCase() };
      if (action === "grant_vip") payload.make_premium = true;
      if (action === "revoke_vip") payload.make_premium = false;
      if (action === "grant_admin") payload.make_admin = true;
      if (action === "revoke_admin") payload.make_admin = false;

      const res = await api<{ message: string }>("/admin/promote-user", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      alert(res.message);
    } catch (e: any) {
      alert(e?.message || "İşlem gerçekleştirilemedi");
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
          testID="changelog-notebook-btn"
          style={styles.iconBtn}
          onPress={() => setChangelogOpen(true)}
        >
          <Ionicons name="journal-outline" size={20} color={theme.text} />
        </TouchableOpacity>
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
          <TouchableOpacity onPress={() => user.photos?.[0] ? setZoomedImage(user.photos[0]) : null}>
            <Avatar uri={user.photos?.[0]} name={user.name || ""} size={110} ring />
          </TouchableOpacity>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md }}>
            <Text style={styles.name}>
              {user.name}{user.age ? <Text style={styles.age}> {user.age}</Text> : null}
            </Text>

            {/* Founder Yellow Crown Tick Badge */}
            {(user.is_founder || user.email?.toLowerCase() === "ertackeser3453@gmail.com") ? (
              <TouchableOpacity onPress={() => alert("👑 VibePulse Kurucusu & Sahibi")} style={{ paddingHorizontal: 2 }}>
                <Ionicons name="sparkles" size={22} color="#FFD700" />
              </TouchableOpacity>
            ) : null}

            {/* Email Verification Green Tick */}
            <TouchableOpacity
              onPress={user.is_email_verified ? () => alert("✅ E-posta Adresi Doğrulanmış Güvenli Hesap") : handleStartVerify}
              disabled={verifyBusy}
            >
              <Ionicons
                name={user.is_email_verified ? "checkmark-circle" : "alert-circle"}
                size={22}
                color={user.is_email_verified ? "#10B981" : "#F59E0B"}
              />
            </TouchableOpacity>

            {/* VIP Orange Verification Tick */}
            {user.is_premium ? (
              <TouchableOpacity onPress={() => alert("VibePulse Premium")}>
                <Ionicons name="checkmark-circle" size={22} color="#FF8C00" />
              </TouchableOpacity>
            ) : null}
          </View>

          <Text style={styles.handle}>@{user.handle}</Text>

          {user.vibe_status ? (
            <View style={styles.vibePill}>
              <Text style={styles.vibeText}>✨ {user.vibe_status}</Text>
            </View>
          ) : null}

          {/* Relationship Goal / Niyet Badge */}
          {user.relationship_goal ? (
            <View style={styles.intentPill}>
              <Text style={styles.intentPillText}>🎯 Niyet: {user.relationship_goal}</Text>
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

          {/* Instagram Deep Link Button (Item 12) */}
          {user.instagram_handle ? (
            <TouchableOpacity
              onPress={() => {
                const clean = user.instagram_handle.replace(/^@+/, "");
                Linking.openURL(`https://instagram.com/${clean}`);
              }}
              style={styles.instaBtn}
            >
              <Ionicons name="logo-instagram" size={16} color="#E1306C" />
              <Text style={styles.instaBtnText}>@{user.instagram_handle.replace(/^@+/, "")}</Text>
            </TouchableOpacity>
          ) : null}
          {user.city ? (
            <Text style={styles.meta}>
              <Ionicons name="location-outline" size={12} color={theme.cyan} /> {user.city}
            </Text>
          ) : null}

          {user.interests && user.interests.length > 0 ? (
            <View style={{ width: "100%", marginTop: spacing.md, alignItems: "center" }}>
              <TouchableOpacity
                onPress={() => setShowInterests(!showInterests)}
                style={styles.interestsToggleBtn}
              >
                <Ionicons name="sparkles" size={14} color="#8B5CF6" />
                <Text style={styles.interestsToggleText}>
                  İlgi Alanları ({user.interests.length}) {showInterests ? "▲" : "▼"}
                </Text>
              </TouchableOpacity>

              {showInterests ? (
                <View style={styles.interestsRow}>
                  {user.interests.map((i) => (
                    <View key={i} style={styles.interestChip}>
                      <Text style={styles.interestText}>{i}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
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
                <TouchableOpacity key={i} onPress={() => setZoomedImage(p)}>
                  <Image source={{ uri: p }} style={styles.gridPhoto} />
                </TouchableOpacity>
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

      {/* Email Verification Modal */}
      <Modal visible={verifyModalOpen} animationType="slide" onRequestClose={() => setVerifyModalOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>📧 E-posta Doğrulama</Text>
            <TouchableOpacity onPress={() => setVerifyModalOpen(false)} style={{ padding: 6 }}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <View style={{ padding: spacing.xl, gap: spacing.lg }}>
            <Text style={{ color: theme.text, fontSize: 15, lineHeight: 22 }}>
              <Text style={{ fontWeight: "700" }}>{user.email}</Text> adresine 6 haneli doğrulama kodunuz iletildi.
            </Text>

            {codeHint ? (
              <View style={{ backgroundColor: "rgba(16,185,129,0.15)", padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: "#10B981" }}>
                <Text style={{ color: "#10B981", fontWeight: "700", textAlign: "center" }}>
                  🔑 Kodunuz: {codeHint}
                </Text>
              </View>
            ) : null}

            <TextInput
              value={verifyCode}
              onChangeText={setVerifyCode}
              placeholder="6 Haneli Kod"
              placeholderTextColor={theme.textMuted}
              keyboardType="number-pad"
              maxLength={6}
              style={[styles.promoteInput, { fontSize: 20, textAlign: "center", letterSpacing: 6 }]}
            />

            <TouchableOpacity
              onPress={handleConfirmCode}
              disabled={verifyBusy || !verifyCode.trim()}
              style={[styles.promoteSubmitBtn, (verifyBusy || !verifyCode.trim()) ? { opacity: 0.5 } : null]}
            >
              <LinearGradient
                colors={[theme.rose, "#8B5CF6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ paddingVertical: 12, alignItems: "center", borderRadius: radius.pill }}
              >
                <Text style={{ color: "#fff", fontWeight: "800" }}>
                  {verifyBusy ? "Doğrulanıyor..." : "Doğrula & Onayla ✅"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

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
                <TouchableOpacity onPress={() => fetchAdminUsers("all")} style={styles.statCard}>
                  <Text style={styles.statVal}>{adminStatsData.total_users}</Text>
                  <Text style={styles.statLbl}>Kullanıcı (Tıkla 📋)</Text>
                </TouchableOpacity>
                <View style={styles.statCard}>
                  <Text style={styles.statVal}>{adminStatsData.total_posts}</Text>
                  <Text style={styles.statLbl}>Gönderi</Text>
                </View>
                <TouchableOpacity onPress={() => fetchAdminUsers("vip")} style={styles.statCard}>
                  <Text style={styles.statVal}>{adminStatsData.premium_users}</Text>
                  <Text style={styles.statLbl}>VIP Üye (Tıkla 🌟)</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.promoteBox}>
              <Text style={styles.promoteTitle}>👑 Üye Yetki Yönetimi (VIP & Admin)</Text>
              <Text style={styles.promoteSub}>İşlem yapmak istediğiniz kullanıcının e-posta adresini girip istediğiniz aksiyon butonuna tıklayın:</Text>
              <TextInput
                value={targetEmail}
                onChangeText={setTargetEmail}
                placeholder="kullanici@email.com"
                placeholderTextColor={theme.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.promoteInput}
              />

              <View style={{ gap: 10, marginTop: 10 }}>
                {/* VIP Roles Row */}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => handleUserRoleChange("grant_vip")}
                    disabled={promoteBusy || !targetEmail.trim()}
                    style={[{ flex: 1, backgroundColor: "rgba(245, 158, 11, 0.2)", paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: "#F59E0B", alignItems: "center" }, (promoteBusy || !targetEmail.trim()) && { opacity: 0.4 }]}
                  >
                    <Text style={{ color: "#F59E0B", fontWeight: "800", fontSize: 13 }}>⭐ VIP Üyelik Ver</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleUserRoleChange("revoke_vip")}
                    disabled={promoteBusy || !targetEmail.trim()}
                    style={[{ flex: 1, backgroundColor: "rgba(239, 68, 68, 0.15)", paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: theme.danger, alignItems: "center" }, (promoteBusy || !targetEmail.trim()) && { opacity: 0.4 }]}
                  >
                    <Text style={{ color: theme.danger, fontWeight: "800", fontSize: 13 }}>🚫 VIP Üyelik Kaldır</Text>
                  </TouchableOpacity>
                </View>

                {/* Admin Roles Row */}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => handleUserRoleChange("grant_admin")}
                    disabled={promoteBusy || !targetEmail.trim()}
                    style={[{ flex: 1, backgroundColor: "rgba(16, 185, 129, 0.2)", paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: "#10B981", alignItems: "center" }, (promoteBusy || !targetEmail.trim()) && { opacity: 0.4 }]}
                  >
                    <Text style={{ color: "#10B981", fontWeight: "800", fontSize: 13 }}>👑 Yönetici Yetkisi Ver</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleUserRoleChange("revoke_admin")}
                    disabled={promoteBusy || !targetEmail.trim()}
                    style={[{ flex: 1, backgroundColor: "rgba(239, 68, 68, 0.15)", paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: theme.danger, alignItems: "center" }, (promoteBusy || !targetEmail.trim()) && { opacity: 0.4 }]}
                  >
                    <Text style={{ color: theme.danger, fontWeight: "800", fontSize: 13 }}>❌ Yöneticiliği Kaldır</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Admin Registered Users List Modal */}
      <Modal visible={userListModalOpen} animationType="slide" onRequestClose={() => setUserListModalOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{userListTitle}</Text>
            <TouchableOpacity onPress={() => setUserListModalOpen(false)} style={{ padding: 6 }}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={adminUsers}
            keyExtractor={(item) => item.user_id}
            contentContainerStyle={{ padding: spacing.lg, gap: 12 }}
            renderItem={({ item }) => (
              <View style={styles.adminUserCard}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ color: theme.text, fontWeight: "800", fontSize: 15 }}>{item.name}</Text>
                    {item.is_founder ? <Text style={{ color: "#F59E0B", fontSize: 11, fontWeight: "900" }}>👑 Kurucu</Text> : null}
                    {item.is_admin ? <Text style={{ color: "#10B981", fontSize: 11, fontWeight: "800" }}>🛡️ Admin</Text> : null}
                    {item.is_premium ? <Text style={{ color: "#F59E0B", fontSize: 11, fontWeight: "800" }}>⭐ VIP</Text> : null}
                  </View>
                  <Text style={{ color: theme.cyan, fontSize: 12, fontWeight: "700", marginTop: 2 }}>@{item.handle}</Text>
                  <Text style={{ color: theme.textDim, fontSize: 12, marginTop: 2 }}>📧 {item.email}</Text>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    setTargetEmail(item.email);
                    setUserListModalOpen(false);
                  }}
                  style={{ backgroundColor: "rgba(244,63,94,0.15)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: theme.rose }}
                >
                  <Text style={{ color: theme.rose, fontWeight: "700", fontSize: 11 }}>Yetkilendir ✏️</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* Full Screen Photo Zoom Modal */}
      <Modal visible={!!zoomedImage} transparent animationType="fade" onRequestClose={() => setZoomedImage(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" }}>
          <TouchableOpacity onPress={() => setZoomedImage(null)} style={{ position: "absolute", top: 40, right: 20, zIndex: 10, padding: 10 }}>
            <Ionicons name="close-circle" size={36} color="#fff" />
          </TouchableOpacity>
          {zoomedImage ? <Image source={{ uri: zoomedImage }} style={{ width: "95%", height: "80%", resizeMode: "contain" }} /> : null}
        </View>
      </Modal>

      <LanguageSelectorModal visible={langModalOpen} onClose={() => setLangModalOpen(false)} />
      <ChangelogModal visible={changelogOpen} onClose={() => setChangelogOpen(false)} />
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
  emailPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginTop: 6,
    borderWidth: 1,
    borderColor: theme.border,
  },
  emailPillText: { fontSize: 11, fontWeight: "700" },
  vibePill: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: "rgba(244,63,94,0.12)",
    borderWidth: 1,
    borderColor: "rgba(244,63,94,0.3)",
  },
  instaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(225, 48, 108, 0.15)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(225, 48, 108, 0.3)",
  },
  instaBtnText: { color: "#E1306C", fontSize: 13, fontWeight: "700" },
  founderBanner: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: "rgba(245,158,11,0.2)",
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  founderBannerText: { color: "#F59E0B", fontWeight: "900", fontSize: 12 },
  vibeText: { color: theme.rose, fontWeight: "700", fontSize: 13 },
  intentPill: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: "rgba(139,92,246,0.15)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.4)",
  },
  intentPillText: { color: "#8B5CF6", fontWeight: "800", fontSize: 12 },
  bio: { color: theme.text, textAlign: "center", marginTop: spacing.md, fontSize: 15, lineHeight: 22 },
  meta: { color: theme.textDim, marginTop: spacing.md, fontSize: 13 },
  interestsToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
  },
  interestsToggleText: { color: "#8B5CF6", fontWeight: "800", fontSize: 13 },
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
  adminUserCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 12,
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
