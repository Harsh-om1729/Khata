import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

const brand = '#0b5d3b';

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: {
      ...minimal2023Preset.maskable,
      padding: 0.2,
      resizeOptions: { background: brand },
    },
    apple: {
      ...minimal2023Preset.apple,
      resizeOptions: { background: brand },
    },
  },
  images: ['public/icon.svg'],
});
