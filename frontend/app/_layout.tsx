import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LogBox, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { AuthProvider, useProtectedRoute } from "@/src/context/auth";
import { queryClient } from "@/src/query-client";
import { useTheme } from "@/src/theme";

LogBox.ignoreAllLogs(true);

function RootNavigator() {
  useProtectedRoute();
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)/welcome" />
      <Stack.Screen name="(auth)/login" />
      <Stack.Screen name="(auth)/register" />
      <Stack.Screen name="(app)/chats" />
      <Stack.Screen name="(app)/search" options={{ animation: "slide_from_bottom" }} />
      <Stack.Screen name="(app)/profile" options={{ animation: "slide_from_bottom" }} />
      <Stack.Screen name="(app)/conversation/[id]" />
    </Stack>
  );
}

export default function RootLayout() {
  const { scheme, colors } = useTheme();
  const [fontsLoaded] = useFonts({
    Ionicons: require("@react-native-vector-icons/ionicons/fonts/Ionicons.ttf"),
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <BottomSheetModalProvider>
                <ErrorBoundary>
                  <StatusBar style={scheme === "dark" ? "light" : "dark"} />
                  {fontsLoaded ? (
                    <RootNavigator />
                  ) : (
                    <View style={{ flex: 1, backgroundColor: colors.brandPrimary }} />
                  )}
                </ErrorBoundary>
              </BottomSheetModalProvider>
            </AuthProvider>
          </QueryClientProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
