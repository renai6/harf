export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'sm';

const BASE =
	'inline-flex min-h-12 items-center justify-center gap-2 rounded-button font-bold transition active:translate-y-px disabled:pointer-events-none disabled:opacity-50';

const VARIANTS: Record<ButtonVariant, string> = {
	primary: 'bg-linear-to-br from-crimson-light to-crimson text-white shadow-primary',
	secondary: 'bg-white text-ink shadow-soft',
	ghost: 'text-ink hover:bg-white/60',
	danger: 'text-crimson hover:bg-white/60'
};

const SIZES: Record<ButtonSize, string> = { md: 'px-5', sm: 'px-3' };

/**
 * Classes for buttons and for links styled as buttons.
 * Padding and colors come from `size` and `variant`; `class` must only add layout or text size, never conflicting utilities.
 */
export function buttonClass(
	variant: ButtonVariant = 'primary',
	options: { size?: ButtonSize; class?: string } = {}
): string {
	return [BASE, VARIANTS[variant], SIZES[options.size ?? 'md'], options.class ?? '']
		.join(' ')
		.trim();
}
