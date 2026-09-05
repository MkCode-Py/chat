import Ionicons from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Text, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { makeStyles, useTheme } from "@/src/theme";

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <LinearGradient colors={[colors.brandPrimary, "#001E5C"]} style={styles.container}>
      <View style={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.hero}>
          <View style={styles.logoBadge}>
            <Ionicons name="swap-horizontal" size={40} color={colors.onBrandPrimary} />
          </View>
          <Text style={styles.title} testID="welcome-title">
            Ponte
          </Text>
          <Text style={styles.subtitle}>
            Converse sem barreiras. Suas mensagens traduzidas com naturalidade entre português e espanhol.
          </Text>
        </View>

        <View style={styles.features}>
          <Feature icon="sparkles" text="Tradução contextual por IA" />
          <Feature icon="mic" text="Mensagens de voz traduzidas" />
          <Feature icon="flash" text="Rápido, em tempo real" />
        </View>

        <View style={styles.actions}>
          <Pressable
            testID="welcome-register-button"
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={() => router.push("/(auth)/register")}
          >
            <Text style={styles.primaryBtnText}>Criar conta</Text>
          </Pressable>
          <Pressable
            testID="welcome-login-button"
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            onPress={() => router.push("/(auth)/login")}
          >
            <Text style={styles.secondaryBtnText}>Já tenho conta</Text>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

function Feature({ icon, text }: { icon: any; text: string }) {
  const styles = useStyles();
  return (
    <View style={styles.feature}>
      <Ionicons name={icon} size={18} color="#FFFFFF" />
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: "space-between" },
  hero: { alignItems: "flex-start", gap: 16, marginTop: 24 },
  logoBadge: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: "#FFFFFF", fontSize: 44, fontWeight: "800", letterSpacing: -1 },
  subtitle: { color: "rgba(255,255,255,0.85)", fontSize: 17, lineHeight: 24 },
  features: { gap: 14, marginVertical: 24 },
  feature: { flexDirection: "row", alignItems: "center", gap: 12 },
  featureText: { color: "#FFFFFF", fontSize: 15, fontWeight: "500" },
  actions: { gap: 12 },
  primaryBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: "center",
  },
  primaryBtnText: { color: colors.brandPrimary, fontSize: 17, fontWeight: "700" },
  secondaryBtn: {
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
  },
  secondaryBtnText: { color: "#FFFFFF", fontSize: 17, fontWeight: "600" },
  pressed: { opacity: 0.8 },
}));
