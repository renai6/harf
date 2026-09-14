<script lang="ts">
	let { text, flash = false }: { text: string; flash?: boolean } = $props();
</script>

<div
	class={[
		// The ring stays green and grows in; fading in from transparent passes through grey.
		// flex-1 fills the free height, so the answers below sit low on phones, in thumb reach.
		'grid min-h-56 flex-1 place-items-center rounded-item bg-white p-6 shadow-item ring-success transition-shadow duration-150',
		flash ? 'ring-4' : 'ring-0'
	]}
>
	{#key text}
		<p
			data-testid="prompt"
			lang="ar"
			dir="rtl"
			class="item-pop font-arabic leading-normal font-bold text-ink"
			style:font-size="clamp(6rem, 40vw, 11rem)"
		>
			{text}
		</p>
	{/key}
</div>
