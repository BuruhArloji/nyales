import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// Deliberately no Cloudflare plugin: browser HMR talks only to the loopback emulator.
export default defineConfig({
 plugins:[react(),{name:'nyales-local-prototype',transformIndexHtml(html){
  return html.replace(/<title>.*?<\/title>/,'<title>NYALES · Prototipe lokal</title>').replace('</head>','<link rel="stylesheet" href="/tools/ui-prototype/studio.css"></head>').replace('</body>','<script type="module" src="/tools/ui-prototype/studio.ts"></script></body>');
 }}],
 envDir:'.nyales-agent/ui-prototype/env',
 server:{host:'127.0.0.1',port:5190,strictPort:true,proxy:{'/api':{target:'http://127.0.0.1:5191'}}}
});
