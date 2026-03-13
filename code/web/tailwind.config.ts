import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg:             "hsl(var(--c-bg) / <alpha-value>)",
        "bg-subtle":    "hsl(var(--c-bg-subtle) / <alpha-value>)",
        "bg-elevated":  "hsl(var(--c-bg-elevated) / <alpha-value>)",
        border:         "hsl(var(--c-border) / <alpha-value>)",
        "border-hover": "hsl(var(--c-border-hover) / <alpha-value>)",
        text:           "hsl(var(--c-text) / <alpha-value>)",
        "text-dim":     "hsl(var(--c-text-dim) / <alpha-value>)",
        "text-muted":   "hsl(var(--c-text-muted) / <alpha-value>)",
        primary:        "hsl(var(--c-primary) / <alpha-value>)",
        "primary-fg":   "hsl(var(--c-primary-fg) / <alpha-value>)",
        success:        "hsl(var(--c-success) / <alpha-value>)",
        warning:        "hsl(var(--c-warning) / <alpha-value>)",
        danger:         "hsl(var(--c-danger) / <alpha-value>)",
      },
      fontFamily: {
        ui:   ["var(--font-ui)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        sm:   "var(--radius-sm)",
        md:   "var(--radius-md)",
        lg:   "var(--radius-lg)",
        xl:   "var(--radius-xl)",
        full: "var(--radius-full)",
      },
      spacing: {
        1:  "var(--space-1)",
        2:  "var(--space-2)",
        3:  "var(--space-3)",
        4:  "var(--space-4)",
        5:  "var(--space-5)",
        6:  "var(--space-6)",
        8:  "var(--space-8)",
        10: "var(--space-10)",
        12: "var(--space-12)",
      },
    },
  },
} satisfies Config;
