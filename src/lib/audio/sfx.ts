export type Sfx = 'correct' | 'wrong' | 'timeup';

type Tone = { notes: number[]; wave: OscillatorType; step: number };

const TONES: Record<Sfx, Tone> = {
	correct: { notes: [660, 880], wave: 'sine', step: 0.07 },
	wrong: { notes: [220, 165], wave: 'triangle', step: 0.12 },
	timeup: { notes: [440, 330, 247], wave: 'sine', step: 0.1 }
};

let context: AudioContext | null = null;

function audio(): AudioContext | null {
	if (typeof AudioContext === 'undefined') return null;
	context ??= new AudioContext();
	void context.resume();
	return context;
}

/**
 * Opens the audio context from inside a user gesture. iOS Safari leaves a context suspended
 * unless a tap created or resumed it, so without this the first tone of a sprint - seconds later,
 * with no tap in progress - is silent. Call it from the tap that starts a round.
 */
export function primeSfx(): void {
	audio();
}

/** Plays a short synthesized tone. Silently does nothing where Web Audio is unavailable. */
export function playSfx(kind: Sfx): void {
	const ctx = audio();
	if (!ctx) return;
	const { notes, wave, step } = TONES[kind];
	notes.forEach((frequency, index) => {
		const start = ctx.currentTime + index * step;
		const oscillator = ctx.createOscillator();
		const gain = ctx.createGain();
		oscillator.type = wave;
		oscillator.frequency.value = frequency;
		gain.gain.setValueAtTime(0.0001, start);
		gain.gain.exponentialRampToValueAtTime(0.2, start + 0.01);
		gain.gain.exponentialRampToValueAtTime(0.0001, start + step);
		oscillator.connect(gain).connect(ctx.destination);
		oscillator.start(start);
		oscillator.stop(start + step + 0.02);
	});
}
