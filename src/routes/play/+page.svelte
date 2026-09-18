<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { playSfx } from '$lib/audio/sfx';
	import { letterByChar } from '$lib/content/letters';
	import { boardKey, parseBoardKey } from '$lib/game/levels';
	import { attempts } from '$lib/game/scoring';
	import { itemLimit, type Outcome, type SprintConfig, type SprintState } from '$lib/game/sprint';
	import { createSprintRunner, type SprintRunner } from '$lib/game/sprint.svelte';
	import { createWebSpeechListener } from '$lib/speech/web-speech';
	import { getStore } from '$lib/storage/app-store';
	import { boardRows } from '$lib/storage/boards';
	import type { SaveResult } from '$lib/storage/store.svelte';
	import AnswerGrid from '$lib/ui/AnswerGrid.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Chip from '$lib/ui/Chip.svelte';
	import ItemCard from '$lib/ui/ItemCard.svelte';
	import MicIndicator from '$lib/ui/MicIndicator.svelte';
	import ResultsView from '$lib/ui/ResultsView.svelte';
	import TimerBar from '$lib/ui/TimerBar.svelte';
	import { buttonClass } from '$lib/ui/styles';

	const store = getStore();
	const player = $derived(store.currentPlayer);
	const setup = $derived(
		parseBoardKey(
			['mode', 'level', 'variant'].map((key) => page.url.searchParams.get(key)).join(':')
		)
	);
	const practice = $derived(page.url.searchParams.get('practice') === '1');

	/** What one item is called, and the card size it uses. */
	const ITEM = { letters: 'letter', words: 'word', sentences: 'sentence' } as const;

	let runner = $state.raw<SprintRunner | null>(null);
	let save = $state.raw<SaveResult | null>(null);
	let announcement = $state('');
	let flash = $state(false);
	let flashTimer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		if (!player) goto(resolve('/'), { replaceState: true });
		else if (!setup) goto(resolve('/modes'), { replaceState: true });
	});

	function sprintConfig(): SprintConfig | null {
		if (!setup) return null;
		return setup.mode === 'letters'
			? { ...setup, rng: Math.random }
			: { ...setup, rng: Math.random, practice };
	}

	function startRound() {
		const config = sprintConfig();
		if (!player || !config) return;
		runner?.stop();
		save = null;
		announcement = '';
		// Captured now, so another tab switching player mid-sprint cannot move the run to someone else.
		const playerId = player.id;
		const listener =
			config.mode !== 'letters' && !config.practice ? createWebSpeechListener() : undefined;
		runner = createSprintRunner(
			config,
			(outcome, state) => handleOutcome(outcome, state, playerId),
			listener
		);
		runner.start();
	}

	function handleOutcome(outcome: Outcome, state: SprintState, playerId: string) {
		// Speech sprints stay silent while listening, so the microphone never hears the game (spec 7.6).
		if (store.data.settings.sound && state.input !== 'speech') {
			playSfx(outcome === 'correct' ? 'correct' : outcome === 'wrong' ? 'wrong' : 'timeup');
		}
		if (outcome === 'correct') {
			announcement = `Correct. ${state.score} points.`;
			flash = true;
			clearTimeout(flashTimer);
			flashTimer = setTimeout(() => (flash = false), 200);
		} else if (outcome === 'finished') {
			// Practice and sprints where speech stopped are never saved (spec 5.6).
			save = !state.ranked
				? null
				: store.saveRun(playerId, {
						board: boardKey(state.config),
						score: state.score,
						correct: state.counters.correct,
						attempts: attempts(state.counters),
						bestStreak: state.counters.bestStreak,
						missed: [...state.missed]
					});
			announcement = `Time is up. You scored ${state.score}.`;
		} else if (outcome === 'skip') {
			announcement = 'Skipped.';
		} else if (state.config.mode !== 'letters') {
			announcement = outcome === 'wrong' ? 'Missed.' : 'Out of time.';
		} else if (state.reveal) {
			const correct = letterByChar(state.reveal.correct);
			announcement = `${outcome === 'wrong' ? 'Not quite' : 'Out of time'}. It was ${correct.name}.`;
		}
	}

	onMount(() => {
		if (player) startRound();
		return () => {
			runner?.stop();
			clearTimeout(flashTimer);
		};
	});
</script>

<svelte:head><title>Sprint · Harf Sprint</title></svelte:head>

{#if player && runner}
	{@const s = runner.state}
	{#if s.phase === 'finished'}
		<ResultsView
			state={s}
			{save}
			rows={boardRows(store.data, boardKey(s.config))}
			currentPlayerId={player.id}
			onagain={startRound}
		/>
	{:else}
		<!-- inert keeps keyboard focus inside the modal pause dialog. -->
		<header inert={s.phase === 'paused'} class="mb-4 flex items-center gap-3">
			<a href={resolve('/modes')} class={buttonClass('ghost', { size: 'sm', class: '-ml-2' })}
				>Quit</a
			>
			<span class="flex-1"></span>
			<Chip data-testid="sprint-score">Score {s.score}</Chip>
			<Chip tone="crimson" data-testid="sprint-time">{Math.ceil(s.sprintLeft / 1000)}s</Chip>
		</header>

		<main inert={s.phase === 'paused'} class="flex flex-1 flex-col gap-4">
			{#if s.phase === 'countdown' || s.resumeTo === 'countdown'}
				<div class="grid flex-1 place-items-center">
					<p class="text-9xl font-bold text-crimson-deep tabular-nums">
						{Math.ceil(s.countdownLeft / 1000)}
					</p>
				</div>
			{:else}
				<TimerBar
					fraction={s.itemLeft / itemLimit(s.config)}
					label="Time left for this {ITEM[s.config.mode]}"
				/>
				<ItemCard text={s.prompt.display} size={ITEM[s.config.mode]} {flash} />
				{#if s.prompt.kind === 'letter'}
					<AnswerGrid
						choices={s.prompt.choices}
						reveal={s.reveal}
						disabled={s.phase !== 'active'}
						onanswer={(choice) => runner?.answer(choice)}
					/>
				{:else if s.input === 'speech'}
					<div class="flex items-center gap-3">
						<MicIndicator listening={runner.listening} heard={runner.heard} />
						<Button
							variant="secondary"
							disabled={s.phase !== 'active'}
							onclick={() => runner?.skip()}
						>
							Skip
						</Button>
					</div>
				{:else}
					{#if !s.ranked && !practice}
						<p role="status" class="rounded-card bg-white/70 px-4 py-2 text-sm">
							Speech recognition is not available, so this sprint is now practice and will not be
							ranked.
						</p>
					{/if}
					<div class="grid grid-cols-2 gap-3">
						<Button
							variant="secondary"
							class="py-3 text-lg"
							disabled={s.phase !== 'active'}
							onclick={() => runner?.selfReport(false)}
						>
							Missed
						</Button>
						<Button
							class="py-3 text-lg"
							disabled={s.phase !== 'active'}
							onclick={() => runner?.selfReport(true)}
						>
							Got it
						</Button>
					</div>
				{/if}
			{/if}
		</main>
	{/if}

	{#if s.phase === 'paused'}
		<div class="fixed inset-0 z-10 grid place-items-center bg-ink/40 px-4 backdrop-blur-sm">
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="paused-title"
				class="w-full max-w-sm rounded-item bg-white p-6 text-center shadow-item"
			>
				<h2 id="paused-title" class="text-2xl font-bold">Paused</h2>
				<p class="mt-1 text-ink/70">The clock stops while you are away.</p>
				<Button
					class="mt-4 w-full"
					onclick={() => runner?.resume()}
					{@attach (node) => node.focus()}
				>
					Continue
				</Button>
			</div>
		</div>
	{/if}

	<p class="sr-only" aria-live="polite">{announcement}</p>
{/if}
