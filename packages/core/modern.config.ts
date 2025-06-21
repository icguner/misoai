import { defineConfig, moduleTools } from '@modern-js/module-tools';
import { version } from './package.json';

export default defineConfig({
  plugins: [moduleTools()],
  buildPreset: 'npm-library',
  buildConfig: {
    input: {
      index: 'src/index.ts',
      utils: 'src/utils.ts',
      tree: 'src/tree.ts',
      'ai-model': 'src/ai-model/index.ts',
    },
    externals: [
      'langsmith',
      'react',
      'react-dom',
      '@types/react',
      '@types/react-dom',
      'csstype',
      'prop-types',
      '@types/prop-types',
      // Sharp and its native dependencies
      'sharp',
      /@img\/sharp-.*/,
      // Internal workspace packages
      'rfi-ai-shared',
    ],
    target: 'es2020',
    define: {
      __VERSION__: version,
    },
    splitting: false,
    sourceMap: true,
    dts: {
      respectExternal: true,
    },
  },
});
