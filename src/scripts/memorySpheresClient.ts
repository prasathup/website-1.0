import { SphereSystem, type SphereBody } from '../lib/memories/physics';
import type { MemoryMediaItem } from '../lib/memories/media';
import { ThreeRenderer } from '../lib/memories/threeRenderer';

interface InitialPosition {
	startX: number;
	startY: number;
	size: number;
}

const pageSelector = '.memory-spheres-page';
const sphereSystem = new SphereSystem();

let renderer: ThreeRenderer | null = null;
let animationFrameId: number | null = null;
let centerIdx: number | null = null;
let mediaItems: MemoryMediaItem[] = [];
let initialPositions: InitialPosition[] = [];

const getMaxSphereCount = (_width: number): number => {
	// Return a high number to include all media items, but physics will only activate the top 15
	return 100;
};

const getSizeScale = (width: number): number => {
	if (width <= 600) return 0.7;
	if (width <= 1024) return 0.95;
	return 1.25;
};

const clampArraysForViewport = (
	media: MemoryMediaItem[],
	positions: InitialPosition[],
	width: number
): { media: MemoryMediaItem[]; positions: InitialPosition[] } => {
	const limit = getMaxSphereCount(width);
	if (media.length <= limit) {
		return { media, positions };
	}
	return {
		media: media.slice(0, limit),
		positions: positions.slice(0, limit)
	};
};

const getViewport = () => {
	const container = document.querySelector('[data-orbs-root]') as HTMLElement | null;
	if (container) {
		const rect = container.getBoundingClientRect();
		return {
			width: rect.width,
			height: rect.height
		};
	}
	// Fallback
	return {
		width: window.innerWidth,
		height: window.innerHeight
	};
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const resolveMediaSrc = (src: string | undefined): string | undefined => {
	if (!src) return undefined;
	try {
		return new URL(src, window.location.origin).toString();
	} catch {
		return src;
	}
};

const stopAnimation = () => {
	if (animationFrameId) {
		cancelAnimationFrame(animationFrameId);
		animationFrameId = null;
	}
};

const destroy = () => {
	stopAnimation();
	renderer?.destroy();
	renderer = null;
	centerIdx = null;
};

const animate = () => {
	sphereSystem.updateViewport(getViewport());
	const bodies = sphereSystem.step();
	renderer?.update(bodies, centerIdx);
	animationFrameId = requestAnimationFrame(animate);
};

const startAnimation = () => {
	stopAnimation();
	animationFrameId = requestAnimationFrame(animate);
};

const centerSphere = (index: number) => {
	centerIdx = index;
	sphereSystem.centerBody(index);
	renderer?.setCenter(index);
	document.querySelector(pageSelector)?.classList.add('has-centered-sphere');
};

const releaseCenterSphere = () => {
	if (centerIdx === null) return;
	sphereSystem.releaseBody(centerIdx);
	renderer?.clearCenter(centerIdx);
	centerIdx = null;
	document.querySelector(pageSelector)?.classList.remove('has-centered-sphere');
};

const convertToBodies = (viewport: { width: number; height: number }): SphereBody[] => {
	const sizeScale = getSizeScale(viewport.width);
	return mediaItems.map((_, index) => {
		const source = initialPositions[index] || {
			startX: Math.random() * 70 + 15,
			startY: Math.random() * 70 + 15,
			size: 180 + Math.random() * 110
		};
		const x = (source.startX / 100) * viewport.width;
		const y = (source.startY / 100) * viewport.height;
		const radius = (source.size * sizeScale) / 2;

		return {
			id: index,
			x,
			y,
			vx: (Math.random() - 0.5) * 6,
			vy: (Math.random() - 0.5) * 6,
			ax: 0,
			ay: 0,
			radius,
			targetRadius: radius,
			originalRadius: radius,
			originalX: x,
			originalY: y,
			isCentered: false,
			z: 0,
			targetZ: 0,
			driftAngle: Math.random() * Math.PI * 2,
			driftSpeed: 0.2 + Math.random() * 0.3
		};
	});
};

const handleResize = () => {
	const viewport = getViewport();
	const sizeScale = getSizeScale(viewport.width);
	sphereSystem.updateViewport(viewport);
	sphereSystem.setActiveLimit(Math.max(15, sphereSystem.getBodies().length));

	const bodies = sphereSystem.getBodies();
	bodies.forEach((body) => {
		const source = initialPositions[body.id];
		if (source) {
			body.originalX = (source.startX / 100) * viewport.width;
			body.originalY = (source.startY / 100) * viewport.height;
			body.originalRadius = (source.size * sizeScale) / 2;
			if (!body.isCentered) {
				body.x = body.originalX;
				body.y = body.originalY;
				body.vx = 0;
				body.vy = 0;
				body.ax = 0;
				body.ay = 0;
				body.releaseProgress = undefined;
				body.releaseRestX = undefined;
				body.releaseRestY = undefined;
			}
		}

		if (body.isCentered) return;

		body.targetRadius = body.originalRadius;
		body.x = clamp(body.x, body.radius, viewport.width - body.radius);
		body.y = clamp(body.y, body.radius, viewport.height - body.radius);
	});

	renderer?.resize(viewport);
};

const initSpheres = async () => {
	destroy();

	const page = document.querySelector(pageSelector) as HTMLElement | null;
	if (!page) return;

	const viewport = getViewport();

	try {
		const parsedMedia = JSON.parse(page.dataset['media'] || '[]') as MemoryMediaItem[];
		const parsedPositions = JSON.parse(page.dataset['positions'] || '[]') as InitialPosition[];
		const normalizedMedia = parsedMedia.map((item) => {
			const resolvedPoster = resolveMediaSrc(item.poster);
			return {
				...item,
				src: resolveMediaSrc(item.src) ?? item.src,
				...(resolvedPoster ? { poster: resolvedPoster } : {})
			};
		});
		const subset = clampArraysForViewport(normalizedMedia, parsedPositions, viewport.width);
		mediaItems = subset.media;
		initialPositions = subset.positions;
	} catch {
		mediaItems = [];
		initialPositions = [];
	}

	if (!mediaItems.length) return;

	const container = page.querySelector('[data-orbs-root]') as HTMLElement | null;

	if (!container) return;

	const bodies = convertToBodies(viewport);
	sphereSystem.setBodies(bodies, viewport);

	renderer = new ThreeRenderer({
		container,
		overlayTexture: resolveMediaSrc('/media/JN-000-OrbMedia_high.webp') ?? '/media/JN-000-OrbMedia_high.webp',
		onSelect: (idx) => {
			// If clicking the currently centered orb, release it
			if (centerIdx === idx) {
				releaseCenterSphere();
			}
			// If clicking a different orb while one is centered, switch to the new one
			else if (centerIdx !== null && centerIdx !== idx) {
				releaseCenterSphere();
				centerSphere(idx);
			}
			// If no orb is centered, center the clicked one
			else {
				centerSphere(idx);
			}
		}
	});

	await renderer.init(mediaItems, bodies);

	// Click background to deselect
	container.addEventListener('click', (e) => {
		// Only if clicking the container itself (not a child/orb)
		if (e.target === container && centerIdx !== null) {
			releaseCenterSphere();
		}
	});

	startAnimation();
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initSpheres, { once: true });
} else {
	void initSpheres();
}

document.addEventListener('astro:page-load', () => {
	void initSpheres();
});
document.addEventListener('astro:before-swap', destroy);
window.addEventListener('resize', handleResize);
window.addEventListener('beforeunload', destroy);
