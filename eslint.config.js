import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  // file copiati dalla cartella del progetto (style/, content/): si controllano là
  { ignores: ["dist", "node_modules", "src/style", "src/assets", "playwright-report", "test-results"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // gli script girano in Node ma passano funzioni al browser (page.evaluate)
  { files: ["scripts/**", "e2e/**", "*.config.*"], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  { files: ["public/sw.js"], languageOptions: { globals: globals.serviceworker } },
  {
    rules: {
      // i dati del percorso arrivano da JSON non tipizzato
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
