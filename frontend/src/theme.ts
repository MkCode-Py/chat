// Design tokens for Ponte — bilingual chat. Light + dark, iOS-Native Clean.
// Keys mirror the "color" block of /app/design_guidelines.json. Brand = the blue
// found in both Brazil & Paraguay flags (#0038A8), accent = warm amber.

import { useMemo } from "react";
import { StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FFFFFF",
  onSurface: "#1C1C1E",
  surfaceSecondary: "#F2F2F7",
  onSurfaceSecondary: "#3A3A3C",
  surfaceTertiary: "#E5E5EA",
  onSurfaceTertiary: "#4B5563",
  surfaceInverse: "#1C1C1E",
  onSurfaceInverse: "#FFFFFF",
  muted: "#8E8E93",

  brand: "#0038A8",
  onBrand: "#FFFFFF",
  brandPrimary: "#0038A8",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#F5A623",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#E6F0FF",
  onBrandTertiary: "#0038A8",

  success: "#34C759",
  onSuccess: "#FFFFFF",
  warning: "#FF9500",
  onWarning: "#FFFFFF",
  error: "#FF3B30",
  onError: "#FFFFFF",
  info: "#007AFF",
  onInfo: "#FFFFFF",

  border: "#E5E5EA",
  borderStrong: "#C7C7CC",
  divider: "#E5E5EA",

  // bubble-specific
  bubbleReceived: "#F2F2F7",
  onBubbleReceived: "#1C1C1E",
  onBubbleReceivedMuted: "#8E8E93",
  bubbleSent: "#0038A8",
  onBubbleSent: "#FFFFFF",
  onBubbleSentMuted: "rgba(255,255,255,0.7)",
};

const dark: typeof light = {
  surface: "#000000",
  onSurface: "#FFFFFF",
  surfaceSecondary: "#1C1C1E",
  onSurfaceSecondary: "#EBEBF0",
  surfaceTertiary: "#2C2C2E",
  onSurfaceTertiary: "#C7C7CC",
  surfaceInverse: "#F2F2F7",
  onSurfaceInverse: "#1C1C1E",
  muted: "#8E8E93",

  brand: "#0A4BD9",
  onBrand: "#FFFFFF",
  brandPrimary: "#0A4BD9",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#F5A623",
  onBrandSecondary: "#1C1C1E",
  brandTertiary: "#0A2452",
  onBrandTertiary: "#9EC1FF",

  success: "#32D74B",
  onSuccess: "#0A2A12",
  warning: "#FF9F0A",
  onWarning: "#3A2600",
  error: "#FF453A",
  onError: "#3A0B08",
  info: "#0A84FF",
  onInfo: "#FFFFFF",

  border: "#2C2C2E",
  borderStrong: "#3A3A3C",
  divider: "#2C2C2E",

  bubbleReceived: "#1C1C1E",
  onBubbleReceived: "#FFFFFF",
  onBubbleReceivedMuted: "#8E8E93",
  bubbleSent: "#0A4BD9",
  onBubbleSent: "#FFFFFF",
  onBubbleSentMuted: "rgba(255,255,255,0.72)",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light, dark };

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
