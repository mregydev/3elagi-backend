/**
 * Copies non-TypeScript assets into dist/ after `tsc`.
 * Nest's nest-cli.json assets are ignored when build uses plain tsc.
 */
import { cpSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** [source relative to project root, destination relative to project root] */
const COPY_PAIRS = [
  ['src/mail/assets', 'dist/mail/assets'],
];

for (const [srcRel, destRel] of COPY_PAIRS) {
  const src = join(root, srcRel);
  const dest = join(root, destRel);
  if (!existsSync(src)) {
    console.warn(`[copy-build-assets] skip missing ${srcRel}`);
    continue;
  }
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log(`[copy-build-assets] ${srcRel} -> ${destRel}`);
}
