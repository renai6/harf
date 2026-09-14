<script lang="ts">
	import { resolve } from '$app/paths';
	import { letterByChar } from '$lib/content/letters';
	import { accuracy, attempts } from '$lib/game/scoring';
	import type { SprintState } from '$lib/game/sprint';
	import type { BoardRow } from '$lib/storage/boards';
	import type { SaveResult } from '$lib/storage/store.svelte';
	import Button from './Button.svelte';
	import Chip from './Chip.svelte';
	import LeaderboardTable from './LeaderboardTable.svelte';
	import { buttonClass } from './styles';

	type Props = {
		state: SprintState;
		save: SaveResult | null;
		rows: BoardRow[];
		currentPlayerId: string;
		onagain: () => void;
	};

	let { state, save, rows, currentPlayerId, onagain }: Props = $props();

	const percent = $derived(
		Math.round(accuracy(state.counters.correct, attempts(state.counters)) * 100)
	);
	const missed = $derived(state.missed.map(letterByChar));
</script>

<main class="flex flex-1 flex-col gap-6">
	<section class="rounded-item bg-white p-6 text-center shadow-item">
		<h1 class="text-lg font-bold text-ink/70">Time's up!</h1>
		<p data-testid="result-score" class="text-7xl font-bold text-crimson tabular-nums">
			{state.score}
		</p>
		<p class="text-sm text-ink/75">{state.score === 1 ? 'point' : 'points'}</p>
		{#if save?.saved && save.personalBest}
			<div class="mt-3"><Chip tone="purple">New personal best</Chip></div>
		{:else if save && !save.saved}
			<p class="mt-3 text-sm font-bold text-crimson-deep">This run could not be saved.</p>
		{/if}
		<dl class="mt-5 grid grid-cols-2 gap-3">
			<div class="rounded-card bg-ink/5 p-3">
				<dt class="text-xs text-ink/75">Accuracy</dt>
				<dd class="text-2xl font-bold tabular-nums">{percent}%</dd>
			</div>
			<div class="rounded-card bg-ink/5 p-3">
				<dt class="text-xs text-ink/75">Best streak</dt>
				<dd class="text-2xl font-bold tabular-nums">{state.counters.bestStreak}</dd>
			</div>
		</dl>
	</section>

	<section class="flex flex-col gap-2">
		<h2 class="font-bold">Top 3</h2>
		<LeaderboardTable {rows} {currentPlayerId} limit={3} />
	</section>

	{#if missed.length > 0}
		<section class="flex flex-col gap-2">
			<h2 class="font-bold">Review what you missed</h2>
			<ul class="grid grid-cols-2 gap-2">
				{#each missed as letter (letter.char)}
					<li class="flex items-center gap-3 rounded-card bg-white px-4 py-2 shadow-soft">
						<span
							lang="ar"
							dir="rtl"
							class="w-9 shrink-0 text-center font-arabic text-3xl leading-normal font-bold"
							>{letter.char}</span
						>
						<span class="flex min-w-0 flex-col items-start leading-tight">
							<span class="font-bold">{letter.name}</span>
							<span lang="ar" dir="rtl" class="font-arabic text-ink/70">{letter.arabicName}</span>
						</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<div class="mt-auto grid grid-cols-2 gap-3">
		<a href={resolve('/')} class={buttonClass('secondary')}>Home</a>
		<Button onclick={onagain}>Again</Button>
	</div>
</main>
