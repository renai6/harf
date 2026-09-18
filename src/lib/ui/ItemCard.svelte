<script lang="ts">
	type Size = 'letter' | 'word' | 'sentence';

	let {
		text,
		flash = false,
		size = 'letter'
	}: { text: string; flash?: boolean; size?: Size } = $props();

	const FONT_SIZE: Record<Size, string> = {
		letter: 'clamp(6rem, 40vw, 11rem)',
		word: 'clamp(3.5rem, 16vw, 5rem)',
		sentence: 'clamp(1.75rem, 8vw, 2.5rem)'
	};
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
			class={[
				'item-pop font-arabic font-bold text-ink',
				// Sentences wrap, and loose lines keep harakat on neighboring lines apart.
				size === 'sentence' ? 'text-center leading-loose' : 'leading-normal'
			]}
			style:font-size={FONT_SIZE[size]}
		>
			{text}
		</p>
	{/key}
</div>
