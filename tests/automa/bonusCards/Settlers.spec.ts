import {expect} from 'chai';
import {BonusCardName} from '@/common/automa/BonusCardName';
import {SpaceType} from '@/common/boards/SpaceType';
import {createBonusCard} from '@/server/automa/bonusCards/MarsBotBonusCards';
import {Settlers} from '@/server/automa/bonusCards/Settlers';
import {Mine} from '@/server/cards/base/Mine';
import {testGame} from '../../TestGame';
import {createAutomaGame, resetCorpRegistry} from '../corps/CorpGame';
import {recordingMarsBot} from '../corps/RecordingMarsBot';

describe('Settlers', () => {
  beforeEach(resetCorpRegistry);

  // Of the empty Tharsis spaces with two bonus icons, only 35 and 36 touch three ocean-reserved spaces
  for (const run of [
    {marked: [], expected: '36'},
    {marked: ['36'], expected: '35'},
  ] as const) {
    it('puts a marker on a free space next to the most ocean-reserved spaces: ' + JSON.stringify(run), () => {
      const [game, human, botPlayer] = testGame(2);
      const placed: Array<string> = [];
      const {marsBot} = recordingMarsBot({game, player: botPlayer, humanPlayer: human, placeMarker: (space) => placed.push(space.id)});
      for (const id of run.marked) {
        game.board.getSpaceOrThrow(id).player = botPlayer;
      }
      // Cost 4 counts to the 2nd of 2
      game.projectDeck.drawPile.push(new Mine());

      new Settlers().resolve(marsBot);

      expect(placed).deep.eq([run.expected]);
    });
  }

  it('places no marker when every land space has one', () => {
    const [game, human, botPlayer] = testGame(2);
    const placed: Array<string> = [];
    const {marsBot} = recordingMarsBot({game, player: botPlayer, humanPlayer: human, placeMarker: (space) => placed.push(space.id)});
    for (const space of game.board.getAvailableSpacesOnLand(botPlayer)) {
      space.player = botPlayer;
    }

    new Settlers().resolve(marsBot);

    expect(placed).is.empty;
  });

  it('puts a player marker on a free land space instead of a tile', () => {
    const {game, human, marsBot} = createAutomaGame();
    marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardName.SETTLERS));

    expect(marsBot.markerSpaceIds).has.length(1);
    const space = game.board.getSpaceOrThrow(marsBot.markerSpaceIds[0]);
    expect(space.spaceType).to.eq(SpaceType.LAND);
    expect(space.tile).is.undefined;
    expect(space.player).to.eq(marsBot.player);
    expect(game.board.getGreeneries(marsBot.player)).is.empty;
    expect(game.board.getAvailableSpacesOnLand(human)).does.not.include(space);
  });

  it('prefers the space next to the most ocean-reserved spaces before the random tiebreak', () => {
    const {marsBot} = createAutomaGame();
    marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardName.SETTLERS));

    // Of the empty Tharsis spaces with two bonus icons, only these two touch three ocean-reserved spaces.
    expect(marsBot.markerSpaceIds[0]).to.be.oneOf(['35', '36']);
  });

  it('never picks a space that already has a marker', () => {
    const {marsBot} = createAutomaGame();
    marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardName.SETTLERS));
    marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardName.SETTLERS));
    marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardName.SETTLERS));

    expect(marsBot.markerSpaceIds.slice(0, 2)).to.have.members(['35', '36']);
    expect(new Set(marsBot.markerSpaceIds).size).to.eq(3);
  });
});
