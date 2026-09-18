<script lang="ts">
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getStore } from '$lib/storage/app-store';
	import Avatar from '$lib/ui/Avatar.svelte';
	import Button from '$lib/ui/Button.svelte';
	import ConfirmPanel from '$lib/ui/ConfirmPanel.svelte';
	import NameForm from '$lib/ui/NameForm.svelte';
	import { buttonClass } from '$lib/ui/styles';

	const store = getStore();
	const sound = $derived(store.data.settings.sound);

	let renamingId = $state<string | null>(null);
	let deletingId = $state<string | null>(null);
	let confirmingReset = $state(false);
	let playersHeading = $state.raw<HTMLElement | null>(null);

	/**
	 * Closing a panel unmounts the button that opened it, which would drop keyboard focus to the
	 * page. Every close puts focus back on a button next to where the player was.
	 */
	async function focusAfterClose(id: string) {
		await tick();
		document.getElementById(id)?.focus();
	}

	function rename(id: string, name: string) {
		const error = store.renamePlayer(id, name);
		if (!error) {
			renamingId = null;
			focusAfterClose(`rename-${id}`);
		}
		return error;
	}

	function cancelRename(id: string) {
		renamingId = null;
		focusAfterClose(`rename-${id}`);
	}

	function cancelDelete(id: string) {
		deletingId = null;
		focusAfterClose(`delete-${id}`);
	}

	async function remove(id: string) {
		store.deletePlayer(id);
		deletingId = null;
		// That player's buttons are gone, so focus lands on the heading above the list.
		await tick();
		playersHeading?.focus();
	}

	function cancelReset() {
		confirmingReset = false;
		focusAfterClose('reset-all');
	}

	function reset() {
		confirmingReset = false;
		if (store.resetAll()) goto(resolve('/'));
		else focusAfterClose('reset-all');
	}
</script>

<svelte:head><title>Settings · Harf Sprint</title></svelte:head>

<header class="mb-6 flex items-center gap-3">
	<a href={resolve('/')} class={buttonClass('ghost', { size: 'sm', class: '-ml-2' })}>Back</a>
	<h1 class="text-2xl font-bold">Settings</h1>
</header>

<main class="flex flex-1 flex-col gap-8">
	<section class="flex flex-col gap-2">
		<h2 class="font-bold">Sound</h2>
		<button
			type="button"
			role="switch"
			aria-checked={sound}
			onclick={() => store.setSound(!sound)}
			class="flex min-h-14 items-center justify-between rounded-card bg-white px-4 shadow-soft"
		>
			<span class="font-bold">Sound effects</span>
			<span
				aria-hidden="true"
				class={[
					'relative h-8 w-14 rounded-full transition-colors',
					sound ? 'bg-crimson' : 'bg-ink/20'
				]}
			>
				<span
					class={[
						'absolute top-1 size-6 rounded-full bg-white shadow-soft transition-all',
						sound ? 'left-7' : 'left-1'
					]}
				></span>
			</span>
		</button>
	</section>

	<section class="flex flex-col gap-2">
		<h2 bind:this={playersHeading} tabindex="-1" class="font-bold">Players</h2>
		{#if store.data.players.length === 0}
			<p class="text-ink/75">No players yet.</p>
		{/if}
		<ul class="flex flex-col gap-2">
			{#each store.data.players as player (player.id)}
				<li>
					{#if renamingId === player.id}
						<NameForm
							label="Rename {player.name}"
							submitLabel="Save"
							initial={player.name}
							onsubmit={(name) => rename(player.id, name)}
							oncancel={() => cancelRename(player.id)}
						/>
					{:else if deletingId === player.id}
						<ConfirmPanel
							message="Delete {player.name} and all their scores?"
							confirmLabel="Delete"
							onconfirm={() => remove(player.id)}
							oncancel={() => cancelDelete(player.id)}
						/>
					{:else}
						<div class="flex items-center gap-2 rounded-card bg-white py-1 pr-1 pl-4 shadow-soft">
							<Avatar name={player.name} seed={player.id} size="sm" />
							<span dir="auto" class="min-w-0 flex-1 truncate text-left font-bold"
								>{player.name}</span
							>
							<Button
								id="rename-{player.id}"
								variant="ghost"
								size="sm"
								aria-label="Rename {player.name}"
								onclick={() => {
									renamingId = player.id;
									deletingId = null;
								}}
							>
								Rename
							</Button>
							<Button
								id="delete-{player.id}"
								variant="danger"
								size="sm"
								aria-label="Delete {player.name}"
								onclick={() => {
									deletingId = player.id;
									renamingId = null;
								}}
							>
								Delete
							</Button>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	</section>

	<section class="flex flex-col gap-2">
		<h2 class="font-bold">Data</h2>
		<p class="text-sm text-ink/75">Players and scores are saved only in this browser.</p>
		{#if confirmingReset}
			<ConfirmPanel
				message="Delete all players, scores and settings?"
				confirmLabel="Reset"
				onconfirm={reset}
				oncancel={cancelReset}
			/>
		{:else}
			<Button
				id="reset-all"
				variant="danger"
				size="sm"
				class="self-start"
				onclick={() => (confirmingReset = true)}
			>
				Reset all data
			</Button>
		{/if}
	</section>
</main>
