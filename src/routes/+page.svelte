<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { getStore } from '$lib/storage/app-store';
	import { bestScore } from '$lib/storage/boards';
	import Avatar from '$lib/ui/Avatar.svelte';
	import NameForm from '$lib/ui/NameForm.svelte';
	import { buttonClass } from '$lib/ui/styles';

	const store = getStore();
	let adding = $state(false);
	const hasPlayers = $derived(store.data.players.length > 0);

	// `/leaderboard` and `/settings` don't exist yet (added in later tasks), so they aren't in
	// the generated route union and `resolve()` can't type-check them. Retype the call for
	// these two routes only; drop once those routes land and `resolve(path)` type-checks
	// directly.
	const resolveAny = resolve as (path: string) => ResolvedPathname;

	function choose(id: string) {
		if (store.selectPlayer(id)) goto(resolve('/modes'));
	}

	function create(name: string) {
		const result = store.addPlayer(name);
		if ('error' in result) return result.error;
		goto(resolve('/modes'));
		return null;
	}
</script>

<svelte:head><title>Harf Sprint</title></svelte:head>

<header class="mb-6 text-center">
	<p lang="ar" dir="rtl" class="font-arabic text-6xl leading-snug font-bold text-crimson">حَرْف</p>
	<h1 class="text-3xl font-bold">Harf Sprint</h1>
	<p class="mt-1 text-ink/70">Who is playing?</p>
</header>

<main class="flex flex-1 flex-col gap-4">
	{#if hasPlayers}
		<ul class="grid grid-cols-2 gap-3" aria-label="Players">
			{#each store.data.players as player (player.id)}
				{@const best = bestScore(store.data, player.id)}
				<li>
					<button
						type="button"
						onclick={() => choose(player.id)}
						class="flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-card bg-white p-3 shadow-soft transition active:translate-y-px"
					>
						<Avatar name={player.name} seed={player.id} size="lg" />
						<span dir="auto" class="max-w-full truncate font-bold">{player.name}</span>
						<span class="text-xs text-ink/60"
							>{best === null ? 'No scores yet' : `Best ${best}`}</span
						>
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	{#if adding || !hasPlayers}
		<NameForm
			label="Your name"
			submitLabel="Let's go"
			onsubmit={create}
			oncancel={hasPlayers ? () => (adding = false) : undefined}
		/>
	{:else}
		<button
			type="button"
			class={buttonClass('secondary', { class: 'w-full' })}
			onclick={() => (adding = true)}
		>
			<span aria-hidden="true">+</span> New player
		</button>
	{/if}
</main>

<nav aria-label="More" class="mt-8 grid grid-cols-2 gap-3">
	<a href={resolveAny('/leaderboard')} class={buttonClass('ghost')}>Leaderboard</a>
	<a href={resolveAny('/settings')} class={buttonClass('ghost')}>Settings</a>
</nav>
