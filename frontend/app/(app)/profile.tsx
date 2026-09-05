import Ionicons from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/src/components/Avatar";
import { useAuth } from "@/src/context/auth";
import { makeStyles, useTheme } from "@/src/theme";

export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const { user, signOut } = useAuth();

  const logout = async () => {
    await signOut();
    router.replace("/(auth)/welcome");
  };

  if (!user) return null;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="profile-back">
          <Ionicons name="chevron-down" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Perfil</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.hero}>
        <Avatar name={user.display_name} color={user.avatar_color} size={96} language={user.language} />
        <Text style={styles.name}>{user.display_name}</Text>
        <Text style={styles.username}>@{user.username}</Text>
      </View>

      <View style={styles.card}>
        <InfoRow icon="mail-outline" label="E-mail" value={user.email ?? "—"} />
        <View style={styles.divider} />
        <InfoRow
          icon="language-outline"
          label="Idioma"
          value={user.language === "pt" ? "🇧🇷 Português" : "🇵🇾 Español"}
        />
      </View>

      <View style={styles.infoBanner}>
        <Ionicons name="sparkles-outline" size={18} color={colors.brandPrimary} />
        <Text style={styles.infoBannerText}>
          Suas mensagens são traduzidas automaticamente para o idioma de quem recebe.
        </Text>
      </View>

      <Pressable
        testID="logout-button"
        style={({ pressed }) => [styles.logout, pressed && { opacity: 0.85 }]}
        onPress={logout}
      >
        <Ionicons name="log-out-outline" size={20} color={colors.error} />
        <Text style={styles.logoutText}>Sair da conta</Text>
      </Pressable>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={20} color={colors.muted} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
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
  hero: { alignItems: "center", gap: 8, marginTop: 20, marginBottom: 28 },
  name: { color: colors.onSurface, fontSize: 24, fontWeight: "800", marginTop: 12 },
  username: { color: colors.muted, fontSize: 16 },
  card: {
    marginHorizontal: 20,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 16 },
  infoLabel: { color: colors.muted, fontSize: 13 },
  infoValue: { color: colors.onSurface, fontSize: 16, fontWeight: "500", marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.divider },
  infoBanner: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: colors.brandTertiary,
    borderRadius: 14,
    padding: 14,
  },
  infoBannerText: { flex: 1, color: colors.onBrandTertiary, fontSize: 14, lineHeight: 19 },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 28,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoutText: { color: colors.error, fontSize: 16, fontWeight: "600" },
}));
