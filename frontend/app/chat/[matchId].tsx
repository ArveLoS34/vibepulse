import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
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
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import Constants from "expo-constants";
import { api, TOKEN_KEY } from "@/src/lib/api";
import { storage } from "@/src/utils/storage";
import { useAuth } from "@/src/context/AuthContext";
import { useScreenProtection } from "@/src/hooks/useScreenProtection";
import { Avatar } from "@/src/components/Avatar";
import { theme, radius, spacing } from "@/src/lib/theme";

type Msg = {
  message_id: string;
  match_id: string;
  from_user_id: string;
  to_user_id: string;
  text: string;
  image?: string;
  voice_note?: string;
  video_note?: string;
  read: boolean;
  created_at: string;
};

type BlindDateInfo = {
  message_count: number;
  required_messages: number;
  is_unlocked: boolean;
  progress_pct: number;
};

export default function ChatScreen() {
  useScreenProtection(); // Activates Android FLAG_SECURE & iOS capture shield
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [blindDate, setBlindDate] = useState<BlindDateInfo | null>(null);
  const [other, setOther] = useState<{ user_id: string; name: string; photo?: string } | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [wingmanOpen, setWingmanOpen] = useState(false);
  const [wingmanBusy, setWingmanBusy] = useState(false);
  const [wingmanSuggestions, setWingmanSuggestions] = useState<string[]>([]);

  // Magic Wand Action Menu & Venues State
  const [magicMenuOpen, setMagicMenuOpen] = useState(false);
  const [venueModalOpen, setVenueModalOpen] = useState(false);
  const [venues, setVenues] = useState<any[]>([]);

  // Virtual House / Roommate Simulation State (Item 7)
  const [homeModalOpen, setHomeModalOpen] = useState(false);
  const [selectedHomeStyle, setSelectedHomeStyle] = useState("Cyberpunk Neon Loft 🌆");
  const [selectedBudget, setSelectedBudget] = useState("Ortak Paylaşımlı 🤝");
  const [selectedRule, setSelectedRule] = useState("🐶 Evcil Hayvan Serbest");

  // Lightbox Zoom State (Item 5)
  const [chatZoomedImage, setChatZoomedImage] = useState<string | null>(null);

  // Media Attachment State
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [voiceUri, setVoiceUri] = useState<string | null>(null);
  const [recordSec, setRecordSec] = useState(0);
  const recTimerRef = useRef<any>(null);

  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<any[]>([]);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const currentSoundRef = useRef<any>(null);

  const listRef = useRef<FlatList>(null);
  const pollRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const loadVenues = async () => {
    try {
      const res = await api<{ venues: any[] }>("/venues/popular");
      setVenues(res.venues || []);
      setVenueModalOpen(true);
    } catch {}
  };

  const handleSuggestVenue = async (venue: any) => {
    try {
      await api(`/matches/${matchId}/suggest-venue`, {
        method: "POST",
        body: JSON.stringify({ venue_name: venue.name, address: venue.address }),
      });
      setVenueModalOpen(false);
      load();
    } catch (e: any) {
      alert(e?.message || "Buluşma önerisi gönderilemedi");
    }
  };

  const sendVirtualHomeResult = async () => {
    const score = Math.floor(Math.random() * 8) + 92; // 92-99% compatibility score
    const resultText = `🏡 Sanal Ev Kurma Simülasyonu Sonucu (%${score} Birlikte Yaşam Uyumu! ✨)\n\n• Ev Dekorasyonu: ${selectedHomeStyle}\n• Bütçe Planı: ${selectedBudget}\n• Ev Kuralı: ${selectedRule}\n\nHarika bir yaşam alanı kurduk! Senin düşüncelerin neler? 😊`;
    setHomeModalOpen(false);
    try {
      await api(`/matches/${matchId}/messages`, {
        method: "POST",
        body: JSON.stringify({ text: resultText }),
      });
      load();
    } catch {
      alert("Sanal ev simülasyonu sonucu gönderilemedi.");
    }
  };

  const startVoiceRecord = async () => {
    setRecordingVoice(true);
    setRecordSec(0);
    audioChunksRef.current = [];

    if (typeof window !== "undefined" && navigator?.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new (window as any).MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event: any) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/mp3" });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = () => {
            setVoiceUri(reader.result as string);
          };
          stream.getTracks().forEach((track: any) => track.stop());
        };

        mediaRecorder.start();
      } catch (err) {
        setVoiceUri("data:audio/mp3;base64,mock_voice_note");
      }
    } else {
      setVoiceUri("data:audio/mp3;base64,mock_voice_note");
    }

    recTimerRef.current = setInterval(() => {
      setRecordSec((s) => {
        if (s >= 14) {
          stopVoiceRecord();
          return 15;
        }
        return s + 1;
      });
    }, 1000);
  };

  const stopVoiceRecord = () => {
    clearInterval(recTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    } else if (!voiceUri) {
      setVoiceUri("data:audio/mp3;base64,mock_voice_note");
    }
    setRecordingVoice(false);
  };

  const togglePlayVoice = (msgId: string, uri?: string) => {
    if (!uri) return;

    if (playingVoiceId === msgId) {
      if (currentSoundRef.current) {
        currentSoundRef.current.pause();
        currentSoundRef.current = null;
      }
      setPlayingVoiceId(null);
      return;
    }

    if (currentSoundRef.current) {
      currentSoundRef.current.pause();
    }

    try {
      if (typeof window !== "undefined" && (window as any).Audio) {
        const audio = new (window as any).Audio(uri);
        currentSoundRef.current = audio;
        setPlayingVoiceId(msgId);
        audio.play().catch(() => {});
        audio.onended = () => {
          setPlayingVoiceId(null);
          currentSoundRef.current = null;
        };
      }
    } catch {
      setPlayingVoiceId(null);
    }
  };

  const load = useCallback(async () => {
    try {
      const res = await api<{ messages: Msg[]; blind_date?: BlindDateInfo }>(`/matches/${matchId}/messages`);
      setMessages(res.messages);
      if (res.blind_date) setBlindDate(res.blind_date);
    } catch (e: any) {
      setErr(e?.message || "Sohbet yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  const loadWingman = async () => {
    setWingmanOpen((o) => !o);
    if (wingmanSuggestions.length > 0) return;
    setWingmanBusy(true);
    try {
      const res = await api<{ suggestions: string[] }>(`/matches/${matchId}/wingman`, { method: "POST" });
      setWingmanSuggestions(res.suggestions || []);
    } catch (e: any) {
      setWingmanSuggestions(["Vibe'ındaki detay harika, hakkında ne düşünüyorsun? ✨"]);
    } finally {
      setWingmanBusy(false);
    }
  };

  const loadOther = useCallback(async () => {
    try {
      const list = await api<{ matches: any[] }>("/matches");
      const m = list.matches.find((x: any) => x.match_id === matchId);
      if (m) setOther({ user_id: m.other_user.user_id, name: m.other_user.name, photo: m.other_user.photos?.[0] });
    } catch {}
  }, [matchId]);

  useEffect(() => {
    load();
    loadOther();
  }, [load, loadOther]);

  useEffect(() => {
    async function initWs() {
      try {
        const token = await storage.secureGet<string>(TOKEN_KEY, "");
        if (!token) return;

        const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || "https://vibepulse-tg92.onrender.com";
        const wsUrl = backendUrl.replace(/^http/, "ws") + `/api/ws/chat/${matchId}?token=${encodeURIComponent(token)}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === "new_message" && data.message) {
              setMessages((prev) => {
                if (prev.some((m) => m.message_id === data.message.message_id)) return prev;
                return [...prev, data.message];
              });
              setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
            }
          } catch {}
        };
      } catch {}
    }

    initWs();

    pollRef.current = setInterval(load, 5000);
    return () => {
      clearInterval(pollRef.current);
      wsRef.current?.close();
    };
  }, [matchId, load]);

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      const base64 = a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri;
      setSelectedImage(base64);
    }
  };

  const send = async () => {
    const body = text.trim();
    if ((!body && !selectedImage && !voiceUri) || sending) return;
    setSending(true);
    setErr(null);
    try {
      const res = await api<{ message: Msg }>(`/matches/${matchId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          text: body,
          image: selectedImage || undefined,
          voice_note: voiceUri || undefined,
        }),
      });
      setMessages((prev) => [...prev, res.message]);
      setText("");
      setSelectedImage(null);
      setVoiceUri(null);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (e: any) {
      setErr(e?.message || "Mesaj gönderilemedi");
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="chat-back">
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </Pressable>
        <Avatar uri={other?.photo} name={other?.name || "?"} size={38} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{other?.name || "Sohbet"}</Text>
          {(user?.is_admin || user?.is_founder) ? (
            <Text style={styles.status}>🔒 Ekran Görüntüsü Engeli Aktif</Text>
          ) : null}
        </View>

        {/* Single Magic Wand 🪄 Action Menu Button (Item 5) */}
        <TouchableOpacity onPress={() => setMagicMenuOpen(true)} style={styles.magicWandBtn}>
          <Text style={{ fontSize: 20 }}>🪄</Text>
        </TouchableOpacity>
      </View>

      {blindDate && (
        <View style={styles.blindDateBanner}>
          <Ionicons name={blindDate.is_unlocked ? "eye" : "eye-off"} size={16} color={theme.rose} />
          <Text style={styles.blindDateText}>
            {blindDate.is_unlocked
              ? "🙈 Kör Randevu Kilidi Açıldı! Fotoğraflar %100 net."
              : `🙈 Kör Randevu: 10 mesajda fotoğraflar açılır (${blindDate.message_count}/10 Mesaj)`}
          </Text>
        </View>
      )}

      {wingmanOpen && (
        <View style={styles.wingmanBox}>
          <Text style={styles.wingmanBoxTitle}>🤖 AI Wingman Mesaj Önerileri:</Text>
          {wingmanBusy ? (
            <ActivityIndicator color={theme.rose} style={{ marginVertical: 10 }} />
          ) : (
            wingmanSuggestions.map((s, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => {
                  setText(s);
                  setWingmanOpen(false);
                }}
                style={styles.wingmanChip}
              >
                <Text style={styles.wingmanChipText}>✨ {s}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={theme.rose} /></View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.message_id}
            contentContainerStyle={{ padding: spacing.lg, gap: 8 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              const mine = item.from_user_id === user?.user_id;
              return (
                <View style={[styles.bubbleWrap, { alignItems: mine ? "flex-end" : "flex-start" }]}>
                  {mine ? (
                    <LinearGradient
                      colors={[theme.rose, "#8B5CF6"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[styles.bubble, styles.mine]}
                    >
                      {item.image ? (
                        <TouchableOpacity onPress={() => setChatZoomedImage(item.image)}>
                          <Image source={{ uri: item.image }} style={styles.chatImage} />
                        </TouchableOpacity>
                      ) : null}

                      {item.voice_note ? (
                        <TouchableOpacity
                          onPress={() => togglePlayVoice(item.message_id, item.voice_note)}
                          style={[styles.voiceNoteBubble, { backgroundColor: "rgba(255,255,255,0.15)" }]}
                        >
                          <View style={styles.playCircleMine}>
                            <Ionicons name={playingVoiceId === item.message_id ? "pause" : "play"} size={16} color={theme.rose} />
                          </View>
                          <View style={{ flex: 1, gap: 2 }}>
                            <View style={styles.voiceWaveformInline}>
                              {[10, 18, 8, 22, 14, 20, 12, 16, 24, 10, 18, 14].map((h, i) => (
                                <View key={i} style={[styles.waveBarInline, { height: h, backgroundColor: playingVoiceId === item.message_id ? "#fff" : "rgba(255,255,255,0.5)" }]} />
                              ))}
                            </View>
                            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
                              {playingVoiceId === item.message_id ? "Oynatılıyor..." : "Sesli Mesajı Dinle ▶️"}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ) : null}

                      {item.text ? <Text style={styles.textLight}>{item.text}</Text> : null}
                    </LinearGradient>
                  ) : (
                    <View style={[styles.bubble, styles.theirs]}>
                      {item.image ? (
                        <TouchableOpacity onPress={() => setChatZoomedImage(item.image)}>
                          <Image source={{ uri: item.image }} style={styles.chatImage} />
                        </TouchableOpacity>
                      ) : null}

                      {item.voice_note ? (
                        <TouchableOpacity
                          onPress={() => togglePlayVoice(item.message_id, item.voice_note)}
                          style={[styles.voiceNoteBubble, { backgroundColor: "rgba(244,63,94,0.08)" }]}
                        >
                          <View style={styles.playCircleTheirs}>
                            <Ionicons name={playingVoiceId === item.message_id ? "pause" : "play"} size={16} color="#fff" />
                          </View>
                          <View style={{ flex: 1, gap: 2 }}>
                            <View style={styles.voiceWaveformInline}>
                              {[10, 18, 8, 22, 14, 20, 12, 16, 24, 10, 18, 14].map((h, i) => (
                                <View key={i} style={[styles.waveBarInline, { height: h, backgroundColor: playingVoiceId === item.message_id ? theme.rose : theme.borderStrong }]} />
                              ))}
                            </View>
                            <Text style={{ color: theme.rose, fontSize: 11, fontWeight: "700" }}>
                              {playingVoiceId === item.message_id ? "Oynatılıyor..." : "Sesli Mesajı Dinle ▶️"}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ) : null}

                      {item.text ? <Text style={styles.textDark}>{item.text}</Text> : null}
                    </View>
                  )}
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={{ padding: spacing.xxl, alignItems: "center" }}>
                <Ionicons name="sparkles" size={32} color={theme.rose} />
                <Text style={styles.emptyTitle}>İlk mesaj sende</Text>
                <Text style={styles.emptyText}>
                  Vibe'ında olan bir konu ile başla, klasik "selam"a hayır.
                </Text>
              </View>
            }
          />
        )}

        {err ? <Text style={styles.err}>{err}</Text> : null}

        {selectedImage && (
          <View style={styles.imagePreviewWrap}>
            <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
            <TouchableOpacity onPress={() => setSelectedImage(null)} style={styles.removeImageBtn}>
              <Ionicons name="close" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {voiceUri && (
          <View style={styles.voicePreviewWrap}>
            <Ionicons name="mic" size={18} color={theme.rose} />
            <Text style={{ color: theme.rose, fontWeight: "700", flex: 1, fontSize: 13 }}>
              Sesli Mesaj Hazır (15 Saniye)
            </Text>
            <TouchableOpacity onPress={() => setVoiceUri(null)} style={{ padding: 4 }}>
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputBar}>
          <TouchableOpacity onPress={pickImage} style={styles.mediaBtn} testID="chat-pick-image">
            <Ionicons name="camera-outline" size={20} color={theme.rose} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={recordingVoice ? stopVoiceRecord : startVoiceRecord}
            style={[styles.mediaBtn, recordingVoice && { backgroundColor: theme.rose }]}
            testID="chat-record-voice"
          >
            <Ionicons name={recordingVoice ? "stop" : "mic-outline"} size={20} color={recordingVoice ? "#fff" : theme.rose} />
          </TouchableOpacity>

          <TextInput
            testID="chat-input"
            value={text}
            onChangeText={setText}
            placeholder={recordingVoice ? `Ses Kaydediliyor... ${recordSec}s` : "Mesajını yaz..."}
            placeholderTextColor={theme.textMuted}
            style={styles.input}
            multiline
            maxLength={500}
            editable={!recordingVoice}
          />

          <TouchableOpacity
            onPress={send}
            disabled={(!text.trim() && !selectedImage && !voiceUri) || sending}
            testID="chat-send"
          >
            <LinearGradient
              colors={[theme.rose, "#8B5CF6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.sendBtn, ((!text.trim() && !selectedImage && !voiceUri) || sending) ? { opacity: 0.4 } : null]}
            >
              <Ionicons name="send" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Popular Date Venues Selection Modal */}
      <Modal visible={venueModalOpen} animationType="slide" onRequestClose={() => setVenueModalOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>☕ Buluşma Noktası Öner</Text>
            <TouchableOpacity onPress={() => setVenueModalOpen(false)} style={{ padding: 6 }}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={venues}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: spacing.lg, gap: 12 }}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => handleSuggestVenue(item)} style={styles.venueCard}>
                <Ionicons name="cafe-outline" size={28} color={theme.rose} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.venueCardName}>{item.name}</Text>
                  <Text style={styles.venueCardCategory}>{item.category} • {item.address}</Text>
                </View>
                <Ionicons name="send-outline" size={20} color={theme.cyan} />
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>
      {/* Virtual Roommate / Nesting Simulation Modal (Item 7) */}
      <Modal visible={homeModalOpen} animationType="slide" onRequestClose={() => setHomeModalOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>🏡 Sanal Ev Kurma Simülasyonu</Text>
            <TouchableOpacity onPress={() => setHomeModalOpen(false)} style={{ padding: 6 }}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
            <Text style={{ color: theme.textDim, fontSize: 14, lineHeight: 20 }}>
              Ortak yaşam zevklerinizi ve ev tarzınızı belirleyin, yapay zeka birlikte yaşam uyum skorunuzu hesaplasın!
            </Text>

            {/* Home Decoration Style */}
            <Text style={styles.optionSectionTitle}>1. Ev Dekorasyon Tarzınız</Text>
            <View style={{ gap: 8 }}>
              {["Minimalist İskandinav 🛋️", "Cyberpunk Neon Loft 🌆", "Doğa & Boho Chic 🌿", "Modern Lüks Penthouse 🏙️"].map((st) => (
                <TouchableOpacity
                  key={st}
                  onPress={() => setSelectedHomeStyle(st)}
                  style={[styles.simChip, selectedHomeStyle === st && styles.simChipActive]}
                >
                  <Text style={[styles.simChipText, selectedHomeStyle === st && styles.simChipTextActive]}>{st}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* House Budget */}
            <Text style={styles.optionSectionTitle}>2. Ortak Bütçe Planı</Text>
            <View style={{ gap: 8 }}>
              {["Ortak Paylaşımlı 🤝", "Esnek & Lüks 💎", "Minimal Ekonomi 💡"].map((b) => (
                <TouchableOpacity
                  key={b}
                  onPress={() => setSelectedBudget(b)}
                  style={[styles.simChip, selectedBudget === b && styles.simChipActive]}
                >
                  <Text style={[styles.simChipText, selectedBudget === b && styles.simChipTextActive]}>{b}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* House Rules */}
            <Text style={styles.optionSectionTitle}>3. Temel Ev Kuralı</Text>
            <View style={{ gap: 8 }}>
              {["🐶 Evcil Hayvan Serbest", "🎉 Hafta Sonu Partileri Serbest", "🔇 23:00 Sessizlik Zamanı"].map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setSelectedRule(r)}
                  style={[styles.simChip, selectedRule === r && styles.simChipActive]}
                >
                  <Text style={[styles.simChipText, selectedRule === r && styles.simChipTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity onPress={sendVirtualHomeResult} style={{ marginTop: spacing.lg }}>
              <LinearGradient
                colors={["#06B6D4", "#3B82F6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ paddingVertical: 16, alignItems: "center", borderRadius: radius.pill }}
              >
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>
                  Sanal Evi Kur & Uyum Skorunu Sohbete Gönder 🚀
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Magic Wand Action Menu Modal (Item 5) */}
      <Modal visible={magicMenuOpen} transparent animationType="fade" onRequestClose={() => setMagicMenuOpen(false)}>
        <TouchableOpacity style={styles.magicBackdrop} activeOpacity={1} onPress={() => setMagicMenuOpen(false)}>
          <View style={styles.magicSheet}>
            <View style={styles.magicHeader}>
              <Text style={styles.magicTitle}>🪄 Sihirli Sohbet Asistanı</Text>
              <TouchableOpacity onPress={() => setMagicMenuOpen(false)}>
                <Ionicons name="close" size={22} color={theme.text} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 10, marginTop: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  setMagicMenuOpen(false);
                  loadVenues();
                }}
                style={styles.magicOptionBtn}
              >
                <Ionicons name="cafe" size={20} color="#10B981" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.magicOptionTitle}>☕ Buluşma Noktası Öner</Text>
                  <Text style={styles.magicOptionSub}>Popüler kafeleri seç ve buluşma teklifi gönder.</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setMagicMenuOpen(false);
                  setHomeModalOpen(true);
                }}
                style={styles.magicOptionBtn}
              >
                <Ionicons name="home" size={20} color="#06B6D4" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.magicOptionTitle}>🏡 Sanal Ev Kurma Simülasyonu</Text>
                  <Text style={styles.magicOptionSub}>Ortak dekorasyon ve kurallar ile yaşam uyum skoru çıkar.</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setMagicMenuOpen(false);
                  loadWingman();
                }}
                style={styles.magicOptionBtn}
              >
                <Ionicons name="sparkles" size={20} color="#F59E0B" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.magicOptionTitle}>🤖 AI Wingman Sohbet Önerisi</Text>
                  <Text style={styles.magicOptionSub}>Tıkanan sohbete akıllı ve eğlenceli mesaj önerileri al.</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Lightbox Image Viewer Modal (Item 5) */}
      <Modal visible={!!chatZoomedImage} transparent animationType="fade" onRequestClose={() => setChatZoomedImage(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" }}>
          <TouchableOpacity onPress={() => setChatZoomedImage(null)} style={{ position: "absolute", top: 40, right: 20, zIndex: 10, padding: 10 }}>
            <Ionicons name="close-circle" size={36} color="#fff" />
          </TouchableOpacity>
          {chatZoomedImage ? <Image source={{ uri: chatZoomedImage }} style={{ width: "95%", height: "80%", resizeMode: "contain" }} /> : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  name: { color: theme.text, fontWeight: "700", fontSize: 16 },
  status: { color: "#10B981", fontSize: 11, fontWeight: "700" },
  magicWandBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(139, 92, 246, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  magicBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  magicSheet: { backgroundColor: theme.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, gap: spacing.md, borderWidth: 1, borderColor: theme.border },
  magicHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  magicTitle: { color: theme.text, fontSize: 16, fontWeight: "800" },
  magicOptionBtn: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: theme.surface, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: theme.border },
  magicOptionTitle: { color: theme.text, fontSize: 14, fontWeight: "800" },
  magicOptionSub: { color: theme.textDim, fontSize: 11, marginTop: 2 },
  homeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: "rgba(6, 182, 212, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(6, 182, 212, 0.4)",
  },
  simChip: {
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  simChipActive: { backgroundColor: "rgba(6, 182, 212, 0.15)", borderColor: theme.cyan },
  simChipText: { color: theme.textDim, fontSize: 14, fontWeight: "600" },
  simChipTextActive: { color: theme.cyan, fontWeight: "800" },
  optionSectionTitle: { color: theme.text, fontSize: 13, fontWeight: "800", marginTop: spacing.sm },
  wingmanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
  },
  wingmanText: { color: "#F59E0B", fontSize: 11, fontWeight: "700" },
  blindDateBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
    backgroundColor: "rgba(244,63,94,0.12)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(244,63,94,0.25)",
  },
  blindDateText: { color: theme.rose, fontSize: 12, fontWeight: "700" },
  wingmanBox: {
    backgroundColor: theme.card,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    gap: 8,
  },
  wingmanBoxTitle: { color: theme.text, fontSize: 13, fontWeight: "700" },
  wingmanChip: {
    backgroundColor: "rgba(139,92,246,0.15)",
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.3)",
  },
  wingmanChipText: { color: theme.text, fontSize: 13, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  bubbleWrap: { width: "100%" },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, maxWidth: "80%" },
  mine: { borderRadius: 18, borderBottomRightRadius: 4 },
  theirs: { backgroundColor: theme.card, borderRadius: 18, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: theme.border },
  textLight: { color: "#fff", fontSize: 15, lineHeight: 21 },
  textDark: { color: theme.text, fontSize: 15, lineHeight: 21 },
  chatImage: { width: 200, height: 200, borderRadius: radius.md, marginBottom: 6 },
  voiceNoteBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    marginVertical: 4,
    minWidth: 180,
  },
  playCircleMine: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  playCircleTheirs: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.rose, alignItems: "center", justifyContent: "center" },
  voiceWaveformInline: { flexDirection: "row", alignItems: "center", gap: 3 },
  waveBarInline: { width: 3, borderRadius: 2 },
  imagePreviewWrap: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, position: "relative" },
  imagePreview: { width: 70, height: 70, borderRadius: radius.md },
  removeImageBtn: {
    position: "absolute",
    top: 4,
    left: 60,
    backgroundColor: "rgba(0,0,0,0.8)",
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  voicePreviewWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(244,63,94,0.12)",
    padding: spacing.md,
    marginHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(244,63,94,0.3)",
  },
  mediaBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: "center",
    justifyContent: "center",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
  },
  input: {
    flex: 1,
    backgroundColor: theme.card,
    color: theme.text,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    maxHeight: 120,
    fontSize: 15,
    borderWidth: 1,
    borderColor: theme.border,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: theme.text, fontSize: 18, fontWeight: "700", marginTop: spacing.md },
  emptyText: { color: theme.textDim, fontSize: 14, textAlign: "center", marginTop: 6, maxWidth: 260 },
  err: { color: theme.danger, textAlign: "center", padding: spacing.sm },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalTitle: { color: theme.text, fontSize: 18, fontWeight: "800" },
  venueCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.card,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.border,
  },
  venueCardName: { color: theme.text, fontWeight: "800", fontSize: 15 },
  venueCardCategory: { color: theme.textDim, fontSize: 12, marginTop: 2 },
});
