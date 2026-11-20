import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {BoardName} from '@/common/boards/BoardName';
import {ColonyName} from '@/common/colonies/ColonyName';
import {createBaseBonusCards} from '@/server/automa/bonusCards/MarsBotBonusCards';
import {MarsBotBonusResolver} from '@/server/automa/MarsBotBonusResolver';
import {Ants} from '@/server/cards/base/Ants';
import {Birds} from '@/server/cards/base/Birds';
import {Fish} from '@/server/cards/base/Fish';
import {GHGProducingBacteria} from '@/server/cards/base/GHGProducingBacteria';
import {Mine} from '@/server/cards/base/Mine';
import {Pets} from '@/server/cards/base/Pets';
import {Tardigrades} from '@/server/cards/base/Tardigrades';
import {InvasiveSpeciesMarsBot} from '@/server/automa/bonusCards/InvasiveSpeciesMarsBot';
import {ProtectedHabitats} from '@/server/cards/base/ProtectedHabitats';
import {Titan} from '@/server/colonies/Titan';
import {testGame} from '../../TestGame';
import {createAutomaGame} from '../corps/CorpGame';
import {recordingMarsBot} from '../corps/RecordingMarsBot';

function invasiveSpecies() {
  return createBaseBonusCards().find((c) => c.id === BonusCardId.B02_INVASIVE_SPECIES)!;
}

describe('InvasiveSpeciesMarsBot', () => {
  for (const run of [
    {options: {}, titan: false, expected: ['gainMc(5)']},
    {options: {venusNextExtension: true}, titan: false, expected: ['gainMc(2)', 'addFloaters(1)']},
    {options: {coloniesExtension: true}, titan: true, expected: ['gainMc(2)', 'addFloaters(1)']},
    {options: {coloniesExtension: true}, titan: false, expected: ['gainMc(2)']},
  ] as const) {
    it('gains 5 M€, or 2 M€ and a floater with Venus Next or Titan: ' + JSON.stringify(run), () => {
      const [game, human] = testGame(1, run.options);
      const {marsBot, calls} = recordingMarsBot({game, humanPlayer: human});
      game.colonies = run.titan ? [new Titan()] : [];

      new InvasiveSpeciesMarsBot().resolve(marsBot);

      expect(calls).deep.eq(run.expected);
    });
  }

  it('removes the resource worth the most VP, not the card scoring the most', () => {
    const [game, human, botPlayer] = testGame(2);
    const {marsBot} = recordingMarsBot({game, player: botPlayer, humanPlayer: human});
    const ants = new Ants();
    ants.resourceCount = 4;
    const birds = new Birds();
    birds.resourceCount = 1;
    human.playedCards.push(ants, birds);

    new InvasiveSpeciesMarsBot().resolve(marsBot);

    expect(ants.resourceCount).eq(4);
    expect(birds.resourceCount).eq(0);
  });

  it('skips Pets, whose animals cannot be removed', () => {
    const [game, human, botPlayer] = testGame(2);
    const {marsBot} = recordingMarsBot({game, player: botPlayer, humanPlayer: human});
    const pets = new Pets();
    pets.resourceCount = 6;
    const tardigrades = new Tardigrades();
    tardigrades.resourceCount = 4;
    human.playedCards.push(pets, tardigrades);

    new InvasiveSpeciesMarsBot().resolve(marsBot);

    expect(pets.resourceCount).eq(6);
    expect(tardigrades.resourceCount).eq(3);
  });

  it('breaks a tie by flipping a project card', () => {
    const [game, human, botPlayer] = testGame(2);
    const {marsBot} = recordingMarsBot({game, player: botPlayer, humanPlayer: human});
    const birds = new Birds();
    birds.resourceCount = 1;
    const fish = new Fish();
    fish.resourceCount = 1;
    human.playedCards.push(birds, fish);
    // Cost 4 counts to the 2nd of 2
    game.projectDeck.drawPile.push(new Mine());

    new InvasiveSpeciesMarsBot().resolve(marsBot);

    expect(birds.resourceCount).eq(1);
    expect(fish.resourceCount).eq(0);
  });

  it('removes nothing from a player with Protected Habitats', () => {
    const [game, human, botPlayer] = testGame(2);
    const {marsBot} = recordingMarsBot({game, player: botPlayer, humanPlayer: human});
    const birds = new Birds();
    birds.resourceCount = 1;
    human.playedCards.push(new ProtectedHabitats(), birds);

    new InvasiveSpeciesMarsBot().resolve(marsBot);

    expect(birds.resourceCount).eq(1);
  });

  // Edge cases (rulebook page 6)
  it('MarsBot gains 5 MC even when human has no animals/microbes', () => {
    const {marsBot} = createAutomaGame();
    // Human has no cards with resources

    const cards = createBaseBonusCards();
    const b02 = cards.find((c) => c.id === BonusCardId.B02_INVASIVE_SPECIES)!;
    const bonusResolver = new MarsBotBonusResolver(marsBot);

    bonusResolver.resolve(b02);
    expect(marsBot.turnResolver.megacredits).to.eq(5);
  });

  it('skips Pets, whose animals cannot be removed', () => {
    const {human, marsBot} = createAutomaGame();
    const pets = new Pets();
    pets.resourceCount = 6; // 3 VP
    const birds = new Birds();
    birds.resourceCount = 1; // 1 VP
    human.playedCards.push(pets, birds);

    marsBot['bonusResolver'].resolve(invasiveSpecies());

    expect(pets.resourceCount).to.eq(6);
    expect(birds.resourceCount).to.eq(0);
  });

  // BGG 3360797 (TDaver): the cube worth the most VP, cards scoring per resource first
  it('removes the cube worth the most VP, not the card scoring the most', () => {
    const {human, marsBot} = createAutomaGame();
    const ants = new Ants();
    ants.resourceCount = 4; // 2 VP, 1/2 VP per microbe
    const birds = new Birds();
    birds.resourceCount = 1; // 1 VP per animal
    human.playedCards.push(ants, birds);

    marsBot['bonusResolver'].resolve(invasiveSpecies());

    expect(birds.resourceCount).to.eq(0);
    expect(ants.resourceCount).to.eq(4);
  });

  it('takes a scoring cube before one on a card that scores no VP', () => {
    const {human, marsBot} = createAutomaGame();
    const bacteria = new GHGProducingBacteria();
    bacteria.resourceCount = 3;
    const tardigrades = new Tardigrades();
    tardigrades.resourceCount = 3; // 0 VP now, 1/4 VP per microbe
    human.playedCards.push(bacteria, tardigrades);

    marsBot['bonusResolver'].resolve(invasiveSpecies());

    expect(tardigrades.resourceCount).to.eq(2);
    expect(bacteria.resourceCount).to.eq(3);
  });

  it('breaks a tie by flipping a project card', () => {
    const {game, human, marsBot} = createAutomaGame();
    const birds = new Birds();
    birds.resourceCount = 1;
    const fish = new Fish();
    fish.resourceCount = 1;
    human.playedCards.push(birds, fish);
    game.projectDeck.drawPile.push(new Mine()); // Cost 4 counts to the 2nd of 2

    marsBot['bonusResolver'].resolve(invasiveSpecies());

    expect(birds.resourceCount).to.eq(1);
    expect(fish.resourceCount).to.eq(0);
  });

  it('with Venus Next gains 2 M€ and 1 floater instead of 5 M€', () => {
    const [game] = testGame(1, {automa: true, venusNextExtension: true, boardName: BoardName.THARSIS});
    const marsBot = game.automaHooks!.marsBot;

    marsBot['bonusResolver'].resolve(invasiveSpecies());

    expect(marsBot.turnResolver.megacredits).to.eq(2);
    expect(marsBot.floaters).to.eq(1);
  });

  it('with Colonies and no Venus Next puts the floater in Titan storage', () => {
    const [game] = testGame(1, {
      automa: true, coloniesExtension: true, boardName: BoardName.THARSIS,
      customColoniesList: [ColonyName.TITAN, ColonyName.CERES, ColonyName.LUNA, ColonyName.IO, ColonyName.GANYMEDE],
    });
    const marsBot = game.automaHooks!.marsBot;

    marsBot['bonusResolver'].resolve(invasiveSpecies());

    expect(marsBot.turnResolver.megacredits).to.eq(2);
    expect(marsBot.shippingBoard.storage.get(ColonyName.TITAN)).to.eq(1);
  });

  // Nick, BGG 3341542: without Venus Next and Titan the floater is ignored; the card's 2 M€ stays
  it('with Colonies, no Venus Next and no Titan gains 2 M€ and ignores the floater', () => {
    const [game] = testGame(1, {
      automa: true, coloniesExtension: true, boardName: BoardName.THARSIS,
      customColoniesList: [ColonyName.CALLISTO, ColonyName.CERES, ColonyName.LUNA, ColonyName.IO, ColonyName.GANYMEDE],
    });
    const marsBot = game.automaHooks!.marsBot;

    marsBot['bonusResolver'].resolve(invasiveSpecies());

    expect(marsBot.turnResolver.megacredits).to.eq(2);
    expect(marsBot.shippingBoard.storage.get(ColonyName.TITAN) ?? 0).to.eq(0);
  });
});
