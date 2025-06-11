import { defineConfig, moduleTools } from '@modern-js/module-tools';

export default defineConfig({
  plugins: [moduleTools()],
  buildConfig: {
    buildType: 'bundle',
    format: 'cjs',
    target: 'es2020',
    outDir: 'dist',
    dts: {
      respectExternal: false,
    },
    externals: [
      // Core dependencies
      'misoai-core',
      'misoai-shared',
      'misoai-web',

      // Optional native dependencies
      'robotjs',
      '@nut-tree/nut-js',
      'screenshot-desktop',
      'active-win',
      'node-ffi-napi',
      'ref-napi',
      'ref-struct-di',
      'windows-window-manager',

      // Node.js built-ins
      'child_process',
      'fs',
      'path',
      'os',
      'util',
    ],
  },
});
