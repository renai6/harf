import { shuffle, type Rng } from './rng';

export type Deck<T> = { readonly order: readonly T[]; readonly index: number };

export function newDeck<T>(items: readonly T[], rng: Rng, avoidFirst?: T): Deck<T> {
	if (items.length === 0) throw new Error('A deck needs at least one item');
	const order = shuffle(items, rng);
	if (order.length > 1 && order[0] === avoidFirst) [order[0], order[1]] = [order[1], order[0]];
	return { order, index: 0 };
}

/** Deals the next item, reshuffling when exhausted so the last item is not dealt twice in a row. */
export function draw<T>(deck: Deck<T>, rng: Rng): { item: T; deck: Deck<T> } {
	const current =
		deck.index < deck.order.length
			? deck
			: newDeck(deck.order, rng, deck.order[deck.order.length - 1]);
	return {
		item: current.order[current.index],
		deck: { order: current.order, index: current.index + 1 }
	};
}
