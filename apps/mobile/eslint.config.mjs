import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules/**", "dist-check/**", ".expo/**", "metro.config.js", "expo-env.d.ts", "dist/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
