import { describe, expect, it } from 'vitest';
import { draw, newDeck, type Deck } from './deck';
import { mulberry32 } from './rng';

function drawMany<T>(deck: Deck<T>, count: number, seed: number): T[] {
	const rng = mulberry32(seed);
	const items: T[] = [];
	let current = deck;
	for (let i = 0; i < count; i++) {
		const result = draw(current, rng);
		items.push(result.item);
		current = result.deck;
	}
	return items;
}

describe('deck', () => {
	it('deals every item once before repeating', () => {
		const items = ['a', 'b', 'c', 'd', 'e'];
		const dealt = drawMany(newDeck(items, mulberry32(3)), 5, 3);
		expect([...dealt].sort()).toEqual(items);
	});

	it('never repeats an item immediately across reshuffles', () => {
		for (let seed = 1; seed <= 300; seed++) {
			const dealt = drawMany(newDeck(['a', 'b', 'c'], mulberry32(seed)), 30, seed);
			for (let i = 1; i < dealt.length; i++) expect(dealt[i]).not.toBe(dealt[i - 1]);
		}
	});

	it('keeps dealing a single-item deck', () => {
		expect(drawMany(newDeck(['only'], mulberry32(1)), 3, 1)).toEqual(['only', 'only', 'only']);
	});

	it('rejects an empty deck', () => {
		expect(() => newDeck([], mulberry32(1))).toThrow();
	});
});
