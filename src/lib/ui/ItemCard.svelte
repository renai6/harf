<script lang="ts">
	let { text, flash = false }: { text: string; flash?: boolean } = $props();
</script>

<div
	class={[
		'grid min-h-56 place-items-center rounded-item bg-white p-6 shadow-item ring-4 transition-shadow duration-150',
		flash ? 'ring-success' : 'ring-transparent'
	]}
>
	{#key text}
		<p
			data-testid="prompt"
			lang="ar"
			dir="rtl"
			class="item-pop font-arabic leading-normal font-bold text-ink"
			style:font-size="clamp(6rem, 32vw, 9rem)"
		>
			{text}
		</p>
	{/key}
</div>
