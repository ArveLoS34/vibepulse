import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { PostCard, Post } from "@/src/components/PostCard";
import { ComposeModal } from "@/src/components/ComposeModal";
import { ChangelogModal } from "@/src/components/ChangelogModal";
import { Avatar } from "@/src/components/Avatar";
import { api } from "@/src/lib/api";
import { storage } from "@/src/utils/storage";
import { useAuth } from "@/src/context/AuthContext";
import { theme, radius, spacing } from "@/src/lib/theme";

const HASHTAGS = ["Tüm", "Yazılım", "Müzik", "Kahve", "Gece", "Sanat", "Eğlence"];
const CURRENT_APP_VERSION = "v2.7.0";

export default function FeedScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [signals, setSignals] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [liveRooms, setLiveRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string>("Tüm");
  const [err, setErr] = useState<string | null>(null);

  // Live Audio Room State
  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [roomTitle, setRoomTitle] = useState("");
  const [roomCategory, setRoomCategory] = useState("Sohbet & Vibe 🎵");
  const [createRoomBusy, setCreateRoomBusy] = useState(false);
  const [activeLounge, setActiveLounge] = useState<any | null>(null);
  const [loungeMessage, setLoungeMessage] = useState("");
  const [loungeChat, setLoungeChat] = useState<any[]>([]);
  const [raisedHand, setRaisedHand] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const loungePollRef = useRef<any>(null);

  useEffect(() => {
    if (!activeLounge?.room_id) {
      clearInterval(loungePollRef.current);
      return;
    }

    const pollLounge = async () => {
      try {
        const res = await api<{ room: any }>(`/live-rooms/${activeLounge.room_id}`);
        if (res.room) {
          if (res.room.chat_messages && Array.isArray(res.room.chat_messages)) {
            setLoungeChat(res.room.chat_messages);
          }
          setActiveLounge((prev: any) => ({ ...prev, ...res.room }));
        }
      } catch {}
    };

    pollLounge();
    loungePollRef.current = setInterval(pollLounge, 2000);
    return () => clearInterval(loungePollRef.current);
  }, [activeLounge?.room_id]);

  // Story state
  const [addStoryOpen, setAddStoryOpen] = useState(false);
  const [storyText, setStoryText] = useState("");
  const [storyMedia, setStoryMedia] = useState<string | null>(null);
  const [storyBusy, setStoryBusy] = useState(false);
  const [activeStoryGroup, setActiveStoryGroup] = useState<any | null>(null);
  const [activeStoryIdx, setActiveStoryIdx] = useState(0);
  const [storyReplyText, setStoryReplyText] = useState("");
  const [storyReplyBusy, setStoryReplyBusy] = useState(false);
  const [viewedStoryUserIds, setViewedStoryUserIds] = useState<string[]>([]);

  // Notification Center state
  const [notifModalOpen, setNotifModalOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);

  const loadNotifications = async () => {
    try {
      const res = await api<{ notifications: any[]; unread_count: number }>("/notifications");
      setNotifications(res.notifications || []);
      setUnreadNotifsCount(res.unread_count || 0);
    } catch {}
  };

  const loadLiveRooms = async () => {
    try {
      const res = await api<{ live_rooms: any[] }>("/live-rooms");
      setLiveRooms(res.live_rooms || []);
    } catch {}
  };

  const markNotifsRead = async () => {
    try {
      await api("/notifications/read-all", { method: "POST" });
      setUnreadNotifsCount(0);
      loadNotifications();
    } catch {}
  };

  const pickStoryMedia = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return alert("Galeri izni gerekli");

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!res.canceled && res.assets[0]?.base64) {
      const mime = res.assets[0].mimeType || "image/jpeg";
      setStoryMedia(`data:${mime};base64,${res.assets[0].base64}`);
    }
  };

  const takeStoryMediaCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return alert("Kamera izni gerekli");

    const res = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!res.canceled && res.assets[0]?.base64) {
      const mime = res.assets[0].mimeType || "image/jpeg";
      setStoryMedia(`data:${mime};base64,${res.assets[0].base64}`);
    }
  };

  const handlePickStoryMediaOptions = () => {
    Alert.alert(
      "Hikaye İçin Medya Ekle",
      "Fotoğraf veya videoyu nasıl eklemek istersiniz?",
      [
        { text: "📷 Kamera İle Çek", onPress: takeStoryMediaCamera },
        { text: "🖼️ Galeriden Seç", onPress: pickStoryMedia },
        { text: "İptal", style: "cancel" },
      ]
    );
  };

  const load = useCallback(async () => {
    try {
      const url = selectedTag && selectedTag !== "Tüm"
        ? `/posts/feed?tag=${encodeURIComponent(selectedTag)}`
        : "/posts/feed";
      const res = await api<{ posts: Post[] }>(url);
      setPosts(res.posts);

      const sigRes = await api<{ signals: any[] }>("/signals");
      setSignals(sigRes.signals || []);

      const storyRes = await api<{ stories_feed: any[] }>("/stories");
      setStories(storyRes.stories_feed || []);

      loadNotifications();
      loadLiveRooms();
      setErr(null);
    } catch (e: any) {
      setErr(e?.message || "Feed yüklenemedi");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedTag]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleStartLiveRoom = () => {
    if (!user?.is_premium && !user?.is_admin) {
      alert("🎙️ VIP Canlı Ses Odası Başlatma Ayrıcalığı\n\nKendi sesli yayın odanı açıp yayın yapmak için VibePulse Premium üyesi olmalısın!");
      router.push("/premium");
      return;
    }
    setCreateRoomOpen(true);
  };

  const submitCreateRoom = async () => {
    if (!roomTitle.trim()) return alert("Lütfen oda başlığı girin.");
    if (roomTitle.trim().length < 3) return alert("Oda başlığı en az 3 karakter olmalıdır.");
    setCreateRoomBusy(true);
    try {
      const res = await api<{ message: string; room: any }>("/live-rooms", {
        method: "POST",
        body: JSON.stringify({ title: roomTitle.trim(), category: roomCategory }),
      });
      alert(res.message);
      setCreateRoomOpen(false);
      setRoomTitle("");
      setActiveLounge(res.room);
      if (res.room?.chat_messages) setLoungeChat(res.room.chat_messages);
      loadLiveRooms();
    } catch (e: any) {
      alert(e?.message || "Oda oluşturulamadı.");
    } finally {
      setCreateRoomBusy(false);
    }
  };

  const closeActiveLounge = async () => {
    if (!activeLounge) return;
    if (loungePollRef.current) {
      clearInterval(loungePollRef.current);
      loungePollRef.current = null;
    }
    const targetRoomId = activeLounge.room_id;
    const isHost = activeLounge.host_id === user?.user_id || user?.is_admin;
    setActiveLounge(null);
    setLoungeChat([]);
    setRaisedHand(false);
    if (isHost) {
      try {
        await api(`/live-rooms/${targetRoomId}`, { method: "DELETE" });
      } catch {}
    }
    loadLiveRooms();
  };

  const sendLoungeChat = async () => {
    if (!loungeMessage.trim() || !activeLounge) return;
    const msgText = loungeMessage.trim();
    setLoungeMessage("");
    try {
      const res = await api<{ message: any }>(`/live-rooms/${activeLounge.room_id}/messages`, {
        method: "POST",
        body: JSON.stringify({ text: msgText }),
      });
      setLoungeChat((prev) => [...prev, res.message]);
    } catch {
      const fallback = {
        id: String(Date.now()),
        sender: user?.name || user?.handle || "Kullanıcı",
        text: msgText,
      };
      setLoungeChat((prev) => [...prev, fallback]);
    }
  };

  const clearReadNotifs = async () => {
    try {
      await api("/notifications/clear-read", { method: "DELETE" });
      loadNotifications();
    } catch {}
  };

  const handleRaiseHand = async () => {
    if (!activeLounge) return;
    try {
      await api(`/live-rooms/${activeLounge.room_id}/raise-hand`, { method: "POST" });
      setRaisedHand(true);
      alert("Yayıncıya konuşma isteğiniz iletildi! ✋");
    } catch {
      alert("İstek gönderilemedi.");
    }
  };

  const handleApproveSpeaker = async (targetUserId: string, action: "approve" | "reject") => {
    if (!activeLounge) return;
    try {
      await api(`/live-rooms/${activeLounge.room_id}/approve-speaker`, {
        method: "POST",
        body: JSON.stringify({ target_user_id: targetUserId, action }),
      });
      alert(action === "approve" ? "Konuşmacı sahneye davet edildi! 🎙️" : "İstek reddedildi.");
    } catch {}
  };

  const handleNotifPress = (item: any) => {
    setNotifModalOpen(false);
    if (item.actor?.post_id || item.type === "like" || item.type === "comment") {
      const pId = item.actor?.post_id;
      if (pId) router.push({ pathname: "/post/[id]", params: { id: pId } });
    } else if (item.actor?.match_id || item.type === "message" || item.type === "story_reply" || item.type === "venue_suggestion") {
      const mId = item.actor?.match_id;
      if (mId) router.push({ pathname: "/chat/[matchId]", params: { matchId: mId } });
    } else if (item.actor?.user_id) {
      router.push({ pathname: "/profile/[id]", params: { id: item.actor.user_id } });
    }
  };

  useEffect(() => {
    async function loadSavedViewedStories() {
      try {
        const saved = await storage.getItem<string[]>("vibepulse.viewed_stories", []);
        if (saved && Array.isArray(saved)) setViewedStoryUserIds(saved);

        const lastSeenVer = await storage.getItem<string>("vibepulse.last_seen_version", "");
        if (lastSeenVer !== CURRENT_APP_VERSION) {
          setShowUpdateBanner(true);
        }
      } catch {}
    }
    loadSavedViewedStories();
  }, []);

  const handleDismissUpdateBanner = async () => {
    setShowUpdateBanner(false);
    await storage.setItem("vibepulse.last_seen_version", CURRENT_APP_VERSION);
    setChangelogOpen(true);
  };

  const openStoryViewer = (group: any) => {
    if (group.user?.user_id) {
      setViewedStoryUserIds((prev) => {
        const next = Array.from(new Set([...prev, group.user.user_id]));
        storage.setItem("vibepulse.viewed_stories", next);
        return next;
      });
    }
    const sortedStories = [...(group.stories || [])].sort(
      (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    setActiveStoryGroup({ ...group, stories: sortedStories });
    setActiveStoryIdx(0);
    setStoryReplyText("");
  };

  const goToNextStoryOrUser = () => {
    if (!activeStoryGroup) return;
    if (activeStoryIdx < activeStoryGroup.stories.length - 1) {
      setActiveStoryIdx((i) => i + 1);
    } else {
      const currentGroupIdx = stories.findIndex(
        (st) => st.user?.user_id === activeStoryGroup.user?.user_id
      );
      if (currentGroupIdx !== -1 && currentGroupIdx < stories.length - 1) {
        openStoryViewer(stories[currentGroupIdx + 1]);
      } else {
        setActiveStoryGroup(null);
      }
    }
  };

  const goToPrevStoryOrUser = () => {
    if (!activeStoryGroup) return;
    if (activeStoryIdx > 0) {
      setActiveStoryIdx((i) => i - 1);
    } else {
      const currentGroupIdx = stories.findIndex(
        (st) => st.user?.user_id === activeStoryGroup.user?.user_id
      );
      if (currentGroupIdx > 0) {
        openStoryViewer(stories[currentGroupIdx - 1]);
      }
    }
  };

  const [speedModalOpen, setSpeedModalOpen] = useState(false);
  const [speedStatus, setSpeedStatus] = useState<"waiting" | "matched" | "idle">("idle");
  const [speedTimerSec, setSpeedTimerSec] = useState(0);
  const speedPollRef = useRef<any>(null);
  const speedTimerRef = useRef<any>(null);

  const joinSpeedDating = async () => {
    const now = new Date();
    const hour = now.getHours();

    if (hour !== 21) {
      alert("Etkinlik henüz başlamadı! ⌛\n\nSesli Hızlı Eşleşme Seansı her akşam sadece saat 21:00 - 22:00 arasında gerçekleşmektedir.");
      return;
    }

    try {
      setSpeedModalOpen(true);
      setSpeedStatus("waiting");
      setSpeedTimerSec(0);

      const res = await api<{ matched: boolean; session?: any; message?: string }>("/speed-dating/join", {
        method: "POST",
        body: JSON.stringify({ preferred_gender: "everyone" }),
      });

      if (res.matched && res.session) {
        setSpeedStatus("matched");
        setTimeout(() => {
          setSpeedModalOpen(false);
          router.push({ pathname: "/chat/[matchId]", params: { matchId: res.session.match_id } });
        }, 1200);
      }
    } catch (e: any) {
      setSpeedModalOpen(false);
      alert(e?.message || "Etkinlik henüz başlamadı! ⌛");
    }
  };

  const leaveSpeedDating = async () => {
    try {
      await api("/speed-dating/leave", { method: "POST" });
    } catch {}
    setSpeedModalOpen(false);
    setSpeedStatus("idle");
    clearInterval(speedPollRef.current);
    clearInterval(speedTimerRef.current);
  };

  useEffect(() => {
    if (!speedModalOpen || speedStatus === "matched") return;

    speedTimerRef.current = setInterval(() => {
      setSpeedTimerSec((s) => s + 1);
    }, 1000);

    speedPollRef.current = setInterval(async () => {
      try {
        const res = await api<{ status: string; session?: any }>("/speed-dating/status");
        if (res.status === "matched" && res.session) {
          setSpeedStatus("matched");
          clearInterval(speedPollRef.current);
          clearInterval(speedTimerRef.current);
          setTimeout(() => {
            setSpeedModalOpen(false);
            router.push({ pathname: "/chat/[matchId]", params: { matchId: res.session.match_id } });
          }, 1200);
        }
      } catch {}
    }, 2000);

    return () => {
      clearInterval(speedPollRef.current);
      clearInterval(speedTimerRef.current);
    };
  }, [speedModalOpen, speedStatus]);

  const postStory = async () => {
    if (!storyText.trim() && !storyMedia) return alert("Lütfen yazı veya bir fotoğraf/video seçin.");
    setStoryBusy(true);
    try {
      await api("/stories", {
        method: "POST",
        body: JSON.stringify({ text: storyText.trim(), image: storyMedia || undefined }),
      });
      alert("24 Saatlik Vibe Hikayeniz paylaşıldı! 🌟");
      setStoryText("");
      setStoryMedia(null);
      setAddStoryOpen(false);
      load();
    } catch (e: any) {
      alert(e?.message || "Hikaye paylaşılamadı");
    } finally {
      setStoryBusy(false);
    }
  };

  const deleteActiveStory = async () => {
    if (!activeStoryGroup || !activeStoryGroup.stories[activeStoryIdx]) return;
    const stId = activeStoryGroup.stories[activeStoryIdx].story_id;
    try {
      await api(`/stories/${stId}`, { method: "DELETE" });
      alert("Hikaye silindi. 🗑️");
      setActiveStoryGroup(null);
      load();
    } catch (e: any) {
      alert(e?.message || "Hikaye silinemedi");
    }
  };

  const toggleLikeActiveStory = async () => {
    if (!activeStoryGroup || !activeStoryGroup.stories[activeStoryIdx]) return;
    const stId = activeStoryGroup.stories[activeStoryIdx].story_id;
    try {
      await api(`/stories/${stId}/like`, { method: "POST" });
      alert("Hikaye beğenildi! 💖");
    } catch {}
  };

  const sendStoryReply = async () => {
    if (!activeStoryGroup || !activeStoryGroup.stories[activeStoryIdx] || !storyReplyText.trim()) return;
    const stId = activeStoryGroup.stories[activeStoryIdx].story_id;
    setStoryReplyBusy(true);
    try {
      const res = await api<{ message: string; match_id: string }>(`/stories/${stId}/reply`, {
        method: "POST",
        body: JSON.stringify({ reply_text: storyReplyText.trim() }),
      });
      alert(res.message || "Yanıtınız özel mesaj olarak iletildi! 📩");
      setStoryReplyText("");
      setActiveStoryGroup(null);
    } catch (e: any) {
      alert(e?.message || "Yanıt iletilemedi");
    } finally {
      setStoryReplyBusy(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top"]}>
      <View style={styles.header} testID="feed-header">
        <View style={styles.brandRow}>
          <LinearGradient
            colors={[theme.rose, "#8B5CF6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logo}
          >
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "900", fontStyle: "italic" }}>V</Text>
          </LinearGradient>
          <Text style={styles.brand}>VibePulse</Text>

          {/* Notification Center Bell Icon & Notebook Defter Icon */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <TouchableOpacity
              onPress={() => setChangelogOpen(true)}
              style={styles.bellBtn}
              testID="changelog-notebook-btn"
            >
              <Ionicons name="journal-outline" size={22} color={theme.text} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                loadNotifications();
                setNotifModalOpen(true);
              }}
              style={styles.bellBtn}
            >
              <Ionicons name="notifications-outline" size={22} color={theme.text} />
              {unreadNotifsCount > 0 ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{unreadNotifsCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          </View>
        </View>

        {/* Live Version Update Notification Banner */}
        {showUpdateBanner ? (
          <TouchableOpacity onPress={handleDismissUpdateBanner} style={styles.updateBanner}>
            <Ionicons name="sparkles" size={18} color="#10B981" />
            <View style={{ flex: 1 }}>
              <Text style={styles.updateBannerTitle}>✨ VibePulse {CURRENT_APP_VERSION} Güncellendi!</Text>
              <Text style={styles.updateBannerSub}>Tüm yeni özellikleri ve düzeltmeleri görmek için dokunun 📖</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#10B981" />
          </TouchableOpacity>
        ) : null}

        {/* 24h Vibe Stories Circles Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: spacing.sm }}
          contentContainerStyle={{ gap: 14, paddingRight: spacing.md, alignItems: "center" }}
        >
          {/* Add My Story Ring */}
          <TouchableOpacity onPress={() => setAddStoryOpen(true)} style={styles.storyWrap}>
            <View style={styles.addStoryRing}>
              <Avatar uri={user?.photos?.[0]} name={user?.name || ""} size={48} />
              <View style={styles.plusBadge}>
                <Ionicons name="add" size={14} color="#fff" />
              </View>
            </View>
            <Text style={styles.storyName} numberOfLines={1}>Hikayen</Text>
          </TouchableOpacity>

          {/* User Stories */}
          {stories.map((st, i) => {
            const isViewed = st.user?.user_id && viewedStoryUserIds.includes(st.user.user_id);
            return (
              <TouchableOpacity key={i} onPress={() => openStoryViewer(st)} style={styles.storyWrap}>
                <LinearGradient
                  colors={isViewed ? ["#666666", "#CCCCCC"] : [theme.rose, "#8B5CF6"]}
                  style={styles.storyRing}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Avatar uri={st.user?.avatar} name={st.user?.name || "?"} size={48} />
                </LinearGradient>
                <Text style={[styles.storyName, isViewed && { color: theme.textMuted }]} numberOfLines={1}>
                  {st.user?.name?.split(" ")[0] || "Vibe"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* B4: Hashtag Chip Bar (Placed directly under Stories) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipBar}
          contentContainerStyle={{ gap: 8, paddingRight: spacing.md }}
        >
          {HASHTAGS.map((tag) => {
            const active = selectedTag === tag;
            return (
              <TouchableOpacity
                key={tag}
                onPress={() => setSelectedTag(tag)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {tag === "Tüm" ? "Tümü" : `#${tag}`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* TikTok Style VIP Live Audio Spaces Bar */}
        <View style={styles.liveSpaceSection}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <Text style={styles.liveSpaceSectionTitle}>🎙️ VibePlus Live Odaları</Text>
            <TouchableOpacity onPress={handleStartLiveRoom} style={styles.startRoomBtn}>
              <Ionicons name="radio" size={14} color="#fff" />
              <Text style={styles.startRoomBtnText}>Oda Aç (VIP)</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {liveRooms.map((room) => (
              <TouchableOpacity
                key={room.room_id}
                onPress={() => setActiveLounge(room)}
                style={styles.liveRoomCard}
              >
                <View style={styles.liveBadge}>
                  <Text style={styles.liveBadgeText}>🔴 CANLI</Text>
                </View>
                <Text style={styles.liveRoomCategory}>{room.category || "Sohbet"}</Text>
                <Text style={styles.liveRoomTitle} numberOfLines={1}>{room.title}</Text>
                <View style={styles.liveRoomHostRow}>
                  <Avatar uri={room.host?.avatar} name={room.host?.name || "Host"} size={24} />
                  <Text style={styles.liveRoomHostName} numberOfLines={1}>@{room.host?.handle || "yayıncı"}</Text>
                </View>
              </TouchableOpacity>
            ))}

            {liveRooms.length === 0 ? (
              <TouchableOpacity onPress={handleStartLiveRoom} style={styles.emptyLiveCard}>
                <Ionicons name="mic" size={24} color="#8B5CF6" />
                <Text style={{ color: theme.text, fontSize: 13, fontWeight: "700" }}>İlk VIP Canlı Ses Odasını Sen Aç!</Text>
                <Text style={{ color: theme.textDim, fontSize: 11 }}>30 dakikalık sohbet / müzik odası başlat</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        </View>

        {/* v2 Feature 1: Blind Speed Dating Event Banner */}
        <TouchableOpacity
          onPress={joinSpeedDating}
          style={styles.speedDatingBanner}
          testID="speed-dating-btn"
        >
          <LinearGradient
            colors={["rgba(139,92,246,0.3)", "rgba(244,63,94,0.3)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.speedDatingInner}
          >
            <Ionicons name="mic-circle" size={22} color="#F59E0B" />
            <View style={{ flex: 1 }}>
              <Text style={styles.speedTitle}>🎙️ 21:00 Sesli Hızlı Eşleşme</Text>
              <Text style={styles.speedSub}>3 dakikalık anonim sesli aramaya katıl.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Feature 3: Hangout Signals */}
        {signals.length > 0 && (
          <View style={styles.signalsSection}>
            <Text style={styles.signalsTitle}>📍 Canlı Buluşma Sinyalleri (6 Sa)</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingTop: 6 }}
            >
              {signals.map((s) => (
                <View key={s.signal_id} style={styles.signalCard}>
                  <Text style={styles.signalLoc}>📍 {s.location_name || "Kadıköy"}</Text>
                  <Text style={styles.signalText} numberOfLines={2}>{s.title}</Text>
                  <Text style={styles.signalAuthor}>@{s.author?.handle || "kullanıcı"}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.rose} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.post_id}
          renderItem={({ item }) => <PostCard post={item} />}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.rose} />}
          ListEmptyComponent={
            <View style={styles.empty} testID="feed-empty">
              <Ionicons name="planet-outline" size={48} color={theme.textMuted} />
              <Text style={styles.emptyTitle}>Feed sessiz</Text>
              <Text style={styles.emptyText}>İlk vibe'ı sen paylaş.</Text>
              {err ? <Text style={styles.err}>{err}</Text> : null}
            </View>
          }
        />
      )}

      <TouchableOpacity
        onPress={() => setComposeOpen(true)}
        testID="feed-compose-fab"
        style={styles.fab}
      >
        <LinearGradient
          colors={[theme.rose, "#8B5CF6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabInner}
        >
          <Ionicons name="add" size={30} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      <ComposeModal visible={composeOpen} onClose={() => setComposeOpen(false)} onPosted={load} />
      <ChangelogModal visible={changelogOpen} onClose={() => setChangelogOpen(false)} />

      {/* Create VIP Live Audio Room Modal */}
      <Modal visible={createRoomOpen} animationType="slide" onRequestClose={() => setCreateRoomOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>🎙️ VIP Canlı Ses Odası Aç</Text>
            <TouchableOpacity onPress={() => setCreateRoomOpen(false)} style={{ padding: 6 }}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <View style={{ padding: spacing.xl, gap: spacing.lg }}>
            <Text style={{ color: theme.textDim, fontSize: 14, lineHeight: 20 }}>
              Kendi canlı yayın odanı başlat! Diğer kullanıcılar oda katılarak seni dinleyebilir ve mesaj atabilir.
            </Text>

            <Text style={styles.labelTitle}>Oda Başlığı / Konusu</Text>
            <TextInput
              value={roomTitle}
              onChangeText={setRoomTitle}
              placeholder="Örn: Gece Müzik Sohbetleri & Kahve Vibe 🎵"
              placeholderTextColor={theme.textMuted}
              style={styles.inputField}
              maxLength={100}
            />

            <Text style={styles.labelTitle}>Kategori</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {["Sohbet & Vibe 🎵", "Müzik Dinletisi 🎸", "İlişki Tavsiyeleri 💖", "Yazılım & Teknoloji 💻"].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setRoomCategory(cat)}
                  style={[styles.catChip, roomCategory === cat && styles.catChipActive]}
                >
                  <Text style={[styles.catChipText, roomCategory === cat && styles.catChipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              onPress={submitCreateRoom}
              disabled={createRoomBusy || !roomTitle.trim()}
              style={{ marginTop: spacing.xl }}
            >
              <LinearGradient
                colors={[theme.rose, "#8B5CF6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ paddingVertical: 16, alignItems: "center", borderRadius: radius.pill }}
              >
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>
                  {createRoomBusy ? "Oda Açılıyor..." : "Canlı Yayını Başlat 🚀"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Full-Screen TikTok Style Live Audio Lounge Modal */}
      <Modal visible={!!activeLounge} animationType="slide" onRequestClose={closeActiveLounge}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0A0C", justifyContent: "space-between" }}>
          {activeLounge && (
            <>
              {/* Lounge Header */}
              <View style={styles.loungeHeader}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={styles.livePill}>
                      <Text style={styles.livePillText}>🔴 CANLI SES YAYINI</Text>
                    </View>
                    <Text style={{ color: theme.textDim, fontSize: 12 }}>👥 {activeLounge.listeners_count || 1} Dinleyici</Text>
                  </View>
                  <Text style={styles.loungeTitle}>{activeLounge.title}</Text>
                </View>
                <TouchableOpacity onPress={closeActiveLounge} style={styles.leaveLoungeBtn}>
                  <Text style={{ color: theme.danger, fontWeight: "800", fontSize: 13 }}>
                    {activeLounge.host_id === user?.user_id ? "Odayı Bitir" : "Ayrıl"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Stage Speaker Grid (TikTok / Clubhouse Style) */}
              <View style={styles.loungeStage}>
                {/* Active Mic Status Banner */}
                <View style={{ marginBottom: 12, paddingHorizontal: 16, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: micMuted ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)" }}>
                  <Ionicons name={micMuted ? "mic-off" : "mic"} size={16} color={micMuted ? theme.danger : "#10B981"} />
                  <Text style={{ color: micMuted ? theme.danger : "#10B981", fontWeight: "800", fontSize: 12 }}>
                    {micMuted ? "🔇 Mikrofonunuz Kapalı" : "🔊 Canlı Mikrofon Açık — Sesiniz İletiliyor"}
                  </Text>
                </View>

                {/* Host Pending Speak Requests Banner (Item 8) */}
                {activeLounge.host_id === user?.user_id && activeLounge.raised_hands && activeLounge.raised_hands.length > 0 ? (
                  <View style={styles.raiseRequestBox}>
                    <Text style={styles.raiseRequestTitle}>✋ Konuşma İstekleri ({activeLounge.raised_hands.length}):</Text>
                    {activeLounge.raised_hands.map((rh: any) => (
                      <View key={rh.user_id} style={styles.raiseRequestRow}>
                        <Text style={styles.raiseRequestName}>{rh.name} sahneye çıkmak istiyor</Text>
                        <View style={{ flexDirection: "row", gap: 6 }}>
                          <TouchableOpacity onPress={() => handleApproveSpeaker(rh.user_id, "approve")} style={styles.approveBtn}>
                            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 11 }}>İzin Ver 🟢</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleApproveSpeaker(rh.user_id, "reject")} style={styles.rejectBtn}>
                            <Text style={{ color: theme.danger, fontWeight: "800", fontSize: 11 }}>Reddet 🔴</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}

                <ScrollView contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", gap: 20, justifyContent: "center", paddingVertical: spacing.md }}>
                  {(activeLounge.speakers || [activeLounge.host]).map((spk: any, idx: number) => (
                    <View key={idx} style={styles.speakerBox}>
                      <LinearGradient
                        colors={!micMuted && spk.user_id === user?.user_id ? ["#10B981", "#06B6D4"] : [theme.rose, "#8B5CF6"]}
                        style={styles.speakingWaveRing}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <Avatar uri={spk.avatar} name={spk.name} size={70} />
                      </LinearGradient>
                      <Text style={styles.speakerName} numberOfLines={1}>{spk.name}</Text>
                      <Text style={styles.speakerRole}>{spk.is_host ? "👑 Yayıncı" : "🎙️ Konuşmacı"}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>

              {/* Room Live Chat Feed */}
              <View style={styles.loungeChatArea}>
                <ScrollView contentContainerStyle={{ gap: 6, paddingHorizontal: spacing.lg }} style={{ maxHeight: 180 }}>
                  {loungeChat.map((m) => (
                    <View key={m.id} style={styles.chatBubbleInline}>
                      <Text style={styles.chatSender}>@{m.sender}: </Text>
                      <Text style={styles.chatText}>{m.text}</Text>
                    </View>
                  ))}
                </ScrollView>

                {/* Bottom Interactive Controls */}
                <View style={styles.loungeBottomBar}>
                  <TouchableOpacity
                    onPress={() => setMicMuted(!micMuted)}
                    style={[styles.raiseHandBtn, micMuted && { backgroundColor: "rgba(239, 68, 68, 0.2)" }]}
                  >
                    <Ionicons name={micMuted ? "mic-off" : "mic"} size={18} color={micMuted ? theme.danger : "#10B981"} />
                  </TouchableOpacity>

                  <TextInput
                    value={loungeMessage}
                    onChangeText={setLoungeMessage}
                    placeholder="Odaya mesaj yaz..."
                    placeholderTextColor={theme.textMuted}
                    style={styles.loungeChatInput}
                  />
                  <TouchableOpacity onPress={sendLoungeChat} style={styles.loungeSendBtn}>
                    <Ionicons name="send" size={18} color="#fff" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleRaiseHand}
                    style={[styles.raiseHandBtn, raisedHand && { backgroundColor: theme.amber }]}
                  >
                    <Text style={{ fontSize: 18 }}>✋</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </SafeAreaView>
      </Modal>

      {/* Add Story Modal with Photo & Video Picker */}
      <Modal visible={addStoryOpen} animationType="slide" onRequestClose={() => setAddStoryOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>✨ 24Sa Vibe Hikayesi Paylaş</Text>
            <TouchableOpacity onPress={() => setAddStoryOpen(false)} style={{ padding: 6 }}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
            {/* Story Media Preview */}
            {storyMedia ? (
              <View style={styles.mediaPreviewBox}>
                <Image source={{ uri: storyMedia }} style={styles.mediaPreviewImg} />
                <TouchableOpacity onPress={() => setStoryMedia(null)} style={styles.removeMediaBtn}>
                  <Ionicons name="close" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={handlePickStoryMediaOptions} style={styles.mediaSelectBtn}>
                <Ionicons name="camera-outline" size={32} color={theme.rose} />
                <Text style={styles.mediaSelectText}>📷 Fotoğraf veya Video Ekle (Kamera / Galeri)</Text>
              </TouchableOpacity>
            )}

            <TextInput
              value={storyText}
              onChangeText={setStoryText}
              placeholder="Hikayene bir yazı ekle... (İsteğe Bağlı)"
              placeholderTextColor={theme.textMuted}
              multiline
              maxLength={280}
              style={styles.storyInput}
            />

            <TouchableOpacity
              onPress={postStory}
              disabled={storyBusy || (!storyText.trim() && !storyMedia)}
              style={[(storyBusy || (!storyText.trim() && !storyMedia)) ? { opacity: 0.5 } : null]}
            >
              <LinearGradient
                colors={[theme.rose, "#8B5CF6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ paddingVertical: 16, alignItems: "center", borderRadius: radius.pill }}
              >
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>
                  {storyBusy ? "Paylaşılıyor..." : "Hikayemde Paylaş 🚀"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Full Screen Story Viewer Modal */}
      <Modal visible={!!activeStoryGroup} animationType="fade" onRequestClose={() => setActiveStoryGroup(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0A0C", justifyContent: "space-between" }}>
          {activeStoryGroup && (
            <>
              {/* Progress bar */}
              <View style={styles.storyBarRow}>
                {activeStoryGroup.stories.map((st: any, idx: number) => (
                  <View key={idx} style={[styles.storyBar, idx <= activeStoryIdx ? { backgroundColor: theme.rose } : null]} />
                ))}
              </View>

              {/* Author Header */}
              <View style={styles.storyAuthorRow}>
                <TouchableOpacity
                  onPress={() => {
                    const uId = activeStoryGroup.user?.user_id;
                    setActiveStoryGroup(null);
                    if (uId) router.push({ pathname: "/profile/[id]", params: { id: uId } });
                  }}
                  style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
                >
                  <Avatar uri={activeStoryGroup.user?.avatar} name={activeStoryGroup.user?.name || ""} size={42} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>{activeStoryGroup.user?.name}</Text>
                    <Text style={{ color: theme.textDim, fontSize: 12 }}>
                      @{activeStoryGroup.user?.handle} • {timeAgo(activeStoryGroup.stories[activeStoryIdx]?.created_at)} önce
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Delete Story Button if Owner */}
                {activeStoryGroup.user?.user_id === user?.user_id ? (
                  <TouchableOpacity onPress={deleteActiveStory} style={{ padding: 6, marginRight: 8 }}>
                    <Ionicons name="trash-outline" size={22} color={theme.danger} />
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity onPress={() => setActiveStoryGroup(null)} style={{ padding: 6 }}>
                  <Ionicons name="close" size={26} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Story Content Card with Photo/Video Media & Left/Right Swipe Areas */}
              <View style={styles.storyBody}>
                <TouchableOpacity onPress={goToPrevStoryOrUser} style={styles.storyNavLeftTouch} />
                <TouchableOpacity onPress={goToNextStoryOrUser} style={styles.storyNavRightTouch} />

                {activeStoryGroup.stories[activeStoryIdx]?.image ? (
                  <Image source={{ uri: activeStoryGroup.stories[activeStoryIdx].image }} style={styles.storyFullMedia} />
                ) : null}

                {activeStoryGroup.stories[activeStoryIdx]?.text ? (
                  <LinearGradient
                    colors={["rgba(244,63,94,0.15)", "rgba(139,92,246,0.25)"]}
                    style={styles.storyCard}
                  >
                    <Text style={styles.storyCardText}>
                      "{activeStoryGroup.stories[activeStoryIdx].text}"
                    </Text>
                  </LinearGradient>
                ) : null}
              </View>

              {/* Footer Reply & Like Box */}
              {activeStoryGroup.user?.user_id !== user?.user_id ? (
                <View style={styles.storyReplyRow}>
                  <TextInput
                    value={storyReplyText}
                    onChangeText={setStoryReplyText}
                    placeholder="Hikayeye özel mesaj gönder..."
                    placeholderTextColor={theme.textMuted}
                    style={styles.storyReplyInput}
                  />
                  <TouchableOpacity
                    onPress={sendStoryReply}
                    disabled={storyReplyBusy || !storyReplyText.trim()}
                    style={styles.storySendBtn}
                  >
                    <Ionicons name="paper-plane" size={18} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={toggleLikeActiveStory} style={styles.storyLikeBtn}>
                    <Ionicons name="heart" size={22} color={theme.rose} />
                  </TouchableOpacity>
                </View>
              ) : (
                /* Footer Navigation for Owner */
                <View style={styles.storyFooter}>
                  <TouchableOpacity
                    disabled={activeStoryIdx === 0}
                    onPress={() => setActiveStoryIdx((i) => i - 1)}
                    style={[styles.storyNavBtn, activeStoryIdx === 0 && { opacity: 0.3 }]}
                  >
                    <Ionicons name="chevron-back" size={24} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "700" }}>Önceki</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      if (activeStoryIdx < activeStoryGroup.stories.length - 1) {
                        setActiveStoryIdx((i) => i + 1);
                      } else {
                        setActiveStoryGroup(null);
                      }
                    }}
                    style={styles.storyNavBtn}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700" }}>
                      {activeStoryIdx < activeStoryGroup.stories.length - 1 ? "Sonraki" : "Kapat"}
                    </Text>
                    <Ionicons name="chevron-forward" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </SafeAreaView>
      </Modal>

      {/* Notification Center Panel Modal */}
      <Modal visible={notifModalOpen} animationType="slide" onRequestClose={() => setNotifModalOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>🔔 Bildirim Paneli</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {unreadNotifsCount > 0 ? (
                <TouchableOpacity onPress={markNotifsRead} style={styles.readAllBtn}>
                  <Text style={{ color: theme.rose, fontWeight: "700", fontSize: 11 }}>Tümünü Okundu İşaretle</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={clearReadNotifs} style={styles.clearReadBtn}>
                <Text style={{ color: theme.cyan, fontWeight: "700", fontSize: 11 }}>Okunanları Sil 🗑️</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setNotifModalOpen(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
          </View>

          <FlatList
            data={notifications}
            keyExtractor={(item) => item.notification_id}
            contentContainerStyle={{ padding: spacing.lg, gap: 12 }}
            ListEmptyComponent={
              <View style={{ padding: spacing.xxl, alignItems: "center" }}>
                <Ionicons name="notifications-off-outline" size={48} color={theme.textMuted} />
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: "700", marginTop: 12 }}>
                  Henüz bir bildirim yok
                </Text>
                <Text style={{ color: theme.textDim, fontSize: 13, textAlign: "center", marginTop: 4 }}>
                  Biri seni beğendiğinde, yorum yaptığında veya mesaj attığında burada görünecektir!
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleNotifPress(item)}
                style={[styles.notifCard, !item.read && styles.notifUnread]}
              >
                <Avatar uri={item.actor?.avatar} name={item.actor?.name || "Vibe"} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.notifTitle}>{item.title}</Text>
                  <Text style={styles.notifBody}>{item.body}</Text>
                  <Text style={styles.notifTime}>{timeAgo(item.created_at)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.textDim} />
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* v2 Feature 1: Speed Dating Radar / Lobi Modal */}
      <Modal visible={speedModalOpen} animationType="fade" transparent onRequestClose={leaveSpeedDating}>
        <View style={styles.speedBackdrop}>
          <View style={styles.speedSheet}>
            <View style={styles.radarCircle}>
              <Ionicons name="radio" size={48} color={speedStatus === "matched" ? "#10B981" : "#F59E0B"} />
            </View>

            <Text style={styles.speedLobbyTitle}>
              {speedStatus === "matched" ? "✨ Eşleşme Bulundu!" : "🎙️ Sesli Hızlı Eşleşme Lobi"}
            </Text>

            <Text style={styles.speedLobbySub}>
              {speedStatus === "matched"
                ? "3 dakikalık sesli sohbet pencerene aktarılıyorsun..."
                : `Benzer müzik/vibe zevklerine sahip partner aranıyor (${Math.floor(speedTimerSec / 60)}:${String(speedTimerSec % 60).padStart(2, "0")})`}
            </Text>

            {speedStatus === "waiting" && (
              <ActivityIndicator color={theme.rose} style={{ marginVertical: 12 }} />
            )}

            <TouchableOpacity onPress={leaveSpeedDating} style={styles.leaveSpeedBtn} testID="leave-speed-btn">
              <Text style={{ color: theme.danger, fontWeight: "700" }}>Sıradan Çık</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function timeAgo(iso?: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso).getTime();
    const diff = Math.max(0, Date.now() - d) / 1000;
    if (diff < 60) return "şimdi";
    if (diff < 3600) return `${Math.floor(diff / 60)}dk`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}sa`;
    return `${Math.floor(diff / 86400)}g`;
  } catch { return ""; }
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
    backgroundColor: "rgba(10,10,11,0.9)",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  updateBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  updateBannerTitle: { color: "#10B981", fontWeight: "800", fontSize: 12 },
  updateBannerSub: { color: theme.textDim, fontSize: 11, marginTop: 1 },
  logo: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  brand: { color: theme.text, fontWeight: "800", fontSize: 18, letterSpacing: -0.3, flex: 1 },
  bellBtn: { position: "relative", padding: 6 },
  unreadBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: theme.rose,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  unreadText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  storyWrap: { alignItems: "center", width: 58 },
  storyRing: { padding: 2, borderRadius: 28 },
  addStoryRing: { position: "relative" },
  plusBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: theme.rose,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: theme.bg,
  },
  storyName: { color: theme.textDim, fontSize: 11, fontWeight: "600", marginTop: 4, textAlign: "center" },
  liveSpaceSection: {
    marginTop: spacing.sm,
    backgroundColor: "rgba(139, 92, 246, 0.08)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.25)",
  },
  liveSpaceSectionTitle: { color: "#8B5CF6", fontSize: 12, fontWeight: "800" },
  startRoomBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: theme.rose },
  startRoomBtnText: { color: "#fff", fontWeight: "800", fontSize: 11 },
  liveRoomCard: { width: 140, backgroundColor: theme.card, padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: "rgba(139, 92, 246, 0.4)", position: "relative" },
  liveBadge: { position: "absolute", top: 6, right: 6, backgroundColor: "rgba(239,68,68,0.2)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill },
  liveBadgeText: { color: theme.danger, fontSize: 9, fontWeight: "900" },
  liveRoomCategory: { color: theme.textDim, fontSize: 10, fontWeight: "700" },
  liveRoomTitle: { color: theme.text, fontSize: 12, fontWeight: "800", marginTop: 4 },
  liveRoomHostRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  liveRoomHostName: { color: theme.cyan, fontSize: 11, fontWeight: "700", flex: 1 },
  emptyLiveCard: { width: 220, backgroundColor: theme.card, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center", gap: 6 },
  chipBar: { marginTop: spacing.sm },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  chipActive: {
    backgroundColor: theme.rose,
    borderColor: theme.rose,
  },
  chipText: { color: theme.textDim, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  speedDatingBanner: { marginTop: spacing.sm, borderRadius: radius.md, overflow: "hidden" },
  speedDatingInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
    borderRadius: radius.md,
  },
  speedTitle: { color: "#F59E0B", fontSize: 13, fontWeight: "800" },
  speedSub: { color: theme.textDim, fontSize: 11, marginTop: 1 },
  signalsSection: { marginTop: spacing.md },
  signalsTitle: { color: theme.rose, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8 },
  signalCard: {
    backgroundColor: theme.card,
    borderRadius: radius.md,
    padding: 10,
    width: 150,
    borderWidth: 1,
    borderColor: "rgba(244,63,94,0.3)",
  },
  signalLoc: { color: theme.cyan, fontSize: 11, fontWeight: "700" },
  signalText: { color: theme.text, fontSize: 12, fontWeight: "600", marginTop: 4, lineHeight: 16 },
  signalAuthor: { color: theme.textMuted, fontSize: 11, marginTop: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", padding: spacing.xxl, marginTop: 60, gap: 8 },
  emptyTitle: { color: theme.text, fontSize: 18, fontWeight: "700", marginTop: spacing.md },
  emptyText: { color: theme.textDim, fontSize: 14, textAlign: "center" },
  err: { color: theme.danger, marginTop: spacing.md },
  fab: { position: "absolute", right: 20, bottom: 20 },
  fabInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.rose,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalTitle: { color: theme.text, fontSize: 18, fontWeight: "800" },
  labelTitle: { color: theme.textDim, fontSize: 12, fontWeight: "800", textTransform: "uppercase", marginTop: 4 },
  inputField: { backgroundColor: theme.card, color: theme.text, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: theme.border, fontSize: 15 },
  catChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
  catChipActive: { borderColor: theme.rose, backgroundColor: "rgba(244,63,94,0.15)" },
  catChipText: { color: theme.textDim, fontSize: 13, fontWeight: "600" },
  catChipTextActive: { color: theme.rose, fontWeight: "800" },
  readAllBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: "rgba(244,63,94,0.15)" },
  clearReadBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: "rgba(6,182,212,0.15)" },
  mediaSelectBtn: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: theme.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.card,
  },
  mediaSelectText: { color: theme.text, fontWeight: "700", fontSize: 14 },
  mediaPreviewBox: { position: "relative", borderRadius: radius.lg, overflow: "hidden", height: 220, backgroundColor: "#000" },
  mediaPreviewImg: { width: "100%", height: "100%", resizeMode: "cover" },
  removeMediaBtn: { position: "absolute", top: 10, right: 10, backgroundColor: "rgba(0,0,0,0.7)", width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  storyInput: {
    backgroundColor: theme.card,
    color: theme.text,
    padding: 16,
    borderRadius: radius.lg,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: theme.border,
  },
  storyBarRow: { flexDirection: "row", gap: 4, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  storyBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)" },
  storyAuthorRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  storyBody: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.md, position: "relative" },
  storyNavLeftTouch: { position: "absolute", top: 0, bottom: 0, left: 0, width: "35%", zIndex: 10 },
  storyNavRightTouch: { position: "absolute", top: 0, bottom: 0, right: 0, width: "65%", zIndex: 10 },
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
  storyFooter: { flexDirection: "row", justifyContent: "space-between", padding: spacing.lg },
  storyNavBtn: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10 },
  storyReplyRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: spacing.lg },
  storyReplyInput: { flex: 1, backgroundColor: theme.card, color: theme.text, paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: theme.border, fontSize: 14 },
  storySendBtn: { backgroundColor: theme.rose, width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  storyLikeBtn: { backgroundColor: "rgba(244,63,94,0.15)", width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(244,63,94,0.4)" },
  notifCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.card,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.border,
  },
  notifUnread: { borderColor: theme.rose, backgroundColor: "rgba(244,63,94,0.08)" },
  notifTitle: { color: theme.text, fontWeight: "800", fontSize: 14 },
  notifBody: { color: theme.textDim, fontSize: 13, marginTop: 2 },
  notifTime: { color: theme.textMuted, fontSize: 11, marginTop: 4 },
  loungeHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: theme.border },
  livePill: { backgroundColor: "rgba(239, 68, 68, 0.2)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1, borderColor: "rgba(239, 68, 68, 0.4)" },
  livePillText: { color: theme.danger, fontWeight: "900", fontSize: 10 },
  loungeTitle: { color: theme.text, fontSize: 18, fontWeight: "900", marginTop: 4 },
  leaveLoungeBtn: { backgroundColor: "rgba(239,68,68,0.15)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: "rgba(239,68,68,0.3)" },
  loungeStage: { flex: 1, justifyContent: "center", alignItems: "center" },
  raiseRequestBox: { width: "90%", backgroundColor: theme.card, padding: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: "#F59E0B", marginBottom: 12, gap: 8 },
  raiseRequestTitle: { color: "#F59E0B", fontWeight: "800", fontSize: 13 },
  raiseRequestRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  raiseRequestName: { color: theme.text, fontSize: 12, fontWeight: "700" },
  approveBtn: { backgroundColor: "#10B981", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  rejectBtn: { backgroundColor: "rgba(239, 68, 68, 0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: "rgba(239, 68, 68, 0.3)" },
  speakerBox: { alignItems: "center", width: 90 },
  speakingWaveRing: { padding: 4, borderRadius: 40 },
  speakerName: { color: "#fff", fontWeight: "800", fontSize: 13, marginTop: 6 },
  speakerRole: { color: theme.cyan, fontSize: 10, fontWeight: "700", marginTop: 2 },
  loungeChatArea: { backgroundColor: theme.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingVertical: spacing.md },
  chatBubbleInline: { flexDirection: "row", alignItems: "center" },
  chatSender: { color: theme.rose, fontWeight: "800", fontSize: 12 },
  chatText: { color: theme.text, fontSize: 12 },
  loungeBottomBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  loungeChatInput: { flex: 1, backgroundColor: theme.surface, color: theme.text, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: theme.border, fontSize: 14 },
  loungeSendBtn: { backgroundColor: theme.rose, width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  raiseHandBtn: { backgroundColor: theme.card, width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.border },
  speedBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10,10,11,0.9)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  speedSheet: {
    width: "100%",
    backgroundColor: theme.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.4)",
  },
  radarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(245,158,11,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: "rgba(245,158,11,0.5)",
  },
  speedLobbyTitle: { color: theme.text, fontSize: 20, fontWeight: "900", textAlign: "center" },
  speedLobbySub: { color: theme.textDim, fontSize: 13, textAlign: "center", marginTop: 6 },
  leaveSpeedBtn: {
    marginTop: spacing.md,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: "rgba(239,68,68,0.12)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
  },
});
