import { describe, expect, it } from 'vitest';
import type { SpeechError, Transcript } from './listener';
import { createWebSpeechListener, type RecognitionConstructor } from './web-speech';

type FakeResult = { transcript: string }[] & { isFinal: boolean };

class FakeRecognition {
	static instances: FakeRecognition[] = [];
	lang = '';
	continuous = false;
	interimResults = false;
	maxAlternatives = 1;
	onstart: (() => void) | null = null;
	onaudiostart: (() => void) | null = null;
	onresult: ((event: unknown) => void) | null = null;
	onerror: ((event: { error: string }) => void) | null = null;
	onend: (() => void) | null = null;
	starts = 0;
	aborted = false;
	private results: FakeResult[] = [];

	constructor() {
		FakeRecognition.instances.push(this);
	}

	start() {
		this.starts++;
		this.results = [];
		this.onstart?.();
		this.onaudiostart?.();
	}

	abort() {
		this.aborted = true;
	}

	/** Sets result `index` (appending or replacing it) and fires a result event from `resultIndex`. */
	emit(index: number, alternatives: string[], isFinal = false, resultIndex = index) {
		this.results[index] = Object.assign(
			alternatives.map((transcript) => ({ transcript })),
			{ isFinal }
		);
		this.onresult?.({ resultIndex, results: this.results });
	}

	end() {
		this.onend?.();
	}

	fail(error: string) {
		this.onerror?.({ error });
	}
}

class FailingRecognition extends FakeRecognition {
	start() {
		throw new Error('InvalidStateError');
	}
}

function setup(Recognition: typeof FakeRecognition = FakeRecognition) {
	FakeRecognition.instances = [];
	const listener = createWebSpeechListener({
		SpeechRecognition: Recognition as unknown as RecognitionConstructor
	});
	const heard: Transcript[] = [];
	const errors: SpeechError[] = [];
	const listening: boolean[] = [];
	listener.start({
		onTranscript: (transcript) => heard.push(transcript),
		onError: (error) => errors.push(error),
		onListeningChange: (value) => listening.push(value)
	});
	const recognition = FakeRecognition.instances[FakeRecognition.instances.length - 1];
	return { listener, heard, errors, listening, recognition };
}

describe('createWebSpeechListener', () => {
	it('reports unsupported when the browser has no speech recognition', () => {
		const listener = createWebSpeechListener({});
		const errors: SpeechError[] = [];
		listener.start({
			onTranscript: () => {},
			onError: (e) => errors.push(e),
			onListeningChange: () => {}
		});
		expect(listener.supported).toBe(false);
		expect(errors).toEqual(['unsupported']);
	});

	it('uses the prefixed constructor too', () => {
		const listener = createWebSpeechListener({
			webkitSpeechRecognition: FakeRecognition as unknown as RecognitionConstructor
		});
		expect(listener.supported).toBe(true);
	});

	it('starts one continuous Arabic session with interim results', () => {
		const { listener, recognition, listening } = setup();
		expect(listener.supported).toBe(true);
		expect(recognition).toMatchObject({
			lang: 'ar-SA',
			continuous: true,
			interimResults: true,
			maxAlternatives: 5,
			starts: 1
		});
		expect(listening).toEqual([true]);
	});

	it('reports every non-empty alternative of interim and final results, trimmed', () => {
		const { recognition, heard } = setup();
		recognition.emit(0, [' نور ', '', 'نون']);
		recognition.emit(0, ['نور'], true);
		expect(heard).toEqual([
			{ text: 'نور', isFinal: false },
			{ text: 'نون', isFinal: false },
			{ text: 'نور', isFinal: true }
		]);
	});

	it('after an item boundary reports the last older result and newer ones only', () => {
		const { listener, recognition, heard } = setup();
		recognition.emit(0, ['نور'], true);
		recognition.emit(1, ['كتاب'], true);
		listener.markItemBoundary();
		heard.length = 0;
		recognition.emit(2, ['سلام'], false, 0);
		expect(heard.map((t) => t.text)).toEqual(['كتاب', 'سلام']);
	});

	it('restarts when the session ends and counts results from the start again', () => {
		const { listener, recognition, heard, listening } = setup();
		recognition.emit(0, ['نور'], true);
		recognition.emit(1, ['كتاب'], true);
		listener.markItemBoundary();
		recognition.end();
		expect(recognition.starts).toBe(2);
		expect(listening).toEqual([true, false, true]);
		heard.length = 0;
		recognition.emit(0, ['سلام'], false, 0);
		expect(heard.map((t) => t.text)).toEqual(['سلام']);
	});

	it('ignores silence and abort errors', () => {
		const { recognition, errors } = setup();
		recognition.fail('no-speech');
		recognition.fail('aborted');
		expect(errors).toEqual([]);
		expect(recognition.aborted).toBe(false);
	});

	it.each([
		['not-allowed', 'not-allowed'],
		['service-not-allowed', 'not-allowed'],
		['audio-capture', 'not-allowed'],
		['network', 'network'],
		['language-not-supported', 'other']
	] as const)('stops on %s and reports %s', (code, expected) => {
		const { recognition, errors, heard } = setup();
		recognition.fail(code);
		expect(errors).toEqual([expected]);
		expect(recognition.aborted).toBe(true);
		recognition.end();
		expect(recognition.starts).toBe(1);
		recognition.emit(0, ['نور']);
		expect(heard).toEqual([]);
	});

	it('stops on request and ignores the session afterwards', () => {
		const { listener, recognition, heard, listening } = setup();
		listener.stop();
		expect(recognition.aborted).toBe(true);
		expect(listening).toEqual([true, false]);
		recognition.end();
		recognition.emit(0, ['نور']);
		expect(recognition.starts).toBe(1);
		expect(heard).toEqual([]);
	});

	it('replaces the previous session when started again', () => {
		const { listener, recognition: first, heard } = setup();
		const later: Transcript[] = [];
		listener.start({
			onTranscript: (t) => later.push(t),
			onError: () => {},
			onListeningChange: () => {}
		});
		const second = FakeRecognition.instances[FakeRecognition.instances.length - 1];
		expect(first.aborted).toBe(true);
		expect(second).not.toBe(first);
		first.emit(0, ['نور']);
		second.emit(0, ['سلام']);
		expect(heard).toEqual([]);
		expect(later.map((t) => t.text)).toEqual(['سلام']);
	});

	it('reports other when the browser refuses to start', () => {
		const { errors } = setup(FailingRecognition);
		expect(errors).toEqual(['other']);
	});
});
