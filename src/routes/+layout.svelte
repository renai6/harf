<script lang="ts">
	import '@fontsource/rubik/500.css';
	import '@fontsource/rubik/700.css';
	import '@fontsource/rubik/900.css';
	import '@fontsource/noto-naskh-arabic/600.css';
	import '@fontsource/noto-naskh-arabic/700.css';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { getStore } from '$lib/storage/app-store';
	import { STORAGE_KEY } from '$lib/storage/schema';
	import NoticeBanner from '$lib/ui/NoticeBanner.svelte';

	let { children } = $props();

	const store = getStore();

	function onstorage(event: StorageEvent) {
		if (event.key === null || event.key === STORAGE_KEY) store.reload();
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<svelte:window {onstorage} />

<div class="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-4 pt-6 pb-10">
	{#if store.notice}
		<NoticeBanner notice={store.notice} ondismiss={() => store.dismissNotice()} />
	{/if}
	{@render children()}
</div>
