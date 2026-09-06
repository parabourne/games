import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        minecraft: resolve(__dirname, 'minecraft.html'),
        // yeni oyun əlavə etdikcə bura yeni sətir əlavə et, məsələn:
        // game2: resolve(__dirname, 'game2.html'),
      }
    }
  }
})