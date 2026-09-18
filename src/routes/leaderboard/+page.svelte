<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		LETTER_VARIANTS,
		LEVELS,
		LEVEL_LABELS,
		MODES,
		MODE_LABELS,
		PACK_VARIANTS,
		VARIANT_LABELS,
		boardKey,
		type LetterVariant,
		type Level,
		type Mode,
		type PackVariant,
		type Setup
	} from '$lib/game/levels';
	import { getStore } from '$lib/storage/app-store';
	import { boardRows } from '$lib/storage/boards';
	import LeaderboardTable from '$lib/ui/LeaderboardTable.svelte';
	import SegmentedControl from '$lib/ui/SegmentedControl.svelte';
	import { buttonClass } from '$lib/ui/styles';

	const store = getStore();

	let mode = $state<Mode>('letters');
	let level = $state<Level>('normal');
	let letterVariant = $state<LetterVariant>('isolated');
	let packVariant = $state<PackVariant>('quran');

	const modeOptions = MODES.map((value) => ({ value, label: MODE_LABELS[value] }));
	const levelOptions = LEVELS.map((value) => ({ value, label: LEVEL_LABELS[value] }));
	const letterOptions = LETTER_VARIANTS.map((value) => ({ value, label: VARIANT_LABELS[value] }));
	const packOptions = PACK_VARIANTS.map((value) => ({ value, label: VARIANT_LABELS[value] }));

	const setup = $derived<Setup>(
		mode === 'letters'
			? { mode, level, variant: letterVariant }
			: { mode, level, variant: packVariant }
	);
	const rows = $derived(boardRows(store.data, boardKey(setup)));
</script>

<svelte:head><title>Leaderboard · Harf Sprint</title></svelte:head>

<header class="mb-6 flex items-center gap-3">
	<a href={resolve('/')} class={buttonClass('ghost', { size: 'sm', class: '-ml-2' })}>Back</a>
	<h1 class="text-2xl font-bold">Leaderboard</h1>
</header>

<main class="flex flex-1 flex-col gap-3">
	<SegmentedControl label="Mode" options={modeOptions} bind:value={mode} />
	<SegmentedControl label="Speed" options={levelOptions} bind:value={level} />
	{#if mode === 'letters'}
		<SegmentedControl label="Letter shapes" options={letterOptions} bind:value={letterVariant} />
	{:else}
		<SegmentedControl label="Content" options={packOptions} bind:value={packVariant} />
	{/if}
	<div class="mt-3">
		<LeaderboardTable {rows} currentPlayerId={store.data.lastPlayerId} />
	</div>
</main>
