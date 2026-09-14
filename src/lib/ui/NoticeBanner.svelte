<script lang="ts">
	import type { Notice } from '$lib/storage/store.svelte';
	import Button from './Button.svelte';

	let { notice, ondismiss }: { notice: Notice; ondismiss: () => void } = $props();

	const MESSAGES: Record<Notice, string> = {
		'corrupt-reset':
			'Saved data could not be read, so the game started fresh. A backup copy was kept in this browser.',
		'write-failed': 'This browser could not save your latest change. The game still works.'
	};
</script>

<div role="status" class="mb-4 flex items-center gap-3 rounded-card bg-white p-4 shadow-soft">
	<p class="flex-1 text-sm">{MESSAGES[notice]}</p>
	<Button variant="ghost" onclick={ondismiss}>Dismiss</Button>
</div>
