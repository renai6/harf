import { describe, expect, it } from 'vitest';
import { matchAny, matchTranscript, SENTENCE_FORGIVENESS_MIN_WORDS, wordCount } from './match';

describe('matchTranscript: words', () => {
	it('matches a plain transcript of a vowelled word', () => {
		expect(matchTranscript('نُور', 'نور', 'word')).toBe(true);
	});

	it('matches recognizer spellings of ta marbuta and alef madda', () => {
		expect(matchTranscript('صَلَاة', 'صلاه', 'word')).toBe(true);
		expect(matchTranscript('قُرْآن', 'قران', 'word')).toBe(true);
	});

	it('matches when the previous answer is still at the start of the result', () => {
		expect(matchTranscript('سَلَام', 'نور سلام', 'word')).toBe(true);
	});

	it('ignores tokens before the tail', () => {
		expect(matchTranscript('سَلَام', 'سلام نور كتاب بيت', 'word')).toBe(false);
	});

	it('does not match a similar but different word', () => {
		expect(matchTranscript('قَلَم', 'علم', 'word')).toBe(false);
	});

	it('takes the tail letter of a merged recognizer result, not an earlier one (spec 11.1)', () => {
		expect(matchTranscript('ص', 'شن ص', 'word')).toBe(true);
		expect(matchTranscript('ش', 'شن ص', 'word')).toBe(false);
	});
});

describe('matchTranscript: sentences', () => {
	const basmala = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';

	it('matches a full plain transcript', () => {
		expect(matchTranscript(basmala, 'بسم الله الرحمن الرحيم', 'sentence')).toBe(true);
	});

	it('forgives one missed word of a final 5-word sentence, but not two', () => {
		const sentence = 'أَنَا أُحِبُّ اللُّغَةَ الْعَرَبِيَّةَ كَثِيرًا';
		expect(matchTranscript(sentence, 'انا احب اللغه العربيه', 'sentence', true)).toBe(true);
		expect(matchTranscript(sentence, 'انا احب اللغه', 'sentence', true)).toBe(false);
	});

	it('matches when the previous sentence is still at the start of the result', () => {
		expect(
			matchTranscript(
				'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ',
				'قل هو الله احد الحمد لله رب العالمين',
				'sentence'
			)
		).toBe(true);
	});

	it('counts a repeated expected word only as often as it was heard', () => {
		expect(matchTranscript('لَا لَا', 'لا', 'sentence')).toBe(false);
	});

	it('pins the forgiveness floor at three words', () => {
		expect(SENTENCE_FORGIVENESS_MIN_WORDS).toBe(3);
	});

	it('forgives one missed word of a final 3-word sentence', () => {
		const sentence = 'الْبَيْتُ كَبِيرٌ جِدًّا';
		expect(matchTranscript(sentence, 'البيت كبير', 'sentence', true)).toBe(true);
	});

	it('requires both words of a final 2-word sentence', () => {
		expect(matchTranscript('الْحَمْدُ لِلَّهِ', 'الحمد', 'sentence', true)).toBe(false);
	});
});

describe('matchTranscript: interim sentences', () => {
	const basmala = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';

	it('requires every word while the recognizer result is still open', () => {
		expect(matchTranscript(basmala, 'بسم الله الرحمن', 'sentence', false)).toBe(false);
		expect(matchTranscript(basmala, 'بسم الله الرحمن الرحيم', 'sentence', false)).toBe(true);
	});

	it('forgives the same missing word once the result is final', () => {
		expect(matchTranscript(basmala, 'بسم الله الرحمن', 'sentence', true)).toBe(true);
	});

	it('never forgives a word for a word prompt, final or not', () => {
		expect(matchTranscript('قَلَم', 'علم', 'word', true)).toBe(false);
	});
});

describe('matchTranscript: empty input', () => {
	it('never matches an empty expected text and scores an empty transcript as 0', () => {
		expect(matchTranscript('', 'نور', 'word')).toBe(false);
		expect(matchTranscript('نُور', '', 'word')).toBe(false);
	});
});

describe('matchAny', () => {
	it('matches a transcript of any accepted spelling', () => {
		expect(matchAny(['باء', 'ب'], 'باء', 'word')).toBe(true);
		expect(matchAny(['باء', 'ب'], 'ب', 'word')).toBe(true);
	});

	it('does not match a spelling that is not accepted', () => {
		expect(matchAny(['باء', 'ب'], 'ماء', 'word')).toBe(false);
	});

	it('passes the final flag through, so sentence forgiveness still applies', () => {
		const sentence = 'الْبَيْتُ كَبِيرٌ جِدًّا';
		expect(matchAny([sentence], 'البيت كبير', 'sentence', false)).toBe(false);
		expect(matchAny([sentence], 'البيت كبير', 'sentence', true)).toBe(true);
	});

	it('never matches when nothing is accepted', () => {
		expect(matchAny([], 'باء', 'word')).toBe(false);
	});
});

describe('wordCount', () => {
	it('counts normalized words', () => {
		expect(wordCount('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ')).toBe(4);
		expect(wordCount('نُور')).toBe(1);
		expect(wordCount('')).toBe(0);
	});
});
