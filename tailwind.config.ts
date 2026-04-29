import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-dm-sans)", "sans-serif"],
      },
      colors: {
        navy: "#0A2342",
        orange: "#F4821F",
        cream: "#F5F0E8",
        border: "#E8E2D9",
        "border-light": "#F0EAE0",
        "text-primary": "#1A1612",
        "text-secondary": "#8A7E6E",
        "text-muted": "#A09880",
        destructive: "#C0392B",
      },
      borderRadius: {
        card: "10px",
        pill: "999px",
      },
    },
  },
  plugins: [],
};

export default config;
