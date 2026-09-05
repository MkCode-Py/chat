import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, type ConversationSummary } from "@/src/api/client";
import { Avatar } from "@/src/components/Avatar";
import { useAuth } from "@/src/context/auth";
import { formatListTime } from "@/src/lib/format";
import { makeStyles, useTheme } from "@/src/theme";

const EMPTY_IMG =
  "https://images.unsplash.com/photo-1662974770404-468fd9660389?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNTl8MHwxfHNlYXJjaHwxfHxjbGVhbiUyMG1lc3NhZ2luZyUyMGFwcCUyMGVtcHR5JTIwc3RhdGUlMjBpbGx1c3RyYXRpb258ZW58MHx8fHwxNzg4NjA5Mjc3fDA&ixlib=rb-4.1.0&q=85";

export default function Chats() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["conversations"],
    queryFn: api.listConversations,
    refetchInterval: 4000,
  });

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View>
          <Text style={styles.headerTitle} testID="chats-title">
            Ponte
          </Text>
          <Text style={styles.headerSub}>Olá, {user?.display_name?.split(" ")[0]}</Text>
        </View>
        <Pressable onPress={() => router.push("/(app)/profile")} hitSlop={8} testID="open-profile">
          {user ? <Avatar name={user.display_name} color={user.avatar_color} size={40} language={user.language} /> : null}
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={
            <View style={styles.empty} testID="chats-empty">
              <Image source={{ uri: EMPTY_IMG }} style={styles.emptyImg} contentFit="contain" />
              <Text style={styles.emptyTitle}>Nenhuma conversa ainda</Text>
              <Text style={styles.emptyText}>Busque uma pessoa pelo @username para começar a conversar.</Text>
              <Pressable style={styles.emptyBtn} onPress={() => router.push("/(app)/search")} testID="empty-new-chat">
                <Ionicons name="search" size={18} color={colors.onBrandPrimary} />
                <Text style={styles.emptyBtnText}>Encontrar alguém</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => <ConversationRow item={item} meId={user?.id ?? ""} />}
        />
      )}

      <Pressable
        testID="new-chat-fab"
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => router.push("/(app)/search")}
      >
        <Ionicons name="create-outline" size={26} color={colors.onBrandPrimary} />
      </Pressable>
    </View>
  );
}

function ConversationRow({ item, meId }: { item: ConversationSummary; meId: string }) {
  const styles = useStyles();
  const router = useRouter();
  const preview = item.last_message?.preview ?? "Toque para conversar";
  const isMine = item.last_message?.sender_id === meId;

  return (
    <Pressable
      testID={`conversation-row-${item.other_user.username}`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => router.push(`/(app)/conversation/${item.id}`)}
    >
      <Avatar name={item.other_user.display_name} color={item.other_user.avatar_color} size={52} language={item.other_user.language} />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.rowName} numberOfLines={1}>
            {item.other_user.display_name}
          </Text>
          <Text style={styles.rowTime}>{formatListTime(item.last_message_at)}</Text>
        </View>
        <View style={styles.rowBottom}>
          <Text style={[styles.rowPreview, item.unread_count > 0 && styles.rowPreviewUnread]} numberOfLines={1}>
            {isMine ? "Você: " : ""}
            {preview}
          </Text>
          {item.unread_count > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.unread_count}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: { color: colors.onSurface, fontSize: 30, fontWeight: "800", letterSpacing: -0.5 },
  headerSub: { color: colors.muted, fontSize: 14, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  rowPressed: { backgroundColor: colors.surfaceSecondary },
  rowBody: { flex: 1, gap: 4 },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowName: { color: colors.onSurface, fontSize: 17, fontWeight: "700", flex: 1, marginRight: 8 },
  rowTime: { color: colors.muted, fontSize: 12 },
  rowBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  rowPreview: { color: colors.muted, fontSize: 15, flex: 1 },
  rowPreviewUnread: { color: colors.onSurfaceSecondary, fontWeight: "500" },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: { color: colors.onBrandPrimary, fontSize: 12, fontWeight: "700" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 12 },
  emptyImg: { width: 180, height: 180, marginBottom: 8 },
  emptyTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "700" },
  emptyText: { color: colors.muted, fontSize: 15, textAlign: "center", lineHeight: 21 },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.brandPrimary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 22,
    marginTop: 12,
  },
  emptyBtnText: { color: colors.onBrandPrimary, fontSize: 16, fontWeight: "700" },
  fab: {
    position: "absolute",
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
}));
