import Ionicons from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Field } from "@/src/components/Field";
import { useAuth } from "@/src/context/auth";
import { makeStyles, useTheme } from "@/src/theme";

export default function Register() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const { signUp } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [language, setLanguage] = useState<"pt" | "es">("pt");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    if (!displayName.trim() || !username.trim() || !email.trim() || !password) {
      setError("Preencha todos os campos.");
      return;
    }
    if (password.length < 6) {
      setError("A senha precisa ter ao menos 6 caracteres.");
      return;
    }
    setLoading(true);
    try {
      await signUp({
        display_name: displayName.trim(),
        username: username.trim().toLowerCase().replace(/^@/, ""),
        email: email.trim(),
        password,
        language,
      });
      router.replace("/(app)/chats");
    } catch (e: any) {
      setError(e?.message ?? "Falha ao criar conta.");
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
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back} testID="register-back">
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>

        <Text style={styles.title}>Criar sua conta</Text>
        <Text style={styles.subtitle}>É rápido. Escolha um @username único.</Text>

        <View style={styles.form}>
          <Field
            testID="register-name-input"
            label="Seu nome"
            icon="person-outline"
            placeholder="Ex: Bruno Silva"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
          />
          <Field
            testID="register-username-input"
            label="Username"
            prefix="@"
            placeholder="bruno"
            value={username}
            onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
          />
          <Field
            testID="register-email-input"
            label="E-mail"
            icon="mail-outline"
            placeholder="voce@email.com"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Field
            testID="register-password-input"
            label="Senha"
            icon="lock-closed-outline"
            placeholder="Mínimo 6 caracteres"
            secure
            value={password}
            onChangeText={setPassword}
          />

          <View style={styles.langWrap}>
            <Text style={styles.langLabel}>Seu idioma</Text>
            <View style={styles.langRow}>
              <LangOption
                active={language === "pt"}
                onPress={() => setLanguage("pt")}
                flag="🇧🇷"
                label="Português"
                testID="lang-pt"
              />
              <LangOption
                active={language === "es"}
                onPress={() => setLanguage("es")}
                flag="🇵🇾"
                label="Español"
                testID="lang-es"
              />
            </View>
          </View>

          {error ? (
            <Text style={styles.error} testID="register-error">
              {error}
            </Text>
          ) : null}
        </View>

        <Pressable
          testID="register-submit-button"
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          onPress={submit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <Text style={styles.buttonText}>Criar conta</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.replace("/(auth)/login")} style={styles.linkRow} testID="go-to-login">
          <Text style={styles.linkMuted}>Já tem conta? </Text>
          <Text style={styles.link}>Entrar</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

function LangOption({
  active,
  onPress,
  flag,
  label,
  testID,
}: {
  active: boolean;
  onPress: () => void;
  flag: string;
  label: string;
  testID: string;
}) {
  const styles = useStyles();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[styles.langOption, active && styles.langOptionActive]}
    >
      <Text style={styles.langFlag}>{flag}</Text>
      <Text style={[styles.langText, active && styles.langTextActive]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { paddingHorizontal: 24, gap: 8, flexGrow: 1 },
  back: { alignSelf: "flex-start", marginBottom: 12 },
  title: { color: colors.onSurface, fontSize: 30, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontSize: 16, marginTop: 4 },
  form: { gap: 16, marginTop: 24 },
  error: { color: colors.error, fontSize: 14, marginLeft: 4 },
  langWrap: { gap: 8 },
  langLabel: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "600", marginLeft: 4 },
  langRow: { flexDirection: "row", gap: 12 },
  langOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  langOptionActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  langFlag: { fontSize: 20 },
  langText: { color: colors.onSurfaceSecondary, fontSize: 15, fontWeight: "600" },
  langTextActive: { color: colors.brandPrimary },
  button: {
    backgroundColor: colors.brandPrimary,
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: "center",
    marginTop: 24,
  },
  buttonText: { color: colors.onBrandPrimary, fontSize: 17, fontWeight: "700" },
  pressed: { opacity: 0.85 },
  linkRow: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  linkMuted: { color: colors.muted, fontSize: 15 },
  link: { color: colors.brandPrimary, fontSize: 15, fontWeight: "700" },
}));
