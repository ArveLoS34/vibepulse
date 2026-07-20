import React from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { theme, radius, spacing } from "@/src/lib/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
};

type ReleaseNote = {
  version: string;
  date: string;
  title: string;
  badgeColor: string;
  items: { icon: string; text: string; sub?: string }[];
};

const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "v2.7.0",
    date: "20 Temmuz 2026",
    title: "Sihirli Değnek Asistanı, Sahne Konuşmacı Onayı & Instagram Yönlendirme",
    badgeColor: "#10B981",
    items: [
      { icon: "color-wand", text: "Sihirli Değnek (🪄) Sohbet Menüsü", sub: "Sohbetteki Buluş, Ev Kur ve AI Wingman butonları tek sihirli menü altında toplandı." },
      { icon: "person", text: "Hikaye & Yorum Profil Yönlendirmesi", sub: "Story izleme ekranında ve Vibe yorumlarında profil resmine tıklayınca doğrudan kişinin profiline gitme." },
      { icon: "mic", text: "Live Oda Sahne Konuşma İzni", sub: "Ses odasında el kaldıran dinleyici için yayıncıya onay/reddet bildirimi paneli." },
      { icon: "logo-instagram", text: "Instagram Profil Butonu", sub: "Biyografi altındaki Instagram butonuna basınca uygulamayı/profili anında açma." },
      { icon: "camera", text: "Kamera İle Fotoğraf Çekme", sub: "Vibe gönderisi paylaşırken galeriye ek olarak doğrudan kamera ile çekme seçeneği." },
      { icon: "sparkles", text: "Sarı Altın Kurucu Rozeti (👑)", sub: "VibePulse kurucusu için özel sarı taç rozeti." },
      { icon: "checkmark-circle", text: "Doğrulama Tikleri Düzeltmesi", sub: "VIP ve e-posta doğrulama rozetlerinin Ionicons ikon seti ile %100 uyumlu hale getirilmesi." },
      { icon: "eye-off", text: "Sadece Yetkili Ekran Güvenliği Uyarısı", sub: "Sohbetteki ekran koruması yazısının sadece yetkili (admin/kurucu) hesaplara gözükmesi." },
      { icon: "swap-horizontal", text: "Keşfet Yumuşak Swipe Düzeltmesi", sub: "Dokunmatik ekranlarda sağa/sola kart kaydırma hassasiyeti ve stabilitesi arttırıldı." },
    ],
  },
  {
    version: "v2.6.0",
    date: "19 Temmuz 2026",
    title: "Sanal Ev Kurma, VIP Turuncu Tik & Görüntüleme İyileştirmeleri",
    badgeColor: "#F43F5E",
    items: [
      { icon: "journal", text: "Sürüm Notları Defteri", sub: "Her güncellemede yapılan değişiklikleri üst bardaki defter butonundan görüntüleme." },
      { icon: "home", text: "Sanal Ev Kurma (Virtual Roommate)", sub: "Sohbet içerisinden dekorasyon, bütçe ve kural seçerek yaşam uyum skoru hesaplama oyunu." },
      { icon: "checkmark-circle", text: "VIP Turuncu Doğrulama Tik'i (🧡)", sub: "VIP üyeler için ismin yanında turuncu tik. Tıklandığında 'VibePulse Premium' uyarısı." },
      { icon: "camera", text: "Vibe Paylaş'a Fotoğraf Ekleme", sub: "Ana sayfa gönderi paylaşımına galeri resmi ekleme ve önizleme desteği." },
      { icon: "refresh", text: "Geri Alma (Rewind ↺) & Sınırsız Beğeni", sub: "Keşfet kartlarında pas geçilen son profili tek tıkla geri getirme." },
      { icon: "search", text: "Fotoğraf Büyütme (Full-Screen Lightbox)", sub: "Gönderi, sohbet ve profil fotoğraflarına tıklandığında tam ekran büyütme modu." },
      { icon: "sparkles", text: "İlgi Alanları Akordiyon Paneli", sub: "Profildeki ilgi alanlarını derli toplu açılır/kapanır buton içine taşıma." },
      { icon: "mic", text: "Sesli Mesaj İletim Düzeltmesi", sub: "Sohbette metin yazmadan doğrudan ses kaydı gönderebilme düzeltmesi." },
      { icon: "checkmark-done-circle", text: "E-posta Yeşil Tik Rozeti (🟢)", sub: "E-postası doğrulanmış kullanıcılar için isim yanında yeşil tik." },
    ],
  },
  {
    version: "v2.5.0",
    date: "18 Temmuz 2026",
    title: "VibePlus Live Odaları, Kurucu Rozeti & Yönetici Paneli",
    badgeColor: "#8B5CF6",
    items: [
      { icon: "radio", text: "VibePlus Live Odaları", sub: "VIP canlı sesli yayın odaları, mikrofon mute/unmute kontrolleri ve canlı oda sohbeti." },
      { icon: "ribbon", text: "Kurucu Rozeti (👑 Kurucu)", sub: "Sistem kurucusu ertackeser3453@gmail.com için özel altın kurucu simgesi." },
      { icon: "people", text: "Yönetici Konsolu Üye Listesi", sub: "Kayıtlı kullanıcıları ve VIP üyeleri detaylı e-posta listesi olarak inceleme." },
      { icon: "trash", text: "Kendi Gönderini Silme", sub: "Paylaşılan Vibe gönderilerini tek tıkla çöp kutusuna atıp silebilme." },
      { icon: "time", text: "Kalıcı İzlenen Story Hafızası", sub: "İzlenen hikaye halkalarının grileşerek cihazda saklanması." },
      { icon: "notifications", text: "Okunan Bildirimleri Temizle", sub: "Bildirim panelinde okunan tüm bildirimleri tek tıkla silme butonu." },
    ],
  },
  {
    version: "v2.0.0",
    date: "17 Temmuz 2026",
    title: "AI Biyometrik Mavi Tik, Mekan Önerisi & Gizlilik Shield'ı",
    badgeColor: "#06B6D4",
    items: [
      { icon: "shield-checkmark", text: "AI Selfie Mavi Tik (🔵 Onaylı Hesap)", sub: "Claude AI Vision ile canlı selfie doğrulaması." },
      { icon: "cafe", text: "Buluşma NoktalarıSeçici", sub: "Sohbet içerisinden popüler kafeleri seçip buluşma teklifi gönderme." },
      { icon: "eye-off", text: "Anti-Screenshot Shield", sub: "Sohbet ve profillerde ekran görüntüsü ve kaydı alınmasını engelleme." },
      { icon: "logo-instagram", text: "Instagram & Spotify Entegrasyonu", sub: "Profilde Instagram handle ve favori şarkı kartı sergileme." },
    ],
  },
];

export function ChangelogModal({ visible, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <LinearGradient
              colors={[theme.rose, "#8B5CF6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconCircle}
            >
              <Ionicons name="journal" size={20} color="#fff" />
            </LinearGradient>
            <View>
              <Text style={styles.headerTitle}>Sürüm Notları & Güncellemeler</Text>
              <Text style={styles.headerSub}>VibePulse Güncelleme Defteri 📖</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} testID="changelog-close">
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* Content list */}
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
          {RELEASE_NOTES.map((rel, rIdx) => (
            <View key={rIdx} style={styles.releaseCard}>
              <View style={styles.releaseHead}>
                <View style={[styles.versionBadge, { backgroundColor: rel.badgeColor }]}>
                  <Text style={styles.versionText}>{rel.version}</Text>
                </View>
                <Text style={styles.releaseDate}>{rel.date}</Text>
              </View>

              <Text style={styles.releaseTitle}>{rel.title}</Text>

              <View style={styles.itemsList}>
                {rel.items.map((it, iIdx) => (
                  <View key={iIdx} style={styles.itemRow}>
                    <View style={styles.itemIconBox}>
                      <Ionicons name={it.icon as any} size={16} color={rel.badgeColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemText}>{it.text}</Text>
                      {it.sub ? <Text style={styles.itemSub}>{it.sub}</Text> : null}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: theme.text, fontSize: 17, fontWeight: "900" },
  headerSub: { color: theme.textDim, fontSize: 12, marginTop: 1 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: "center",
    justifyContent: "center",
  },
  releaseCard: {
    backgroundColor: theme.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: theme.border,
    gap: spacing.md,
  },
  releaseHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  versionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  versionText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  releaseDate: { color: theme.textDim, fontSize: 12, fontWeight: "600" },
  releaseTitle: { color: theme.text, fontSize: 16, fontWeight: "800", lineHeight: 22 },
  itemsList: { gap: 12, marginTop: 4 },
  itemRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  itemIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  itemText: { color: theme.text, fontSize: 14, fontWeight: "700" },
  itemSub: { color: theme.textDim, fontSize: 12, marginTop: 2, lineHeight: 17 },
});
