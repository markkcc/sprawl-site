import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { imagetools } from 'vite-imagetools'

// https://vite.dev/config/
export default defineConfig({
  // imagetools resizes the recap photos at build time; see recapSlides.js.
  plugins: [react(), imagetools()],
  base: '/',
})
