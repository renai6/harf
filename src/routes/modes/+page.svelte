<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		ITEM_LIMIT_MS,
		LETTER_VARIANTS,
		LEVELS,
		LEVEL_LABELS,
		VARIANT_LABELS,
		boardKey,
		type LetterVariant,
		type Level
	} from '$lib/game/levels';
	import { accuracy } from '$lib/game/scoring';
	import { getStore } from '$lib/storage/app-store';
	import { playerBest } from '$lib/storage/boards';
	import Avatar from '$lib/ui/Avatar.svelte';
	import Button from '$lib/ui/Button.svelte';
	import ModeTile from '$lib/ui/ModeTile.svelte';
	import SegmentedControl from '$lib/ui/SegmentedControl.svelte';
	import { buttonClass } from '$lib/ui/styles';

	const store = getStore();
	const player = $derived(store.currentPlayer);

	let level = $state<Level>('normal');
	let variant = $state<LetterVariant>('isolated');

	const best = $derived(
		player
			? playerBest(store.data, boardKey({ mode: 'letters', level, variant }), player.id)
			: undefined
	);

	const levelOptions = LEVELS.map((value) => ({ value, label: LEVEL_LABELS[value] }));
	const variantOptions = LETTER_VARIANTS.map((value) => ({ value, label: VARIANT_LABELS[value] }));
	const VARIANT_HINTS: Record<LetterVariant, string> = {
		isolated: 'Each letter on its own',
		forms: 'Letters as they look at the start, middle or end of a word'
	};

	$effect(() => {
		if (!player) goto(resolve('/'), { replaceState: true });
	});

	function start() {
		const query = new URLSearchParams({ mode: 'letters', level, variant });
		// resolve() cannot add a query string, so the resolved path is extended here.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(`${resolve('/play')}?${query}`);
	}
</script>

<svelte:head><title>Pick a sprint · Harf Sprint</title></svelte:head>

{#if player}
	<header class="mb-6 flex items-center gap-3">
		<Avatar name={player.name} seed={player.id} />
		<div class="min-w-0 flex-1">
			<p class="text-xs text-ink/60">Playing as</p>
			<p dir="auto" class="truncate font-bold">{player.name}</p>
		</div>
		<a href={resolve('/')} class={buttonClass('ghost', { size: 'sm', class: 'text-sm' })}
			>Switch player</a
		>
	</header>

	<main class="flex flex-1 flex-col gap-6">
		<h1 class="text-2xl font-bold">Pick a sprint</h1>

		<div class="grid grid-cols-3 gap-3">
			<ModeTile arabic="ب" title="Letters" selected />
			<ModeTile arabic="كَلِمَة" title="Words" subtitle="Coming soon" selected={false} disabled />
			<ModeTile
				arabic="جُمْلَة"
				title="Sentences"
				subtitle="Coming soon"
				selected={false}
				disabled
			/>
		</div>

		<section class="flex flex-col gap-2">
			<h2 class="font-bold">Speed</h2>
			<SegmentedControl label="Speed" options={levelOptions} bind:value={level} />
			<p class="text-sm text-ink/60">{ITEM_LIMIT_MS.letters[level] / 1000} seconds per letter</p>
		</section>

		<section class="flex flex-col gap-2">
			<h2 class="font-bold">Letter shapes</h2>
			<SegmentedControl label="Letter shapes" options={variantOptions} bind:value={variant} />
			<p class="text-sm text-ink/60">{VARIANT_HINTS[variant]}</p>
		</section>

		<dl class="grid grid-cols-3 gap-3 rounded-card bg-white p-4 text-center shadow-soft">
			<div>
				<dt class="text-xs text-ink/60">Best</dt>
				<dd class="text-2xl font-bold tabular-nums">{best ? best.run.score : '-'}</dd>
			</div>
			<div>
				<dt class="text-xs text-ink/60">Rank</dt>
				<dd class="text-2xl font-bold tabular-nums">{best ? `#${best.rank}` : '-'}</dd>
			</div>
			<div>
				<dt class="text-xs text-ink/60">Accuracy</dt>
				<dd class="text-2xl font-bold tabular-nums">
					{best ? `${Math.round(accuracy(best.run.correct, best.run.attempts) * 100)}%` : '-'}
				</dd>
			</div>
		</dl>

		<Button class="mt-auto w-full text-lg" onclick={start}>Start</Button>
	</main>
{/if}
