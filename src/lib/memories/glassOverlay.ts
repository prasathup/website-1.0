import * as THREE from 'three';

/**
 * Static field glass via TextureLoader (HTML Image) — same path as main overlay load.
 *
 * Avoid canvas round-trips for alpha WebP: 2d canvas is premultiplied and, when uploaded
 * with default premultiplyAlpha=false, washes the shell so photos punch through.
 * TextureLoader preserves alpha and matches the previous “glass-dominant” look.
 *
 * Animation deferred until a Chrome-safe looping path exists.
 */
export class GlassOverlayPlayer {
	private texture: THREE.Texture;
	private destroyed = false;
	private loadToken = 0;
	private loader = new THREE.TextureLoader();

	constructor(_size = 768) {
		// Placeholder until loadStatic; MeshBasicMaterial tolerates an empty data texture.
		const data = new Uint8Array([0, 0, 0, 0]);
		this.texture = new THREE.DataTexture(data, 1, 1);
		this.texture.needsUpdate = true;
	}

	getTexture(): THREE.Texture {
		return this.texture;
	}

	/**
	 * Load frame 0 of the (animated) glass WebP via Image/TextureLoader.
	 * Never throws — on failure keeps the prior/placeholder texture.
	 */
	async loadStatic(url: string): Promise<THREE.Texture> {
		const token = ++this.loadToken;
		try {
			const next = await this.loader.loadAsync(url);
			if (token !== this.loadToken || this.destroyed) {
				next.dispose();
				return this.texture;
			}
			// Match main TextureLoader overlay: leave NoColorSpace (do not mark SRGB).
			next.colorSpace = THREE.NoColorSpace;
			next.minFilter = THREE.LinearFilter;
			next.magFilter = THREE.LinearFilter;
			next.generateMipmaps = false;
			next.needsUpdate = true;

			const prev = this.texture;
			this.texture = next;
			prev.dispose();
		} catch {
			/* keep placeholder / previous map */
		}
		return this.texture;
	}

	async startLoop(_url: string): Promise<void> {
		/* animation deferred */
	}

	stopLoop(): void {
		/* no-op */
	}

	tick(_nowMs?: number): void {
		/* no-op */
	}

	dispose(): void {
		this.destroyed = true;
		this.loadToken++;
		this.texture.dispose();
	}
}
