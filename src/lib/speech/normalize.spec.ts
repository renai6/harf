import { describe, expect, it } from 'vitest';
import { normalizeArabic, tokens } from './normalize';

describe('normalizeArabic', () => {
	it('strips harakat and shadda', () => {
		expect(normalizeArabic('اللَّه')).toBe('الله');
		expect(normalizeArabic('كِتَاب')).toBe('كتاب');
	});

	it('strips superscript alef', () => {
		expect(normalizeArabic('الرَّحْمَٰنِ')).toBe('الرحمن');
		expect(normalizeArabic('هَٰذَا')).toBe('هذا');
	});

	it('unifies alef forms', () => {
		expect(normalizeArabic('أَحَدٌ')).toBe('احد');
		expect(normalizeArabic('إِيَّاكَ')).toBe('اياك');
		expect(normalizeArabic('قُرْآن')).toBe('قران');
		expect(normalizeArabic('ٱلْحَمْدُ')).toBe('الحمد');
	});

	it('unifies ta marbuta, alef maqsura and hamza seats', () => {
		expect(normalizeArabic('صَلَاة')).toBe('صلاه');
		expect(normalizeArabic('مُوسَى')).toBe('موسي');
		expect(normalizeArabic('سَائِل')).toBe('سايل');
		expect(normalizeArabic('مُؤْمِن')).toBe('مومن');
	});

	it('removes standalone hamza', () => {
		expect(normalizeArabic('مَاء')).toBe('ما');
		expect(normalizeArabic('شَيْءٌ')).toBe('شي');
	});

	it('removes tatweel, Quranic marks and format characters', () => {
		expect(normalizeArabic('كتـــاب')).toBe('كتاب');
		expect(normalizeArabic('الْعَالَمِينَ \u06DD')).toBe('العالمين');
		expect(normalizeArabic('ب\u200Dت')).toBe('بت');
	});

	it('turns punctuation into spaces and collapses whitespace', () => {
		expect(normalizeArabic('  بسم  الله،الرحمن! ')).toBe('بسم الله الرحمن');
		expect(normalizeArabic('من؟ انا')).toBe('من انا');
	});

	it('lowercases Latin noise', () => {
		expect(normalizeArabic('Hello  WORLD')).toBe('hello world');
	});
});

describe('tokens', () => {
	it('splits normalized text into words', () => {
		expect(tokens('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ')).toEqual([
			'بسم',
			'الله',
			'الرحمن',
			'الرحيم'
		]);
	});

	it('returns no tokens for empty or blank input', () => {
		expect(tokens('')).toEqual([]);
		expect(tokens('  ،  ')).toEqual([]);
	});
});
