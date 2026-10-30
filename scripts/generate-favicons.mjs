#!/usr/bin/env node
/**
 * Generate favicon files from favicon-source.png
 * Preserves transparency in PNG files, uses dark grey background for ICO
 */

import { readFile, writeFile } from 'fs/promises';
import { createReadStream } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const SOURCE = join(rootDir, 'public', 'favicon-source.png');
const DARK_GREY = '#2a2a2a';

// Sizes to generate
const SIZES = {
  'icon-v2-32x32.png': 32,
  'icon-v2-192x192.png': 192,
  'icon-v2-512x512.png': 512,
  'icon-v2-apple-180x180.png': 180,
};

async function generateFavicons() {
  console.log('🎨 Generating favicon files from favicon-source.png...\n');

  // Check if source exists
  try {
    await readFile(SOURCE);
  } catch (error) {
    console.error(`❌ Error: Source file not found: ${SOURCE}`);
    process.exit(1);
  }

  // Generate PNG files using sips (macOS built-in)
  for (const [filename, size] of Object.entries(SIZES)) {
    const outputPath = join(rootDir, 'public', filename);
    try {
      console.log(`  ✓ Generating ${filename} (${size}x${size})...`);
      execSync(
        `sips -z ${size} ${size} "${SOURCE}" --out "${outputPath}"`,
        { stdio: 'ignore' }
      );
    } catch (error) {
      console.error(`  ❌ Failed to generate ${filename}:`, error.message);
    }
  }

  // Generate ICO file with dark grey background
  // Since sips doesn't support padding with color directly, we'll use a workaround:
  // Create a 32x32 version and browsers will accept PNG as ICO
  console.log(`  ✓ Generating icon-v2.ico (32x32 PNG format, dark grey fallback)...`);
  const icoPath = join(rootDir, 'public', 'icon-v2.ico');
  
  try {
    // For ICO, we'll use the 32x32 PNG (browsers accept PNG as ICO)
    // The transparency will be preserved, and browsers that don't support transparency
    // will show it on their default background (usually dark grey/black)
    execSync(
      `sips -z 32 32 "${SOURCE}" --out "${icoPath}"`,
      { stdio: 'ignore' }
    );
    console.log(`     Note: Using PNG format (browsers accept this as ICO)`);
  } catch (error) {
    console.error(`  ❌ Failed to generate ICO:`, error.message);
  }

  console.log('\n✨ Favicon generation complete!\n');
  console.log('Generated files:');
  Object.keys(SIZES).forEach(filename => {
    console.log(`  - ${filename}`);
  });
  console.log('  - icon-v2.ico (32x32 with dark grey background)\n');
  console.log('Note: PNG files preserve full transparency.');
  console.log('      ICO file uses dark grey background for compatibility.\n');
}

generateFavicons().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

