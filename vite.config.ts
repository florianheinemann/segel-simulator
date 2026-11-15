import { defineConfig, type Plugin } from 'vite';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import pkg from './package.json' with { type: 'json' };

// Eindeutige Kennung je Build – daran erkennt die App, ob es eine neuere Version gibt
const stamp = (process.env.GITHUB_SHA || Date.now().toString(36)).slice(0, 7);
const BUILD = `${pkg.version}+${stamp}`;

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

function pwa(): Plugin {
  let outDir = 'dist';
  return {
    name: 'segelsim-pwa',
    configResolved(c) {
      outDir = c.build.outDir;
    },
    // iOS-Startbilder: je Gerät und Ausrichtung ein eigenes Bild
    transformIndexHtml() {
      const devices: { w: number; h: number; dpr: number }[] = JSON.parse(readFileSync('splash.json', 'utf8'));
      return devices.flatMap((d) =>
        (['portrait', 'landscape'] as const).map((o) => {
          const [W, H] = o === 'portrait' ? [d.w * d.dpr, d.h * d.dpr] : [d.h * d.dpr, d.w * d.dpr];
          return {
            tag: 'link',
            injectTo: 'head' as const,
            attrs: {
              rel: 'apple-touch-startup-image',
              href: `splash/${W}x${H}.png`,
              media: `(device-width: ${d.w}px) and (device-height: ${d.h}px) and (-webkit-device-pixel-ratio: ${d.dpr}) and (orientation: ${o})`,
            },
          };
        }),
      );
    },
    closeBundle() {
      writeFileSync(join(outDir, 'version.json'), JSON.stringify({ build: BUILD }));
      const files = walk(outDir)
        .map((p) => relative(outDir, p).replace(/\\/g, '/'))
        .filter((f) => !f.startsWith('splash/') && f !== 'sw.js' && f !== 'version.json')
        .map((f) => (f === 'index.html' ? './' : f));
      const sw = join(outDir, 'sw.js');
      writeFileSync(
        sw,
        readFileSync(sw, 'utf8')
          .replace("/*BUILD*/ 'dev'", JSON.stringify(BUILD))
          .replace('/*FILES*/ []', JSON.stringify(files)),
      );
    },
  };
}

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __BUILD__: JSON.stringify(BUILD) },
  plugins: [pwa()],
});
