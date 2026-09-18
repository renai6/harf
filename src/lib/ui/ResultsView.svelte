<script lang="ts">
	import { resolve } from '$app/paths';
	import { boardLabel } from '$lib/game/levels';
	import { reviewItems } from '$lib/game/review';
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

	let { state: sprint, save, rows, currentPlayerId, onagain }: Props = $props();

	/** A Fast sprint can miss enough items to bury the buttons, so the rest wait behind a tap. */
	const REVIEW_PREVIEW = 6;

	const percent = $derived(
		Math.round(accuracy(sprint.counters.correct, attempts(sprint.counters)) * 100)
	);
	const review = $derived(reviewItems(sprint.config, sprint.missed));
	const letters = $derived(sprint.config.mode === 'letters');
	const board = $derived(boardLabel(sprint.config));

	let showAllReview = $state(false);
	const shownReview = $derived(showAllReview ? review : review.slice(0, REVIEW_PREVIEW));
</script>

<main class="flex flex-1 flex-col gap-6">
	<section class="rounded-item bg-white p-6 text-center shadow-item">
		<h1 class="text-lg font-bold text-ink/70">Time's up!</h1>
		<p data-testid="result-score" class="text-7xl font-bold text-crimson tabular-nums">
			{sprint.score}
		</p>
		<p class="text-sm text-ink/75">{sprint.score === 1 ? 'point' : 'points'}</p>
		{#if !sprint.ranked}
			<div class="mt-3"><Chip>Practice - not ranked</Chip></div>
		{:else if save?.saved && save.personalBest && sprint.score > 0}
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
				<dd class="text-2xl font-bold tabular-nums">{sprint.counters.bestStreak}</dd>
			</div>
		</dl>
	</section>

	{#if sprint.ranked}
		<section class="flex flex-col gap-2">
			<h2 class="font-bold">Top 3</h2>
			<p data-testid="results-board" class="-mt-2 text-sm text-ink/75">{board}</p>
			<LeaderboardTable {rows} {currentPlayerId} limit={3} />
		</section>
	{/if}

	{#if review.length > 0}
		<section class="flex flex-col gap-2">
			<h2 class="font-bold">Review what you missed</h2>
			<ul
				aria-label="Review what you missed"
				class={['grid gap-2', letters ? 'grid-cols-2' : 'grid-cols-1']}
			>
				{#each shownReview as item (item.id)}
					{#if letters}
						<li class="flex items-center gap-3 rounded-card bg-white px-4 py-2 shadow-soft">
							<span
								lang="ar"
								dir="rtl"
								class="w-9 shrink-0 text-center font-arabic text-3xl leading-normal font-bold"
								>{item.arabic}</span
							>
							<span class="flex min-w-0 flex-col items-start leading-tight">
								<span class="font-bold">{item.label}</span>
								<span lang="ar" dir="rtl" class="font-arabic text-ink/70">{item.detail}</span>
							</span>
						</li>
					{:else}
						<li class="flex flex-col gap-1 rounded-card bg-white px-4 py-3 shadow-soft">
							<span
								lang="ar"
								dir="rtl"
								class="text-right font-arabic text-2xl leading-loose font-bold">{item.arabic}</span
							>
							<span class="font-bold">{item.label}</span>
							<span class="text-sm text-ink/75">{item.detail}</span>
						</li>
					{/if}
				{/each}
			</ul>
			{#if !showAllReview && review.length > REVIEW_PREVIEW}
				<Button variant="secondary" onclick={() => (showAllReview = true)}>
					Show all ({review.length})
				</Button>
			{/if}
		</section>
	{/if}

	<div class="mt-auto grid grid-cols-2 gap-3">
		<a href={resolve('/')} class={buttonClass('secondary')}>Home</a>
		<Button onclick={onagain}>Again</Button>
	</div>
</main>
