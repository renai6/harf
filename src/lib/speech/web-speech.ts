import type { ListenerHandlers, SpeechError, SpeechListener } from './listener';

type Alternative = { readonly transcript: string };

type RecognitionResult = {
	readonly isFinal: boolean;
	readonly length: number;
	readonly [index: number]: Alternative;
};

type RecognitionEvent = {
	readonly resultIndex: number;
	readonly results: { readonly length: number; readonly [index: number]: RecognitionResult };
};

/** The part of the Web Speech API's SpeechRecognition this app uses. */
type Recognition = {
	lang: string;
	continuous: boolean;
	interimResults: boolean;
	maxAlternatives: number;
	onstart: (() => void) | null;
	onaudiostart: (() => void) | null;
	onresult: ((event: RecognitionEvent) => void) | null;
	onerror: ((event: { readonly error: string }) => void) | null;
	onend: (() => void) | null;
	start(): void;
	abort(): void;
};

export type RecognitionConstructor = new () => Recognition;

/** Where the constructor lives: `window` in the browser, a fake in tests. */
export type SpeechScope = {
	SpeechRecognition?: RecognitionConstructor;
	webkitSpeechRecognition?: RecognitionConstructor;
};

export const SPEECH_LANG = 'ar-SA';

const BLOCKED = new Set(['not-allowed', 'service-not-allowed', 'audio-capture']);

/** Silence and the session's own aborts are normal; recognition simply continues or restarts. */
const IGNORED = new Set(['no-speech', 'aborted']);

function toSpeechError(code: string): SpeechError {
	if (BLOCKED.has(code)) return 'not-allowed';
	return code === 'network' ? 'network' : 'other';
}

export function createWebSpeechListener(
	scope: SpeechScope = globalThis as SpeechScope
): SpeechListener {
	const Recognition = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
	let recognition: Recognition | null = null;
	let handlers: ListenerHandlers | null = null;
	/** Results in the current recognition session, and how many existed when the current item appeared. */
	let resultCount = 0;
	let boundary = 0;

	function stop() {
		const active = handlers;
		const current = recognition;
		recognition = null;
		handlers = null;
		current?.abort();
		active?.onListeningChange(false);
	}

	function fail(error: SpeechError) {
		const active = handlers;
		stop();
		active?.onError(error);
	}

	function startSession(r: Recognition) {
		try {
			r.start();
		} catch {
			fail('other');
		}
	}

	function begin(Ctor: RecognitionConstructor) {
		const r = new Ctor();
		r.lang = SPEECH_LANG;
		r.continuous = true;
		r.interimResults = true;
		r.maxAlternatives = 5;
		r.onstart = () => {
			resultCount = 0;
			boundary = 0;
		};
		r.onaudiostart = () => {
			if (recognition === r) handlers?.onListeningChange(true);
		};
		r.onresult = (event) => {
			if (recognition !== r) return;
			resultCount = event.results.length;
			// Chrome can append a new answer to the previous item's still-open result, so the last older result is kept.
			for (let i = Math.max(event.resultIndex, boundary - 1, 0); i < event.results.length; i++) {
				const result = event.results[i];
				for (let a = 0; a < result.length; a++) {
					// A handler may stop the listener mid-loop, for example when the mic check passes.
					if (recognition !== r || !handlers) return;
					const text = result[a].transcript.trim();
					if (text) handlers.onTranscript({ text, isFinal: result.isFinal });
				}
			}
		};
		r.onerror = (event) => {
			if (recognition !== r || IGNORED.has(event.error)) return;
			fail(toSpeechError(event.error));
		};
		r.onend = () => {
			if (recognition !== r) return;
			handlers?.onListeningChange(false);
			startSession(r);
		};
		recognition = r;
		startSession(r);
	}

	return {
		supported: Recognition !== undefined,
		start(next) {
			stop();
			if (!Recognition) {
				next.onError('unsupported');
				return;
			}
			handlers = next;
			begin(Recognition);
		},
		markItemBoundary() {
			boundary = resultCount;
		},
		stop
	};
}
