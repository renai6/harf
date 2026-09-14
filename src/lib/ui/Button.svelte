<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { buttonClass, type ButtonSize, type ButtonVariant } from './styles';

	type Props = Omit<HTMLButtonAttributes, 'class'> & {
		variant?: ButtonVariant;
		size?: ButtonSize;
		class?: string;
	};

	let {
		variant = 'primary',
		size = 'md',
		type = 'button',
		class: extra = '',
		children,
		...rest
	}: Props = $props();
</script>

<button {type} class={buttonClass(variant, { size, class: extra })} {...rest}>
	{@render children?.()}
</button>
