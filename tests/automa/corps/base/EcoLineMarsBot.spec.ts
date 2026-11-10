import {expect} from 'chai';
import {Resource} from '@/common/Resource';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {CardName} from '@/common/cards/CardName';
import {Game} from '@/server/Game';
import {MarsBot} from '@/server/automa/MarsBot';
import {createBonusCard} from '@/server/automa/MarsBotBonusCard';
import {MarsBotBonusCard} from '@/server/automa/MarsBotBonusCard';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {ECOLINE_MARSBOT_CORP} from '@/server/automa/corps/base/EcoLineMarsBot';
import {runAllActions} from '../../../TestingUtils';
import {chooseSource, createCorpFaqGame, resetCorpRegistry} from '../CorpGame';
import {createAutomaGame} from '../CorpGame';
import {recordingMarsBot} from '../RecordingMarsBot';

function rapidSprouting(marsBot: MarsBot): void {
  marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B23_RAPID_SPROUTING));
}

describe('EcoLineMarsBot', () => {
  beforeEach(resetCorpRegistry);

  // The start of a generation (rulebook B p.3)
  it('adds Rapid Sprouting to the action deck before the action phase', () => {
    const {marsBot, calls} = recordingMarsBot();

    ECOLINE_MARSBOT_CORP.beforeActionPhase!(marsBot);

    expect(calls).deep.eq(['addBonusCardToActionDeck(B23)']);
  });

  // Corporation FAQ (rulebook B, p.4): the player may destroy or steal the plants on the corporation card
  it('destroys the Ecoline plant, and the excess is lost', () => {
    const {game, human, marsBot} = createCorpFaqGame(CardName.ECOLINE);
    rapidSprouting(marsBot);
    marsBot.turnResolver.megacredits = 20;

    marsBot.player.stock.add(Resource.PLANTS, -3, {from: {player: human}});
    chooseSource(game, human, 0);

    expect(marsBot.getCorpState('plantResources')).eq(0);
    expect(marsBot.turnResolver.megacredits).eq(20);
  });

  // "you can remove either 2mc or that 1 plant. You cannot remove 1 MC and 1 plant" (TDaver, BGG 3341536)
  it('lets the player destroy from the M€ supply instead, leaving the plant', () => {
    const {game, human, marsBot} = createCorpFaqGame(CardName.ECOLINE);
    rapidSprouting(marsBot);
    marsBot.turnResolver.megacredits = 20;

    marsBot.player.stock.add(Resource.PLANTS, -3, {from: {player: human}});
    chooseSource(game, human, 1);

    expect(marsBot.getCorpState('plantResources')).eq(1);
    expect(marsBot.turnResolver.megacredits).eq(17);
  });

  it('takes the plant without asking when the M€ supply is empty', () => {
    const {game, human, marsBot} = createCorpFaqGame(CardName.ECOLINE);
    rapidSprouting(marsBot);

    marsBot.player.stock.add(Resource.PLANTS, -3, {from: {player: human}});
    runAllActions(game);

    expect(human.popWaitingFor()).is.undefined;
    expect(marsBot.getCorpState('plantResources')).eq(0);
  });

  it('Rapid Sprouting spends a plant the player left on Ecoline', () => {
    const {game, marsBot} = createCorpFaqGame(CardName.ECOLINE);
    rapidSprouting(marsBot);
    rapidSprouting(marsBot);

    expect(game.board.getGreeneries(marsBot.player)).has.length(1);
    expect(marsBot.getCorpState('plantResources')).eq(0);
  });

  it('steals the Ecoline plant, and the excess is lost', () => {
    const {game, human, marsBot} = createCorpFaqGame(CardName.ECOLINE);
    rapidSprouting(marsBot);
    marsBot.turnResolver.megacredits = 20;

    marsBot.player.stock.steal(Resource.PLANTS, 3, human);
    chooseSource(game, human, 0);

    expect(human.plants).eq(1);
    expect(marsBot.getCorpState('plantResources')).eq(0);
    expect(marsBot.turnResolver.megacredits).eq(20);
  });

  it('counts the plants on the card for Crash Site Cleanup and Law Suit when the player destroys them', () => {
    const {game, human, marsBot} = createCorpFaqGame(CardName.ECOLINE);
    rapidSprouting(marsBot);
    marsBot.turnResolver.megacredits = 20;

    marsBot.player.stock.add(Resource.PLANTS, -3, {from: {player: human}});
    chooseSource(game, human, 0);

    expect(game.someoneHasRemovedOtherPlayersPlants).is.true;
    expect(marsBot.player.removingPlayers).to.include(human.id);
  });

  it('reads an Ecoline plant from older saves', () => {
    const {game} = createCorpFaqGame(CardName.ECOLINE);
    const serialized = JSON.parse(JSON.stringify(game.serialize()));
    serialized.automaState.corpSpecificState = {plantOnCard: 1};

    const restored = Game.deserialize(serialized).automaHooks!.marsBot;

    expect(restored.getCorpState('plantResources')).eq(1);
    expect(restored.corpSpecificState.has('plantOnCard')).is.false;
  });

  it('adds Rapid Sprouting to the action deck each generation', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.ECOLINE)!;
    marsBot.setCorpAndSetup(corp);

    const deckBefore = marsBot.actionDeck.length;
    corp.beforeActionPhase!(marsBot);
    expect(marsBot.actionDeck.length).to.eq(deckBefore + 1);
    expect(marsBot.actionDeck.map((c) => (c as MarsBotBonusCard).id)).to.include(BonusCardId.B23_RAPID_SPROUTING);
  });
});
