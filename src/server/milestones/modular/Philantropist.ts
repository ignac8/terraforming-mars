import {BaseMilestone} from '../IMilestone';
import {IPlayer} from '../../IPlayer';
import {CardType} from '../../../common/cards/CardType';
import {ICard} from '@/server/cards/ICard';

function hasPositiveVictoryPoints(card: ICard): boolean {
  const victoryPoints = card.metadata.victoryPoints;

  if (card.type === CardType.EVENT) {
    return false;
  }
  if (victoryPoints === undefined) {
    return false;
  }

  if (typeof victoryPoints === 'number') {
    return victoryPoints > 0;
  } else {
    return victoryPoints.points > 0;
  }
}

export class Philantropist extends BaseMilestone {
  constructor() {
    super(
      'Philantropist',
      'Have 5 cards with non-negative VP',
      5,
    );
  }

  public getScore(player: IPlayer): number {
    return player.tableau.filter(hasPositiveVictoryPoints).length;
  }
}
