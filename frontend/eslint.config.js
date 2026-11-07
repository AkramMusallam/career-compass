import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  { ignores: ["dist/**", "node_modules/**"] },
  {
    files: ["**/*.{js,jsx,cjs}"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } }, globals: { ...globals.browser, ...globals.node } },
    plugins: { "react-hooks": reactHooks },
    rules: { ...js.configs.recommended.rules, "no-empty": ["error", { allowEmptyCatch: true }], "no-unused-vars": "off", "no-undef": "off", "react-hooks/exhaustive-deps": "warn" },
  },
];

