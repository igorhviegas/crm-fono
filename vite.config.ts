import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // .claude/worktrees guarda cópias do projeto (outras sessões); não devem rodar junto
  test: { exclude: ['**/node_modules/**', '.claude/**'] },
})
