/** Returns a float in [0, 1). Math.random satisfies this type. */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function randomInt(max: number, rng: Rng): number {
	return Math.floor(rng() * max);
}

export function pick<T>(items: readonly T[], rng: Rng): T {
	if (items.length === 0) throw new Error('Cannot pick from an empty list');
	return items[randomInt(items.length, rng)];
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = randomInt(i + 1, rng);
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}
