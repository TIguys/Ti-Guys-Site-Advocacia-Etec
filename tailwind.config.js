module.exports = {
  content: ['./index.html', './app.js'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          900: '#2B050B',
          800: '#3D0B12',
          700: '#54121B',
          600: '#701A24',
          50: '#FAF4F5'
        },
        gold: {
          600: '#9E7D23',
          500: '#B89635',
          400: '#CFAC4C',
          100: '#FDF9EE',
          50: '#FEFCF7'
        },
        paper: '#FAF9F6',
        darkbg: '#0F172A',
        darksurface: '#1E293B',
        darkcard: '#334155'
      },
      fontFamily: {
        serif: ['"Noto Serif"', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', '"Plus Jakarta Sans"', 'sans-serif'],
        ui: ['"Plus Jakarta Sans"', 'sans-serif']
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries')
  ]
};
