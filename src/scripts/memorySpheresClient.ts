import {
	assignDepthBand,
	getDeviceBudgets,
	sampleDeepZ,
	sampleNearZ,
	scoreLodPriority,
	type DeviceBudgets
} from '../lib/memories/budgets';
import { AssetLoader } from '../lib/memories/assetLoader';
import { CameraControls } from '../lib/memories/cameraControls';
import { CINEMATIC_DEFAULT_DOLLY, fovForDolly, lookAtZForDolly } from '../lib/memories/cinematicCamera';
import { LandscapeBg } from '../lib/memories/landscapeBg';
import type { MemoryMediaItem } from '../lib/memories/media';
import { SphereSystem, type SphereBody } from '../lib/memories/physics';
import {
	mediaUrlForTier,
	ThreeRenderer,
	type MediaTier
} from '../lib/memories/threeRenderer';
import { isVideoSrc } from '../lib/memories/lodUrls';

interface InitialPosition {
	startX: number;
	startY: number;
	size: number;
}

interface LandscapeConfig {
	poster?: string;
	src?: string;
}

const pageSelector = '.memory-spheres-page';
const DEFAULT_DOLLY = CINEMATIC_DEFAULT_DOLLY;
const DEFAULT_FOV_RAD = (fovForDolly(DEFAULT_DOLLY) * Math.PI) / 180;

const sphereSystem = new SphereSystem();
const cameraControls = new CameraControls({ defaultDolly: DEFAULT_DOLLY });

let renderer: ThreeRenderer | null = null;
let assetLoader: AssetLoader | null = null;
let landscape: LandscapeBg | null = null;
let animationFrameId: number | null = null;
let centerIdx: number | null = null;
let mediaItems: MemoryMediaItem[] = [];
let initialPositions: InitialPosition[] = [];
let budgets: DeviceBudgets = getDeviceBudgets(1200);
let interactionBoost = new Map<number, number>();
let landscapeArmed = false;
let thumbsStarted = false;
let lastFrameTime = 0;

const getViewport = () => {
	const vv = window.visualViewport;
	const visibleW = vv?.width ?? window.innerWidth;
	const visibleH = vv?.height ?? window.innerHeight;
	const container = document.querySelector('[data-orbs-root]') as HTMLElement | null;
	if (container) {
		const rect = container.getBoundingClientRect();
		// Cap to the visible viewport in case layout still overflows (legacy 100vw).
		return {
			width: Math.max(1, Math.min(rect.width, visibleW)),
			height: Math.max(1, Math.min(rect.height, visibleH))
		};
	}
	return { width: Math.max(1, visibleW), height: Math.max(1, visibleH) };
};

const resolveMediaSrc = (src: string | undefined): string | undefined => {
	if (!src) return undefined;
	try {
		return new URL(src, window.location.origin).toString();
	} catch {
		return src;
	}
};

const worldExtentAtZ = (dolly: number, z: number, viewportH: number, fovDeg?: number) => {
	const dist = Math.max(1, dolly - z);
	const fovRad = ((fovDeg ?? fovForDolly(dolly)) * Math.PI) / 180;
	const worldH = 2 * dist * Math.tan(fovRad / 2);
	const worldW = worldH * (getViewport().width / Math.max(1, viewportH));
	return { worldW, worldH };
};

const stopAnimation = () => {
	if (animationFrameId) {
		cancelAnimationFrame(animationFrameId);
		animationFrameId = null;
	}
	lastFrameTime = 0;
};

const destroy = () => {
	stopAnimation();
	cameraControls.detach();
	assetLoader?.dispose();
	assetLoader = null;
	landscape?.dispose();
	landscape = null;
	renderer?.destroy();
	renderer = null;
	centerIdx = null;
	landscapeArmed = false;
	thumbsStarted = false;
	interactionBoost.clear();
};

const convertToBodies = (viewport: { width: number; height: number }): SphereBody[] => {
	budgets = getDeviceBudgets(viewport.width);
	const { worldW, worldH } = worldExtentAtZ(DEFAULT_DOLLY, 0, viewport.height);
	const halfW = worldW * 0.55;
	const halfH = worldH * 0.55;

	return mediaItems.map((_, index) => {
		const source = initialPositions[index] || {
			startX: Math.random() * 70 + 15,
			startY: Math.random() * 70 + 15,
			size: 180 + Math.random() * 110
		};
		const band = assignDepthBand(index, budgets.nearOrbCount);
		const z = band === 'near' ? sampleNearZ(Math.random) : sampleDeepZ(Math.random);

		// Map legacy % positions into world XY frustum
		const x = ((source.startX / 100) * 2 - 1) * halfW;
		const y = (1 - source.startY / 100) * halfH * 2 - halfH;

		// Readable near size: ~140–220px class at default dolly
		const targetPx = band === 'near' ? source.size : source.size * 0.35;
		const dist = Math.max(1, DEFAULT_DOLLY - z);
		const worldHAtZ = 2 * dist * Math.tan(DEFAULT_FOV_RAD / 2);
		const pxPerWorld = viewport.height / worldHAtZ;
		const radius = targetPx / 2 / pxPerWorld;

		return {
			id: index,
			x,
			y,
			z,
			vx: (Math.random() - 0.5) * 0.8,
			vy: (Math.random() - 0.5) * 0.8,
			vz: 0,
			ax: 0,
			ay: 0,
			radius,
			targetRadius: radius,
			originalRadius: radius,
			originalX: x,
			originalY: y,
			originalZ: z,
			isCentered: false,
			targetZ: z,
			depthBand: band,
			driftAngle: Math.random() * Math.PI * 2,
			driftSpeed: 0.15 + Math.random() * 0.25
		};
	});
};

const scheduleLodPass = () => {
	if (!renderer || !assetLoader) return;
	const viewport = getViewport();
	const bodies = sphereSystem.getBodies();
	const cam = cameraControls.getState();

	type Ranked = { id: number; score: number; want: MediaTier; url: string };
	const ranked: Ranked[] = [];

	for (const body of bodies) {
		const item = mediaItems[body.id];
		if (!item) continue;
		const projected = renderer.projectedDiameterPx(body, viewport);
		// Hysteresis: only demote when clearly tiny (avoids flicker at the threshold).
		const demotePx = budgets.ghostProjectedPx * 0.65;
		if (projected < demotePx && centerIdx !== body.id) {
			if (renderer.getOrbTier(body.id) !== 'ghost') {
				renderer.demoteToGhost(body.id);
			}
			continue;
		}

		const nx = (body.x - cam.panX) / Math.max(1, worldExtentAtZ(cam.dolly, body.z, viewport.height, cam.fov).worldW);
		const ny = (body.y - cam.panY) / Math.max(1, worldExtentAtZ(cam.dolly, body.z, viewport.height, cam.fov).worldH);
		const dist01 = Math.min(1, Math.hypot(nx, ny));
		const boost = interactionBoost.get(body.id) ?? 1;
		const score = scoreLodPriority(projected, dist01, boost);

		let want: MediaTier = 'thumb';
		if (centerIdx === body.id) want = 'focus';
		else if (projected > 120 || body.depthBand === 'near') want = 'mid';

		const url = mediaUrlForTier(item, want === 'focus' && isVideoSrc(item.src, item.type) ? 'mid' : want);
		if (!url) continue;
		ranked.push({ id: body.id, score, want, url });
	}

	ranked.sort((a, b) => b.score - a.score);
	const textured = ranked.slice(0, budgets.texturedOrbs);

	for (const entry of textured) {
		const current = renderer.getOrbTier(entry.id);
		if (entry.want === 'thumb' && current !== 'ghost') continue;
		if (entry.want === 'mid' && (current === 'mid' || current === 'focus')) continue;
		if (entry.want === 'focus') continue;

		void assetLoader
			.request({
				id: entry.id,
				url: entry.url,
				tier: entry.want,
				priority: entry.score
			})
			.then((asset) => {
				if (!asset || !renderer) return;
				renderer.applyMediaBitmap(entry.id, asset.canvas, entry.want, asset.aspect);
			});
	}

	if (!landscapeArmed && thumbsStarted) {
		armLandscape();
	}
};

const armLandscape = () => {
	if (landscapeArmed || !landscape) return;
	landscapeArmed = true;
	const page = document.querySelector(pageSelector) as HTMLElement | null;
	let config: LandscapeConfig = {};
	try {
		config = JSON.parse(page?.dataset['landscape'] || '{}') as LandscapeConfig;
	} catch {
		config = {};
	}
	const run = () => {
		landscape?.activate({
			poster: resolveMediaSrc(config.poster),
			src: resolveMediaSrc(config.src)
		});
	};
	if (typeof requestIdleCallback !== 'undefined') {
		requestIdleCallback(() => run(), { timeout: 2500 });
	} else {
		window.setTimeout(run, 800);
	}
};

const startThumbWave = () => {
	if (!renderer || !assetLoader || thumbsStarted) return;
	thumbsStarted = true;
	const viewport = getViewport();
	const bodies = sphereSystem.getBodies();
	const near = bodies
		.filter((b) => b.depthBand === 'near')
		.sort(
			(a, b) =>
				renderer!.projectedDiameterPx(b, viewport) - renderer!.projectedDiameterPx(a, viewport)
		);

	for (const body of near.slice(0, budgets.texturedOrbs)) {
		const item = mediaItems[body.id];
		if (!item) continue;
		const url = mediaUrlForTier(item, 'thumb');
		if (!url) continue;
		void assetLoader
			.request({
				id: body.id,
				url,
				tier: 'thumb',
				priority: 1000 - body.id
			})
			.then((asset) => {
				if (!asset || !renderer) return;
				renderer.applyMediaBitmap(body.id, asset.canvas, 'thumb', asset.aspect);
			});
	}

	window.setTimeout(() => scheduleLodPass(), 400);
	armLandscape();
};

const animate = (now: number) => {
	const viewport = getViewport();
	sphereSystem.updateViewport(viewport);
	const dtSec = lastFrameTime > 0 ? (now - lastFrameTime) / 1000 : 1 / 60;
	lastFrameTime = now;
	const cam = cameraControls.step(dtSec);
	renderer?.setCameraState(cam);
	const bodies = sphereSystem.step(dtSec);
	renderer?.update(bodies, centerIdx, dtSec);
	animationFrameId = requestAnimationFrame(animate);
};

const startAnimation = () => {
	stopAnimation();
	lastFrameTime = 0;
	animationFrameId = requestAnimationFrame(animate);
};

const centerSphere = async (index: number) => {
	centerIdx = index;
	interactionBoost.set(index, 4);
	const cam = cameraControls.getState();
	// Stage at current look-at — keep dolly/pan frozen (no resetPan snap).
	sphereSystem.centerBody(
		index,
		cam.dolly,
		cam.panX,
		cam.panY,
		cam.fov,
		lookAtZForDolly(cam.dolly)
	);
	renderer?.setCenter(index);
	cameraControls.holdView();
	cameraControls.setFrozen(true);
	document.querySelector(pageSelector)?.classList.add('has-centered-sphere');

	const item = mediaItems[index];
	if (!item || !renderer) return;

	void renderer.beginCenterGlass(index);

	if (isVideoSrc(item.src, item.type)) {
		try {
			await renderer.applyFocusVideo(index, item);
		} catch {
			const url = mediaUrlForTier(item, 'mid') ?? item.poster ?? item.src;
			const asset = await assetLoader?.request({
				id: index,
				url,
				tier: 'mid',
				priority: 1e6
			});
			if (asset) renderer.applyMediaBitmap(index, asset.canvas, 'mid', asset.aspect);
		}
	} else {
		// Center-stage uses the full master still (not the compressed focus LOD).
		const url = item.src;
		const asset = await assetLoader?.request({
			id: index,
			url,
			tier: 'focus',
			priority: 1e6
		});
		if (asset) renderer.applyMediaBitmap(index, asset.canvas, 'focus', asset.aspect);
	}
};

const releaseCenterSphere = () => {
	if (centerIdx === null) return;
	const released = centerIdx;
	sphereSystem.releaseBody(released);
	renderer?.endCenterGlass(released);
	renderer?.clearCenter(released);
	renderer?.clearFocusVideo();
	centerIdx = null;
	cameraControls.setFrozen(false);
	document.querySelector(pageSelector)?.classList.remove('has-centered-sphere');
	scheduleLodPass();
};

const handleResize = () => {
	const viewport = getViewport();
	budgets = getDeviceBudgets(viewport.width);
	assetLoader?.setBudgets(budgets.concurrency, budgets.texturedOrbs);
	sphereSystem.updateViewport(viewport);
	cameraControls.setViewport(viewport);
	renderer?.resize(viewport);
	scheduleLodPass();
};

const pageLoadHandler = () => {
	void initSpheres();
};

const initSpheres = async () => {
	destroy();

	const page = document.querySelector(pageSelector) as HTMLElement | null;
	if (!page) return;

	const viewport = getViewport();
	budgets = getDeviceBudgets(viewport.width);

	try {
		const parsedMedia = JSON.parse(page.dataset['media'] || '[]') as MemoryMediaItem[];
		const parsedPositions = JSON.parse(page.dataset['positions'] || '[]') as InitialPosition[];
		mediaItems = parsedMedia.map((item) => {
			const resolvedPoster = resolveMediaSrc(item.poster);
			return {
				...item,
				src: resolveMediaSrc(item.src) ?? item.src,
				thumb: resolveMediaSrc(item.thumb) ?? item.thumb,
				mid: resolveMediaSrc(item.mid) ?? item.mid,
				focus: resolveMediaSrc(item.focus) ?? item.focus,
				...(resolvedPoster ? { poster: resolvedPoster } : {})
			};
		});
		initialPositions = parsedPositions;
	} catch {
		mediaItems = [];
		initialPositions = [];
	}

	if (!mediaItems.length) return;

	const container = page.querySelector('[data-orbs-root]') as HTMLElement | null;
	if (!container) return;

	const fieldGlass =
		resolveMediaSrc(page.dataset['glassField'] || '/media/JN-000-OrbMedia_field.webp') ??
		'/media/JN-000-OrbMedia_field.webp';
	const focusGlass =
		resolveMediaSrc(page.dataset['glassFocus'] || '/media/JN-000-OrbMedia_focus.webp') ??
		'/media/JN-000-OrbMedia_focus.webp';

	let landscapeConfig: LandscapeConfig = {};
	try {
		landscapeConfig = JSON.parse(page.dataset['landscape'] || '{}') as LandscapeConfig;
	} catch {
		landscapeConfig = {};
	}

	const bodies = convertToBodies(viewport);
	sphereSystem.setBodies(bodies, viewport, {
		minX: -1100,
		maxX: 1100,
		minY: -700,
		maxY: 700,
		minZ: -1800,
		maxZ: 80
	});

	assetLoader = new AssetLoader(budgets.concurrency, budgets.texturedOrbs);

	renderer = new ThreeRenderer({
		container,
		fieldGlassUrl: fieldGlass,
		focusGlassUrl: focusGlass,
		onSelect: (idx) => {
			if (centerIdx === idx) {
				releaseCenterSphere();
			} else if (centerIdx !== null) {
				releaseCenterSphere();
				void centerSphere(idx);
			} else {
				void centerSphere(idx);
			}
		},
		onBackgroundClick: () => {
			if (centerIdx !== null) releaseCenterSphere();
		}
	});

	landscape = null;
	if (landscapeConfig.poster || landscapeConfig.src) {
		landscape = new LandscapeBg({
			container: page,
			canvasHost: container
		});
		landscape.setPoster(resolveMediaSrc(landscapeConfig.poster));
	}

	// Phase 1: shells + drift immediately (no media wait)
	await renderer.initShells(mediaItems, bodies);
	cameraControls.attach(renderer.getDomElement(), viewport);
	startAnimation();

	// Phase 2: thumbs for near layer
	startThumbWave();
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', pageLoadHandler, { once: true });
} else {
	void initSpheres();
}

document.addEventListener('astro:page-load', pageLoadHandler);
document.addEventListener('astro:before-swap', destroy);
window.addEventListener('resize', handleResize);
window.addEventListener('beforeunload', destroy);
