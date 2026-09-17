import type { Pack } from '../types';

export const MSA_PACK: Pack = {
	id: 'msa',
	name: 'Modern Standard',
	words: [
		{ id: 'm-bayt', text: 'بَيْت', translit: 'bayt', meaning: 'house' },
		{ id: 'm-maa', text: 'مَاء', translit: "maa'", meaning: 'water' },
		{ id: 'm-qalam', text: 'قَلَم', translit: 'qalam', meaning: 'pen' },
		{ id: 'm-shams', text: 'شَمْس', translit: 'shams', meaning: 'sun' },
		{ id: 'm-qamar', text: 'قَمَر', translit: 'qamar', meaning: 'moon' },
		{ id: 'm-walad', text: 'وَلَد', translit: 'walad', meaning: 'boy' },
		{ id: 'm-madrasah', text: 'مَدْرَسَة', translit: 'madrasah', meaning: 'school' }
	],
	sentences: [
		{
			id: 'm-bayt-kabir',
			text: 'هَٰذَا بَيْتٌ كَبِيرٌ',
			translit: 'haadhaa baytun kabiir',
			meaning: 'This is a big house'
		},
		{
			id: 'm-ashrabu-maa',
			text: 'أَنَا أَشْرَبُ الْمَاءَ',
			translit: "anaa ashrabu l-maa'",
			meaning: 'I drink the water'
		}
	]
};
