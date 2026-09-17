<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { SpeechError } from '$lib/speech/listener';
	import { matchTranscript } from '$lib/speech/match';
	import { micSession } from '$lib/speech/session';
	import { createWebSpeechListener } from '$lib/speech/web-speech';
	import Button from './Button.svelte';
	import MicIndicator from './MicIndicator.svelte';

	type Props = { onpass: () => void; onpractice: () => void; oncancel: () => void };

	let { onpass, onpractice, oncancel }: Props = $props();

	/** Said aloud to prove the microphone and the recognizer work (spec 6). */
	const PHRASE = 'بِسْمِ اللَّهِ';
	const TIMEOUT_MS = 8_000;

	type Failure = SpeechError | 'timeout';

	const MESSAGES: Record<Failure, string> = {
		'not-allowed':
			'The microphone is blocked. Allow microphone access for this site in your browser settings, then try again.',
		network:
			'Speech recognition needs an internet connection. Check your connection and try again.',
		unsupported:
			'This browser cannot recognize speech. Use Chrome, Edge or Safari to be ranked, or practice without the microphone.',
		other: 'Speech recognition stopped unexpectedly. Try again.',
		timeout: 'We did not hear it. Check that your microphone is on and try again.'
	};

	const id = $props.id();
	const listener = createWebSpeechListener();
	let status = $state<'intro' | 'listening' | Failure>(
		listener.supported ? 'intro' : 'unsupported'
	);
	let listening = $state(false);
	let heard = $state('');
	let timer: ReturnType<typeof setTimeout> | undefined;
	let panel: HTMLElement | undefined;

	$effect(() => {
		// The panel takes the place of Start at the bottom of the page and every state has its own
		// height, so each state scrolls itself into view instead of hanging below the fold on a phone.
		if (status) panel?.scrollIntoView({ block: 'end' });
	});

	function end() {
		clearTimeout(timer);
		listener.stop();
	}

	function begin() {
		heard = '';
		status = 'listening';
		timer = setTimeout(() => {
			listener.stop();
			status = 'timeout';
		}, TIMEOUT_MS);
		listener.start({
			onTranscript: ({ text }) => {
				heard = text;
				if (!matchTranscript(PHRASE, text, 'sentence').matched) return;
				end();
				micSession.pass();
				onpass();
			},
			onError: (error) => {
				clearTimeout(timer);
				status = error;
			},
			onListeningChange: (value) => {
				listening = value;
			}
		});
	}

	function cancel() {
		end();
		oncancel();
	}

	onDestroy(end);
</script>

<section
	bind:this={panel}
	aria-labelledby="{id}-title"
	class="flex scroll-mb-10 flex-col gap-3 rounded-card bg-white p-4 shadow-soft"
>
	<h2 id="{id}-title" class="font-bold">Microphone check</h2>

	{#if status === 'intro'}
		<p>
			Say <span lang="ar" dir="rtl" class="font-arabic text-xl font-bold">{PHRASE}</span> to check your
			microphone.
		</p>
		<p class="text-sm text-ink/75">
			Chrome sends your voice to Google to recognize it, so you need an internet connection.
		</p>
		<div class="grid grid-cols-2 gap-3">
			<Button variant="secondary" onclick={cancel}>Cancel</Button>
			<Button onclick={begin}>Start check</Button>
		</div>
	{:else if status === 'listening'}
		<p class="text-center text-sm text-ink/75">Say</p>
		<p lang="ar" dir="rtl" class="text-center font-arabic text-4xl leading-loose font-bold">
			{PHRASE}
		</p>
		<MicIndicator {listening} {heard} />
		<Button variant="secondary" onclick={cancel}>Cancel</Button>
	{:else}
		<p role="alert">{MESSAGES[status]}</p>
		<p class="text-sm text-ink/75">Practice uses Got it and Missed buttons and is not ranked.</p>
		<div class="grid grid-cols-2 gap-3">
			{#if status === 'unsupported'}
				<Button variant="secondary" onclick={cancel}>Cancel</Button>
			{:else}
				<Button variant="secondary" onclick={begin}>Try again</Button>
			{/if}
			<Button onclick={onpractice}>Practice</Button>
		</div>
	{/if}
</section>
