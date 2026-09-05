import Ionicons from "@react-native-vector-icons/ionicons";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type Message } from "@/src/api/client";
import { makeStyles, useTheme } from "@/src/theme";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export function MessageActions({
  message,
  isMine,
  onClose,
  onReact,
  onReply,
  onEdit,
  onDelete,
}: {
  message: Message | null;
  isMine: boolean;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={!!message} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="action-backdrop">
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.reactionsRow}>
            {QUICK_EMOJIS.map((emoji) => (
              <Pressable
                key={emoji}
                testID={`react-${emoji}`}
                style={({ pressed }) => [styles.emojiBtn, pressed && styles.pressed]}
                onPress={() => onReact(emoji)}
              >
                <Text style={styles.emoji}>{emoji}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.actions}>
            <ActionItem icon="arrow-undo-outline" label="Responder" onPress={onReply} testID="action-reply" />
            {isMine && message?.type === "text" ? (
              <>
                <View style={styles.divider} />
                <ActionItem icon="create-outline" label="Editar" onPress={onEdit} testID="action-edit" />
              </>
            ) : null}
            {isMine ? (
              <>
                <View style={styles.divider} />
                <ActionItem
                  icon="trash-outline"
                  label="Apagar"
                  onPress={onDelete}
                  color={colors.error}
                  testID="action-delete"
                />
              </>
            ) : null}
          </View>

          <Pressable style={styles.cancel} onPress={onClose} testID="action-cancel">
            <Text style={styles.cancelText}>Cancelar</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

function ActionItem({
  icon,
  label,
  onPress,
  color,
  testID,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  color?: string;
  testID: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      style={({ pressed }) => [styles.actionItem, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Text style={[styles.actionLabel, { color: color ?? colors.onSurface }]}>{label}</Text>
      <Ionicons name={icon} size={22} color={color ?? colors.onSurface} />
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: { paddingHorizontal: 12, gap: 10 },
  reactionsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  emojiBtn: { padding: 6, borderRadius: 999 },
  emoji: { fontSize: 28 },
  actions: { backgroundColor: colors.surface, borderRadius: 16, overflow: "hidden" },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  actionLabel: { fontSize: 17, fontWeight: "500" },
  divider: { height: 1, backgroundColor: colors.divider, marginLeft: 18 },
  cancel: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  cancelText: { color: colors.brandPrimary, fontSize: 17, fontWeight: "700" },
  pressed: { backgroundColor: colors.surfaceSecondary },
}));
