import type { Page } from '@playwright/test';

type FakeSpeechOptions = {
	/** No SpeechRecognition in the browser at all. */
	unsupported?: boolean;
	/** Every recognition session fails at once with `not-allowed`. */
	denied?: boolean;
};

type SpeechTestApi = {
	say(text: string): void;
	fail(error: string): void;
	readonly active: boolean;
	readonly starts: number;
};

type SpeechTestWindow = { __speech: SpeechTestApi };

/**
 * Replaces the browser's SpeechRecognition with a fake before the app loads, so the app's real
 * listener runs and tests decide what is heard.
 */
export async function installFakeSpeech(page: Page, options: FakeSpeechOptions = {}) {
	await page.addInitScript((opts: FakeSpeechOptions) => {
		const scope = window as unknown as Record<string, unknown>;
		if (opts.unsupported) {
			scope.SpeechRecognition = undefined;
			scope.webkitSpeechRecognition = undefined;
			return;
		}

		type Result = { transcript: string }[] & { isFinal: boolean };
		let current: FakeRecognition | null = null;
		let starts = 0;

		class FakeRecognition {
			lang = '';
			continuous = false;
			interimResults = false;
			maxAlternatives = 1;
			onstart: (() => void) | null = null;
			onaudiostart: (() => void) | null = null;
			onresult: ((event: unknown) => void) | null = null;
			onerror: ((event: { error: string }) => void) | null = null;
			onend: (() => void) | null = null;
			results: Result[] = [];

			start() {
				starts++;
				// eslint-disable-next-line @typescript-eslint/no-this-alias -- the fake tracks which session is live, as the browser does
				current = this;
				this.results = [];
				if (opts.denied) {
					queueMicrotask(() => {
						this.onerror?.({ error: 'not-allowed' });
						this.onend?.();
					});
					return;
				}
				this.onstart?.();
				this.onaudiostart?.();
			}

			abort() {
				if (current === this) current = null;
			}
		}

		const api: SpeechTestApi = {
			say(text) {
				const recognition = current;
				if (!recognition) throw new Error('Speech recognition is not listening');
				const index = recognition.results.length;
				recognition.results.push(Object.assign([{ transcript: text }], { isFinal: true }));
				recognition.onresult?.({ resultIndex: index, results: recognition.results });
			},
			fail(error) {
				const recognition = current;
				recognition?.onerror?.({ error });
				recognition?.onend?.();
			},
			get active() {
				return current !== null;
			},
			get starts() {
				return starts;
			}
		};

		scope.__speech = api;
		scope.SpeechRecognition = FakeRecognition;
		scope.webkitSpeechRecognition = FakeRecognition;
	}, options);
}

export async function say(page: Page, text: string) {
	await page.evaluate(
		(spoken) => (window as unknown as SpeechTestWindow).__speech.say(spoken),
		text
	);
}

export async function failSpeech(page: Page, error: string) {
	await page.evaluate((code) => (window as unknown as SpeechTestWindow).__speech.fail(code), error);
}

export async function speechState(page: Page) {
	return page.evaluate(() => {
		const speech = (window as unknown as SpeechTestWindow).__speech;
		return { active: speech.active, starts: speech.starts };
	});
}

/** The vowelled Arabic currently on the item card. */
export async function promptText(page: Page) {
	return ((await page.getByTestId('prompt').textContent()) ?? '').trim();
}
