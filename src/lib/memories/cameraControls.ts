import type { ViewportSize } from './physics';
import { frameScale, lerpFactor, REF_DT_SEC } from './frameScale';
import {
	CINEMATIC_DEFAULT_DOLLY,
	CINEMATIC_LOOK_AHEAD,
	CINEMATIC_MAX_DOLLY,
	CINEMATIC_MIN_DOLLY,
	dollyFromPinch,
	fovForDolly,
	lookAtZForDolly
} from './cinematicCamera';

export interface CameraState {
	/** Dolly distance along view axis (world units). */
	dolly: number;
	/** Pan in the view plane (world units). */
	panX: number;
	panY: number;
	targetDolly: number;
	targetPanX: number;
	targetPanY: number;
	frozen: boolean;
	/** Vertical FOV in degrees (dolly-linked cinematic curve). */
	fov: number;
}

export interface CameraControlsOptions {
	minDolly?: number;
	maxDolly?: number;
	defaultDolly?: number;
	damping?: number;
}

const DEFAULTS = {
	minDolly: CINEMATIC_MIN_DOLLY,
	maxDolly: CINEMATIC_MAX_DOLLY,
	defaultDolly: CINEMATIC_DEFAULT_DOLLY,
	damping: 0.12
};

/**
 * Perspective explore controls: wheel/pinch dolly, drag pan.
 * Frozen while an orb is center-staged.
 */
export class CameraControls {
	private state: CameraState;
	private opts: Required<CameraControlsOptions>;
	private dragging = false;
	private lastX = 0;
	private lastY = 0;
	private viewport: ViewportSize = { width: 1, height: 1 };
	private element: HTMLElement | null = null;
	private onWheelBound = (e: WheelEvent) => this.onWheel(e);
	private onPointerDownBound = (e: PointerEvent) => this.onPointerDown(e);
	private onPointerMoveBound = (e: PointerEvent) => this.onPointerMove(e);
	private onPointerUpBound = () => this.onPointerUp();
	private pinchStartDist: number | null = null;
	private pinchStartDolly = 0;

	constructor(options: CameraControlsOptions = {}) {
		this.opts = { ...DEFAULTS, ...options };
		const d = this.opts.defaultDolly;
		this.state = {
			dolly: d,
			panX: 0,
			panY: 0,
			targetDolly: d,
			targetPanX: 0,
			targetPanY: 0,
			frozen: false,
			fov: fovForDolly(d, this.opts)
		};
	}

	attach(element: HTMLElement, viewport: ViewportSize): void {
		this.detach();
		this.element = element;
		this.viewport = viewport;
		element.addEventListener('wheel', this.onWheelBound, { passive: false });
		element.addEventListener('pointerdown', this.onPointerDownBound);
		window.addEventListener('pointermove', this.onPointerMoveBound);
		window.addEventListener('pointerup', this.onPointerUpBound);
		element.addEventListener('touchstart', this.onTouchStart, { passive: false });
		element.addEventListener('touchmove', this.onTouchMove, { passive: false });
		element.addEventListener('touchend', this.onTouchEnd);
	}

	detach(): void {
		if (!this.element) return;
		this.element.removeEventListener('wheel', this.onWheelBound);
		this.element.removeEventListener('pointerdown', this.onPointerDownBound);
		window.removeEventListener('pointermove', this.onPointerMoveBound);
		window.removeEventListener('pointerup', this.onPointerUpBound);
		this.element.removeEventListener('touchstart', this.onTouchStart);
		this.element.removeEventListener('touchmove', this.onTouchMove);
		this.element.removeEventListener('touchend', this.onTouchEnd);
		this.element = null;
	}

	setViewport(viewport: ViewportSize): void {
		this.viewport = viewport;
	}

	setFrozen(frozen: boolean): void {
		this.state.frozen = frozen;
		if (frozen) {
			this.dragging = false;
			this.pinchStartDist = null;
		}
	}

	/** Keep pan/dolly where they are; center-stage targets the current look-at instead. */
	holdView(): void {
		this.state.targetDolly = this.state.dolly;
		this.state.targetPanX = this.state.panX;
		this.state.targetPanY = this.state.panY;
	}

	/** Snap pan to origin so center-stage sits in screen center (keeps current dolly). */
	resetPan(): void {
		this.state.panX = 0;
		this.state.panY = 0;
		this.state.targetPanX = 0;
		this.state.targetPanY = 0;
	}

	getState(): CameraState {
		return this.state;
	}

	/** Soft-step toward targets; call once per RAF with wall-clock dt. */
	step(dtSec: number = REF_DT_SEC): CameraState {
		if (!this.state.frozen) {
			const d = lerpFactor(this.opts.damping, frameScale(dtSec));
			this.state.dolly += (this.state.targetDolly - this.state.dolly) * d;
			this.state.panX += (this.state.targetPanX - this.state.panX) * d;
			this.state.panY += (this.state.targetPanY - this.state.panY) * d;
		}
		this.state.fov = fovForDolly(this.state.dolly, this.opts);
		return this.state;
	}

	private clampDolly(v: number): number {
		return Math.min(this.opts.maxDolly, Math.max(this.opts.minDolly, v));
	}

	private onWheel(e: WheelEvent): void {
		if (this.state.frozen) return;
		e.preventDefault();
		const delta = e.deltaY;
		this.state.targetDolly = this.clampDolly(this.state.targetDolly + delta * 0.9);
	}

	private onPointerDown(e: PointerEvent): void {
		if (this.state.frozen || e.button !== 0) return;
		this.dragging = true;
		this.lastX = e.clientX;
		this.lastY = e.clientY;
		// Do not capture touch — capture blocks clean two-finger pinch on mobile.
		if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
			this.element?.setPointerCapture?.(e.pointerId);
		}
	}

	private onPointerMove(e: PointerEvent): void {
		if (!this.dragging || this.state.frozen || this.pinchStartDist !== null) return;
		const dx = e.clientX - this.lastX;
		const dy = e.clientY - this.lastY;
		this.lastX = e.clientX;
		this.lastY = e.clientY;
		const scale = (CINEMATIC_LOOK_AHEAD / Math.max(1, this.viewport.height)) * 1.1;
		this.state.targetPanX -= dx * scale;
		this.state.targetPanY += dy * scale;
	}

	private onPointerUp(): void {
		this.dragging = false;
	}

	private onTouchStart = (e: TouchEvent): void => {
		if (this.state.frozen) return;
		if (e.touches.length === 2) {
			e.preventDefault();
			const a = e.touches[0];
			const b = e.touches[1];
			if (!a || !b) return;
			this.pinchStartDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
			this.pinchStartDolly = this.state.targetDolly;
			this.dragging = false;
		}
	};

	private onTouchMove = (e: TouchEvent): void => {
		if (this.state.frozen) return;
		if (e.touches.length === 2 && this.pinchStartDist !== null) {
			e.preventDefault();
			const a = e.touches[0];
			const b = e.touches[1];
			if (!a || !b) return;
			const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
			// Additive (not multiplicative): works across negative dolly / deep dive.
			// Higher gain so mobile can cover the full travel range like desktop wheel.
			this.state.targetDolly = this.clampDolly(
				dollyFromPinch(this.pinchStartDolly, this.pinchStartDist, dist)
			);
		}
	};

	private onTouchEnd = (e: TouchEvent): void => {
		if (e.touches.length < 2) this.pinchStartDist = null;
	};
}

export {
	fovForDolly,
	lookAtZForDolly,
	dollyFromPinch,
	CINEMATIC_MIN_DOLLY,
	CINEMATIC_MAX_DOLLY,
	CINEMATIC_DEFAULT_DOLLY,
	CINEMATIC_LOOK_AHEAD
};
