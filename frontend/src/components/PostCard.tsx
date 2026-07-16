import React from "react";
import { Image, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Audio } from "expo-av";
import { Avatar } from "@/src/components/Avatar";
import { theme, radius, spacing } from "@/src/lib/theme";
import { api } from "@/src/lib/api";

export type PostAuthor = {
  user_id: string;
  name: string;
  handle: string;
  avatar: string;
  vibe_status?: string;
};

export type Post = {
  post_id: string;
  text: string;
  image?: string;
  voice_note?: string;
  likes_count: number;
  comments_count: number;
  liked_by_me: boolean;
  created_at: string;
  author: PostAuthor;
};

function timeAgo(iso: string): string {
  try {
    const d = new Date(iso).getTime();
    const diff = Math.max(0, Date.now() - d) / 1000;
    if (diff < 60) return `${Math.floor(diff)}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}dk`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}sa`;
    return `${Math.floor(diff / 86400)}g`;
  } catch {
    return "";
  }
}

export function PostCard({ post, onChange }: { post: Post; onChange?: (p: Post) => void }) {
  const router = useRouter();
  const [liked, setLiked] = React.useState(post.liked_by_me);
  const [count, setCount] = React.useState(post.likes_count);
  const [playingAudio, setPlayingAudio] = React.useState(false);
  const soundRef = React.useRef<Audio.Sound | null>(null);

  React.useEffect(() => {
    setLiked(post.liked_by_me);
    setCount(post.likes_count);
  }, [post.liked_by_me, post.likes_count]);

  const toggleAudio = async () => {
    if (!post.voice_note) return;
    try {
      if (soundRef.current) {
        if (playingAudio) {
          await soundRef.current.pauseAsync();
          setPlayingAudio(false);
        } else {
          await soundRef.current.playAsync();
          setPlayingAudio(true);
        }
      } else {
        const { sound } = await Audio.Sound.createAsync(
          { uri: post.voice_note },
          { shouldPlay: true }
        );
        soundRef.current = sound;
        setPlayingAudio(true);
        sound.setOnPlaybackStatusUpdate((status: any) => {
          if (status.didJustFinish) {
            setPlayingAudio(false);
          }
        });
      }
    } catch {
      setPlayingAudio(false);
    }
  };

  const toggleLike = async () => {
    const prev = { liked, count };
    setLiked(!liked);
    setCount(liked ? count - 1 : count + 1);
    try {
      const r = await api<{ liked: boolean; likes_count: number }>(`/posts/${post.post_id}/like`, { method: "POST" });
      setLiked(r.liked);
      setCount(r.likes_count);
      onChange?.({ ...post, liked_by_me: r.liked, likes_count: r.likes_count });
    } catch {
      setLiked(prev.liked);
      setCount(prev.count);
    }
  };

  const goPost = () => router.push({ pathname: "/post/[id]", params: { id: post.post_id } });
  const goProfile = () => router.push({ pathname: "/profile/[id]", params: { id: post.author.user_id } });
  const sendVibe = () => router.push({ pathname: "/profile/[id]", params: { id: post.author.user_id } });

  return (
    <Pressable onPress={goPost} style={styles.wrap} testID={`post-${post.post_id}`}>
      <TouchableOpacity onPress={goProfile}>
        <Avatar uri={post.author.avatar || null} name={post.author.name} size={44} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <View style={styles.headRow}>
          <TouchableOpacity onPress={goProfile} style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {post.author.name || "İsimsiz"}
            </Text>
            <Text style={styles.handle} numberOfLines={1}>
              @{post.author.handle}
            </Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.time}>{timeAgo(post.created_at)}</Text>
          </TouchableOpacity>
        </View>
        {post.author.vibe_status ? (
          <View style={styles.vibePill}>
            <Text style={styles.vibeText}>✨ {post.author.vibe_status}</Text>
          </View>
        ) : null}
        <Text style={styles.body}>{post.text}</Text>

        {post.voice_note ? (
          <TouchableOpacity
            onPress={toggleAudio}
            style={styles.voicePlayer}
            testID={`voice-${post.post_id}`}
          >
            <View style={styles.voicePlayBtn}>
              <Ionicons name={playingAudio ? "pause" : "play"} size={16} color="#fff" />
            </View>
            <View style={styles.voiceWaveform}>
              {[12, 20, 8, 24, 16, 22, 10, 18, 14, 24, 8, 16, 22, 10].map((h, i) => (
                <View key={i} style={[styles.waveBar, { height: h }, playingAudio && { backgroundColor: theme.rose }]} />
              ))}
            </View>
            <Text style={styles.voiceTime}>0:15</Text>
          </TouchableOpacity>
        ) : null}

        {post.image ? <Image source={{ uri: post.image }} style={styles.media} /> : null}
        <View style={styles.actionsRow}>
          <TouchableOpacity onPress={goPost} style={styles.action} testID={`comment-${post.post_id}`}>
            <Ionicons name="chatbubble-outline" size={18} color={theme.textDim} />
            <Text style={styles.actionText}>{post.comments_count}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleLike} style={styles.action} testID={`like-${post.post_id}`}>
            <Ionicons name={liked ? "heart" : "heart-outline"} size={20} color={liked ? theme.rose : theme.textDim} />
            <Text style={[styles.actionText, liked ? { color: theme.rose } : null]}>{count}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={sendVibe} style={[styles.action, styles.vibeAction]} testID={`sendvibe-${post.post_id}`}>
            <Ionicons name="flash" size={18} color={theme.cyan} />
            <Text style={[styles.actionText, { color: theme.cyan, fontWeight: "700" }]}>Vibe Gönder</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
    backgroundColor: theme.bg,
  },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", flexShrink: 1, gap: 6 },
  name: { color: theme.text, fontWeight: "700", fontSize: 15, maxWidth: 140 },
  handle: { color: theme.textMuted, fontSize: 13 },
  dot: { color: theme.textMuted },
  time: { color: theme.textMuted, fontSize: 13 },
  vibePill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(244,63,94,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginTop: 4,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "rgba(244,63,94,0.25)",
  },
  vibeText: { color: theme.rose, fontSize: 11, fontWeight: "600" },
  body: { color: theme.text, fontSize: 15.5, lineHeight: 22, marginTop: 4 },
  voicePlayer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: theme.border,
  },
  voicePlayBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.rose,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceWaveform: { flexDirection: "row", alignItems: "center", gap: 3, flex: 1 },
  waveBar: { width: 3, borderRadius: 2, backgroundColor: theme.borderStrong },
  voiceTime: { color: theme.textDim, fontSize: 12, fontWeight: "600" },
  media: { width: "100%", height: 200, borderRadius: radius.md, marginTop: spacing.sm, backgroundColor: theme.cardAlt },
  actionsRow: { flexDirection: "row", alignItems: "center", gap: 22, marginTop: spacing.md },
  action: { flexDirection: "row", alignItems: "center", gap: 6 },
  vibeAction: { marginLeft: "auto" },
  actionText: { color: theme.textDim, fontSize: 13, fontWeight: "500" },
});
