import * as THREE from 'three';
import type { MemoryMediaItem } from './media';
import type { SphereBody, ViewportSize } from './physics';
import type { CameraState } from './cameraControls';
import { GlassOverlayPlayer } from './glassOverlay';
import { isVideoSrc } from './lodUrls';
import { frameScale, lerpFactor, REF_DT_SEC } from './frameScale';
import { lookAtZForDolly } from './cinematicCamera';
import { firstCircularOrbHit } from './orbPick';

export type MediaTier = 'ghost' | 'thumb' | 'mid' | 'focus';

interface ThreeRendererOptions {
	container: HTMLElement;
	fieldGlassUrl: string;
	focusGlassUrl: string;
	onSelect: (index: number) => void;
	onBackgroundClick?: () => void;
}

interface OrbMesh {
	group: THREE.Group;
	mediaMesh: THREE.Mesh;
	overlayMesh: THREE.Mesh;
	bodyId: number;
	focusProgress: number;
	material: THREE.ShaderMaterial;
	mediaTier: MediaTier;
	mediaTexture: THREE.Texture | null;
	hue?: number | undefined;
}

const vertexShader = `
	varying vec2 vUv;
	void main() {
		vUv = uv;
		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	}
`;

const fragmentShader = `
	uniform sampler2D map;
	uniform float blur;
	uniform float opacity;
	uniform float textureAspect;
	uniform vec2 offset;
	uniform float hasMap;
	varying vec2 vUv;

	void main() {
		vec2 uv = vUv;
		if (textureAspect > 1.0) {
			uv.x = (uv.x - 0.5) / textureAspect + 0.5;
		} else {
			uv.y = (uv.y - 0.5) * textureAspect + 0.5;
		}
		uv += offset;

		float dist = length(vUv - 0.5) * 2.0;
		float edgeAlpha = smoothstep(1.0, 0.95, dist);
		float dreamyFactor = clamp(blur / 20.0, 0.0, 1.0);

		vec4 texColor = hasMap > 0.5 ? texture2D(map, uv) : vec4(0.02, 0.03, 0.08, 1.0);

		vec2 lightCenter = vec2(0.5, 0.25);
		float distToLight = distance(vUv, lightCenter);
		float glow = exp(-distToLight * 3.5);
		float verticalMask = smoothstep(0.9, 0.4, vUv.y);
		glow *= verticalMask;
		float horizontalMask = smoothstep(0.5, 0.0, abs(vUv.x - 0.5));
		glow *= mix(0.5, 1.0, horizontalMask);

		vec3 voidColor = vec3(0.0, 0.0, 0.05);
		vec3 flameColor = vec3(1.0, 0.8, 0.95);

		vec3 dreamyState = mix(voidColor, texColor.rgb, hasMap > 0.5 ? 0.15 : 0.0);
		dreamyState += flameColor * glow * 1.2;
		vec3 focusedState = texColor.rgb;
		vec3 finalColor = mix(focusedState, dreamyState, dreamyFactor);

		gl_FragColor = vec4(finalColor, (hasMap > 0.5 ? texColor.a : 1.0) * opacity * edgeAlpha);
	}
`;

const MEDIA_UV_OFFSET = new THREE.Vector2(0.0, 0.0);
const MEDIA_PLANE_OFFSET = new THREE.Vector3(-0.02, 0.0, 0.0);
const DEFAULT_FOV = 52;

export class ThreeRenderer {
	private scene: THREE.Scene;
	private camera: THREE.PerspectiveCamera;
	private renderer: THREE.WebGLRenderer;
	private raycaster: THREE.Raycaster;
	private pointer: THREE.Vector2;
	private pointerDownX: number | null = null;
	private pointerDownY: number | null = null;
	private orbs: OrbMesh[] = [];
	private options: ThreeRendererOptions;
	/** Shared static field glass (frame 0 only) — all orbs including center-stage. */
	private fieldGlass: GlassOverlayPlayer;
	private focusGlassLoaded = false;
	private centeredIndex: number | null = null;
	private placeholderTexture: THREE.DataTexture;
	private activeVideo: { id: number; video: HTMLVideoElement; texture: THREE.VideoTexture } | null =
		null;
	private planeGeo: THREE.PlaneGeometry;
	constructor(options: ThreeRendererOptions) {
		this.options = options;
		this.scene = new THREE.Scene();
		this.camera = new THREE.PerspectiveCamera(DEFAULT_FOV, 1, 0.5, 5000);
		this.camera.position.set(0, 0, 900);

		this.renderer = new THREE.WebGLRenderer({
			alpha: true,
			antialias: true,
			powerPreference: 'high-performance'
		});
		// Keep default SRGB output. Do NOT set NoColorSpace — WebGLRenderer throws
		// when assigning drawingBufferColorSpace from spaces[''].
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.options.container.appendChild(this.renderer.domElement);

		this.raycaster = new THREE.Raycaster();
		this.pointer = new THREE.Vector2();
		this.fieldGlass = new GlassOverlayPlayer(768);
		this.planeGeo = new THREE.PlaneGeometry(1, 1);

		const data = new Uint8Array([8, 10, 20, 255]);
		this.placeholderTexture = new THREE.DataTexture(data, 1, 1);
		this.placeholderTexture.needsUpdate = true;

		this.renderer.domElement.addEventListener('pointermove', this.onPointerMove);
		this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
		this.renderer.domElement.addEventListener('click', this.onClick);
	}

	getDomElement(): HTMLCanvasElement {
		return this.renderer.domElement;
	}

	/**
	 * Boot shells only — static field glass + tinted overlays, no media wait.
	 * Glass failure must not abort orb spawn (Chrome OOM / decode errors).
	 */
	async initShells(mediaItems: MemoryMediaItem[], bodies: SphereBody[]): Promise<void> {
		try {
			await this.fieldGlass.loadStatic(this.options.fieldGlassUrl);
		} catch {
			/* loadStatic already swallows; keep empty canvas map */
		}
		const overlayMap = this.fieldGlass.getTexture();

		for (let i = 0; i < mediaItems.length; i++) {
			const item = mediaItems[i];
			const body = bodies[i];
			if (!body || !item) continue;

			const group = new THREE.Group();

			const overlayMaterial = new THREE.MeshBasicMaterial({
				map: overlayMap,
				transparent: true,
				opacity: 1,
				depthWrite: false,
				blending: THREE.NormalBlending
			});
			if (item.hue) {
				overlayMaterial.color.setHSL(item.hue / 360, 1, 0.5);
			}

			const overlayMesh = new THREE.Mesh(this.planeGeo, overlayMaterial);
			overlayMesh.position.z = 0.02;
			overlayMesh.renderOrder = 2;

			const mediaMaterial = new THREE.ShaderMaterial({
				uniforms: {
					map: { value: this.placeholderTexture },
					blur: { value: 20.0 },
					opacity: { value: 0.9 },
					textureAspect: { value: 1.0 },
					offset: { value: MEDIA_UV_OFFSET.clone() },
					hasMap: { value: 0.0 }
				},
				vertexShader,
				fragmentShader,
				transparent: true,
				depthWrite: false
			});

			const mediaMesh = new THREE.Mesh(this.planeGeo, mediaMaterial);
			mediaMesh.position.copy(MEDIA_PLANE_OFFSET);
			mediaMesh.scale.setScalar(0.48);
			mediaMesh.renderOrder = 1;

			group.add(mediaMesh);
			group.add(overlayMesh);
			this.scene.add(group);

			this.orbs.push({
				group,
				mediaMesh,
				overlayMesh,
				bodyId: body.id,
				focusProgress: 0,
				material: mediaMaterial,
				mediaTier: 'ghost',
				mediaTexture: null,
				hue: item.hue
			});
		}

		this.resize({
			width: this.options.container.clientWidth,
			height: this.options.container.clientHeight
		});
	}

	/**
	 * Focus master / animated glass deferred. Center-stage keeps shared static field glass
	 * (Chrome ImageDecoder loop was blanking the center overlay).
	 */
	async ensureFocusGlass(): Promise<void> {
		if (this.focusGlassLoaded) return;
		this.focusGlassLoaded = true;
	}

	/** Reserved for a future Chrome-safe glass loop; currently a no-op. */
	async beginCenterGlass(_bodyId: number): Promise<void> {
		/* keep shared static field glass on all overlays */
	}

	endCenterGlass(_bodyId: number): void {
		/* no-op */
	}

	async restoreFieldGlass(): Promise<void> {
		try {
			await this.fieldGlass.loadStatic(this.options.fieldGlassUrl);
		} catch {
			/* keep prior / empty canvas */
		}
		const map = this.fieldGlass.getTexture();
		for (const orb of this.orbs) {
			(orb.overlayMesh.material as THREE.MeshBasicMaterial).map = map;
			(orb.overlayMesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
		}
	}

	applyMediaBitmap(
		bodyId: number,
		canvas: HTMLCanvasElement,
		tier: MediaTier,
		aspect: number
	): void {
		const orb = this.orbs.find((o) => o.bodyId === bodyId);
		if (!orb) return;
		if (tier === 'thumb' && (orb.mediaTier === 'mid' || orb.mediaTier === 'focus')) return;
		if (tier === 'mid' && orb.mediaTier === 'focus') return;

		this.disposeOrbMedia(orb);
		const tex = new THREE.CanvasTexture(canvas);
		// Display-referred like main TextureLoader (no SRGB mark; shader has no colorspace_fragment).
		tex.colorSpace = THREE.NoColorSpace;
		// Match legacy TextureLoader (HTMLImageElement) orientation.
		tex.flipY = true;
		tex.minFilter = THREE.LinearMipmapLinearFilter;
		tex.generateMipmaps = true;
		tex.needsUpdate = true;

		orb.mediaTexture = tex;
		orb.mediaTier = tier;
		orb.material.uniforms['map']!.value = tex;
		orb.material.uniforms['textureAspect']!.value = aspect;
		orb.material.uniforms['hasMap']!.value = 1.0;
	}

	async applyFocusVideo(bodyId: number, item: MemoryMediaItem): Promise<void> {
		this.clearFocusVideo();
		const orb = this.orbs.find((o) => o.bodyId === bodyId);
		if (!orb) return;

		const video = document.createElement('video');
		video.src = item.src;
		video.loop = true;
		video.muted = true;
		video.playsInline = true;
		video.setAttribute('playsinline', '');
		video.preload = 'auto';
		if (item.poster) video.poster = item.poster;

		await new Promise<void>((resolve, reject) => {
			const onOk = () => {
				cleanup();
				resolve();
			};
			const onErr = () => {
				cleanup();
				reject(new Error('focus video failed'));
			};
			const cleanup = () => {
				video.removeEventListener('loadeddata', onOk);
				video.removeEventListener('error', onErr);
			};
			video.addEventListener('loadeddata', onOk, { once: true });
			video.addEventListener('error', onErr, { once: true });
			video.load();
		});

		void video.play().catch(() => {});
		const tex = new THREE.VideoTexture(video);
		tex.colorSpace = THREE.NoColorSpace;
		tex.minFilter = THREE.LinearFilter;
		tex.magFilter = THREE.LinearFilter;
		tex.generateMipmaps = false;
		tex.needsUpdate = true;

		this.disposeOrbMedia(orb);
		orb.mediaTexture = tex;
		orb.mediaTier = 'focus';
		const aspect =
			video.videoWidth && video.videoHeight
				? video.videoWidth / video.videoHeight
				: 1;
		orb.material.uniforms['map']!.value = tex;
		orb.material.uniforms['textureAspect']!.value = aspect;
		orb.material.uniforms['hasMap']!.value = 1.0;
		this.activeVideo = { id: bodyId, video, texture: tex };
	}

	clearFocusVideo(): void {
		if (!this.activeVideo) return;
		const { id, video, texture } = this.activeVideo;
		video.pause();
		video.removeAttribute('src');
		video.load();
		texture.dispose();
		this.activeVideo = null;
		const orb = this.orbs.find((o) => o.bodyId === id);
		if (orb && orb.mediaTier === 'focus') {
			orb.mediaTier = 'mid';
			orb.mediaTexture = null;
			orb.material.uniforms['map']!.value = this.placeholderTexture;
			orb.material.uniforms['hasMap']!.value = 0.0;
		}
	}

	demoteToGhost(bodyId: number): void {
		const orb = this.orbs.find((o) => o.bodyId === bodyId);
		if (!orb || orb.mediaTier === 'ghost') return;
		this.disposeOrbMedia(orb);
		orb.mediaTier = 'ghost';
		orb.material.uniforms['map']!.value = this.placeholderTexture;
		orb.material.uniforms['hasMap']!.value = 0.0;
	}

	getOrbTier(bodyId: number): MediaTier {
		return this.orbs.find((o) => o.bodyId === bodyId)?.mediaTier ?? 'ghost';
	}

	projectedDiameterPx(body: SphereBody, viewport: ViewportSize): number {
		const dist = Math.max(1, this.camera.position.z - body.z);
		const worldH = 2 * dist * Math.tan((this.camera.fov * Math.PI) / 360);
		const pxPerWorld = viewport.height / worldH;
		return body.radius * 2 * pxPerWorld;
	}

	setCameraState(state: CameraState): void {
		this.camera.position.set(state.panX, state.panY, state.dolly);
		const lookZ = lookAtZForDolly(state.dolly);
		this.camera.lookAt(state.panX, state.panY, lookZ);
		if (Math.abs(this.camera.fov - state.fov) > 0.01) {
			this.camera.fov = state.fov;
			this.camera.updateProjectionMatrix();
		}
	}

	update(bodies: SphereBody[], centerIdx: number | null, dtSec: number = REF_DT_SEC): void {
		this.centeredIndex = centerIdx;
		const frames = frameScale(dtSec);

		bodies.forEach((body) => {
			const orb = this.orbs.find((o) => o.bodyId === body.id);
			if (!orb) return;
			const uniforms = orb.material.uniforms;

			const isFocused = centerIdx === body.id;
			const targetFocus = isFocused ? 1 : 0;
			// Settle focus faster so dreamy/void mix does not linger on center-stage.
			const focusLerp = lerpFactor(isFocused ? 0.12 : 0.06, frames);
			if (Math.abs(targetFocus - orb.focusProgress) > 0.005) {
				orb.focusProgress += (targetFocus - orb.focusProgress) * focusLerp;
			} else {
				orb.focusProgress = targetFocus;
			}

			orb.group.position.set(body.x, body.y, body.z);
			const diameter = body.radius * 2;
			orb.group.scale.set(diameter, diameter, 1);

			const fp = orb.focusProgress;
			orb.mediaMesh.scale.setScalar(0.48);
			uniforms['blur']!.value = 20.0 * (1 - fp);

			if (centerIdx !== null && centerIdx !== body.id) {
				uniforms['opacity']!.value = 0.3;
				(orb.overlayMesh.material as THREE.MeshBasicMaterial).opacity = 0.3;
			} else {
				uniforms['opacity']!.value = 0.9;
				(orb.overlayMesh.material as THREE.MeshBasicMaterial).opacity = 1;
			}
		});

		this.renderer.render(this.scene, this.camera);
	}

	resize(viewport: ViewportSize): void {
		this.camera.aspect = viewport.width / Math.max(1, viewport.height);
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(viewport.width, viewport.height);
	}

	destroy(): void {
		this.clearFocusVideo();
		this.orbs.forEach((orb) => this.disposeOrbMedia(orb));
		this.orbs = [];
		this.fieldGlass.dispose();
		this.placeholderTexture.dispose();
		this.planeGeo.dispose();
		this.scene.clear();
		this.renderer.dispose();
		this.renderer.domElement.remove();
	}

	setCenter(index: number): void {
		this.centeredIndex = index;
	}

	clearCenter(index: number): void {
		if (this.centeredIndex === index) this.centeredIndex = null;
	}

	private disposeOrbMedia(orb: OrbMesh): void {
		if (this.activeVideo?.id === orb.bodyId) {
			this.clearFocusVideo();
		}
		if (orb.mediaTexture && orb.mediaTexture !== this.placeholderTexture) {
			orb.mediaTexture.dispose();
		}
		orb.mediaTexture = null;
	}

	private onPointerMove = (event: PointerEvent): void => {
		this.updatePointerFromEvent(event);
	};

	private onPointerDown = (event: PointerEvent): void => {
		this.updatePointerFromEvent(event);
		this.pointerDownX = this.pointer.x;
		this.pointerDownY = this.pointer.y;
	};

	private onClick = (event: PointerEvent): void => {
		this.updatePointerFromEvent(event);
		const dx = this.pointer.x - (this.pointerDownX ?? this.pointer.x);
		const dy = this.pointer.y - (this.pointerDownY ?? this.pointer.y);
		if (Math.sqrt(dx * dx + dy * dy) > 0.02) return;

		this.raycaster.setFromCamera(this.pointer, this.camera);
		const meshes = this.orbs.map((o) => o.overlayMesh);
		const intersects = this.raycaster.intersectObjects(meshes);
		// Square planes vs circular glass — ignore transparent corners.
		const picked = firstCircularOrbHit(intersects);
		if (!picked) {
			this.options.onBackgroundClick?.();
			return;
		}
		const orb = this.orbs.find((o) => o.overlayMesh === picked.object);
		if (orb) this.options.onSelect(orb.bodyId);
	};

	private updatePointerFromEvent(event: PointerEvent): void {
		const rect = this.renderer.domElement.getBoundingClientRect();
		this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
		this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
	}
}

export function mediaUrlForTier(item: MemoryMediaItem, tier: MediaTier): string | null {
	if (tier === 'ghost') return null;
	if (tier === 'thumb') return item.thumb ?? item.poster ?? item.src;
	if (tier === 'mid') return item.mid ?? item.thumb ?? item.poster ?? item.src;
	if (isVideoSrc(item.src, item.type)) return null; // video focus via applyFocusVideo
	return item.focus ?? item.src;
}
