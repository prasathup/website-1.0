import type { CollectionEntry } from 'astro:content';

/**
 * Normalized representation for each memory asset.
 * Keeping this lean + descriptive lets DOM and WebGL layers
 * consume exactly the same manifest later on.
 */
export interface MemoryMediaItem {
	src: string;
	type: 'image' | 'video' | 'gif';
	alt?: string;
	caption?: string;
	poster?: string;
	width?: number;
	height?: number;
	hue?: number;
	colorClass?: string;
}

/**
 * Build a flat manifest of every media attachment that belongs to a journey entry.
 * This central mapping means future renderers do not need to re-implement the merge logic
 * for `media`, `mediaGallery`, and `additionalMedia`.
 */
export function buildMemoryMedia(entry: CollectionEntry<'journey'>): MemoryMediaItem[] {
	const { data } = entry;
	const manifest: MemoryMediaItem[] = [];

	if (data.media) {
		const rawSrc = data.media.publicUrl || data.media.src;
		const finalSrc = typeof rawSrc === 'object' ? rawSrc.src : rawSrc;
		if (finalSrc) {
			manifest.push({
				src: finalSrc,
				type: (data.media.type as MemoryMediaItem['type']) || 'image',
				alt: data.media.alt || data.title,
				caption: data.media.alt || data.title,
				poster: data.media.poster,
				width: data.media.width,
				height: data.media.height
			});
		}
	}

	const gallery = data.additionalMedia || data.mediaGallery || [];

	for (const item of gallery) {
		const rawSrc = item.publicUrl || item.src;
		const finalSrc = typeof rawSrc === 'object' ? rawSrc.src : rawSrc;
		if (finalSrc) {
			manifest.push({
				src: finalSrc,
				type: (item.type as MemoryMediaItem['type']) || 'image',
				alt: item.alt || data.title,
				caption: item.caption || item.alt || data.title,
				poster: item.poster,
				width: item.width,
				height: item.height
			});
		}
	}

	return manifest;
}

