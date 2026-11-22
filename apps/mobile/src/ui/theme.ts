import { useColorScheme } from "react-native";

export interface Theme {
  bg: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
  onPrimary: string;
  soft: string;
  warnBg: string;
  warnText: string;
  okText: string;
  error: string;
}

const light: Theme = {
  bg: "#f5f8f7",
  card: "#ffffff",
  text: "#0f1f1a",
  muted: "#52635e",
  border: "#d9e3df",
  primary: "#0b6e4f",
  onPrimary: "#ffffff",
  soft: "#e2f1eb",
  warnBg: "#fdf1dc",
  warnText: "#7a4600",
  okText: "#157a3c",
  error: "#b42318",
};

const dark: Theme = {
  bg: "#0d1512",
  card: "#151f1b",
  text: "#e3ece9",
  muted: "#9db0aa",
  border: "#27352f",
  primary: "#4fd1a0",
  onPrimary: "#062b1f",
  soft: "#163329",
  warnBg: "#3a2c14",
  warnText: "#f2c37a",
  okText: "#5fd88a",
  error: "#ff8a7a",
};

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}
