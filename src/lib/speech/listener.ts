export type SpeechError = 'not-allowed' | 'network' | 'unsupported' | 'other';

export type Transcript = { text: string; isFinal: boolean };

export type ListenerHandlers = {
	onTranscript: (transcript: Transcript) => void;
	/** The listener has already stopped when this is called. */
	onError: (error: SpeechError) => void;
	onListeningChange: (listening: boolean) => void;
};

export interface SpeechListener {
	readonly supported: boolean;
	start(handlers: ListenerHandlers): void;
	/** Call when a new item appears, so results that belong to the previous item are not reported again. */
	markItemBoundary(): void;
	stop(): void;
}
