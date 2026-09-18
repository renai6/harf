<script lang="ts">
	import { letterByChar } from '$lib/content/letters';
	import type { Reveal } from '$lib/game/sprint';

	type Props = {
		choices: readonly string[];
		reveal: Reveal | null;
		disabled: boolean;
		onanswer: (choice: string) => void;
	};

	let { choices, reveal, disabled, onanswer }: Props = $props();

	/** Keys 1-4 map to the buttons in reading order. */
	const KEYS = ['1', '2', '3', '4'];

	function onkeydown(event: KeyboardEvent) {
		if (disabled || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
		const choice = choices[KEYS.indexOf(event.key)];
		if (choice === undefined) return;
		event.preventDefault();
		onanswer(choice);
	}
</script>

<svelte:window {onkeydown} />

<div role="group" aria-label="Answers" class="grid grid-cols-2 gap-3">
	{#each choices as choice, index (choice)}
		{@const letter = letterByChar(choice)}
		{@const look =
			reveal?.correct === choice ? 'correct' : reveal?.chosen === choice ? 'wrong' : 'idle'}
		<button
			type="button"
			{disabled}
			aria-keyshortcuts={KEYS[index]}
			onclick={() => onanswer(choice)}
			class={[
				'flex min-h-18 flex-wrap items-center justify-center gap-x-2 rounded-button px-3 py-2 text-lg shadow-soft transition',
				look === 'idle' && 'bg-white text-ink',
				// During the reveal the answers nobody touched step back, so the right one stands out.
				look === 'idle' && (reveal ? 'opacity-40' : disabled && 'opacity-60'),
				// White on success green is under 3:1 contrast; ink reads clearly.
				look === 'correct' && 'bg-success text-ink',
				look === 'wrong' && 'shake bg-crimson-deep text-white'
			]}
		>
			<span class="font-bold">{letter.name}</span>
			<span aria-hidden="true" class="opacity-60">·</span>
			<span lang="ar" dir="rtl" class="font-arabic text-xl font-bold">{letter.arabicName}</span>
		</button>
	{/each}
</div>
