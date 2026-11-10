import {expect} from 'chai';
import {GlobalParameter} from '@/common/GlobalParameter';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {BoardName} from '@/common/boards/BoardName';
import {CardName} from '@/common/cards/CardName';
import {createBonusCard} from '@/server/automa/MarsBotBonusCard';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {PRISTAR_MARSBOT_CORP} from '@/server/automa/corps/turmoil/PristarMarsBot';
import {testGame} from '../../../TestGame';
import {setTemperature, setVenusScaleLevel} from '../../../TestingUtils';
import {createAutomaGame, resetCorpRegistry} from '../CorpGame';
import {recordingMarsBot} from '../RecordingMarsBot';

// A 2-step raise resolves one step at a time, so Pristar's cube cancels only the first step
// (BGG threads 3431297 and 3432237, TDaver)
function pristarGame(venus: boolean = false) {
  const [game] = testGame(1, {automa: true, venusNextExtension: venus, boardName: BoardName.THARSIS});
  const marsBot = game.automaHooks!.marsBot;
  marsBot.setCorpAndSetup(getMarsBotCorp(CardName.PRISTAR)!);
  marsBot.corpSpecificState.set('whiteCubeOnCard', 1);
  return {game, marsBot, tr: marsBot.player.terraformRating, mc: marsBot.turnResolver.megacredits};
}

// C36
describe('PristarMarsBot', () => {
  beforeEach(resetCorpRegistry);

  it('skips the first raise of a global parameter for 1 TR and 6 M€, and lets the next one through', () => {
    const {marsBot, calls, corpState} = recordingMarsBot();
    const effect = PRISTAR_MARSBOT_CORP.effect!;
    corpState.set('whiteCubeOnCard', 1);

    expect(effect.interceptGlobalParameterRaise!(marsBot, GlobalParameter.TEMPERATURE)).is.true;
    expect(corpState.get('whiteCubeOnCard')).eq(0);
    expect(calls).deep.eq(['raiseTR(1)', 'gainMc(6)']);

    expect(effect.interceptGlobalParameterRaise!(marsBot, GlobalParameter.OXYGEN)).is.false;
    expect(calls).deep.eq(['raiseTR(1)', 'gainMc(6)']);
  });

  it('puts the cube back before the action phase', () => {
    const {marsBot, corpState} = recordingMarsBot();
    corpState.set('whiteCubeOnCard', 0);

    PRISTAR_MARSBOT_CORP.beforeActionPhase!(marsBot);

    expect(corpState.get('whiteCubeOnCard')).eq(1);
  });

  it('intercepts parameter raise when white cube on card', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.PRISTAR)!;
    marsBot.setCorpAndSetup(corp);
    marsBot.corpSpecificState.set('whiteCubeOnCard', 1);
    const trBefore = marsBot.player.terraformRating;
    const mcBefore = marsBot.turnResolver.megacredits;
    const skip = corp.effect!.interceptGlobalParameterRaise!(marsBot, GlobalParameter.TEMPERATURE);
    expect(skip).to.be.true;
    expect(marsBot.corpSpecificState.get('whiteCubeOnCard')).to.eq(0);
    expect(marsBot.player.terraformRating).to.eq(trBefore + 1);
    expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 6);
  });

  it('does not intercept without white cube', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.PRISTAR)!;
    marsBot.setCorpAndSetup(corp);
    marsBot.corpSpecificState.set('whiteCubeOnCard', 0);
    const skip = corp.effect!.interceptGlobalParameterRaise!(marsBot, GlobalParameter.TEMPERATURE);
    expect(skip).to.be.false;
  });

  it('per-gen adds white cube when missing', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.PRISTAR)!;
    marsBot.setCorpAndSetup(corp);
    marsBot.corpSpecificState.set('whiteCubeOnCard', 0);
    corp.beforeActionPhase!(marsBot);
    expect(marsBot.corpSpecificState.get('whiteCubeOnCard')).to.eq(1);
  });

  it('on a 2-step raise, temperature2 icon raises the second step', () => {
    const {game, marsBot, tr, mc} = pristarGame();
    setTemperature(game, -30);
    marsBot.turnResolver.raiseTemperature(2);
    expect(game.getTemperature()).to.eq(-28);
    expect(marsBot.player.terraformRating).to.eq(tr + 2);
    expect(marsBot.turnResolver.megacredits).to.eq(mc + 6);
    expect(marsBot.temperatureRaises).to.eq(1);
  });

  it('on a 2-step raise, venus2 icon raises the second step', () => {
    const {game, marsBot, tr} = pristarGame(true);
    (marsBot.turnResolver as any).raiseVenus(2);
    expect(game.getVenusScaleLevel()).to.eq(2);
    expect(marsBot.player.terraformRating).to.eq(tr + 2);
  });

  it('on a 2-step raise, Lobbyists temperature branch raises the second step', () => {
    const {game, marsBot, tr} = pristarGame();
    setTemperature(game, -28);
    marsBot.resolveBonusCard(BonusCardId.B06_LOBBYISTS);
    expect(game.getTemperature()).to.eq(-26);
    expect(marsBot.player.terraformRating).to.eq(tr + 2);
  });

  it('on a 2-step raise, Lobbyists (Venus) Venus branch raises the second step', () => {
    const {game, marsBot, tr} = pristarGame(true);
    setVenusScaleLevel(game, 4);
    marsBot.resolveBonusCard(BonusCardId.B15_LOBBYISTS_VENUS);
    expect(game.getVenusScaleLevel()).to.eq(6);
    expect(marsBot.player.terraformRating).to.eq(tr + 2);
  });

  // Corp hook wiring
  it('cube intercepts the bot ocean placement', () => {
    const {game, marsBot} = createAutomaGame();
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.PRISTAR)!);
    marsBot.corpSpecificState.set('whiteCubeOnCard', 1);
    const oceansBefore = game.board.getOceanSpaces().length;
    const trBefore = marsBot.player.terraformRating;
    const mcBefore = marsBot.turnResolver.megacredits;
    marsBot.turnResolver.placeOcean();
    expect(game.board.getOceanSpaces().length).to.eq(oceansBefore);
    expect(marsBot.player.terraformRating).to.eq(trBefore + 1);
    expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 6);
    expect(marsBot.corpSpecificState.get('whiteCubeOnCard')).to.eq(0);
  });

  it('without a cube lets the bot ocean placement through', () => {
    const {game, marsBot} = createAutomaGame();
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.PRISTAR)!);
    marsBot.corpSpecificState.set('whiteCubeOnCard', 0);
    const oceansBefore = game.board.getOceanSpaces().length;
    marsBot.turnResolver.placeOcean();
    expect(game.board.getOceanSpaces().length).to.eq(oceansBefore + 1);
  });

  it('is not triggered by Government Intervention (FAQ)', () => {
    const {game, marsBot} = createAutomaGame();
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.PRISTAR)!);
    marsBot.corpSpecificState.set('whiteCubeOnCard', 1);
    (game as any).generation = 2; // even generation → furthest-parameter branch
    marsBot['bonusResolver'].resolveEffect(createBonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION));
    expect(marsBot.corpSpecificState.get('whiteCubeOnCard')).to.eq(1);
  });
});
