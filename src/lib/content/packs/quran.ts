import type { Pack } from '../types';

export const QURAN_PACK: Pack = {
	id: 'quran',
	name: 'Quranic',
	words: [
		{ id: 'q-allah', text: 'اللَّه', translit: 'allaah', meaning: 'God (Allah)' },
		{ id: 'q-rabb', text: 'رَبّ', translit: 'rabb', meaning: 'Lord' },
		{ id: 'q-nur', text: 'نُور', translit: 'nuur', meaning: 'light' },
		{ id: 'q-salam', text: 'سَلَام', translit: 'salaam', meaning: 'peace' },
		{ id: 'q-salah', text: 'صَلَاة', translit: 'Salaah', meaning: 'prayer' },
		{ id: 'q-quran', text: 'قُرْآن', translit: "qur'aan", meaning: 'recitation, the Quran' },
		{ id: 'q-jannah', text: 'جَنَّة', translit: 'jannah', meaning: 'garden, paradise' },
		{ id: 'q-kitab', text: 'كِتَاب', translit: 'kitaab', meaning: 'book, scripture' }
	],
	sentences: [
		{
			id: 'q-basmala',
			text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
			translit: 'bismi llaahi r-raHmaani r-raHiim',
			meaning: 'In the name of God, the Most Gracious, the Most Merciful',
			source: '1:1'
		},
		{
			id: 'q-hamd',
			text: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ',
			translit: "al-Hamdu lillaahi rabbi l-'aalamiin",
			meaning: 'All praise is for God, Lord of all the worlds',
			source: '1:2'
		},
		{
			id: 'q-ikhlas-1',
			text: 'قُلْ هُوَ اللَّهُ أَحَدٌ',
			translit: 'qul huwa llaahu aHad',
			meaning: 'Say: He is God, the One',
			source: '112:1'
		}
	]
};
