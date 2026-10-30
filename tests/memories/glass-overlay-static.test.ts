import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Contract: loadStatic must not walk ImageDecoder frame lists (Chrome OOM).
 * Glass uses TextureLoader / HTML Image for correct alpha (canvas wash broke the shell).
 */

describe('GlassOverlayPlayer.loadStatic', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('loads via TextureLoader and does not call ImageDecoder', async () => {
		const ImageDecoderSpy = vi.fn();
		vi.stubGlobal('ImageDecoder', ImageDecoderSpy);

		const fakeTex = {
			colorSpace: '',
			minFilter: 0,
			magFilter: 0,
			generateMipmaps: true,
			needsUpdate: false,
			dispose: vi.fn()
		};

		vi.doMock('three', async () => {
			const actual = await vi.importActual<typeof import('three')>('three');
			return {
				...actual,
				TextureLoader: class {
					loadAsync = vi.fn(async () => ({ ...fakeTex }));
				},
				DataTexture: class {
					needsUpdate = false;
					dispose = vi.fn();
					constructor() {}
				}
			};
		});

		const { GlassOverlayPlayer } = await import('../../src/lib/memories/glassOverlay');
		const player = new GlassOverlayPlayer(64);
		const tex = await player.loadStatic('/media/JN-000-OrbMedia_field.webp');

		expect(ImageDecoderSpy).not.toHaveBeenCalled();
		expect(tex).toBeTruthy();
		player.dispose();
	});

	it('swallows load errors and leaves a usable texture (boot must not abort)', async () => {
		vi.doMock('three', async () => {
			const actual = await vi.importActual<typeof import('three')>('three');
			return {
				...actual,
				TextureLoader: class {
					loadAsync = vi.fn(async () => {
						throw new Error('network down');
					});
				},
				DataTexture: class {
					needsUpdate = false;
					dispose = vi.fn();
					constructor() {}
				}
			};
		});

		const { GlassOverlayPlayer } = await import('../../src/lib/memories/glassOverlay');
		const player = new GlassOverlayPlayer(64);
		await expect(player.loadStatic('/bad.webp')).resolves.toBeTruthy();
		expect(player.getTexture()).toBeTruthy();
		player.dispose();
	});
});
