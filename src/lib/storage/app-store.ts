import { createStore, type Store } from './store.svelte';

let store: Store | undefined;

/** The app-wide store over localStorage. Created on first use, which is always in the browser (ssr = false). */
export function getStore(): Store {
	store ??= createStore(localStorage);
	return store;
}
