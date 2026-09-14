<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = Omit<HTMLAttributes<HTMLSpanElement>, 'class'> & {
		tone?: 'white' | 'crimson' | 'purple';
	};

	let { tone = 'white', children, ...rest }: Props = $props();
</script>

<span
	class={[
		'inline-flex min-h-8 items-center gap-1 rounded-full px-3 text-sm font-bold tabular-nums',
		tone === 'white' && 'bg-white text-ink shadow-soft',
		tone === 'crimson' && 'bg-crimson text-white shadow-primary',
		tone === 'purple' && 'bg-linear-to-br from-purple-light to-purple text-white shadow-purple'
	]}
	{...rest}
>
	{@render children?.()}
</span>
