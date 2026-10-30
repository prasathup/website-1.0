#!/usr/bin/env node
/**
 * Generate thumb / mid / focus WebP derivatives for memory stills.
 * Videos: skip video encode; derive thumb/mid from poster if present.
 *
 * Usage: node scripts/generate-memory-lod.mjs
 * Requires ImageMagick (`magick`) on PATH — no new npm deps.
 */
import { mkdir, readdir, access } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const srcDir = join(root, 'public/media/Memories');
const lodRoot = join(srcDir, 'lod');

const TIERS = {
	thumb: 256,
	mid: 512,
	focus: 1536
};

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov']);

function run(cmd, args) {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, { stdio: 'inherit' });
		child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
	});
}

async function exists(p) {
	try {
		await access(p);
		return true;
	} catch {
		return false;
	}
}

async function encodeTier(input, outPath, size) {
	await mkdir(join(outPath, '..'), { recursive: true });
	await run('magick', [
		input,
		'-auto-orient',
		'-resize',
		`${size}x${size}>`,
		'-quality',
		'78',
		outPath
	]);
}

async function main() {
	const files = await readdir(srcDir);
	let done = 0;
	for (const file of files) {
		const ext = extname(file).toLowerCase();
		const base = basename(file, extname(file));
		const input = join(srcDir, file);

		if (IMAGE_EXT.has(ext)) {
			for (const [tier, size] of Object.entries(TIERS)) {
				const out = join(lodRoot, tier, `${base}.webp`);
				await encodeTier(input, out, size);
			}
			done++;
			continue;
		}

		if (VIDEO_EXT.has(ext)) {
			// Prefer matching poster naming if present; else skip still LODs
			const posterCandidates = [
				join(srcDir, `${base}-poster.jpg`),
				join(srcDir, `${base}.poster.jpg`),
				join(srcDir, `${base}.jpg`)
			];
			let poster = null;
			for (const c of posterCandidates) {
				if (await exists(c)) {
					poster = c;
					break;
				}
			}
			if (!poster) continue;
			for (const tier of ['thumb', 'mid']) {
				const out = join(lodRoot, tier, `${base}.webp`);
				await encodeTier(poster, out, TIERS[tier]);
			}
			done++;
		}
	}
	console.log(`LOD complete: ${done} sources → ${lodRoot}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
