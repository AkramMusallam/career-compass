/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#4F46E5",
          50: "#EEF2FF",
          100: "#E0E7FF",
          200: "#C7D2FE",
          300: "#A5B4FC",
          400: "#818CF8",
          500: "#6366F1",
          600: "#4F46E5",
          700: "#4338CA",
          800: "#3730A3",
          900: "#312E81",
        },
        secondary: {
          DEFAULT: "#8B5CF6",
          50: "#F5F3FF",
          100: "#EDE9FE",
          200: "#DDD6FE",
          300: "#C4B5FD",
          400: "#A78BFA",
          500: "#8B5CF6",
          600: "#7C3AED",
        },
        accent: {
          DEFAULT: "#F43F5E",
          50: "#FFF1F2",
          100: "#FFE4E6",
          500: "#F43F5E",
          600: "#E11D48",
        },
        danger: {
          DEFAULT: "#EF4444",
          50: "#FEF2F2",
          100: "#FEE2E2",
        },
        warning: {
          DEFAULT: "#F59E0B",
          50: "#FFFBEB",
          100: "#FEF3C7",
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
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        pulse_soft: {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.8 },
        },
        fade_in_up: {
          "0%": { opacity: 0, transform: "translateY(20px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        }
      },
      animation: {
        "compass-spin": "spin_slow 4s cubic-bezier(0.4, 0, 0.2, 1) infinite",
        "float": "float 3s ease-in-out infinite",
        "pulse-soft": "pulse_soft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in-up": "fade_in_up 0.5s ease-out forwards",
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
        'glow': '0 0 20px rgba(79, 70, 229, 0.4)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-pattern': "url('data:image/svg+xml,%3Csvg width=\"60\" height=\"60\" viewBox=\"0 0 60 60\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cg fill=\"none\" fill-rule=\"evenodd\"%3E%3Cg fill=\"%239C92AC\" fill-opacity=\"0.05\"%3E%3Cpath d=\"M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')",
      }
    },
  },
  plugins: [],
};