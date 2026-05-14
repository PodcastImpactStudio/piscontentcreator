import { createContext, useContext } from "react";

export const DARK_THEME = {
  bg: "#1A1A1A",
  surface: "#212121",
  card: "#2A2520",
  cardBorder: "#3A3A3A",
  text: "#FFFFFF",
  textSecondary: "#CECECE",
  textMuted: "#FFFFFF",
  coral: "#FF3131",
  coralSoft: "#FF313112",
  coralMid: "#FF313140",
  red: "#FF3131",
};

export const LIGHT_THEME = {
  bg: "#F5F0E8",
  surface: "#FDFAF5",
  card: "#FFFFFF",
  cardBorder: "#E2D9CC",
  text: "#1A1A1A",
  textSecondary: "#4A3F35",
  textMuted: "#6B5E52",
  coral: "#C41230",
  coralSoft: "#C4123010",
  coralMid: "#C4123028",
  red: "#C41230",
};

export const ThemeContext = createContext({ T: DARK_THEME, theme: "dark", toggleTheme: () => {} });
export function useTheme() { return useContext(ThemeContext); }
