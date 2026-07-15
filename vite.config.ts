import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({

  plugins: [
    react(),
    tailwindcss()
  ],


  resolve: {

    alias: {

      '@': path.resolve(__dirname, '.')

    }

  },


  build: {

    rollupOptions: {

      output: {

        manualChunks(id) {


          if (id.includes('node_modules')) {


            if (id.includes('react')) {

              return 'react';

            }


            if (id.includes('firebase')) {

              return 'firebase';

            }


            if (
              id.includes('lucide') ||
              id.includes('icons')
            ) {

              return 'icons';

            }


            return 'vendor';


          }


        }

      }

    }

  },


  server: {

    hmr:
      process.env.DISABLE_HMR !== 'true',


    watch:
      process.env.DISABLE_HMR === 'true'
        ? null
        : {}

  }

});