/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        night: {
          950: "#0A0B1E",
          900: "#0F1024",
          800: "#161835",
          700: "#1F2247",
          600: "#2A2D5A"
        },
        violet: {
          400: "#9B84FF",
          500: "#7C5CFC",
          600: "#6743E8"
        },
        coral: {
          400: "#FF6B7A",
          500: "#FF4757",
          600: "#E8394A"
        },
        teal: {
          400: "#4FF0C7",
          500: "#2EE6A8",
          600: "#20C98F"
        },
        amber: {
          400: "#FFC24B",
          500: "#FF9F1C"
        }
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"]
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(124, 92, 252, 0.45)",
        "glow-coral": "0 0 40px -8px rgba(255, 71, 87, 0.55)"
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out"
      }
    }
  },
  plugins: []
};
