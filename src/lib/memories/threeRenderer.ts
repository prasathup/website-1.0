import * as THREE from 'three';
import gsap from 'gsap';
import type { MemoryMediaItem } from './media';
import type { SphereBody, ViewportSize } from './physics';

interface ThreeRendererOptions {
    container: HTMLElement;
    overlayTexture: string;
    onSelect: (index: number) => void;
}

interface OrbMesh {
    group: THREE.Group;
    mediaMesh: THREE.Mesh;
    overlayMesh: THREE.Mesh;
    bodyId: number;
    focusProgress: number; // 0 to 1
    material: THREE.ShaderMaterial; // Keep ref to update uniforms
}

// Vertex shader: Standard
const vertexShader = `
	varying vec2 vUv;
	void main() {
		vUv = uv;
		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	}
`;

// Fragment shader: "Spectral Light" Ethereal Shader
// Simulates a living light source inside the orb, fading up like a flame.
// NO BLUR (Performance optimized)
const fragmentShader = `
	uniform sampler2D map;
	uniform float blur; // 0.0 (Sharp) to 20.0 (Dreamy)
	uniform float opacity;
	uniform float textureAspect; // width / height
	uniform vec2 offset; // manual centering tweaks
	varying vec2 vUv;

	void main() {
		// 1. Aspect Ratio Correction
		vec2 uv = vUv;
		if (textureAspect > 1.0) {
			uv.x = (uv.x - 0.5) / textureAspect + 0.5;
		} else {
			uv.y = (uv.y - 0.5) * textureAspect + 0.5;
		}
		uv += offset;

		// 2. Geometry & Mask (Sphere Impostor)
		float dist = length(vUv - 0.5) * 2.0; // 0 center -> 1 edge
		float edgeAlpha = smoothstep(1.0, 0.95, dist);

		// 3. State Calculation
		// Normalize blur (0..20) to 0..1 factor. 
		// 1.0 = Dreamy/Resting state. 0.0 = Focused/Active state.
		float dreamyFactor = clamp(blur / 20.0, 0.0, 1.0);

		// 4. Content Sampling (Single Tap - High Performance)
		vec4 texColor = texture2D(map, uv);

		// 5. "Spectral Flame" Glow Calculation
		// Center of the light source (bottom center)
		vec2 lightCenter = vec2(0.5, 0.25); 
		float distToLight = distance(vUv, lightCenter);
		
		// Core Glow: Strong near bottom, fades radially
		// Optimized exponential falloff
		float glow = exp(-distToLight * 3.5);
		
		// Vertical Rise: Allow glow to rise but fade at the very top
		// "Emerging like a flame but not covering entire orb"
		float verticalMask = smoothstep(0.9, 0.4, vUv.y); // Fade out at top
		glow *= verticalMask;
		
		// Side containment: Keep it somewhat central
		float horizontalMask = smoothstep(0.5, 0.0, abs(vUv.x - 0.5));
		glow *= mix(0.5, 1.0, horizontalMask);

		// 6. Compositing
		// Define the Colors
		vec3 voidColor = vec3(0.0, 0.0, 0.05); // Deepest dark blue
		vec3 flameColor = vec3(1.0, 0.8, 0.95); // Soft magical light (Pink/Gold tint)
		
		// DREAMY STATE:
		// Background: Dark Void
		// Content: Faint ghost (15% opacity) - visible but ethereal
		// Light: Additive flame glow
		
		vec3 dreamyState = mix(voidColor, texColor.rgb, 0.15);
		dreamyState += flameColor * glow * 1.2; // Add intensity
		
		// FOCUSED STATE:
		// Just the pure content
		vec3 focusedState = texColor.rgb;
		
		// Mix based on state
		vec3 finalColor = mix(focusedState, dreamyState, dreamyFactor);

		gl_FragColor = vec4(finalColor, texColor.a * opacity * edgeAlpha);
	}
`;

const MEDIA_UV_OFFSET = new THREE.Vector2(0.0, 0.0); // UV offset stays neutral; plane offset handles drift
const MEDIA_PLANE_OFFSET = new THREE.Vector3(-0.02, 0.0, 0.0); // Physical mesh offset for last-mile alignment

export class ThreeRenderer {
    private scene: THREE.Scene;
    private camera: THREE.OrthographicCamera;
    private renderer: THREE.WebGLRenderer;
    private raycaster: THREE.Raycaster;
    private pointer: THREE.Vector2;
    private pointerDownX: number | null = null; // Track pointer position at mousedown
    private pointerDownY: number | null = null;
    private orbs: OrbMesh[] = [];
    private options: ThreeRendererOptions;
    private textureLoader: THREE.TextureLoader;
    private overlayMap: THREE.Texture | null = null;
    private overlayVideo: HTMLVideoElement | null = null;
    private centeredIndex: number | null = null;
    private mediaTextures: THREE.Texture[] = []; // Track GPU textures so we can dispose when tearing down
    private activeVideos: HTMLVideoElement[] = []; // Keep refs to autoplaying videos for proper cleanup

    constructor(options: ThreeRendererOptions) {
        this.options = options;
        this.scene = new THREE.Scene();

        // Camera setup: orthographic projection keeps motion linear while we simulate depth manually
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 3000);
        this.camera.position.z = 1200;

        this.renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.options.container.appendChild(this.renderer.domElement);

        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        this.textureLoader = new THREE.TextureLoader();

        this.renderer.domElement.addEventListener('pointermove', this.onPointerMove.bind(this));
        this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown.bind(this));
        this.renderer.domElement.addEventListener('click', this.onClick.bind(this));
    }

    async init(mediaItems: MemoryMediaItem[], bodies: SphereBody[]): Promise<void> {
        console.log('✓ ThreeRenderer v20: Snap-to-target ensures full 95% size reached');
        try {
            this.overlayMap = await this.loadOverlayTexture(this.options.overlayTexture);
            console.log('✓ Overlay texture loaded');
        } catch (e) {
            console.error('❌ Failed to load overlay texture:', e);
        }

        const geometry = new THREE.PlaneGeometry(1, 1);
        const mediaGeometry = new THREE.PlaneGeometry(1, 1);

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < mediaItems.length; i++) {
            const item = mediaItems[i];
            const body = bodies[i];
            if (!body || !item) continue;

            // 1. Media Mesh - ONLY create if texture loads successfully
            let mediaTexture: THREE.Texture | null = null;
            let aspect = 1.0;

            try {
                const result = await this.buildMediaTexture(item);
                mediaTexture = result.texture;
                aspect = result.aspect;
                this.mediaTextures.push(mediaTexture);
                successCount++;
            } catch (error) {
                console.warn(`⚠️ Skipping orb ${i}: Failed to load ${item.src}`);
                failCount++;
                continue; // SKIP this orb entirely if texture fails
            }

            const group = new THREE.Group();

            const mediaMaterial = new THREE.ShaderMaterial({
                uniforms: {
                    map: { value: mediaTexture }, // Guaranteed to be valid texture
                    blur: { value: 4.0 },
                    opacity: { value: 0.9 },
                    textureAspect: { value: aspect },
                    offset: { value: MEDIA_UV_OFFSET.clone() } // Each mesh keeps its own vec reference
                },
                vertexShader,
                fragmentShader,
                transparent: true
            });

            const mediaMesh = new THREE.Mesh(mediaGeometry, mediaMaterial);
            mediaMesh.position.set(
                MEDIA_PLANE_OFFSET.x,
                MEDIA_PLANE_OFFSET.y,
                MEDIA_PLANE_OFFSET.z
            );

            // Base scale: 0.5 for proper containment within glass orb
            mediaMesh.scale.setScalar(0.5);

            // 2. Overlay Mesh
            const overlayMaterial = new THREE.MeshBasicMaterial({
                map: this.overlayMap,
                transparent: true,
                opacity: 1,
                blending: THREE.NormalBlending
            });

            if (item.hue) {
                overlayMaterial.color.setHSL(item.hue / 360, 1, 0.5);
            }

            const overlayMesh = new THREE.Mesh(geometry, overlayMaterial);
            overlayMesh.position.z = 1;

            group.add(mediaMesh);
            group.add(overlayMesh);

            this.scene.add(group);

            this.orbs.push({
                group,
                mediaMesh,
                overlayMesh,
                bodyId: body.id,
                focusProgress: 0,
                material: mediaMaterial
            });
        }

        console.log(`✓ Created ${successCount} orbs (${failCount} failed)`);
        this.resize({ width: this.options.container.clientWidth, height: this.options.container.clientHeight });
    }

    update(bodies: SphereBody[], centerIdx: number | null): void {
        this.centeredIndex = centerIdx;

        const viewportWidth = this.options.container.clientWidth;
        const viewportHeight = this.options.container.clientHeight;
        const halfWidth = viewportWidth / 2;
        const halfHeight = viewportHeight / 2;

        bodies.forEach(body => {
            const orb = this.orbs.find(o => o.bodyId === body.id);
            if (!orb) return;
            const uniforms = orb.material.uniforms as Record<string, THREE.IUniform>;

            // Target Focus State
            const isFocused = centerIdx === body.id;
            const targetFocus = isFocused ? 1 : 0;

            // Animate focus progress
            if (Math.abs(targetFocus - orb.focusProgress) > 0.01) {
                // Extremely gentle easing so opacity/blur shifts feel calm
                orb.focusProgress += (targetFocus - orb.focusProgress) * 0.025;
            } else {
                orb.focusProgress = targetFocus;
            }

            // Map Physics to World
            const targetX = body.x - halfWidth;
            const targetY = halfHeight - body.y;

            orb.group.position.x = targetX;
            orb.group.position.y = targetY;
            orb.group.position.z = body.z;

            // Scale
            const depthScale = this.camera.position.z / (this.camera.position.z - body.z);
            const diameter = body.radius * 2 * depthScale;
            orb.group.scale.set(diameter, diameter, 1);

            // Visual adjustments
            const fp = orb.focusProgress;

            // Media Scale: Keep constant at 0.5 to properly fill orb without overflow
            orb.mediaMesh.scale.setScalar(0.48);

            // Blur: Normal (20.0) -> Focused (0.0)
            // Increased from 4.0 to 20.0 for stronger blur effect
            const blurAmount = 20.0 * (1 - fp);
            const blurUniform = uniforms['blur'];
            if (blurUniform) {
                blurUniform.value = blurAmount;
            }

            // Opacity/Dimming
            if (centerIdx !== null && centerIdx !== body.id) {
                const opacityUniform = uniforms['opacity'];
                if (opacityUniform) {
                    opacityUniform.value = 0.3;
                }
                (orb.overlayMesh.material as THREE.MeshBasicMaterial).opacity = 0.3;
            } else {
                const opacityUniform = uniforms['opacity'];
                if (opacityUniform) {
                    opacityUniform.value = 0.9;
                }
                (orb.overlayMesh.material as THREE.MeshBasicMaterial).opacity = 1;
            }
        });

        if (this.overlayMap) {
            this.overlayMap.needsUpdate = true; // ensure animated WebP overlays refresh each frame
        }

        this.renderer.render(this.scene, this.camera);
    }

    resize(viewport: ViewportSize): void {
        const halfWidth = viewport.width / 2;
        const halfHeight = viewport.height / 2;
        this.camera.left = -halfWidth;
        this.camera.right = halfWidth;
        this.camera.top = halfHeight;
        this.camera.bottom = -halfHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(viewport.width, viewport.height);
    }

    destroy(): void {
        // Dispose GPU assets and pause HTMLVideoElements so Safari/iOS free resources immediately
        this.mediaTextures.forEach(texture => texture.dispose());
        this.mediaTextures = [];
        this.activeVideos.forEach(video => {
            video.pause();
            video.src = '';
        });
        this.activeVideos = [];
        if (this.overlayVideo) {
            this.overlayVideo.pause();
            this.overlayVideo.src = '';
            this.overlayVideo = null;
        }
        this.overlayMap?.dispose();
        this.overlayMap = null;
        this.scene.clear();
        this.renderer.dispose();
    }

    private loadTexture(url: string): Promise<THREE.Texture> {
        return new Promise((resolve, reject) => {
            this.textureLoader.load(url, resolve, undefined, reject);
        });
    }

    private async loadOverlayTexture(source: string): Promise<THREE.Texture | null> {
        if (this.isVideoSource(source)) {
            const { texture, video } = await this.loadVideoTextureFromUrl(source);
            this.overlayVideo = video;
            return texture;
        }
        const { texture } = await this.loadImageTexture(source);
        return texture;
    }

    private async buildMediaTexture(item: MemoryMediaItem): Promise<{ texture: THREE.Texture; aspect: number }> {
        // Videos need their own loader path because TextureLoader cannot consume mp4 containers
        if (this.isVideoItem(item)) {
            try {
                return await this.loadVideoTexture(item);
            } catch (error) {
                console.warn(`⚠️ Video texture fallback for ${item.src}`, error);
                return this.buildPosterTexture(item);
            }
        }

        return this.loadImageTexture(item.src);
    }

    private async buildPosterTexture(item: MemoryMediaItem): Promise<{ texture: THREE.Texture; aspect: number }> {
        if (item.poster) {
            return this.loadImageTexture(item.poster);
        }

        const canvas = document.createElement('canvas');
        canvas.width = 2;
        canvas.height = 2;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = 'rgba(11, 12, 20, 0.85)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return { texture, aspect: 1 };
    }

    private async loadImageTexture(url: string): Promise<{ texture: THREE.Texture; aspect: number }> {
        const texture = await this.loadTexture(url);
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.generateMipmaps = true;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;

        const image = texture.image as { width?: number; height?: number } | undefined;
        const aspect = image?.width && image?.height ? image.width / image.height : 1;
        return { texture, aspect };
    }

    private loadVideoTexture(item: MemoryMediaItem): Promise<{ texture: THREE.VideoTexture; aspect: number }> {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.src = item.src;
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            video.setAttribute('playsinline', '');
            video.preload = 'auto';
            video.crossOrigin = 'anonymous';
            if (item.poster) {
                video.poster = item.poster;
            }

            let settled = false;
            const cleanup = () => {
                settled = true;
                window.clearTimeout(timeoutId);
                video.removeEventListener('loadeddata', handleLoaded);
                video.removeEventListener('loadedmetadata', handleLoaded);
                video.removeEventListener('error', handleError);
            };

            const handleLoaded = () => {
                if (settled) return;
                cleanup();
                video.play().catch(() => {
                    // Autoplay can still be blocked on some browsers; ignore silently
                });
                const texture = new THREE.VideoTexture(video);
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.generateMipmaps = false;
                texture.wrapS = THREE.ClampToEdgeWrapping;
                texture.wrapT = THREE.ClampToEdgeWrapping;
                texture.needsUpdate = true;

                const width = video.videoWidth || item.width || 1;
                const height = video.videoHeight || item.height || 1;

                this.activeVideos.push(video);
                resolve({ texture, aspect: width / height });
            };

            const handleError = () => {
                if (settled) return;
                cleanup();
                reject(new Error(`Video failed to load: ${item.src}`));
            };

            video.addEventListener('loadeddata', handleLoaded, { once: true });
            video.addEventListener('loadedmetadata', handleLoaded, { once: true });
            video.addEventListener('error', handleError, { once: true });
            const timeoutId = window.setTimeout(() => {
                if (settled) return;
                cleanup();
                reject(new Error(`Video load timeout: ${item.src}`));
            }, 5000);
            video.load();
        });
    }

    private loadVideoTextureFromUrl(url: string): Promise<{ texture: THREE.VideoTexture; video: HTMLVideoElement }> {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.src = url;
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            video.setAttribute('playsinline', '');
            video.preload = 'auto';
            video.crossOrigin = 'anonymous';

            let settled = false;
            const cleanup = () => {
                settled = true;
                window.clearTimeout(timeoutId);
                video.removeEventListener('loadeddata', handleLoaded);
                video.removeEventListener('loadedmetadata', handleLoaded);
                video.removeEventListener('error', handleError);
            };

            const handleLoaded = () => {
                if (settled) return;
                cleanup();
                video.play().catch(() => { });
                const texture = new THREE.VideoTexture(video);
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.generateMipmaps = false;
                texture.wrapS = THREE.ClampToEdgeWrapping;
                texture.wrapT = THREE.ClampToEdgeWrapping;
                texture.needsUpdate = true;
                resolve({ texture, video });
            };

            const handleError = () => {
                if (settled) return;
                cleanup();
                reject(new Error(`Overlay video failed to load: ${url}`));
            };

            video.addEventListener('loadeddata', handleLoaded, { once: true });
            video.addEventListener('loadedmetadata', handleLoaded, { once: true });
            video.addEventListener('error', handleError, { once: true });
            const timeoutId = window.setTimeout(() => {
                if (settled) return;
                cleanup();
                reject(new Error(`Overlay video load timeout: ${url}`));
            }, 5000);
            video.load();
        });
    }

    private isVideoItem(item: MemoryMediaItem): boolean {
        if (item.type === 'video') return true;
        return /\.mp4($|\?)/i.test(item.src);
    }

    private isVideoSource(url: string): boolean {
        return /\.(mp4|webm|mov)($|\?)/i.test(url);
    }

    private updatePointerFromEvent(event: PointerEvent): void {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    private onPointerMove(event: PointerEvent): void {
        this.updatePointerFromEvent(event);
        gsap.to({}, { duration: 0 });
    }

    private onPointerDown(event: PointerEvent): void {
        this.updatePointerFromEvent(event);
        // Store pointer position at mousedown to detect drag vs click
        this.pointerDownX = this.pointer.x;
        this.pointerDownY = this.pointer.y;
    }

    private onClick(event: PointerEvent): void {
        this.updatePointerFromEvent(event);

        // Ignore if pointer moved significantly (drag, not click)
        const dx = this.pointer.x - (this.pointerDownX ?? this.pointer.x);
        const dy = this.pointer.y - (this.pointerDownY ?? this.pointer.y);
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 0.02) {
            console.log('🚫 Click ignored: pointer moved too much (drag detected)');
            return;
        }

        this.raycaster.setFromCamera(this.pointer, this.camera);
        const meshes: THREE.Object3D[] = [];
        this.orbs.forEach(orb => meshes.push(orb.overlayMesh));

        const intersects = this.raycaster.intersectObjects(meshes);

        if (intersects.length === 0) {
            console.log('🚫 No orb clicked (background)');
            return;
        }

        // Get the CLOSEST intersection (first in array, already sorted by distance)
        const hit = intersects[0]?.object;
        if (!hit) return;

        const orb = this.orbs.find(o => o.overlayMesh === hit);
        if (orb && intersects[0]) {
            console.log(`✅ Orb clicked: ID ${orb.bodyId}, Distance: ${intersects[0].distance.toFixed(2)}`);
            this.options.onSelect(orb.bodyId);
        }
    }

    setCenter(index: number): void {
        this.centeredIndex = index;
    }

    clearCenter(index: number): void {
        if (this.centeredIndex === index) {
            this.centeredIndex = null;
        }
    }
}
