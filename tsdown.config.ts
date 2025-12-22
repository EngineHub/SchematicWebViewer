import { defineConfig } from 'tsdown';

export default defineConfig({
    entry: './src/index.ts',
    format: ['esm'],
    sourcemap: true,
    dts: true,
    platform: 'browser',
});
