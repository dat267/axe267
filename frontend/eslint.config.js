import js from "@eslint/js";
import svelte from "eslint-plugin-svelte";
import globals from "globals";

export default [
  js.configs.recommended,
  ...svelte.configs["flat/recommended"],
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        Bun: "readonly",
        $state: "readonly",
        $derived: "readonly",
        $props: "readonly",
        $effect: "readonly",
        $inspect: "readonly",
        $host: "readonly",
        $bindable: "readonly",
      },
    },
    rules: {
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "svelte/no-at-html-tags": "off",
      "svelte/require-each-key": "warn",
    },
  },
  {
    ignores: ["dist/", "node_modules/", "coverage/"],
  },
];
