import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, type Message } from "@/src/api/client";
import { stopPlayback } from "@/src/audio";
import { Avatar } from "@/src/components/Avatar";
import { MessageActions } from "@/src/components/MessageActions";
import { MessageBubble } from "@/src/components/MessageBubble";
import { useAuth } from "@/src/context/auth";
import { formatDuration } from "@/src/lib/format";
import { makeStyles, useTheme } from "@/src/theme";

export default function Conversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const convId = String(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [selected, setSelected] = useState<Message | null>(null);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [permError, setPermError] = useState(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: conv } = useQuery({
    queryKey: ["conversation", convId],
    queryFn: () => api.getConversation(convId),
  });

  const { data: messages, isLoading } = useQuery({
    queryKey: ["messages", convId],
    queryFn: () => api.getMessages(convId),
    refetchInterval: 2500,
  });

  useEffect(() => {
    return () => {
      stopPlayback();
      if (recTimer.current) clearInterval(recTimer.current);
    };
  }, []);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["messages", convId] });
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  const sendMutation = useMutation({
    mutationFn: () => {
      if (editing) return api.editMessage(editing.id, text.trim());
      return api.sendMessage(convId, text.trim(), replyTo?.id ?? null);
    },
    onSuccess: () => {
      setText("");
      setReplyTo(null);
      setEditing(null);
      invalidate();
    },
  });

  const voiceMutation = useMutation({
    mutationFn: (payload: { uri: string; duration: number }) =>
      api.sendVoice(convId, payload.uri, payload.duration, replyTo?.id ?? null),
    onSuccess: () => {
      setReplyTo(null);
      invalidate();
    },
  });

  const reactMutation = useMutation({
    mutationFn: (payload: { id: string; emoji: string }) => api.reactMessage(payload.id, payload.emoji),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (msgId: string) => api.deleteMessage(msgId),
    onSuccess: invalidate,
  });

  const handleSend = () => {
    if (!text.trim() || sendMutation.isPending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    sendMutation.mutate();
  };

  const startRecording = async () => {
    setPermError(false);
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setPermError(true);
      return;
    }
    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setRecording(true);
      setRecSeconds(0);
      recTimer.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch {
      setRecording(false);
    }
  };

  const finishRecording = async (send: boolean) => {
    if (recTimer.current) clearInterval(recTimer.current);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const duration = recSeconds;
    setRecording(false);
    try {
      await recorder.stop();
    } catch {}
    await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    const uri = recorder.uri;
    if (send && uri && duration >= 1) {
      voiceMutation.mutate({ uri, duration });
    }
    setRecSeconds(0);
  };

  const onLongPress = useCallback((m: Message) => setSelected(m), []);

  const other = conv?.other_user;
  const reversed = messages ? [...messages].reverse() : [];
  const headerHeight = insets.top + 56;
  const translating = sendMutation.isPending || voiceMutation.isPending;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="conversation-back">
          <Ionicons name="chevron-back" size={28} color={colors.brandPrimary} />
        </Pressable>
        {other ? (
          <>
            <Avatar name={other.display_name} color={other.avatar_color} size={38} language={other.language} />
            <View style={styles.headerInfo}>
              <Text style={styles.headerName} numberOfLines={1}>
                {other.display_name}
              </Text>
              <Text style={styles.headerSub} numberOfLines={1}>
                @{other.username} · {other.language === "pt" ? "Português" : "Español"}
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.headerInfo} />
        )}
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior="translate-with-padding"
        keyboardVerticalOffset={headerHeight}
      >
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.brandPrimary} />
          </View>
        ) : (
          <FlatList
            data={reversed}
            inverted
            keyExtractor={(m) => m.id}
            keyboardDismissMode="interactive"
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 12 }}
            renderItem={({ item }) => (
              <MessageBubble message={item} isMine={item.sender_id === user?.id} onLongPress={onLongPress} />
            )}
            ListEmptyComponent={
              <View style={[styles.emptyChat, { transform: [{ scaleY: -1 }] }]} testID="conversation-empty">
                <View style={styles.datePill}>
                  <Text style={styles.datePillText}>Hoje</Text>
                </View>
                <Ionicons name="chatbubbles-outline" size={40} color={colors.surfaceTertiary} />
                <Text style={styles.emptyChatText}>
                  Diga olá! Sua mensagem chega traduzida automaticamente.
                </Text>
              </View>
            }
          />
        )}

        {translating ? (
          <View style={styles.translatingBar} testID="translating-indicator">
            <ActivityIndicator size="small" color={colors.brandPrimary} />
            <Text style={styles.translatingText}>Traduzindo com IA…</Text>
          </View>
        ) : null}

        {permError ? (
          <View style={styles.permBar}>
            <Text style={styles.permText}>Precisamos de acesso ao microfone para gravar áudios.</Text>
            <Pressable onPress={() => Linking.openSettings()} testID="open-settings">
              <Text style={styles.permLink}>Abrir ajustes</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Reply / edit banner */}
        {replyTo || editing ? (
          <View style={styles.replyBanner}>
            <View style={styles.replyBannerBar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.replyBannerTitle}>
                {editing ? "Editando mensagem" : "Respondendo"}
              </Text>
              <Text style={styles.replyBannerText} numberOfLines={1}>
                {editing
                  ? editing.original_text
                  : replyTo?.sender_id === user?.id
                    ? replyTo?.original_text
                    : replyTo?.translated_text}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                if (editing) {
                  setEditing(null);
                  setText("");
                }
                setReplyTo(null);
              }}
              hitSlop={10}
              testID="cancel-reply-edit"
            >
              <Ionicons name="close-circle" size={22} color={colors.muted} />
            </Pressable>
          </View>
        ) : null}

        {/* Composer / recording */}
        {recording ? (
          <View style={[styles.composer, { paddingBottom: insets.bottom + 8 }]}>
            <Pressable onPress={() => finishRecording(false)} hitSlop={8} testID="cancel-recording">
              <Ionicons name="trash-outline" size={24} color={colors.error} />
            </Pressable>
            <View style={styles.recPulse}>
              <View style={styles.recDot} />
              <Text style={styles.recTime}>{formatDuration(recSeconds)}</Text>
              <Text style={styles.recHint}>Gravando… solte para enviar</Text>
            </View>
            <Pressable style={styles.sendBtn} onPress={() => finishRecording(true)} testID="stop-send-recording">
              <Ionicons name="send" size={20} color={colors.onBrandPrimary} />
            </Pressable>
          </View>
        ) : (
          <View style={[styles.composer, { paddingBottom: insets.bottom + 8 }]}>
            <View style={styles.inputWrap}>
              <TextInput
                testID="message-input"
                style={styles.input}
                placeholder={editing ? "Editar mensagem…" : "Mensagem"}
                placeholderTextColor={colors.muted}
                value={text}
                onChangeText={setText}
                multiline
              />
            </View>
            {text.trim() ? (
              <Pressable style={styles.sendBtn} onPress={handleSend} testID="send-button" disabled={sendMutation.isPending}>
                <Ionicons name={editing ? "checkmark" : "send"} size={20} color={colors.onBrandPrimary} />
              </Pressable>
            ) : (
              <Pressable style={styles.micBtn} onPress={startRecording} testID="mic-button">
                <Ionicons name="mic" size={24} color={colors.onBrandPrimary} />
              </Pressable>
            )}
          </View>
        )}
      </KeyboardAvoidingView>

      <MessageActions
        message={selected}
        isMine={selected?.sender_id === user?.id}
        onClose={() => setSelected(null)}
        onReact={(emoji) => {
          if (selected) reactMutation.mutate({ id: selected.id, emoji });
          setSelected(null);
        }}
        onReply={() => {
          setReplyTo(selected);
          setEditing(null);
          setSelected(null);
        }}
        onEdit={() => {
          if (selected) {
            setEditing(selected);
            setReplyTo(null);
            setText(selected.original_text);
          }
          setSelected(null);
        }}
        onDelete={() => {
          if (selected) deleteMutation.mutate(selected.id);
          setSelected(null);
        }}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerInfo: { flex: 1 },
  headerName: { color: colors.onSurface, fontSize: 17, fontWeight: "700" },
  headerSub: { color: colors.muted, fontSize: 12.5, marginTop: 1 },

  emptyChat: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12, paddingHorizontal: 40 },
  datePill: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 16,
  },
  datePillText: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  emptyChatText: { color: colors.muted, fontSize: 15, textAlign: "center", lineHeight: 21 },

  translatingBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 6,
  },
  translatingText: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "500" },

  permBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginHorizontal: 12,
    marginBottom: 6,
    padding: 12,
    backgroundColor: colors.brandTertiary,
    borderRadius: 12,
  },
  permText: { flex: 1, color: colors.onBrandTertiary, fontSize: 13 },
  permLink: { color: colors.brandPrimary, fontSize: 13, fontWeight: "700" },

  replyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  replyBannerBar: { width: 3, height: 32, borderRadius: 2, backgroundColor: colors.brandPrimary },
  replyBannerTitle: { color: colors.brandPrimary, fontSize: 13, fontWeight: "700" },
  replyBannerText: { color: colors.muted, fontSize: 13, marginTop: 1 },

  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  inputWrap: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 22,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
    justifyContent: "center",
  },
  input: { color: colors.onSurface, fontSize: 16, paddingVertical: Platform.OS === "ios" ? 12 : 8, maxHeight: 120 },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  recPulse: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  recDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.error },
  recTime: { color: colors.onSurface, fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"] },
  recHint: { color: colors.muted, fontSize: 13 },
}));
