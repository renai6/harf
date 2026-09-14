<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { playSfx } from '$lib/audio/sfx';
	import { letterByChar } from '$lib/content/letters';
	import { parseBoardKey } from '$lib/game/levels';
	import { itemLimit, type Outcome, type SprintState } from '$lib/game/sprint';
	import { createSprintRunner, type SprintRunner } from '$lib/game/sprint.svelte';
	import { getStore } from '$lib/storage/app-store';
	import AnswerGrid from '$lib/ui/AnswerGrid.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Chip from '$lib/ui/Chip.svelte';
	import ItemCard from '$lib/ui/ItemCard.svelte';
	import TimerBar from '$lib/ui/TimerBar.svelte';
	import { buttonClass } from '$lib/ui/styles';

	const store = getStore();
	const player = $derived(store.currentPlayer);
	const setup = $derived(
		parseBoardKey(
			['mode', 'level', 'variant'].map((key) => page.url.searchParams.get(key)).join(':')
		)
	);

	let runner = $state.raw<SprintRunner | null>(null);
	let announcement = $state('');
	let flash = $state(false);
	let flashTimer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		if (!player) goto(resolve('/'), { replaceState: true });
		else if (setup?.mode !== 'letters') goto(resolve('/modes'), { replaceState: true });
	});

	function startRound() {
		if (setup?.mode !== 'letters') return;
		runner?.stop();
		runner = createSprintRunner(
			{ mode: 'letters', level: setup.level, variant: setup.variant, rng: Math.random },
			handleOutcome
		);
		runner.start();
	}

	function handleOutcome(outcome: Outcome, state: SprintState) {
		if (store.data.settings.sound) {
			playSfx(outcome === 'correct' ? 'correct' : outcome === 'wrong' ? 'wrong' : 'timeup');
		}
		if (outcome === 'correct') {
			announcement = `Correct. ${state.score} points.`;
			flash = true;
			clearTimeout(flashTimer);
			flashTimer = setTimeout(() => (flash = false), 200);
		} else if (outcome === 'finished') {
			announcement = `Time is up. You scored ${state.score}.`;
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
		<main class="grid flex-1 place-items-center text-center">
			<div>
				<h1 class="text-3xl font-bold">Time's up!</h1>
				<p class="text-7xl font-bold text-crimson tabular-nums">{s.score}</p>
			</div>
		</main>
	{:else}
		<header class="mb-4 flex items-center gap-3">
			<a href={resolve('/modes')} class={buttonClass('ghost', { size: 'sm' })}>Quit</a>
			<span class="flex-1"></span>
			<Chip data-testid="sprint-score">Score {s.score}</Chip>
			<Chip tone="crimson" data-testid="sprint-time">{Math.ceil(s.sprintLeft / 1000)}s</Chip>
		</header>

		<main class="flex flex-1 flex-col gap-4">
			{#if s.phase === 'countdown' || s.resumeTo === 'countdown'}
				<div class="grid flex-1 place-items-center">
					<p class="text-9xl font-bold text-crimson tabular-nums">
						{Math.ceil(s.countdownLeft / 1000)}
					</p>
				</div>
			{:else}
				<TimerBar fraction={s.itemLeft / itemLimit(s.config)} label="Time left for this letter" />
				<ItemCard text={s.prompt.display} {flash} />
				<AnswerGrid
					choices={s.prompt.choices}
					reveal={s.reveal}
					disabled={s.phase !== 'active'}
					onanswer={(choice) => runner?.answer(choice)}
				/>
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
