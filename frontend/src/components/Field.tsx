import { useState } from "react";
import { Text, TextInput, View, Pressable, type TextInputProps } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";

import { makeStyles, useTheme } from "@/src/theme";

type Props = TextInputProps & {
  label: string;
  icon?: any;
  prefix?: string;
  secure?: boolean;
  testID?: string;
};

export function Field({ label, icon, prefix, secure, testID, style, ...rest }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [hidden, setHidden] = useState(!!secure);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        {icon ? <Ionicons name={icon} size={18} color={colors.muted} style={styles.leftIcon} /> : null}
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          testID={testID}
          style={[styles.input, style as any]}
          placeholderTextColor={colors.muted}
          secureTextEntry={hidden}
          autoCapitalize="none"
          autoCorrect={false}
          {...rest}
        />
        {secure ? (
          <Pressable onPress={() => setHidden((v) => !v)} hitSlop={10} testID="toggle-password-visibility">
            <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={20} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { gap: 6 },
  label: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "600", marginLeft: 4 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 52,
  },
  leftIcon: { marginRight: 8 },
  prefix: { color: colors.muted, fontSize: 16, fontWeight: "600", marginRight: 2 },
  input: { flex: 1, color: colors.onSurface, fontSize: 16, paddingVertical: 14 },
}));
