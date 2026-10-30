/**
 * Theme utility functions for Safari-compatible theme management
 * 
 * These utilities handle:
 * - Theme preference detection (localStorage + OS preference)
 * - Safari meta tag updates (with clone+replace workaround)
 * - Theme application (classes and attributes)
 * 
 * Following best practices:
 * - Single source of truth for theme logic
 * - Reusable across multiple script contexts
 * - Preserves all Safari workarounds
 */

// Theme color constants - single source of truth
export const THEME_COLORS = {
	light: '#fbf4e8',
	dark: '#0b0d14'
} as const;

/**
 * Get theme preference from localStorage or OS preference
 * Used across multiple script contexts (head, body, theme toggle)
 */
export function getThemePreference(): boolean {
	if (typeof window === 'undefined') return false;
	
	const saved = localStorage.getItem('theme');
	if (saved === 'dark') return true;
	if (saved === 'light') return false;
	
	// Fallback to OS preference
	return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

/**
 * Update meta tag with Safari workaround (clone + replace pattern)
 * CRITICAL: Safari requires tag replacement, not just attribute update
 * Used in 6+ places - now consolidated to single function
 */
export function updateMetaTagSafari(metaId: string, content: string): void {
	if (typeof document === 'undefined') return;
	
	const meta = document.getElementById(metaId);
	if (!meta) return;
	
	meta.setAttribute('content', content);
	const clone = meta.cloneNode(true) as HTMLElement;
	clone.setAttribute('content', content);
	meta.parentNode?.replaceChild(clone, meta);
}

/**
 * Apply theme classes and attributes to HTML/body
 * Used in 3+ places - now consolidated to single function
 */
export function applyTheme(isDark: boolean): void {
	if (typeof document === 'undefined') return;
	
	const html = document.documentElement;
	const body = document.body;
	if (!html || !body) return;
	
	html.classList.toggle('dark', isDark);
	html.style.colorScheme = isDark ? 'dark' : 'light';
	body.classList.toggle('dark-mode', isDark);
	body.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

