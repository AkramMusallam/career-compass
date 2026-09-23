/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // نظام الألوان المحدد في القسم 3.1 من دليل التطوير:
        // أزرق أساسي (#1E40AF)، أخضر ثانوي (#059669)
        primary: {
          DEFAULT: "#1E40AF",
          50: "#EEF2FF",
          100: "#E0E7FF",
          400: "#3B5BDB",
          500: "#1E40AF",
          600: "#1A3690",
          700: "#152C73",
        },
        secondary: {
          DEFAULT: "#059669",
          50: "#ECFDF5",
          100: "#D1FAE5",
          500: "#059669",
          600: "#047857",
        },
        danger: {
          DEFAULT: "#DC2626",
          50: "#FEF2F2",
          100: "#FEE2E2",
        },
        warning: {
          DEFAULT: "#EA580C",
          50: "#FFF7ED",
          100: "#FFEDD5",
        },
      },
      fontFamily: {
        sans: ["Tajawal", "Cairo", "system-ui", "sans-serif"],
      },
      keyframes: {
        spin_slow: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "compass-spin": "spin_slow 3s linear infinite",
      },
    },
  },
  plugins: [],
};
