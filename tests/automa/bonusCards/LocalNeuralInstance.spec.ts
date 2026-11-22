import {expect} from 'chai';
import {TileType} from '@/common/TileType';
import {BonusCardName} from '@/common/automa/BonusCardName';
import {SpaceType} from '@/common/boards/SpaceType';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {createBonusCard} from '@/server/automa/bonusCards/MarsBotBonusCards';
import {MarsBotTilePlacer} from '@/server/automa/MarsBotTilePlacer';
import {LocalNeuralInstance} from '@/server/automa/bonusCards/LocalNeuralInstance';
import {Space} from '@/server/boards/Space';
import {IProjectCard} from '@/server/cards/IProjectCard';
import {Mine} from '@/server/cards/base/Mine';
import {testGame} from '../../TestGame';
import {createAutomaGame} from '../corps/CorpGame';
import {recordingMarsBot} from '../corps/RecordingMarsBot';

function neuralInstance() {
  return createBonusCard(BonusCardName.LOCAL_NEURAL_INSTANCE);
}

/** Covers the board with the player's greeneries until no space is left for the Neural Instance tile. */
function leaveNoNeuralInstanceSpace(marsBot: IMarsBot): void {
  const placer = new MarsBotTilePlacer(marsBot);
  for (let space = placer.findNeuralInstanceSpace(); space !== undefined; space = placer.findNeuralInstanceSpace()) {
    marsBot.game.simpleAddTile(marsBot.humanPlayer, space, {tileType: TileType.GREENERY});
  }
}

describe('LocalNeuralInstance', () => {
  for (const run of [
    {spaceLeft: true, expected: {placed: 1, played: 0, destroyed: true}},
    {spaceLeft: false, expected: {placed: 0, played: 1, destroyed: false}},
  ] as const) {
    it('places its tile and is destroyed, otherwise resolves a project card and is kept: ' + JSON.stringify(run), () => {
      const [game, human, botPlayer] = testGame(2);
      const placed: Array<Space> = [];
      const played: Array<IProjectCard> = [];
      const {marsBot} = recordingMarsBot({
        game,
        player: botPlayer,
        humanPlayer: human,
        megacredits: 0,
        placeNeuralInstance: (space) => placed.push(space),
        resolveProjectCard: (card) => played.push(card),
      });
      if (!run.spaceLeft) {
        leaveNoNeuralInstanceSpace(marsBot);
      }
      game.projectDeck.drawPile.push(new Mine());

      const destroyed = new LocalNeuralInstance().resolve(marsBot);

      expect(placed).has.length(run.expected.placed);
      expect(played).has.length(run.expected.played);
      expect(destroyed).eq(run.expected.destroyed);
    });
  }

  it('is removed once its tile is placed', () => {
    const {marsBot} = createAutomaGame();

    const destroyed = marsBot.actionDeck.playBonusCard(neuralInstance());

    expect(marsBot.neuralInstanceSpace?.tile?.tileType).to.eq(TileType.NEURAL_INSTANCE);
    const placementMc = new MarsBotTilePlacer(marsBot).getTotalPlacementMC(marsBot.neuralInstanceSpace!);
    expect(marsBot.megacredits).to.eq(placementMc);
    expect(destroyed).to.be.true;
    const discardedIds = marsBot.bonusDeck.discardPile.map((c) => c.name);
    expect(discardedIds).does.not.include(BonusCardName.LOCAL_NEURAL_INSTANCE);
  });

  it('goes to the bonus discard pile when its tile cannot be placed', () => {
    const {marsBot} = createAutomaGame();
    leaveNoNeuralInstanceSpace(marsBot);
    const played = marsBot.playedProjectCards.length;

    const destroyed = marsBot.actionDeck.playBonusCard(neuralInstance());

    expect(marsBot.neuralInstanceSpace).to.be.undefined;
    expect(marsBot.playedProjectCards).has.length(played + 1); // The project card it resolved instead
    expect(destroyed).to.be.false;
    const discardedIds = marsBot.bonusDeck.discardPile.map((c) => c.name);
    expect(discardedIds).to.include(BonusCardName.LOCAL_NEURAL_INSTANCE);
  });

  it('records the project card in its fallback', () => {
    const {marsBot} = createAutomaGame();
    leaveNoNeuralInstanceSpace(marsBot);
    const b07 = createBonusCard(BonusCardName.LOCAL_NEURAL_INSTANCE);

    marsBot.actionDeck.playBonusCard(b07);

    expect(marsBot.playedProjectCards).to.have.length(1);
  });

  it('gains 1 MC per covered icon', () => {
    const {game, marsBot} = createAutomaGame();
    const space = game.board.spaces.find((s) => s.bonus.length >= 2 && s.spaceType === SpaceType.LAND)!;

    marsBot.placeNeuralInstance(space);

    const expected = new MarsBotTilePlacer(marsBot).getTotalPlacementMC(space);
    expect(expected).to.be.gte(2);
    expect(marsBot.megacredits).to.eq(expected);
  });
});
