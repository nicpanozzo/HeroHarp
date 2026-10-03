import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  // file copiati dalla cartella del progetto (style/, content/): si controllano là
  { ignores: ["dist", "node_modules", "src/style", "src/assets", "playwright-report", "test-results"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ["scripts/**", "e2e/**", "*.config.*"], languageOptions: { globals: globals.node } },
  {
    rules: {
      // i dati del percorso arrivano da JSON non tipizzato
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
