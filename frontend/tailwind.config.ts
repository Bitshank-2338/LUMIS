import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0A0A0F",
        surface: "#12121B",
        elevated: "#1A1A26",
        border: "#262636",
        accent: {
          primary: "#6366F1",
          secondary: "#8B5CF6",
          glow: "#A78BFA",
        },
        severity: {
          critical: "#EF4444",
          high: "#F97316",
          medium: "#EAB308",
          low: "#84CC16",
          ok: "#22C55E",
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "grid-pattern":
          "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 20px rgba(99, 102, 241, 0.5)" },
          "50%": { opacity: "0.7", boxShadow: "0 0 40px rgba(99, 102, 241, 0.8)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
