// Skerrywind hand-in program for make.fun's "Make the best flight game" bounty (Node 22, standard
// library only). The playable game is the static folder game/ beside this file; screenshots/ holds the
// renders the judge sees. This program copies both into the output directory and writes dossier.json
// with the kit's unchanged vendor/makefun-game.ts. It never reads the clock, the network or a random
// source, and it copies entries in name order, so two runs write the same bytes.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repositoryRoot = dirname(fileURLToPath(import.meta.url));
const outputRoot = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's own limits, passed through so this program refuses what the gate would refuse.
const GATE_LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const byName = (a: { name: string }, b: { name: string }): number => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

/** Copies a folder of plain files and folders, depth first in name order; returns how many files it copied. */
function copyFolder(from: string, to: string): number {
  mkdirSync(to, { recursive: true });
  let copied = 0;
  for (const entry of readdirSync(from, { withFileTypes: true }).sort(byName)) {
    const source = join(from, entry.name);
    const target = join(to, entry.name);
    if (entry.isDirectory()) {
      copied += copyFolder(source, target);
    } else if (entry.isFile()) {
      copyFileSync(source, target);
      copied += 1;
    } else {
      throw new Error(`refusing ${source}: only plain files and folders are handed in`);
    }
  }
  return copied;
}

const gameFiles = copyFolder(join(repositoryRoot, 'game'), join(outputRoot, 'game'));
const screenshotFiles = copyFolder(join(repositoryRoot, 'screenshots'), join(outputRoot, 'screenshots'));
const dossier = buildDossier(outputRoot, GATE_LIMITS);
writeFileSync(join(outputRoot, 'dossier.json'), dossier);
console.log(`Skerrywind: ${gameFiles} game files, ${screenshotFiles} screenshots, dossier ${dossier.length} bytes`);
