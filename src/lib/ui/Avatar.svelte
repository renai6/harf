<script lang="ts">
	type Props = { name: string; seed: string; size?: 'sm' | 'md' | 'lg' };

	let { name, seed, size = 'md' }: Props = $props();

	// Dark enough for white text; chosen by player id so a rename keeps the color.
	const COLORS = [
		'var(--color-crimson-deep)',
		'#7b3fb2',
		'#0f7a55',
		'#c2410c',
		'#1d4ed8',
		'#9d174d'
	];

	const color = $derived(
		COLORS[[...seed].reduce((sum, char) => sum + (char.codePointAt(0) ?? 0), 0) % COLORS.length]
	);
	const initial = $derived(([...name][0] ?? '?').toLocaleUpperCase());
</script>

<span
	aria-hidden="true"
	class={[
		'grid shrink-0 place-items-center rounded-full font-bold text-white ring-2 ring-white',
		size === 'sm' && 'size-8 text-sm',
		size === 'md' && 'size-10 text-base',
		size === 'lg' && 'size-14 text-2xl'
	]}
	style:background-color={color}
>
	{initial}
</span>
