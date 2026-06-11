import { defineConfig } from 'vite';

// GitHub Pages はリポジトリ名のサブパスで配信されるため base を固定する
export default defineConfig({
  base: '/potal-test-fable-05/',
  build: {
    target: 'es2022',
  },
});
