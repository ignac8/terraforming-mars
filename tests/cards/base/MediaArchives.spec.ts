import {expect} from 'chai';
import {MediaArchives} from '../../../src/server/cards/base/MediaArchives';
import {Virus} from '../../../src/server/cards/base/Virus';
import {IceAsteroid} from '../../../src/server/cards/base/IceAsteroid';
import {ImportedHydrogen} from '../../../src/server/cards/base/ImportedHydrogen';
import {testGame} from '../../TestingUtils';
import {cast} from '../../../src/common/utils/utils';
import {Tag} from '../../../src/common/cards/Tag';

describe('MediaArchives', () => {
  it('Should play', () => {
    const card = new MediaArchives();
    const [/* game */, player, player2] = testGame(2);
    player.playedCards.push(card, new Virus());
    player2.playedCards.push(new IceAsteroid(), new ImportedHydrogen());

    cast(card.play(player), undefined);

    // Every player's events count, not just your own.
    expect(player.megaCredits).to.eq(3);
  });

  // MarsBot has no played events: its event track counts instead (automa rulebook A p.4).
  it('counts MarsBot\'s event track', () => {
    const card = new MediaArchives();
    const [game, player] = testGame(1, {automa: true});
    const marsBotBoard = game.automaHooks!.marsBot.marsBotBoard;
    const eventTrack = marsBotBoard.tracks[marsBotBoard.tagToTrack[Tag.EVENT]!];
    for (let i = 0; i < 4; i++) {
      eventTrack.advance();
    }
    player.playedCards.push(card, new Virus());

    cast(card.play(player), undefined);

    expect(player.megaCredits).to.eq(1 + 4);
  });
});
