import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, View } from "react-native";

import { useTheme } from "@/src/theme";

// Splash while auth initializes; useProtectedRoute() redirects away from "/".
export default function Index() {
  const { colors } = useTheme();
  return (
    <LinearGradient
      colors={[colors.brandPrimary, colors.brand]}
      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
    >
      <View testID="splash-loading">
        <ActivityIndicator size="large" color={colors.onBrandPrimary} />
      </View>
    </LinearGradient>
  );
}
