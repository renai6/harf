<script lang="ts">
	import { untrack } from 'svelte';
	import { NAME_MAX, type NameError } from '$lib/storage/schema';
	import Button from './Button.svelte';

	type Props = {
		label: string;
		submitLabel: string;
		initial?: string;
		onsubmit: (name: string) => NameError | 'write-failed' | null;
		oncancel?: () => void;
	};

	let { label, submitLabel, initial = '', onsubmit, oncancel }: Props = $props();

	const MESSAGES: Record<NameError | 'write-failed', string> = {
		empty: 'Enter a name.',
		'too-long': `Use ${NAME_MAX} characters or fewer.`,
		taken: 'That name is already taken.',
		'write-failed': 'Could not save. Please try again.'
	};

	const id = $props.id();
	let name = $state(untrack(() => initial));
	let error = $state<NameError | 'write-failed' | null>(null);

	function submit(event: SubmitEvent) {
		event.preventDefault();
		error = onsubmit(name);
	}
</script>

<form
	onsubmit={submit}
	novalidate
	class="flex flex-col gap-3 rounded-card bg-white p-4 shadow-soft"
>
	<label for="{id}-name" class="font-bold">{label}</label>
	<input
		id="{id}-name"
		bind:value={name}
		oninput={() => (error = null)}
		autocomplete="off"
		autocapitalize="words"
		enterkeyhint="go"
		dir="auto"
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={error ? `${id}-error` : undefined}
		class="min-h-12 rounded-button border-2 border-ink/15 bg-white px-4 text-lg"
		{@attach (node) => node.focus()}
	/>
	{#if error}
		<p id="{id}-error" class="text-sm font-bold text-crimson-deep">{MESSAGES[error]}</p>
	{/if}
	<div class="flex gap-3">
		{#if oncancel}
			<Button variant="secondary" onclick={oncancel}>Cancel</Button>
		{/if}
		<Button type="submit" class="flex-1">{submitLabel}</Button>
	</div>
</form>
