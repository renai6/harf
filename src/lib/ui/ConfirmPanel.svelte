<script lang="ts">
	import Button from './Button.svelte';

	type Props = {
		message: string;
		confirmLabel: string;
		onconfirm: () => void;
		oncancel: () => void;
	};

	let { message, confirmLabel, onconfirm, oncancel }: Props = $props();
</script>

<div
	role="group"
	aria-label="Confirm"
	class="flex flex-col gap-3 rounded-card bg-white p-4 shadow-soft"
>
	<p class="font-bold">{message}</p>
	<div class="grid grid-cols-2 gap-3">
		<Button variant="secondary" onclick={oncancel} {@attach (node) => node.focus()}>Cancel</Button>
		<Button onclick={onconfirm}>{confirmLabel}</Button>
	</div>
</div>
