export interface ViewportSize {
	width: number;
	height: number;
}

export interface PhysicsConfig {
	friction: number;
	brownianStrength: number;
	boundaryStiffness: number;
	separationForce: number;
	separationDistance: number;
}

export interface SphereBody {
	id: number;
	x: number;
	y: number;
	vx: number;
	vy: number;
	ax: number;
	ay: number;
	radius: number;
	targetRadius: number;
	originalRadius: number;
	originalX: number;
	originalY: number;
	isCentered: boolean;
	z: number;
	targetZ: number;
	driftAngle: number; // Current direction of movement (radians)
	driftSpeed: number; // Base speed for this sphere
	centerProgress?: number | undefined;
	centerMaxRadius?: number | undefined;
	centerStartX?: number | undefined;
	centerStartY?: number | undefined;
	releaseProgress?: number | undefined;
	releaseStartX?: number | undefined;
	releaseStartY?: number | undefined;
	releaseStartRadius?: number | undefined;
	releaseRestX?: number | undefined;
	releaseRestY?: number | undefined;
}

const defaultPhysicsConfig = (_viewport: ViewportSize): PhysicsConfig => {
	return {
		friction: 0.96, // Higher friction for more controlled turns
		brownianStrength: 0.05, // Reduced random noise (now controls turn rate)
		boundaryStiffness: 0,
		separationForce: 0,
		separationDistance: 0
	};
};

export class SphereSystem {
	private bodies: SphereBody[] = [];
	private viewport: ViewportSize = { width: 0, height: 0 };
	private readonly getConfig: (viewport: ViewportSize) => PhysicsConfig;
	private readonly random: () => number;
	private elapsed = 0;

	constructor(
		getConfig: (viewport: ViewportSize) => PhysicsConfig = defaultPhysicsConfig,
		random: () => number = Math.random
	) {
		this.getConfig = getConfig;
		this.random = random;
	}

	setBodies(bodies: SphereBody[], viewport: ViewportSize): void {
		this.bodies = bodies;
		this.viewport = viewport;
	}

	updateViewport(viewport: ViewportSize): void {
		this.viewport = viewport;
	}

	setActiveLimit(_limit: number): void {
		// Deprecated - no longer used
	}

	getBodies(): SphereBody[] {
		return this.bodies;
	}

	step(): SphereBody[] {
		this.elapsed++;
		const config = this.getConfig(this.viewport);

		// ALL spheres get the same smooth physics
		for (let i = 0; i < this.bodies.length; i++) {
			const body = this.bodies[i];
			if (!body) continue;

			if (body.isCentered) {
				// Centered: Move to screen center and scale to 80% of screen
				const targetX = this.viewport.width / 2 + 20;
				const targetY = this.viewport.height / 2;
				const baseProgressStep = this.viewport.width <= 640 ? 0.015 : 0.01;
				const progress = Math.min(1, (body.centerProgress ?? 0) + baseProgressStep);
				body.centerProgress = progress;

				// Capture the starting point once so interpolation stays exact and arc-free
				const startX = body.centerStartX ?? body.x;
				const startY = body.centerStartY ?? body.y;
				body.centerStartX = startX;
				body.centerStartY = startY;

				// Keep translation perfectly linear to avoid curved or uneven motion
				const eased = progress;
				body.x = startX + (targetX - startX) * eased;
				body.y = startY + (targetY - startY) * eased;

				body.vx = 0;
				body.vy = 0;
				body.ax = 0;
				body.ay = 0;
				body.z = 0;
				body.targetZ = 0;

				// Synchronize radius growth with travel progress
				const maxRadius = body.centerMaxRadius ?? body.targetRadius;
				const desiredRadius = body.originalRadius + (maxRadius - body.originalRadius) * eased;
				body.targetRadius = desiredRadius;
				body.radius = desiredRadius;

				if (progress >= 0.995) {
					body.vx *= 0.0;
					body.vy *= 0.0;
				}

			} else {
				// Normal physics for all memory spheres + optional release easing
				this.updateSphere(body, config, i);
			}

			// Interpolate radius with snap-to-target threshold
			const radiusDiff = body.targetRadius - body.radius;
			if (Math.abs(radiusDiff) < 2) {
				// Close enough - snap to exact target
				body.radius = body.targetRadius;
			} else {
				// Continue smooth interpolation
				body.radius += radiusDiff * 0.3;
			}

			// Interpolate Z
			const zDiff = body.targetZ - body.z;
			if (Math.abs(zDiff) < 1) {
				body.z = body.targetZ;
			} else {
				body.z += zDiff * 0.25;
			}
		}

		// NO collision handling - depth layers prevent visual conflicts

		return this.bodies;
	}

	centerBody(id: number): void {
		const body = this.bodies.find((b) => b.id === id);
		if (body) {
			const prevRadius = body.radius;
			body.isCentered = true;
			body.centerProgress = 0;
			body.centerStartX = body.x;
			body.centerStartY = body.y;
			body.vx = 0;
			body.vy = 0;
			body.ax = 0;
			body.ay = 0;
			body.z = 0;
			// Scale to 2x viewport height due to Three.js perspective projection
			// (Actual screen fill is ~100% despite 2.0 multiplier on desktops)
			const isMobile = this.viewport.width <= 640;
			const isTablet = !isMobile && this.viewport.width <= 1024;
			const heightMultiplier = isMobile ? 1.10 : isTablet ? 5.8 : 2.0;
			const widthClamp = isMobile ? 2.5 : isTablet ? 5.0 : 1.25;
			const maxDiameter = Math.min(this.viewport.height * heightMultiplier, this.viewport.width * widthClamp);
			const fullRadius = Math.max(body.originalRadius * 1.5, maxDiameter / 2);
			body.centerMaxRadius = fullRadius;
			body.targetRadius = body.radius; // start from current size, grow via progress
			body.targetZ = 0;

			console.log(`🎯 CENTER: orb ${id}`);
			console.log(`   Current radius: ${prevRadius.toFixed(0)}px`);
			console.log(`   Target radius: ${fullRadius.toFixed(0)}px`);
			const fillPercent = ((fullRadius * 2) / this.viewport.height) * 100;
			console.log(`   Target ≈ ${fillPercent.toFixed(0)}% of viewport height`);
		}
	}

	releaseBody(id: number): void {
		const body = this.bodies.find((b) => b.id === id);
		if (body) {
			body.isCentered = false;
			body.centerProgress = undefined;
			body.centerMaxRadius = undefined;
			body.centerStartX = undefined;
			body.centerStartY = undefined;
			body.releaseProgress = 0;
			body.releaseStartX = body.x;
			body.releaseStartY = body.y;
			body.releaseStartRadius = body.radius;

			// Store a target rest point slightly offset from original to avoid stacking
			const restOffsetX = (this.random() - 0.5) * 60;
			const restOffsetY = (this.random() - 0.5) * 60;
			body.releaseRestX = body.originalX + restOffsetX;
			body.releaseRestY = body.originalY + restOffsetY;

			body.targetRadius = body.originalRadius;
			// Return to its depth layer (10 layers, 0 to -1200)
			const depthIndex = body.id % 10;
			body.targetZ = -depthIndex * 120;
			body.z = body.targetZ;

			// Reset drift state on release
			body.driftAngle = this.random() * Math.PI * 2;
			body.driftSpeed = 0.2 + this.random() * 0.3; // Random speed between 0.2 and 0.5

			body.vx = Math.cos(body.driftAngle) * body.driftSpeed;
			body.vy = Math.sin(body.driftAngle) * body.driftSpeed;
		}
	}

	private updateSphere(body: SphereBody, _config: PhysicsConfig, index: number): void {
		// If we're easing back toward drifting state, blend position/scale first
		if (!body.isCentered && body.releaseProgress !== undefined && body.releaseProgress < 1) {
			const progress = Math.min(1, (body.releaseProgress ?? 0) + 0.012);
			body.releaseProgress = progress;

			const startX = body.releaseStartX ?? body.x;
			const startY = body.releaseStartY ?? body.y;
			const startRadius = body.releaseStartRadius ?? body.radius;
			const restX = body.releaseRestX ?? body.originalX;
			const restY = body.releaseRestY ?? body.originalY;

			body.releaseStartX = startX;
			body.releaseStartY = startY;
			body.releaseStartRadius = startRadius;

			const eased = progress;
			body.x = startX + (restX - startX) * eased;
			body.y = startY + (restY - startY) * eased;
			const radius = startRadius + (body.originalRadius - startRadius) * eased;
			body.radius = radius;
			body.targetRadius = radius;

			if (progress >= 0.999) {
				body.releaseProgress = undefined;
				body.releaseStartX = undefined;
				body.releaseStartY = undefined;
				body.releaseStartRadius = undefined;
				body.releaseRestX = undefined;
				body.releaseRestY = undefined;

				// Initialize drift state when release finishes
				body.driftAngle = this.random() * Math.PI * 2;
				body.driftSpeed = 0.2 + this.random() * 0.3;
			}

			return;
		}

		// --- SMOOTH DRIFTING PHYSICS ---

		// 1. Initialize drift state if missing (e.g. first frame)
		if (body.driftAngle === undefined) {
			body.driftAngle = this.random() * Math.PI * 2;
			body.driftSpeed = 0.2 + this.random() * 0.3;
		}

		// 2. Slowly turn the steering wheel (drift angle)
		// Small random perturbation to the angle each frame
		const turnRate = 0.05; // How fast they can turn (lower = smoother curves)
		body.driftAngle += (this.random() - 0.5) * turnRate;

		// 3. Calculate velocity vector from angle
		// This ensures constant speed and smooth direction changes
		const targetVx = Math.cos(body.driftAngle) * body.driftSpeed;
		const targetVy = Math.sin(body.driftAngle) * body.driftSpeed;

		// 4. Blend current velocity towards target (momentum)
		// 0.05 blend factor = heavy momentum, very smooth
		body.vx += (targetVx - body.vx) * 0.05;
		body.vy += (targetVy - body.vy) * 0.05;

		// 5. Update position
		body.x += body.vx;
		body.y += body.vy;

		// 6. Soft boundary: Gently steer back if drifting too far
		if (!body.isCentered && this.viewport.width > 0 && this.viewport.height > 0) {
			const margin = Math.max(48, body.radius * 0.5);
			const minX = margin;
			const maxX = this.viewport.width - margin;
			const minY = margin;
			const maxY = this.viewport.height - margin;

			// If hitting wall, gently turn angle away from wall
			if (body.x < minX) {
				body.x = minX;
				body.driftAngle = 0; // Turn right
			} else if (body.x > maxX) {
				body.x = maxX;
				body.driftAngle = Math.PI; // Turn left
			}

			if (body.y < minY) {
				body.y = minY;
				body.driftAngle = Math.PI / 2; // Turn down
			} else if (body.y > maxY) {
				body.y = maxY;
				body.driftAngle = -Math.PI / 2; // Turn up
			}
		}

		// Assign depth layers: 10 layers from 0 to -1200 for spacious 3D feel
		const depthIndex = index % 10;
		body.targetZ = -depthIndex * 120;
	}

}
