/** Design tokens live as CSS variables (src/index.css) and are mapped here. */
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        midnight: token("bg"),
        surface: token("surface"),
        panel: token("panel"),
        line: token("line"),
        electric: token("electric"),
        signal: token("signal"),
        accent: token("accent"),
        ink: token("ink"),
        mute: token("mute"),
        ok: token("ok"),
        warn: token("warn"),
        bad: token("bad"),
      },
      fontFamily: {
        sans: ['"Segoe UI"', "Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        mono: ['"Cascadia Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: { card: "0 1px 0 0 rgb(255 255 255 / 0.03) inset, 0 8px 24px -12px rgb(0 0 0 / 0.6)" },
    },
  },
  plugins: [],
};
