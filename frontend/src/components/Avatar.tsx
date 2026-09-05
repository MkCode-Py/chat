import { View, Text, StyleSheet } from "react-native";

import { initials } from "@/src/lib/format";

export function Avatar({
  name,
  color,
  size = 48,
  language,
}: {
  name: string;
  color: string;
  size?: number;
  language?: "pt" | "es";
}) {
  const flag = language === "pt" ? "🇧🇷" : language === "es" ? "🇵🇾" : null;
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        ]}
      >
        <Text style={{ color: "#FFFFFF", fontSize: size * 0.36, fontWeight: "700" }}>
          {initials(name)}
        </Text>
      </View>
      {flag ? (
        <View style={[styles.flagBadge, { borderRadius: size * 0.2 }]}>
          <Text style={{ fontSize: size * 0.26 }}>{flag}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: "center",
    justifyContent: "center",
  },
  flagBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 1,
  },
});
