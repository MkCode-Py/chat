import Ionicons from "@react-native-vector-icons/ionicons";
import * as Haptics from "expo-haptics";
import { useCallback, useSyncExternalStore } from "react";
import { Pressable, Text, View } from "react-native";

import { mediaUrl, type Message } from "@/src/api/client";
import { getPlayingId, subscribePlayback, togglePlayback } from "@/src/audio";
import { formatDuration, formatTime } from "@/src/lib/format";
import { makeStyles, useTheme } from "@/src/theme";

const WAVE = [8, 16, 22, 12, 26, 18, 10, 24, 14, 20, 9, 17, 23, 11, 19];

function usePlayingId() {
  return useSyncExternalStore(subscribePlayback, getPlayingId, getPlayingId);
}

export function MessageBubble({
  message,
  isMine,
  onLongPress,
}: {
  message: Message;
  isMine: boolean;
  onLongPress: (m: Message) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const playingId = usePlayingId();
  const isPlaying = playingId === message.id;

  const primary = isMine ? message.original_text : message.translated_text;
  const secondary = isMine ? message.translated_text : message.original_text;

  const onPrimaryTone = isMine ? styles.textSentPrimary : styles.textRecvPrimary;
  const onSecondaryTone = isMine ? styles.textSentSecondary : styles.textRecvSecondary;

  const handleLongPress = useCallback(() => {
    if (message.deleted) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    onLongPress(message);
  }, [message, onLongPress]);

  const audioId = isMine ? message.audio_media_id : message.tts_media_id ?? message.audio_media_id;

  const play = () => {
    if (!audioId) return;
    Haptics.selectionAsync().catch(() => {});
    togglePlayback(message.id, mediaUrl(audioId));
  };

  if (message.deleted) {
    return (
      <View style={[styles.container, isMine ? styles.alignRight : styles.alignLeft]}>
        <View style={[styles.bubble, isMine ? styles.bubbleSent : styles.bubbleRecv, styles.deletedBubble]}>
          <View style={styles.deletedRow}>
            <Ionicons name="ban-outline" size={14} color={isMine ? colors.onBubbleSentMuted : colors.muted} />
            <Text style={[styles.deletedText, isMine ? styles.textSentSecondary : styles.textRecvSecondary]}>
              Mensagem apagada
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, isMine ? styles.alignRight : styles.alignLeft]}>
      <Pressable
        testID={`message-bubble-${message.id}`}
        onLongPress={handleLongPress}
        delayLongPress={250}
        style={({ pressed }) => [
          styles.bubble,
          isMine ? styles.bubbleSent : styles.bubbleRecv,
          pressed && { opacity: 0.9 },
        ]}
      >
        {message.reply_to ? (
          <View style={[styles.replyQuote, isMine ? styles.replyQuoteSent : styles.replyQuoteRecv]}>
            <Text style={[styles.replyText, onSecondaryTone]} numberOfLines={2}>
              {message.reply_to.preview}
            </Text>
          </View>
        ) : null}

        {message.type === "voice" ? (
          <View style={styles.voiceRow}>
            <Pressable onPress={play} hitSlop={8} testID={`voice-play-${message.id}`} style={styles.playBtn}>
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={20}
                color={isMine ? colors.onBubbleSent : colors.brandPrimary}
              />
            </Pressable>
            <View style={styles.waveform}>
              {WAVE.map((h, i) => (
                <View
                  key={i}
                  style={[
                    styles.waveBar,
                    { height: h },
                    { backgroundColor: isMine ? "rgba(255,255,255,0.55)" : colors.borderStrong },
                  ]}
                />
              ))}
            </View>
            <Text style={[styles.voiceDuration, onSecondaryTone]}>{formatDuration(message.duration)}</Text>
          </View>
        ) : null}

        {primary ? <Text style={[styles.primary, onPrimaryTone]}>{primary}</Text> : null}
        {secondary && secondary !== primary ? (
          <Text style={[styles.secondary, onSecondaryTone]}>{secondary}</Text>
        ) : null}

        <View style={styles.metaRow}>
          {message.edited ? <Text style={[styles.meta, onSecondaryTone]}>editada · </Text> : null}
          <Text style={[styles.meta, onSecondaryTone]}>{formatTime(message.created_at)}</Text>
        </View>

        {message.reactions.length > 0 ? (
          <View style={[styles.reactions, isMine ? styles.reactionsRight : styles.reactionsLeft]}>
            {Array.from(new Set(message.reactions.map((r) => r.emoji))).map((emoji) => {
              const count = message.reactions.filter((r) => r.emoji === emoji).length;
              return (
                <View key={emoji} style={styles.reactionPill}>
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                  {count > 1 ? <Text style={styles.reactionCount}>{count}</Text> : null}
                </View>
              );
            })}
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { paddingHorizontal: 14, marginBottom: 8, maxWidth: "100%" },
  alignRight: { alignItems: "flex-end" },
  alignLeft: { alignItems: "flex-start" },
  bubble: {
    maxWidth: "82%",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 6,
  },
  bubbleSent: { backgroundColor: colors.bubbleSent, borderBottomRightRadius: 4 },
  bubbleRecv: { backgroundColor: colors.bubbleReceived, borderBottomLeftRadius: 4 },
  deletedBubble: { opacity: 0.7 },
  deletedRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  deletedText: { fontSize: 14, fontStyle: "italic" },

  primary: { fontSize: 16, fontWeight: "500", lineHeight: 21 },
  secondary: { fontSize: 12.5, lineHeight: 17, marginTop: 4 },
  textSentPrimary: { color: colors.onBubbleSent },
  textSentSecondary: { color: colors.onBubbleSentMuted },
  textRecvPrimary: { color: colors.onBubbleReceived },
  textRecvSecondary: { color: colors.onBubbleReceivedMuted },

  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 4 },
  meta: { fontSize: 10.5 },

  replyQuote: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    paddingVertical: 3,
    marginBottom: 6,
    borderRadius: 3,
  },
  replyQuoteSent: { borderLeftColor: "rgba(255,255,255,0.6)" },
  replyQuoteRecv: { borderLeftColor: colors.brandPrimary },
  replyText: { fontSize: 13 },

  voiceRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 2, minWidth: 200 },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  waveform: { flex: 1, flexDirection: "row", alignItems: "center", gap: 3, height: 28 },
  waveBar: { width: 3, borderRadius: 2 },
  voiceDuration: { fontSize: 12 },

  reactions: { flexDirection: "row", gap: 4, position: "absolute", bottom: -14 },
  reactionsRight: { right: 6 },
  reactionsLeft: { left: 6 },
  reactionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  reactionEmoji: { fontSize: 13 },
  reactionCount: { fontSize: 11, color: colors.muted, fontWeight: "600" },
}));
