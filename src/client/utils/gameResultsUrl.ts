import {paths} from '@/common/app/paths';
import {GameModel} from '@/common/models/GameModel';
import {isJudgeId, ParticipantId} from '@/common/Types';

/** The results page has no judge view, so a judge reads the table's results through the spectator id. */
export function gameResultsUrl(id: ParticipantId, game: GameModel): string {
  return `${paths.THE_END}?id=${isJudgeId(id) ? game.spectatorId : id}`;
}
