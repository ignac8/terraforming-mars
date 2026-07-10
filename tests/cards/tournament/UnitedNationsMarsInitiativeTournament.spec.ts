import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {UnitedNationsMarsInitiativeTournament} from '../../../src/server/cards/tournament/UnitedNationsMarsInitiativeTournament';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {cast} from '../../../src/common/utils/utils';
import {TileType} from '../../../src/common/TileType';
import {fakeCard, runAllActions} from '../../TestingUtils';

describe('UnitedNationsMarsInitiativeTournament', () => {
  it('Places ocean, city and greenery without map bonuses, then discards 3', () => {
    const card = new UnitedNationsMarsInitiativeTournament();
    const [game, player] = testGame(2);
    player.cardsInHand.push(fakeCard(), fakeCard(), fakeCard(), fakeCard(), fakeCard());

    player.playCorporationCard(card);
    runAllActions(game);

    // 40 M€ minus 3 M€ for each of the 5 cards bought during setup.
    expect(player.megaCredits).to.eq(25);
    const initialTR = player.terraformRating;
    const handSizeBeforePlacements = player.cardsInHand.length;

    // Ocean: raises the ocean count and TR, but grants nothing from the space.
    const selectOcean = cast(player.popWaitingFor(), SelectSpace);
    const oceanSpace = selectOcean.spaces.find((space) => space.bonus.length > 0) ?? selectOcean.spaces[0];
    selectOcean.cb(oceanSpace);
    runAllActions(game);
    expect(oceanSpace.tile?.tileType).to.eq(TileType.OCEAN);
    expect(game.board.getOceanSpaces()).has.length(1);
    expect(player.terraformRating).to.eq(initialTR + 1);

    // City.
    const selectCity = cast(player.popWaitingFor(), SelectSpace);
    const citySpace = selectCity.spaces.find((space) => space.bonus.length > 0) ?? selectCity.spaces[0];
    selectCity.cb(citySpace);
    runAllActions(game);
    expect(citySpace.tile?.tileType).to.eq(TileType.CITY);

    // Greenery: raises oxygen and TR.
    const selectGreenery = cast(player.popWaitingFor(), SelectSpace);
    const greenerySpace = selectGreenery.spaces.find((space) => space.bonus.length > 0) ?? selectGreenery.spaces[0];
    selectGreenery.cb(greenerySpace);
    runAllActions(game);
    expect(greenerySpace.tile?.tileType).to.eq(TileType.GREENERY);
    expect(game.getOxygenLevel()).to.eq(1);
    expect(player.terraformRating).to.eq(initialTR + 2);

    // No space bonuses were collected for any of the three placements.
    expect(player.plants).to.eq(0);
    expect(player.steel).to.eq(0);
    expect(player.titanium).to.eq(0);
    expect(player.cardsInHand.length).to.eq(handSizeBeforePlacements);

    // Discard 3 cards.
    const selectCard = cast(player.popWaitingFor(), SelectCard);
    expect(selectCard.config.min).to.eq(3);
    selectCard.cb(player.cardsInHand.slice(0, 3));
    expect(player.cardsInHand).has.length(2);
  });

  it('Discards the whole hand when it holds fewer than 3 cards', () => {
    const card = new UnitedNationsMarsInitiativeTournament();
    const [game, player] = testGame(2);
    player.cardsInHand.push(fakeCard());

    player.playCorporationCard(card);
    runAllActions(game);

    for (const _ of [0, 1, 2]) {
      const selectSpace = cast(player.popWaitingFor(), SelectSpace);
      selectSpace.cb(selectSpace.spaces[0]);
      runAllActions(game);
    }

    expect(player.cardsInHand).is.empty;
  });
});
