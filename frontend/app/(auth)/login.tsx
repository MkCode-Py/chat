import Ionicons from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Field } from "@/src/components/Field";
import { useAuth } from "@/src/context/auth";
import { makeStyles, useTheme } from "@/src/theme";

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError("Preencha e-mail e senha.");
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace("/(app)/chats");
    } catch (e: any) {
      setError(e?.message ?? "Falha ao entrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }]}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back} testID="login-back">
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>

        <Text style={styles.title}>Bem-vindo de volta</Text>
        <Text style={styles.subtitle}>Entre para continuar suas conversas.</Text>

        <View style={styles.form}>
          <Field
            testID="login-email-input"
            label="E-mail"
            icon="mail-outline"
            placeholder="voce@email.com"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Field
            testID="login-password-input"
            label="Senha"
            icon="lock-closed-outline"
            placeholder="Sua senha"
            secure
            value={password}
            onChangeText={setPassword}
          />
          {error ? (
            <Text style={styles.error} testID="login-error">
              {error}
            </Text>
          ) : null}
        </View>

        <Pressable
          testID="login-submit-button"
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          onPress={submit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <Text style={styles.buttonText}>Entrar</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.replace("/(auth)/register")} style={styles.linkRow} testID="go-to-register">
          <Text style={styles.linkMuted}>Não tem conta? </Text>
          <Text style={styles.link}>Criar agora</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { paddingHorizontal: 24, gap: 8, flexGrow: 1 },
  back: { alignSelf: "flex-start", marginBottom: 12 },
  title: { color: colors.onSurface, fontSize: 30, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontSize: 16, marginTop: 4 },
  form: { gap: 16, marginTop: 28 },
  error: { color: colors.error, fontSize: 14, marginLeft: 4 },
  button: {
    backgroundColor: colors.brandPrimary,
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: "center",
    marginTop: 28,
  },
  buttonText: { color: colors.onBrandPrimary, fontSize: 17, fontWeight: "700" },
  pressed: { opacity: 0.85 },
  linkRow: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  linkMuted: { color: colors.muted, fontSize: 15 },
  link: { color: colors.brandPrimary, fontSize: 15, fontWeight: "700" },
}));
