/**
 * Build-time LOD URL conventions for memory media.
 * Derivatives live under /media/Memories/lod/{thumb|mid|focus}/<basename>.webp
 */

const LOD_ROOT = '/media/Memories/lod';

export function basenameFromSrc(src: string): string {
	const path = src.split('?')[0] ?? src;
	const parts = path.split('/');
	const file = parts[parts.length - 1] ?? path;
	return file.replace(/\.[^.]+$/, '');
}

export function lodUrl(tier: 'thumb' | 'mid' | 'focus', src: string): string {
	return `${LOD_ROOT}/${tier}/${basenameFromSrc(src)}.webp`;
}

export function isVideoSrc(src: string, type?: string): boolean {
	if (type === 'video') return true;
	return /\.(mp4|webm|mov)($|\?)/i.test(src);
}

export interface LodCapableMedia {
	src: string;
	type?: string | undefined;
	poster?: string | undefined;
	thumb?: string | undefined;
	mid?: string | undefined;
	focus?: string | undefined;
}

/**
 * Attach conventional LOD URLs. Build script must produce matching files.
 */
export function withLodUrls<T extends LodCapableMedia>(
	item: T
): T & { thumb: string; mid: string; focus: string } {
	const video = isVideoSrc(item.src, item.type);
	const thumbSource = video && item.poster ? item.poster : item.src;
	return {
		...item,
		thumb: item.thumb ?? lodUrl('thumb', thumbSource),
		mid: item.mid ?? lodUrl('mid', thumbSource),
		focus: item.focus ?? (video ? item.src : lodUrl('focus', item.src))
	};
}
