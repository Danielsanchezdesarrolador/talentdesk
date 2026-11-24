import {defineConfig} from 'vite';
export default defineConfig({base:'/ats-assets/',build:{outDir:'.private-build',emptyOutDir:true,rollupOptions:{input:'private-lab/ats.html'}}});
