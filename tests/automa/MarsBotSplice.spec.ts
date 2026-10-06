import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {Game} from '../../src/server/Game';
import {SerializedGame} from '../../src/server/SerializedGame';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {BoardName} from '../../src/common/boards/BoardName';
import {Tag} from '../../src/common/cards/Tag';
import {CardName} from '../../src/common/cards/CardName';
import {Phase} from '../../src/common/Phase';
import {Splice} from '../../src/server/cards/promo/Splice';
import {PharmacyUnion} from '../../src/server/cards/promo/PharmacyUnion';
import {SaturnSystems} from '../../src/server/cards/corporation/SaturnSystems';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {IndustrialMicrobes} from '../../src/server/cards/base/IndustrialMicrobes';
import {SulphurEatingBacteria} from '../../src/server/cards/venusNext/SulphurEatingBacteria';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {MarsBotCorpResolver} from '../../src/server/automa/corps/MarsBotCorpResolver';
import {getAllMarsBotCorps} from '../../src/server/automa/corps/MarsBotCorpRegistry';
import {runAllActions} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';

function createAutomaGame(venusNextExtension: boolean = false): {game: Game, human: TestPlayer, marsBot: MarsBot} {
  const [game, human] = testGame(1, {automaOption: true, venusNextExtension, boardName: BoardName.THARSIS});
  return {game: game as Game, human, marsBot: game.automaHooks!.marsBot};
}

function helperAction(marsBot: MarsBot, awardName: string): boolean {
  return marsBot['bonusResolver']['tryHelperAction'](awardName);
}

function passForThisGeneration(player: TestPlayer): void {
  const actions = cast(player.getWaitingFor(), OrOptions);
  const index = actions.options.findIndex((option) => option.title === 'Pass for this generation');
  expect(index).to.not.eq(-1);
  player.process({type: 'or', index, response: {type: 'option'}});
}

describe('MarsBot and the player\'s Splice', () => {
  let game: Game;
  let human: TestPlayer;
  let marsBot: MarsBot;

  beforeEach(() => {
    ({game, human, marsBot} = createAutomaGame());
    human.playedCards.push(new Splice());
  });

  it('pays 2 M€ for a MarsBot card that holds microbes, without asking MarsBot', () => {
    marsBot.turnResolver.resolveProjectCard(new Tardigrades());
    runAllActions(game);

    expect(human.megaCredits).to.eq(2);
    expect(game.deferredActions.length).to.eq(0);
    expect(marsBot.player.getWaitingFor()).is.undefined;
  });

  it('pays 2 M€ for a MarsBot microbe card that holds no resources', () => {
    marsBot.turnResolver.resolveProjectCard(new IndustrialMicrobes());
    runAllActions(game);

    expect(human.megaCredits).to.eq(2);
  });

  it('pays 2 M€ for MarsBot\'s microbe starting tag', () => {
    const recyclon = getAllMarsBotCorps().find((corp) => corp.name === CardName.RECYCLON)!;
    MarsBotCorpResolver.setupCorp(recyclon, marsBot);
    runAllActions(game);

    expect(human.megaCredits).to.eq(2);
  });

  it('pays 2 M€ when Biologist advances MarsBot\'s microbe track', () => {
    expect(helperAction(marsBot, 'Biologist')).is.true;
    runAllActions(game);

    expect(human.megaCredits).to.eq(2);
    expect(marsBot.player.getWaitingFor()).is.undefined;
  });

  it('pays 2 M€ when a track action advances MarsBot\'s microbe track', () => {
    ({game, human, marsBot} = createAutomaGame(/* venusNextExtension */ true));
    human.playedCards.push(new Splice());
    const venusTrack = marsBot.marsBotBoard.tagToTrack[Tag.VENUS]!;
    // The next Venus track space shows the microbe icon.
    marsBot.marsBotBoard.tracks[venusTrack].position = 8;
    const microbeTrack = marsBot.marsBotBoard.tracks[marsBot.marsBotBoard.tagToTrack[Tag.MICROBE]!];
    const microbePosition = microbeTrack.position;

    marsBot.turnResolver.advanceTrack(venusTrack);
    runAllActions(game);

    expect(microbeTrack.position).to.eq(microbePosition + 1);
    expect(human.megaCredits).to.eq(2);
  });

  it('pays nothing when Biologist finds MarsBot\'s microbe track at its end', () => {
    const microbeTrack = marsBot.marsBotBoard.tracks[marsBot.marsBotBoard.tagToTrack[Tag.MICROBE]!];
    microbeTrack.position = microbeTrack.definition.layout.length - 1;

    helperAction(marsBot, 'Biologist');
    runAllActions(game);

    expect(human.megaCredits).to.eq(0);
  });

  it('pays nothing for a plant advance on the shared track', () => {
    helperAction(marsBot, 'Botanist');
    runAllActions(game);

    expect(human.megaCredits).to.eq(0);
  });

  it('keeps the game moving when MarsBot plays Sulphur-Eating Bacteria after the player passed', () => {
    const saves: Array<SerializedGame> = [];
    // The database stores saves as JSON, so the copy doesn't follow the live game.
    game.save = () => {
      saves.push(JSON.parse(JSON.stringify(game.serialize())));
    };
    marsBot.actionDeck = [new SulphurEatingBacteria()];
    human.megaCredits = 0;

    game.phase = Phase.ACTION;
    game.startActionsForPlayer(human);
    expect(saves).has.length(1);
    passForThisGeneration(human);

    expect(game.deferredActions.length).to.eq(0);
    expect(marsBot.player.getWaitingFor()).is.undefined;
    // MarsBot plays its last card and passes, so the generation ends.
    expect(game.generation).to.eq(2);
    expect(game.phase).to.not.eq(Phase.ACTION);
    // 2 M€ from Splice, then production pays the player's TR.
    expect(human.megaCredits).to.eq(2 + human.terraformRating);

    // A server restart reloads the save from the start of the player's turn: the player is
    // asked again and MarsBot's deck still starts with Sulphur-Eating Bacteria.
    const restored = Game.deserialize(saves[0]);
    const restoredHuman = restored.players[0] as TestPlayer;
    const restoredBot = restored.automaHooks!.marsBot;
    expect(restored.activePlayer).to.eq(restoredHuman);
    expect(restoredHuman.getWaitingFor()).is.not.undefined;
    const top = restoredBot.actionDeck[0];
    expect('name' in top && top.name).to.eq(CardName.SULPHUR_EATING_BACTERIA);

    passForThisGeneration(restoredHuman);
    expect(restoredBot.player.getWaitingFor()).is.undefined;
    expect(restored.generation).to.eq(2);
  });
});

describe('MarsBot and the player\'s Pharmacy Union', () => {
  it('adds a disease when Biologist advances MarsBot\'s microbe track', () => {
    const {game, human, marsBot} = createAutomaGame();
    const pharmacyUnion = new PharmacyUnion();
    human.playedCards.push(pharmacyUnion);
    human.megaCredits = 10;

    helperAction(marsBot, 'Biologist');
    runAllActions(game);

    expect(pharmacyUnion.resourceCount).to.eq(1);
    expect(human.megaCredits).to.eq(6);
  });

  it('adds a disease for a MarsBot card that holds microbes', () => {
    const {game, human, marsBot} = createAutomaGame();
    const pharmacyUnion = new PharmacyUnion();
    human.playedCards.push(pharmacyUnion);

    marsBot.turnResolver.resolveProjectCard(new Tardigrades());
    runAllActions(game);

    expect(pharmacyUnion.resourceCount).to.eq(1);
    expect(marsBot.player.getWaitingFor()).is.undefined;
  });
});

describe('MarsBot track advances and the player\'s Saturn Systems', () => {
  it('a Jovian track advance from a bonus card does not raise M€ production', () => {
    const {game, human, marsBot} = createAutomaGame();
    human.playedCards.push(new SaturnSystems());

    helperAction(marsBot, 'Traveller');
    helperAction(marsBot, 'Biologist');
    runAllActions(game);

    expect(human.production.megacredits).to.eq(0);
  });
});
