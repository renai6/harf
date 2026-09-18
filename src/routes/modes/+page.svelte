<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { primeSfx } from '$lib/audio/sfx';
	import {
		ITEM_LIMIT_MS,
		LETTER_VARIANTS,
		LEVELS,
		LEVEL_LABELS,
		PACK_VARIANTS,
		VARIANT_LABELS,
		boardKey,
		parseBoardKey,
		type LetterVariant,
		type Level,
		type Mode,
		type PackVariant,
		type Setup
	} from '$lib/game/levels';
	import { accuracy } from '$lib/game/scoring';
	import { micSession } from '$lib/speech/session';
	import { getStore } from '$lib/storage/app-store';
	import { playerBest } from '$lib/storage/boards';
	import Avatar from '$lib/ui/Avatar.svelte';
	import Button from '$lib/ui/Button.svelte';
	import MicCheck from '$lib/ui/MicCheck.svelte';
	import ModeTile from '$lib/ui/ModeTile.svelte';
	import SegmentedControl from '$lib/ui/SegmentedControl.svelte';
	import { buttonClass } from '$lib/ui/styles';

	const store = getStore();
	const player = $derived(store.currentPlayer);

	// The screen reopens on the last sprint that was started. Only that sprint's variant is
	// remembered, so the other kind of variant falls back to its default.
	const last = parseBoardKey(store.data.settings.lastSetup ?? '');

	let mode = $state<Mode>(last?.mode ?? 'letters');
	let level = $state<Level>(last?.level ?? 'normal');
	let letterVariant = $state<LetterVariant>(last?.mode === 'letters' ? last.variant : 'isolated');
	let packVariant = $state<PackVariant>(last && last.mode !== 'letters' ? last.variant : 'quran');
	let checking = $state(false);

	const setup = $derived<Setup>(
		mode === 'letters'
			? { mode, level, variant: letterVariant }
			: { mode, level, variant: packVariant }
	);
	const best = $derived(player ? playerBest(store.data, boardKey(setup), player.id) : undefined);

	const ITEM = { letters: 'letter', words: 'word', sentences: 'sentence' } as const;
	const levelOptions = LEVELS.map((value) => ({ value, label: LEVEL_LABELS[value] }));
	const letterOptions = LETTER_VARIANTS.map((value) => ({ value, label: VARIANT_LABELS[value] }));
	const packOptions = PACK_VARIANTS.map((value) => ({ value, label: VARIANT_LABELS[value] }));
	const VARIANT_HINTS: Record<LetterVariant | PackVariant, string> = {
		isolated: 'Each letter on its own',
		forms: 'Letters as they look at the start, middle or end of a word',
		quran: 'Words and short ayat from the Quran',
		msa: 'Everyday words and sentences'
	};

	$effect(() => {
		if (!player) goto(resolve('/'), { replaceState: true });
	});

	function selectMode(next: Mode) {
		mode = next;
		checking = false;
	}

	function play(practice: boolean) {
		store.setLastSetup(boardKey(setup));
		const query = new URLSearchParams({
			mode: setup.mode,
			level: setup.level,
			variant: setup.variant,
			...(practice ? { practice: '1' } : {})
		});
		// resolve() cannot add a query string, so the resolved path is extended here.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(`${resolve('/play')}?${query}`);
	}

	function start() {
		// Opening the audio context needs this tap; see primeSfx.
		if (store.data.settings.sound) primeSfx();
		if (setup.mode === 'letters' || micSession.checked) play(false);
		else checking = true;
	}
</script>

<svelte:head><title>Pick a sprint · Harf Sprint</title></svelte:head>

{#if player}
	<header class="mb-6 flex items-center gap-3">
		<Avatar name={player.name} seed={player.id} />
		<div class="min-w-0 flex-1">
			<p class="text-xs text-ink/75">Playing as</p>
			<p dir="auto" class="truncate text-left font-bold">{player.name}</p>
		</div>
		<a href={resolve('/')} class={buttonClass('ghost', { size: 'sm', class: '-mr-2 text-sm' })}
			>Switch player</a
		>
	</header>

	<main class="flex flex-1 flex-col gap-6">
		<h1 class="text-2xl font-bold">Pick a sprint</h1>

		<div class="grid grid-cols-3 gap-3">
			<ModeTile
				arabic="ب"
				title="Letters"
				subtitle="Pick the name"
				selected={mode === 'letters'}
				onclick={() => selectMode('letters')}
			/>
			<ModeTile
				arabic="كَلِمَة"
				title="Words"
				subtitle="Read aloud"
				selected={mode === 'words'}
				onclick={() => selectMode('words')}
			/>
			<ModeTile
				arabic="جُمْلَة"
				title="Sentences"
				subtitle="Read aloud"
				selected={mode === 'sentences'}
				onclick={() => selectMode('sentences')}
			/>
		</div>

		<section class="flex flex-col gap-2">
			<h2 class="font-bold">Speed</h2>
			<SegmentedControl label="Speed" options={levelOptions} bind:value={level} />
			<p class="text-sm text-ink/75">
				{ITEM_LIMIT_MS[mode][level] / 1000} seconds per {ITEM[mode]}
			</p>
		</section>

		<section class="flex flex-col gap-2">
			{#if mode === 'letters'}
				<h2 class="font-bold">Letter shapes</h2>
				<SegmentedControl
					label="Letter shapes"
					options={letterOptions}
					bind:value={letterVariant}
				/>
			{:else}
				<h2 class="font-bold">Content</h2>
				<SegmentedControl label="Content" options={packOptions} bind:value={packVariant} />
			{/if}
			<p class="text-sm text-ink/75">{VARIANT_HINTS[setup.variant]}</p>
		</section>

		<dl class="grid grid-cols-3 gap-3 rounded-card bg-white p-4 text-center shadow-soft">
			<div>
				<dt class="text-xs text-ink/75">Best</dt>
				<dd class="text-2xl font-bold tabular-nums">{best ? best.run.score : '-'}</dd>
			</div>
			<div>
				<dt class="text-xs text-ink/75">Rank</dt>
				<dd class="text-2xl font-bold tabular-nums">{best ? `#${best.rank}` : '-'}</dd>
			</div>
			<div>
				<dt class="text-xs text-ink/75">Accuracy</dt>
				<dd class="text-2xl font-bold tabular-nums">
					{best ? `${Math.round(accuracy(best.run.correct, best.run.attempts) * 100)}%` : '-'}
				</dd>
			</div>
		</dl>

		{#if checking}
			<MicCheck
				onpass={() => play(false)}
				onpractice={() => play(true)}
				oncancel={() => (checking = false)}
			/>
		{:else}
			<Button class="mt-auto w-full text-lg" onclick={start}>Start</Button>
		{/if}
	</main>
{/if}
