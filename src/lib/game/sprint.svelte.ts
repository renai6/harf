import type { ListenerHandlers, SpeechListener, Transcript } from '$lib/speech/listener';
import { matchAny } from '$lib/speech/match';
import { acceptedText } from './prompts';
import {
	createSprint,
	outcomeBetween,
	reduce,
	type Outcome,
	type SprintConfig,
	type SprintEvent,
	type SprintState
} from './sprint';

/**
 * Drives a sprint with requestAnimationFrame and pauses it when the page is hidden.
 * While the sprint listens it turns matching transcripts into answers, for letters and text alike.
 * The countdown starts when the runner is created, so call `start()` straight away.
 */
export function createSprintRunner(
	config: SprintConfig,
	onOutcome: (outcome: Outcome, state: SprintState) => void,
	listener?: SpeechListener
) {
	let state = $state.raw<SprintState>(createSprint(config, performance.now()));
	let listening = $state(false);
	let heard = $state('');
	let frame = 0;
	let started = false;
	let hearing = false;

	const handlers: ListenerHandlers = {
		onTranscript,
		onError: () => {
			// The listener has already stopped; the sprint carries on with the Got it and Missed buttons.
			hearing = false;
			dispatch({ type: 'speechLost', now: performance.now() });
		},
		onListeningChange: (value) => {
			listening = value;
		}
	};

	/** Listens from the countdown on so the microphone is warm, and not while paused or finished (spec 8.7). */
	function syncListening() {
		const wanted =
			started && state.input === 'speech' && state.phase !== 'paused' && state.phase !== 'finished';
		if (listener && wanted && !hearing) {
			hearing = true;
			heard = '';
			listener.start(handlers);
		} else if (!wanted && hearing) {
			hearing = false;
			listener?.stop();
		}
	}

	function dispatch(event: SprintEvent) {
		const previous = state;
		state = reduce(previous, event);
		if (
			state.prompt !== previous.prompt ||
			(previous.phase === 'countdown' && state.phase === 'active')
		) {
			// Anything heard so far belongs to the previous item or the countdown.
			listener?.markItemBoundary();
			heard = '';
		}
		syncListening();
		const outcome = outcomeBetween(previous, state);
		if (outcome) onOutcome(outcome, state);
	}

	function onTranscript(transcript: Transcript) {
		const { prompt, phase, input } = state;
		if (input !== 'speech') return;
		heard = transcript.text;
		if (
			phase === 'active' &&
			matchAny(acceptedText(prompt), transcript.text, prompt.matchKind, transcript.isFinal)
		) {
			dispatch({ type: 'matched', now: performance.now() });
		}
	}

	function loop() {
		dispatch({ type: 'tick', now: performance.now() });
		frame = state.phase === 'finished' ? 0 : requestAnimationFrame(loop);
	}

	function onVisibilityChange() {
		if (document.hidden) dispatch({ type: 'pause', now: performance.now() });
	}

	return {
		get state() {
			return state;
		},
		get listening() {
			return listening;
		},
		/** The latest transcript for the current item, shown under the mic indicator. */
		get heard() {
			return heard;
		},
		start() {
			started = true;
			document.addEventListener('visibilitychange', onVisibilityChange);
			frame = requestAnimationFrame(loop);
			syncListening();
		},
		answer(choice: string) {
			dispatch({ type: 'answer', choice, now: performance.now() });
		},
		skip() {
			dispatch({ type: 'skip', now: performance.now() });
		},
		selfReport(correct: boolean) {
			dispatch({ type: 'selfReport', correct, now: performance.now() });
		},
		resume() {
			dispatch({ type: 'resume', now: performance.now() });
		},
		stop() {
			started = false;
			cancelAnimationFrame(frame);
			document.removeEventListener('visibilitychange', onVisibilityChange);
			syncListening();
		}
	};
}

export type SprintRunner = ReturnType<typeof createSprintRunner>;
