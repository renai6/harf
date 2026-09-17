import { describe, expect, it } from 'vitest';
import { matchTranscript, wordCount } from './match';

describe('matchTranscript: words', () => {
	it('matches a plain transcript of a vowelled word', () => {
		expect(matchTranscript('نُور', 'نور', 'word')).toEqual({ matched: true, ratio: 1 });
	});

	it('matches recognizer spellings of ta marbuta and alef madda', () => {
		expect(matchTranscript('صَلَاة', 'صلاه', 'word').matched).toBe(true);
		expect(matchTranscript('قُرْآن', 'قران', 'word').matched).toBe(true);
	});

	it('matches when the previous answer is still at the start of the result', () => {
		expect(matchTranscript('سَلَام', 'نور سلام', 'word').matched).toBe(true);
	});

	it('ignores tokens before the tail', () => {
		expect(matchTranscript('سَلَام', 'سلام نور كتاب بيت', 'word')).toEqual({
			matched: false,
			ratio: 0
		});
	});

	it('does not match a similar but different word', () => {
		expect(matchTranscript('قَلَم', 'علم', 'word').matched).toBe(false);
	});
});

describe('matchTranscript: sentences', () => {
	const basmala = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';

	it('matches a full plain transcript', () => {
		expect(matchTranscript(basmala, 'بسم الله الرحمن الرحيم', 'sentence')).toEqual({
			matched: true,
			ratio: 1
		});
	});

	it('does not match an unfinished interim transcript of a 4-word sentence', () => {
		expect(matchTranscript(basmala, 'بسم الله الرحمن', 'sentence')).toEqual({
			matched: false,
			ratio: 0.75
		});
	});

	it('matches at exactly 80% of a 5-word sentence and not below', () => {
		const sentence = 'أَنَا أُحِبُّ اللُّغَةَ الْعَرَبِيَّةَ كَثِيرًا';
		expect(matchTranscript(sentence, 'انا احب اللغه العربيه', 'sentence')).toEqual({
			matched: true,
			ratio: 0.8
		});
		expect(matchTranscript(sentence, 'انا احب اللغه', 'sentence').matched).toBe(false);
	});

	it('matches when the previous sentence is still at the start of the result', () => {
		expect(
			matchTranscript(
				'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ',
				'قل هو الله احد الحمد لله رب العالمين',
				'sentence'
			).matched
		).toBe(true);
	});

	it('counts a repeated expected word only as often as it was heard', () => {
		expect(matchTranscript('لَا لَا', 'لا', 'sentence')).toEqual({ matched: false, ratio: 0.5 });
	});
});

describe('matchTranscript: empty input', () => {
	it('never matches an empty expected text and scores an empty transcript as 0', () => {
		expect(matchTranscript('', 'نور', 'word')).toEqual({ matched: false, ratio: 0 });
		expect(matchTranscript('نُور', '', 'word')).toEqual({ matched: false, ratio: 0 });
	});
});

describe('wordCount', () => {
	it('counts normalized words', () => {
		expect(wordCount('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ')).toBe(4);
		expect(wordCount('نُور')).toBe(1);
		expect(wordCount('')).toBe(0);
	});
});
