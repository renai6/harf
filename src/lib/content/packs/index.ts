import type { PackVariant } from '$lib/game/levels';
import type { Pack } from '../types';
import { MSA_PACK } from './msa';
import { QURAN_PACK } from './quran';

export const PACKS: Record<PackVariant, Pack> = { quran: QURAN_PACK, msa: MSA_PACK };
