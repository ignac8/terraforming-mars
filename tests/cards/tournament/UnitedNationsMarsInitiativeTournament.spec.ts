import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {UnitedNationsMarsInitiativeTournament} from '../../../src/server/cards/tournament/UnitedNationsMarsInitiativeTournament';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {cast} from '../../../src/common/utils/utils';
import {TileType} from '../../../src/common/TileType';
import {fakeCard, runAllActions} from '../../TestingUtils';
import {RecyclonTournament} from '../../../src/server/cards/tournament/RecyclonTournament';
import {Phase} from '../../../src/common/Phase';

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

    expect(player.megaCredits).to.eq(25);

    // City: next to the new ocean — the 2 M€ adjacency reward still pays.
    const selectCity = cast(player.popWaitingFor(), SelectSpace);
    const oceanNeighbors = game.board.getAdjacentSpaces(oceanSpace);
    const citySpace = selectCity.spaces.find((space) => oceanNeighbors.includes(space));
    expect(citySpace).is.not.undefined;
    selectCity.cb(citySpace!);
    runAllActions(game);
    expect(citySpace!.tile?.tileType).to.eq(TileType.CITY);
    expect(player.megaCredits).to.eq(27);

    // Greenery: raises oxygen and TR.
    const selectGreenery = cast(player.popWaitingFor(), SelectSpace);
    const greenerySpace = selectGreenery.spaces.find((space) => space.bonus.length > 0) ?? selectGreenery.spaces[0];
    const greeneryOceans = game.board.getAdjacentSpaces(greenerySpace).filter((space) => space.tile?.tileType === TileType.OCEAN).length;
    const megaCreditsBeforeGreenery = player.megaCredits;
    selectGreenery.cb(greenerySpace);
    runAllActions(game);
    expect(greenerySpace.tile?.tileType).to.eq(TileType.GREENERY);
    expect(game.getOxygenLevel()).to.eq(1);
    expect(player.terraformRating).to.eq(initialTR + 2);
    expect(player.megaCredits).to.eq(megaCreditsBeforeGreenery + 2 * greeneryOceans);

    // No printed space bonuses were collected for any of the three placements.
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

  // Corporations are played at setup, where every player resolves their own choices at once. Two
  // owners must not place on the shared board at the same time: the first in turn order places all
  // three tiles, then the next one does.
  it('A second owner places their tiles only after the first has finished', () => {
    const [game, p1, p2, p3] = testGame(3, {tournamentExpansion: true});
    game.phase = Phase.RESEARCH;

    p1.playCorporationCard(new UnitedNationsMarsInitiativeTournament());
    p2.playCorporationCard(new RecyclonTournament());
    p3.playCorporationCard(new UnitedNationsMarsInitiativeTournament());

    expect(p1.getWaitingFor()).instanceOf(SelectSpace);
    expect(p2.getWaitingFor()).is.undefined;
    expect(p3.getWaitingFor()).is.undefined;

    for (const tile of ['ocean', 'city', 'greenery']) {
      const selectSpace = cast(p1.getWaitingFor(), SelectSpace);
      p1.process({type: 'space', spaceId: selectSpace.spaces[0].id});
      if (tile !== 'greenery') {
        expect(p3.getWaitingFor()).is.undefined;
      }
    }
    expect(game.phase).eq(Phase.RESEARCH);

    for (const _ of ['ocean', 'city', 'greenery']) {
      const selectSpace = cast(p3.getWaitingFor(), SelectSpace);
      p3.process({type: 'space', spaceId: selectSpace.spaces[0].id});
    }

    expect(game.board.getOceanSpaces()).has.length(2);
    expect(game.board.getCities()).has.length(2);
    expect(game.board.getGreeneries()).has.length(2);
    expect(game.phase).eq(Phase.ACTION);
  });
});
