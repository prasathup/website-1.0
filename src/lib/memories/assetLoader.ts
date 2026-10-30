export type LodTier = 'thumb' | 'mid' | 'focus' | 'ghost';

export interface AssetRequest {
	id: number;
	url: string;
	tier: LodTier;
	priority: number;
}

export interface LoadedAsset {
	id: number;
	url: string;
	tier: LodTier;
	/** Canvas with pixels oriented for THREE.CanvasTexture + flipY=true (TextureLoader-equivalent). */
	canvas: HTMLCanvasElement;
	aspect: number;
}

type ResolveFn = (asset: LoadedAsset | null) => void;

interface QueueItem extends AssetRequest {
	resolve: ResolveFn;
}

/**
 * Decode media onto a canvas the same way TextureLoader + HTMLImage would present it.
 * Avoids ImageBitmap + flipY inconsistencies that inverted most memory photos.
 */
async function decodeToOrientedCanvas(url: string): Promise<HTMLCanvasElement | null> {
	const response = await fetch(url);
	if (!response.ok) return null;
	const blob = await response.blob();

	const objectUrl = URL.createObjectURL(blob);
	try {
		const img = new Image();
		img.decoding = 'async';
		img.src = objectUrl;
		await img.decode();

		const canvas = document.createElement('canvas');
		canvas.width = Math.max(1, img.naturalWidth || img.width);
		canvas.height = Math.max(1, img.naturalHeight || img.height);
		const ctx = canvas.getContext('2d', { alpha: true });
		if (!ctx) return null;
		ctx.drawImage(img, 0, 0);
		return canvas;
	} finally {
		URL.revokeObjectURL(objectUrl);
	}
}

/**
 * Priority queue + concurrency cap + LRU eviction for memory orb textures.
 */
export class AssetLoader {
	private queue: QueueItem[] = [];
	private active = 0;
	private concurrency: number;
	private maxCached: number;
	private cache = new Map<string, LoadedAsset>();
	private lru: string[] = [];
	private inFlight = new Map<string, Promise<LoadedAsset | null>>();
	private destroyed = false;

	constructor(concurrency = 4, maxCached = 32) {
		this.concurrency = concurrency;
		this.maxCached = maxCached;
	}

	setBudgets(concurrency: number, maxCached: number): void {
		this.concurrency = concurrency;
		this.maxCached = maxCached;
		this.evictIfNeeded();
	}

	getCached(url: string): LoadedAsset | null {
		const hit = this.cache.get(url);
		if (!hit) return null;
		this.touch(url);
		return hit;
	}

	request(req: AssetRequest): Promise<LoadedAsset | null> {
		if (this.destroyed) return Promise.resolve(null);
		const cached = this.getCached(req.url);
		if (cached) return Promise.resolve(cached);

		const existing = this.inFlight.get(req.url);
		if (existing) return existing;

		const promise = new Promise<LoadedAsset | null>((resolve) => {
			this.queue.push({ ...req, resolve });
			this.queue.sort((a, b) => b.priority - a.priority);
			this.pump();
		});
		this.inFlight.set(req.url, promise);
		void promise.finally(() => {
			this.inFlight.delete(req.url);
		});
		return promise;
	}

	release(url: string): void {
		const asset = this.cache.get(url);
		if (!asset) return;
		this.cache.delete(url);
		this.lru = this.lru.filter((u) => u !== url);
	}

	dispose(): void {
		this.destroyed = true;
		this.queue.splice(0).forEach((item) => item.resolve(null));
		this.cache.clear();
		this.lru = [];
		this.inFlight.clear();
	}

	private pump(): void {
		while (this.active < this.concurrency && this.queue.length > 0) {
			const next = this.queue.shift();
			if (!next) break;
			this.active++;
			void this.loadOne(next)
				.then((asset) => next.resolve(asset))
				.finally(() => {
					this.active--;
					this.pump();
				});
		}
	}

	private async loadOne(item: QueueItem): Promise<LoadedAsset | null> {
		if (this.destroyed) return null;
		try {
			const canvas = await decodeToOrientedCanvas(item.url);
			if (!canvas) return null;
			const asset: LoadedAsset = {
				id: item.id,
				url: item.url,
				tier: item.tier,
				canvas,
				aspect: canvas.width / Math.max(1, canvas.height)
			};
			this.cache.set(item.url, asset);
			this.touch(item.url);
			this.evictIfNeeded();
			return asset;
		} catch {
			return null;
		}
	}

	private touch(url: string): void {
		this.lru = this.lru.filter((u) => u !== url);
		this.lru.push(url);
	}

	private evictIfNeeded(): void {
		while (this.cache.size > this.maxCached && this.lru.length > 0) {
			const oldest = this.lru.shift();
			if (!oldest) break;
			this.cache.delete(oldest);
		}
	}
}
