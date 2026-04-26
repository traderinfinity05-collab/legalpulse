import type { Config } from "tailwindcss";

// Palette per the original brief: McKinsey-Insights restraint. Off-white paper,
// near-black ink, country-coded accents (deep blue / deep saffron). No gradients,
// no shadows, no rounded corners larger than 4px.

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FAFAF7",
        ink: "#0A0A0A",
        rule: "#E5E3DD",
        muted: "#5C5A52",
        usa: "#1B3A6B",
        india: "#C8651B",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        serif: ["var(--font-source-serif)", "Georgia", "serif"],
      },
      borderRadius: {
        none: "0",
        sm: "2px",
        DEFAULT: "4px",
      },
      maxWidth: {
        prose: "68ch",
      },
    },
  },
  plugins: [],
};

export default config;
