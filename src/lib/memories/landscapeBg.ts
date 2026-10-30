export interface LandscapeTheme {
	poster?: string | undefined;
	src?: string | undefined;
}

export interface LandscapeBgOptions {
	container: HTMLElement;
	/** Insert landscape behind this element (WebGL canvas parent). */
	canvasHost: HTMLElement;
	reducedMotion?: boolean;
}

/**
 * DOM <video> behind the WebGL canvas. Poster first; src after idle / near thumbs.
 * One element — theme swap replaces src (never decode light+dark together).
 * Do not mount an <img> without a real poster URL (empty img paints a border on mobile).
 */
export class LandscapeBg {
	private root: HTMLDivElement;
	private img: HTMLImageElement | null = null;
	private video: HTMLVideoElement;
	private activated = false;
	private destroyed = false;
	private reducedMotion: boolean;

	constructor(options: LandscapeBgOptions) {
		this.reducedMotion =
			options.reducedMotion ??
			(typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);

		this.root = document.createElement('div');
		this.root.className = 'memory-landscape-bg';
		this.root.setAttribute('aria-hidden', 'true');

		this.video = document.createElement('video');
		this.video.muted = true;
		this.video.loop = true;
		this.video.playsInline = true;
		this.video.setAttribute('playsinline', '');
		this.video.preload = 'none';
		this.video.className = 'memory-landscape-video';

		this.root.appendChild(this.video);

		const host = options.canvasHost;
		host.parentElement?.insertBefore(this.root, host);
		if (!this.root.parentElement) {
			options.container.insertBefore(this.root, host);
		}
	}

	setPoster(url: string | undefined): void {
		if (!url) return;
		if (!this.img) {
			this.img = document.createElement('img');
			this.img.alt = '';
			this.img.decoding = 'async';
			this.img.className = 'memory-landscape-poster';
			this.root.insertBefore(this.img, this.video);
		}
		this.img.src = url;
	}

	/**
	 * Attach theme video src after near thumbs / idle. No-op under reduced motion / data-saver.
	 */
	activate(theme: LandscapeTheme): void {
		if (this.destroyed || this.activated) return;
		if (this.reducedMotion) return;
		if (typeof navigator !== 'undefined' && 'connection' in navigator) {
			const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
			if (conn?.saveData) return;
		}
		if (!theme.src) return;

		this.activated = true;
		this.video.preload = 'metadata';
		this.video.src = theme.src;
		void this.video.play().catch(() => {
			/* autoplay may be blocked; poster remains */
		});
	}

	swapTheme(theme: LandscapeTheme): void {
		if (this.destroyed) return;
		if (theme.poster) this.setPoster(theme.poster);
		if (this.reducedMotion || !theme.src) {
			this.video.removeAttribute('src');
			this.video.load();
			return;
		}
		this.video.pause();
		this.video.src = theme.src;
		void this.video.play().catch(() => {});
	}

	dispose(): void {
		this.destroyed = true;
		this.video.pause();
		this.video.removeAttribute('src');
		this.video.load();
		this.root.remove();
		this.img = null;
	}
}
