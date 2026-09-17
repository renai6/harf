<script lang="ts" generics="T extends string">
	type Option = { value: T; label: string };
	type Props = { label: string; options: readonly Option[]; value: T };

	let { label, options, value = $bindable() }: Props = $props();
</script>

<div role="group" aria-label={label} class="flex gap-1 rounded-full bg-white/50 p-1">
	{#each options as option (option.value)}
		<button
			type="button"
			aria-pressed={value === option.value}
			class={[
				'min-h-12 flex-1 rounded-full px-3 text-sm font-bold transition',
				value === option.value
					? 'bg-white text-crimson-deep shadow-soft'
					: 'text-ink/70 hover:text-ink'
			]}
			onclick={() => (value = option.value)}
		>
			{option.label}
		</button>
	{/each}
</div>
