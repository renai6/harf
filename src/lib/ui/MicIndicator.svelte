<script lang="ts">
	let { listening, heard }: { listening: boolean; heard: string } = $props();
</script>

<div
	data-testid="mic"
	class="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-full bg-white/70 px-4 shadow-soft"
>
	<span
		aria-hidden="true"
		class={['size-3 shrink-0 rounded-full', listening ? 'mic-pulse bg-crimson-deep' : 'bg-ink/30']}
	></span>
	<span class="shrink-0 text-sm font-bold">{listening ? 'Listening' : 'Starting mic'}</span>
	{#if heard}
		<span
			lang="ar"
			dir="rtl"
			class="min-w-0 flex-1 truncate text-right font-arabic text-lg text-ink/75">{heard}</span
		>
	{/if}
</div>
