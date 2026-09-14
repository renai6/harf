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
 * The countdown starts when the runner is created, so call `start()` straight away.
 */
export function createSprintRunner(
	config: SprintConfig,
	onOutcome: (outcome: Outcome, state: SprintState) => void
) {
	let state = $state.raw<SprintState>(createSprint(config, performance.now()));
	let frame = 0;

	function dispatch(event: SprintEvent) {
		const previous = state;
		state = reduce(previous, event);
		const outcome = outcomeBetween(previous, state);
		if (outcome) onOutcome(outcome, state);
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
		start() {
			document.addEventListener('visibilitychange', onVisibilityChange);
			frame = requestAnimationFrame(loop);
		},
		answer(choice: string) {
			dispatch({ type: 'answer', choice, now: performance.now() });
		},
		resume() {
			dispatch({ type: 'resume', now: performance.now() });
		},
		stop() {
			cancelAnimationFrame(frame);
			document.removeEventListener('visibilitychange', onVisibilityChange);
		}
	};
}

export type SprintRunner = ReturnType<typeof createSprintRunner>;
