import { frameScale, lerpFactor, REF_DT_SEC } from './frameScale';
import { CINEMATIC_LOOK_AHEAD } from './cinematicCamera';

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

export interface WorldBounds {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
	minZ: number;
	maxZ: number;
}

/** World-space orb radius so diameter fills `fill` of the view height at z=0. */
export function worldRadiusForScreenFill(
	cameraDolly: number,
	fovDeg: number,
	fill: number
): number {
	const dolly = Math.max(1, cameraDolly);
	const worldH = 2 * dolly * Math.tan((fovDeg * Math.PI) / 360);
	return (worldH * Math.max(0.05, fill)) / 2;
}

/**
 * Legacy center-stage sizing (main branch feel) in world units.
 * Desktop/tablet: oversized vs viewport height so glass fills the stage.
 * Mobile: same as main — height×1.1, widthClamp 2.5 so narrow screens are not
 * width-capped (main allowed diameter > viewport width to fill stage vertically).
 */
export function worldRadiusForCenterStage(
	cameraDolly: number,
	fovDeg: number,
	viewport: ViewportSize
): number {
	const isMobile = viewport.width <= 640;
	const isTablet = !isMobile && viewport.width <= 1024;
	const heightMultiplier = isMobile ? 1.1 : isTablet ? 1.35 : 1.9;
	// Mobile must match main (2.5): 0.98 was clamping to ~width and under-filling height.
	const widthClamp = isMobile ? 2.5 : isTablet ? 0.92 : 0.98;
	const targetDiameterPx = Math.min(
		viewport.height * heightMultiplier,
		viewport.width * widthClamp
	);
	const worldH = 2 * Math.max(1, cameraDolly) * Math.tan((fovDeg * Math.PI) / 360);
	const worldPerPx = worldH / Math.max(1, viewport.height);
	return (targetDiameterPx * worldPerPx) / 2;
}

/**
 * Main orthographic center used `width/2 + 20`. Glass WebP centroid sits slightly
 * left, so a right nudge is required — but full +20 overshoots on current mobile
 * chrome; 14px reads optically centered (user-verified vs left/right bias).
 */
export function centerStageWorldOffsetX(
	cameraDolly: number,
	fovDeg: number,
	viewport: ViewportSize,
	nudgePx = 14
): number {
	const worldH = 2 * Math.max(1, cameraDolly) * Math.tan((fovDeg * Math.PI) / 360);
	return nudgePx * (worldH / Math.max(1, viewport.height));
}

export interface SphereBody {
	id: number;
	/** World-space position (camera looks down −Z). */
	x: number;
	y: number;
	z: number;
	vx: number;
	vy: number;
	vz: number;
	ax: number;
	ay: number;
	/** World-space radius (perspective projects to screen size). */
	radius: number;
	targetRadius: number;
	originalRadius: number;
	originalX: number;
	originalY: number;
	originalZ: number;
	isCentered: boolean;
	targetZ: number;
	depthBand: 'near' | 'deep';
	driftAngle: number;
	driftSpeed: number;
	centerProgress?: number | undefined;
	centerMaxRadius?: number | undefined;
	/** World-space stage target (camera look-at); defaults to origin. */
	centerTargetX?: number | undefined;
	centerTargetY?: number | undefined;
	centerTargetZ?: number | undefined;
	centerStartX?: number | undefined;
	centerStartY?: number | undefined;
	centerStartZ?: number | undefined;
	releaseProgress?: number | undefined;
	releaseStartX?: number | undefined;
	releaseStartY?: number | undefined;
	releaseStartZ?: number | undefined;
	releaseStartRadius?: number | undefined;
	releaseRestX?: number | undefined;
	releaseRestY?: number | undefined;
	releaseRestZ?: number | undefined;
}

const defaultPhysicsConfig = (_viewport: ViewportSize): PhysicsConfig => {
	return {
		friction: 0.96,
		brownianStrength: 0.05,
		boundaryStiffness: 0,
		separationForce: 0,
		separationDistance: 0
	};
};

const defaultWorldBounds = (): WorldBounds => ({
	minX: -900,
	maxX: 900,
	minY: -560,
	maxY: 560,
	minZ: -1800,
	maxZ: 80
});

export class SphereSystem {
	private bodies: SphereBody[] = [];
	private viewport: ViewportSize = { width: 0, height: 0 };
	private world: WorldBounds = defaultWorldBounds();
	private readonly getConfig: (viewport: ViewportSize) => PhysicsConfig;
	private readonly random: () => number;

	constructor(
		getConfig: (viewport: ViewportSize) => PhysicsConfig = defaultPhysicsConfig,
		random: () => number = Math.random
	) {
		this.getConfig = getConfig;
		this.random = random;
	}

	setBodies(bodies: SphereBody[], viewport: ViewportSize, world?: WorldBounds): void {
		this.bodies = bodies;
		this.viewport = viewport;
		if (world) this.world = world;
	}

	updateViewport(viewport: ViewportSize): void {
		this.viewport = viewport;
	}

	setWorldBounds(world: WorldBounds): void {
		this.world = world;
	}

	/** @deprecated no longer used — near/deep budgets handle density */
	setActiveLimit(_limit: number): void {}

	getBodies(): SphereBody[] {
		return this.bodies;
	}

	/** @param dtSec wall-clock seconds since last step (default = one 60fps frame). */
	step(dtSec: number = REF_DT_SEC): SphereBody[] {
		const frames = frameScale(dtSec);
		const config = this.getConfig(this.viewport);

		for (let i = 0; i < this.bodies.length; i++) {
			const body = this.bodies[i];
			if (!body) continue;

			if (body.isCentered) {
				this.stepCentered(body, frames);
			} else {
				this.updateSphere(body, config, frames);
			}

			const radiusDiff = body.targetRadius - body.radius;
			if (Math.abs(radiusDiff) < 0.5) {
				body.radius = body.targetRadius;
			} else {
				body.radius += radiusDiff * lerpFactor(0.3, frames);
			}

			const zDiff = body.targetZ - body.z;
			if (Math.abs(zDiff) < 0.5) {
				body.z = body.targetZ;
			} else {
				body.z += zDiff * lerpFactor(0.18, frames);
			}
		}

		return this.bodies;
	}

	/**
	 * Bring orb to center-stage at the current camera look-at (panX/panY/lookAtZ),
	 * plus a small horizontal optical nudge so the glass reads centered.
	 * Stage distance is always LOOK_AHEAD so fill stays stable through a deep dive.
	 */
	centerBody(
		id: number,
		_cameraDolly = 900,
		stageX = 0,
		stageY = 0,
		fovDeg = 52,
		stageZ = 0
	): void {
		const body = this.bodies.find((b) => b.id === id);
		if (!body) return;

		body.isCentered = true;
		body.centerProgress = 0;
		body.centerStartX = body.x;
		body.centerStartY = body.y;
		body.centerStartZ = body.z;
		// Size as if framed at LOOK_AHEAD (not raw camera Z, which can be negative).
		const stageDist = CINEMATIC_LOOK_AHEAD;
		body.centerTargetX = stageX + centerStageWorldOffsetX(stageDist, fovDeg, this.viewport);
		body.centerTargetY = stageY;
		body.centerTargetZ = stageZ;
		body.vx = 0;
		body.vy = 0;
		body.vz = 0;
		body.ax = 0;
		body.ay = 0;

		const fullRadius = worldRadiusForCenterStage(stageDist, fovDeg, this.viewport);
		body.centerMaxRadius = fullRadius;
		body.targetRadius = body.radius;
		body.targetZ = stageZ;
	}

	releaseBody(id: number): void {
		const body = this.bodies.find((b) => b.id === id);
		if (!body) return;

		body.isCentered = false;
		body.centerProgress = undefined;
		body.centerMaxRadius = undefined;
		body.centerTargetX = undefined;
		body.centerTargetY = undefined;
		body.centerTargetZ = undefined;
		body.centerStartX = undefined;
		body.centerStartY = undefined;
		body.centerStartZ = undefined;
		body.releaseProgress = 0;
		body.releaseStartX = body.x;
		body.releaseStartY = body.y;
		body.releaseStartZ = body.z;
		body.releaseStartRadius = body.radius;

		const restOffsetX = (this.random() - 0.5) * 40;
		const restOffsetY = (this.random() - 0.5) * 40;
		body.releaseRestX = body.originalX + restOffsetX;
		body.releaseRestY = body.originalY + restOffsetY;
		body.releaseRestZ = body.originalZ;

		body.targetRadius = body.originalRadius;
		body.targetZ = body.originalZ;

		body.driftAngle = this.random() * Math.PI * 2;
		body.driftSpeed = 0.15 + this.random() * 0.25;
		body.vx = Math.cos(body.driftAngle) * body.driftSpeed;
		body.vy = Math.sin(body.driftAngle) * body.driftSpeed;
		body.vz = 0;
	}

	private stepCentered(body: SphereBody, frames: number): void {
		const targetX = body.centerTargetX ?? 0;
		const targetY = body.centerTargetY ?? 0;
		const targetZ = body.centerTargetZ ?? 0;
		const baseProgressStep = this.viewport.width <= 640 ? 0.015 : 0.01;
		const progress = Math.min(1, (body.centerProgress ?? 0) + baseProgressStep * frames);
		body.centerProgress = progress;
		const eased = 1 - (1 - progress) ** 2;

		const startX = body.centerStartX ?? body.x;
		const startY = body.centerStartY ?? body.y;
		const startZ = body.centerStartZ ?? body.z;
		body.centerStartX = startX;
		body.centerStartY = startY;
		body.centerStartZ = startZ;

		body.x = startX + (targetX - startX) * eased;
		body.y = startY + (targetY - startY) * eased;
		body.z = startZ + (targetZ - startZ) * eased;
		body.targetZ = body.z;

		body.vx = 0;
		body.vy = 0;
		body.vz = 0;
		body.ax = 0;
		body.ay = 0;

		const maxRadius = body.centerMaxRadius ?? body.targetRadius;
		const desiredRadius = body.originalRadius + (maxRadius - body.originalRadius) * eased;
		body.targetRadius = desiredRadius;
		body.radius = desiredRadius;
	}

	private updateSphere(body: SphereBody, _config: PhysicsConfig, frames: number): void {
		if (!body.isCentered && body.releaseProgress !== undefined && body.releaseProgress < 1) {
			const progress = Math.min(1, (body.releaseProgress ?? 0) + 0.012 * frames);
			body.releaseProgress = progress;

			const startX = body.releaseStartX ?? body.x;
			const startY = body.releaseStartY ?? body.y;
			const startZ = body.releaseStartZ ?? body.z;
			const startRadius = body.releaseStartRadius ?? body.radius;
			const restX = body.releaseRestX ?? body.originalX;
			const restY = body.releaseRestY ?? body.originalY;
			const restZ = body.releaseRestZ ?? body.originalZ;

			body.x = startX + (restX - startX) * progress;
			body.y = startY + (restY - startY) * progress;
			body.z = startZ + (restZ - startZ) * progress;
			body.targetZ = body.z;
			const radius = startRadius + (body.originalRadius - startRadius) * progress;
			body.radius = radius;
			body.targetRadius = radius;

			if (progress >= 0.999) {
				body.releaseProgress = undefined;
				body.releaseStartX = undefined;
				body.releaseStartY = undefined;
				body.releaseStartZ = undefined;
				body.releaseStartRadius = undefined;
				body.releaseRestX = undefined;
				body.releaseRestY = undefined;
				body.releaseRestZ = undefined;
				body.driftAngle = this.random() * Math.PI * 2;
				body.driftSpeed = 0.15 + this.random() * 0.25;
			}
			return;
		}

		if (body.driftAngle === undefined) {
			body.driftAngle = this.random() * Math.PI * 2;
			body.driftSpeed = 0.15 + this.random() * 0.25;
		}

		const turnRate = 0.05;
		body.driftAngle += (this.random() - 0.5) * turnRate * frames;

		const targetVx = Math.cos(body.driftAngle) * body.driftSpeed;
		const targetVy = Math.sin(body.driftAngle) * body.driftSpeed;
		const velLerp = lerpFactor(0.05, frames);
		body.vx += (targetVx - body.vx) * velLerp;
		body.vy += (targetVy - body.vy) * velLerp;
		// Very weak Z wander
		body.vz += ((this.random() - 0.5) * 0.02 * frames - body.vz) * lerpFactor(0.02, frames);

		body.x += body.vx * frames;
		body.y += body.vy * frames;
		body.z += body.vz * frames;
		body.targetZ = body.z;

		const { minX, maxX, minY, maxY, minZ, maxZ } = this.world;
		const margin = Math.max(20, body.radius * 0.4);

		if (body.x < minX + margin) {
			body.x = minX + margin;
			body.driftAngle = 0;
		} else if (body.x > maxX - margin) {
			body.x = maxX - margin;
			body.driftAngle = Math.PI;
		}

		if (body.y < minY + margin) {
			body.y = minY + margin;
			body.driftAngle = Math.PI / 2;
		} else if (body.y > maxY - margin) {
			body.y = maxY - margin;
			body.driftAngle = -Math.PI / 2;
		}

		if (body.z < minZ) {
			body.z = minZ;
			body.vz = Math.abs(body.vz);
		} else if (body.z > maxZ) {
			body.z = maxZ;
			body.vz = -Math.abs(body.vz);
		}
	}
}
