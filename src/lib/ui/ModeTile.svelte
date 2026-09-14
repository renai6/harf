<script lang="ts">
	type Props = {
		arabic: string;
		title: string;
		subtitle?: string;
		selected: boolean;
		disabled?: boolean;
		onclick?: () => void;
	};

	let { arabic, title, subtitle, selected, disabled = false, onclick }: Props = $props();
</script>

<button
	type="button"
	aria-pressed={selected}
	{disabled}
	{onclick}
	class={[
		'flex min-h-28 flex-col items-center justify-center gap-1 rounded-card p-3 text-center transition active:translate-y-px disabled:opacity-50',
		selected
			? 'bg-linear-to-br from-purple-light to-purple text-white shadow-purple'
			: 'bg-white text-ink shadow-soft'
	]}
>
	<span lang="ar" dir="rtl" class="font-arabic text-3xl leading-snug font-bold">{arabic}</span>
	<span class="font-bold">{title}</span>
	{#if subtitle}<span class="text-xs opacity-80">{subtitle}</span>{/if}
</button>
