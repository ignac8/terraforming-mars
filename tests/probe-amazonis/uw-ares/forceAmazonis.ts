// Differential probe: force the default board to Amazonis Planitia for the existing suites.
import {DEFAULT_GAME_OPTIONS} from '@/server/game/GameOptions';
import {BoardName} from '@/common/boards/BoardName';

(DEFAULT_GAME_OPTIONS as any).boardName = BoardName.AMAZONIS_PLANITIA;
