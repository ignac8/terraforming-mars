/**
 * Shared helper functions for MarsBot corporation definitions.
 */
import {IMarsBot, MarsBotTrackCube} from '../MarsBotCorpTypes';
import {BonusCardId, CubeType} from '../../../common/automa/AutomaTypes';

/** Generate white cubes for all 18 positions on a track (replaces transparent cubes). */
export function whiteTrackCubes(trackIndex: number): MarsBotTrackCube[] {
  return Array.from({length: 18}, (_, i) => ({trackIndex, position: i + 1, cubeType: 'white' as const}));
}

/** Factory for the common "add bonus card to action deck before action phase" per-gen pattern. */
export function bonusCardPerGen(bonusCardId: BonusCardId, corpName: string): {timing: 'beforeActionPhase', resolve: (bot: IMarsBot) => void} {
  return {
    timing: 'beforeActionPhase',
    resolve(bot) {
      bot.addBonusCardToActionDeck(bonusCardId);
      bot.game.log(`MarsBot (${corpName}): ${bonusCardId} added to action deck`);
    },
  };
}

/** Factory for the common "add 1 floater at round start" per-gen pattern. */
export function floaterPerRound(corpName: string): {timing: 'roundStart', resolve: (bot: IMarsBot) => void} {
  return {
    timing: 'roundStart',
    resolve(bot) {
      bot.addFloaters(1);
      bot.game.log(`MarsBot (${corpName}): round start, +1 floater`);
    },
  };
}

/** Shared cube handler: white -> advance least-advanced track, black -> advance space track. */
export function whiteLeastBlackSpaceHandler(bot: IMarsBot, cubeType: CubeType, corpName: string): void {
  if (cubeType === 'white') {
    bot.advanceTrack(bot.board.getLeastAdvancedTrackIndex());
    bot.game.log(`MarsBot (${corpName}): white cube — advance least-advanced track`);
  } else if (cubeType === 'black') {
    bot.advanceTrack(1);
    bot.game.log(`MarsBot (${corpName}): black cube — advance space track`);
  }
}
