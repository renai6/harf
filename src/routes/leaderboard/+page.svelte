<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		LETTER_VARIANTS,
		LEVELS,
		LEVEL_LABELS,
		MODES,
		MODE_LABELS,
		VARIANT_LABELS,
		boardKey,
		type LetterVariant,
		type Level,
		type Mode
	} from '$lib/game/levels';
	import { getStore } from '$lib/storage/app-store';
	import { boardRows } from '$lib/storage/boards';
	import LeaderboardTable from '$lib/ui/LeaderboardTable.svelte';
	import SegmentedControl from '$lib/ui/SegmentedControl.svelte';
	import { buttonClass } from '$lib/ui/styles';

	const store = getStore();

	// Words and Sentences boards arrive in Phase 2.
	let mode = $state<Mode>('letters');
	let level = $state<Level>('normal');
	let variant = $state<LetterVariant>('isolated');

	const modeOptions = MODES.map((value) => ({
		value,
		label: MODE_LABELS[value],
		disabled: value !== 'letters'
	}));
	const levelOptions = LEVELS.map((value) => ({ value, label: LEVEL_LABELS[value] }));
	const variantOptions = LETTER_VARIANTS.map((value) => ({ value, label: VARIANT_LABELS[value] }));

	const rows = $derived(boardRows(store.data, boardKey({ mode: 'letters', level, variant })));
</script>

<svelte:head><title>Leaderboard · Harf Sprint</title></svelte:head>

<header class="mb-6 flex items-center gap-3">
	<a href={resolve('/')} class={buttonClass('ghost', { size: 'sm', class: '-ml-2' })}>Back</a>
	<h1 class="text-2xl font-bold">Leaderboard</h1>
</header>

<main class="flex flex-1 flex-col gap-3">
	<SegmentedControl label="Mode" options={modeOptions} bind:value={mode} />
	<SegmentedControl label="Speed" options={levelOptions} bind:value={level} />
	<SegmentedControl label="Letter shapes" options={variantOptions} bind:value={variant} />
	<div class="mt-3">
		<LeaderboardTable {rows} currentPlayerId={store.data.lastPlayerId} />
	</div>
</main>
