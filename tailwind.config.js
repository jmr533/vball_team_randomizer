/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Barlow Condensed"', '"Arial Narrow"', 'sans-serif'],
        mono: ['"Space Mono"', 'ui-monospace', '"SF Mono"', 'Menlo', 'monospace']
      }
    }
  },
  plugins: []
};