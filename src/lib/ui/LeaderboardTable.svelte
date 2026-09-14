<script lang="ts">
	import { accuracy } from '$lib/game/scoring';
	import type { BoardRow } from '$lib/storage/boards';
	import Avatar from './Avatar.svelte';

	type Props = { rows: BoardRow[]; currentPlayerId: string | null; limit?: number };

	let { rows, currentPlayerId, limit = 10 }: Props = $props();

	const top = $derived(rows.slice(0, limit));
	const mine = $derived(rows.find((row) => row.player.id === currentPlayerId && row.rank > limit));
</script>

{#snippet item(row: BoardRow)}
	{@const current = row.player.id === currentPlayerId}
	<li
		aria-current={current ? 'true' : undefined}
		class={[
			'flex min-h-14 items-center gap-3 rounded-card px-4 py-2',
			current
				? 'bg-linear-to-br from-purple-light to-purple text-white shadow-purple'
				: 'bg-white shadow-soft'
		]}
	>
		<span class="w-6 text-right font-bold tabular-nums">{row.rank}</span>
		<Avatar name={row.player.name} seed={row.player.id} size="sm" />
		<span dir="auto" class="min-w-0 flex-1 truncate font-bold">{row.player.name}</span>
		<span class={['text-sm tabular-nums', current ? 'text-white/80' : 'text-ink/60']}>
			{Math.round(accuracy(row.run.correct, row.run.attempts) * 100)}%
		</span>
		<span class="w-10 text-right text-xl font-bold tabular-nums">{row.run.score}</span>
	</li>
{/snippet}

{#if rows.length === 0}
	<p class="rounded-card bg-white/70 p-5 text-center text-ink/70">No scores yet. Be the first!</p>
{:else}
	<ol aria-label="Leaderboard" class="flex flex-col gap-2">
		{#each top as row (row.player.id)}
			{@render item(row)}
		{/each}
		{#if mine}
			<li aria-hidden="true" class="text-center leading-none text-ink/50">...</li>
			{@render item(mine)}
		{/if}
	</ol>
{/if}
