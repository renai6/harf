<script lang="ts">
	let { fraction, label }: { fraction: number; label: string } = $props();

	const percent = $derived(Math.max(0, Math.min(1, fraction)) * 100);
</script>

<div
	role="progressbar"
	aria-label={label}
	aria-valuemin={0}
	aria-valuemax={100}
	aria-valuenow={Math.round(percent)}
	class="h-3 overflow-hidden rounded-full bg-white/60"
>
	<div
		class="h-full rounded-full bg-linear-to-r from-purple to-purple-light"
		style:width="{percent}%"
	></div>
</div>
