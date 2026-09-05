import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, type User } from "@/src/api/client";
import { Avatar } from "@/src/components/Avatar";
import { makeStyles, useTheme } from "@/src/theme";

export default function Search() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => api.searchUsers(debounced),
    enabled: debounced.length >= 1,
  });

  const startMutation = useMutation({
    mutationFn: (username: string) => api.startConversation(username),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      router.replace(`/(app)/conversation/${res.id}`);
    },
  });

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="search-back">
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Nova conversa</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          testID="search-input"
          style={styles.searchInput}
          placeholder="Buscar por @username"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />
        {isFetching ? <ActivityIndicator color={colors.muted} /> : null}
      </View>

      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 8 }}
        ListEmptyComponent={
          <View style={styles.empty} testID="search-empty">
            <Ionicons
              name={debounced ? "person-outline" : "search-outline"}
              size={44}
              color={colors.surfaceTertiary}
            />
            <Text style={styles.emptyText}>
              {debounced
                ? isFetching
                  ? "Buscando..."
                  : "Nenhum usuário encontrado."
                : "Digite um @username para encontrar alguém."}
            </Text>
          </View>
        }
        renderItem={({ item }: { item: User }) => (
          <Pressable
            testID={`search-result-${item.username}`}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => startMutation.mutate(item.username)}
            disabled={startMutation.isPending}
          >
            <Avatar name={item.display_name} color={item.avatar_color} size={48} language={item.language} />
            <View style={styles.rowBody}>
              <Text style={styles.rowName}>{item.display_name}</Text>
              <Text style={styles.rowUsername}>@{item.username}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        )}
      />
    </View>
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
  headerTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "700" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.onSurface, fontSize: 16, paddingVertical: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  rowPressed: { backgroundColor: colors.surfaceSecondary },
  rowBody: { flex: 1 },
  rowName: { color: colors.onSurface, fontSize: 17, fontWeight: "600" },
  rowUsername: { color: colors.muted, fontSize: 14, marginTop: 2 },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 14, paddingHorizontal: 40 },
  emptyText: { color: colors.muted, fontSize: 15, textAlign: "center" },
}));
