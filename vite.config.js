import { defineConfig } from 'vite'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        minecraft: resolve(__dirname, 'minecraft.html'),
        merge: resolve(__dirname, 'merge.html'),
        // yeni oyun əlavə etdikcə bura yeni sətir əlavə et, məsələn:
        // game3: resolve(__dirname, 'game3.html'),
      }
    }
  }
})