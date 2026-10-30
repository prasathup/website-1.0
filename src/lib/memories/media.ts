import type { CollectionEntry } from 'astro:content';
import { withLodUrls } from './lodUrls';

/**
 * Normalized representation for each memory asset.
 * LOD fields (thumb/mid/focus) are filled from build-time derivatives;
 * runtime never uploads camera originals for resting orbs.
 */
export interface MemoryMediaItem {
	src: string;
	type: 'image' | 'video' | 'gif';
	alt?: string | undefined;
	caption?: string | undefined;
	poster?: string | undefined;
	thumb?: string | undefined;
	mid?: string | undefined;
	focus?: string | undefined;
	width?: number | undefined;
	height?: number | undefined;
	hue?: number | undefined;
	colorClass?: string | undefined;
}

/**
 * Build a flat manifest of every media attachment that belongs to a journey entry.
 */
export function buildMemoryMedia(entry: CollectionEntry<'journey'>): MemoryMediaItem[] {
	const { data } = entry;
	const manifest: MemoryMediaItem[] = [];

	if (data.media) {
		const rawSrc = data.media.publicUrl || data.media.src;
		const finalSrc = typeof rawSrc === 'object' ? rawSrc.src : rawSrc;

		let width: number | undefined;
		let height: number | undefined;
		if (typeof rawSrc === 'object' && 'width' in rawSrc) {
			width = rawSrc.width;
			height = rawSrc.height;
		}

		if (finalSrc) {
			manifest.push(
				withLodUrls({
					src: finalSrc,
					type: (data.media.type as MemoryMediaItem['type']) || 'image',
					alt: data.media.alt || data.title,
					caption: data.media.alt || data.title,
					poster: data.media.poster,
					width: width,
					height: height
				})
			);
		}
	}

	const gallery = data.additionalMedia || data.mediaGallery || [];

	for (const item of gallery) {
		const rawSrc = item.publicUrl || item.src;
		const finalSrc = typeof rawSrc === 'object' ? rawSrc.src : rawSrc;

		let width: number | undefined;
		let height: number | undefined;
		if (typeof rawSrc === 'object' && 'width' in rawSrc) {
			width = rawSrc.width;
			height = rawSrc.height;
		}

		if (finalSrc) {
			manifest.push(
				withLodUrls({
					src: finalSrc,
					type: (item.type as MemoryMediaItem['type']) || 'image',
					alt: item.alt || data.title,
					caption: item.caption || item.alt || data.title,
					poster: item.poster,
					width: width,
					height: height
				})
			);
		}
	}

	return manifest;
}
