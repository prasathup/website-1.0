import { describe, expect, it } from 'vitest';
import {
	assignDepthBand,
	getDeviceBudgets,
	scoreLodPriority
} from '../../src/lib/memories/budgets';
import { basenameFromSrc, lodUrl, isVideoSrc, withLodUrls } from '../../src/lib/memories/lodUrls';

describe('memory budgets', () => {
	it('uses tighter near/textured caps on mobile', () => {
		const mobile = getDeviceBudgets(390);
		const desktop = getDeviceBudgets(1440);
		expect(mobile.nearOrbCount).toBe(16);
		expect(mobile.concurrency).toBeLessThanOrEqual(3);
		expect(desktop.nearOrbCount).toBe(22);
		expect(desktop.texturedOrbs).toBeGreaterThan(mobile.texturedOrbs);
	});

	it('assigns deep band past near budget', () => {
		expect(assignDepthBand(0, 16)).toBe('near');
		expect(assignDepthBand(15, 16)).toBe('near');
		expect(assignDepthBand(16, 16)).toBe('deep');
	});

	it('scores larger + more-centered orbs higher', () => {
		const edge = scoreLodPriority(80, 0.9, 1);
		const center = scoreLodPriority(80, 0.1, 1);
		const bigger = scoreLodPriority(200, 0.1, 1);
		expect(center).toBeGreaterThan(edge);
		expect(bigger).toBeGreaterThan(center);
	});
});

describe('lod url shape', () => {
	it('builds conventional lod paths', () => {
		expect(basenameFromSrc('/media/Memories/JN-sample-01.JPG')).toBe('JN-sample-01');
		expect(lodUrl('thumb', '/media/Memories/JN-sample-01.JPG')).toBe(
			'/media/Memories/lod/thumb/JN-sample-01.webp'
		);
		expect(isVideoSrc('/media/Memories/JN-sample-video.mp4')).toBe(true);
	});

	it('withLodUrls fills thumb/mid/focus', () => {
		const item = withLodUrls({
			src: '/media/Memories/JN-sample-01.JPG',
			type: 'image'
		} as const);
		expect(item.thumb).toContain('/lod/thumb/');
		expect(item.mid).toContain('/lod/mid/');
		expect(item.focus).toContain('/lod/focus/');
	});
});
