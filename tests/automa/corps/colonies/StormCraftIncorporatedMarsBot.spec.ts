import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {CardName} from '@/common/cards/CardName';
import {MAX_TEMPERATURE} from '@/common/constants';
import {cast} from '@/common/utils/utils';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {STORMCRAFT_INCORPORATED_MARSBOT_CORP} from '@/server/automa/corps/colonies/StormCraftIncorporatedMarsBot';
import {IProjectCard} from '@/server/cards/IProjectCard';
import {SelectCard} from '@/server/inputs/SelectCard';
import {testGame} from '../../../TestGame';
import {setTemperature} from '../../../TestingUtils';
import {AutomaGame, resetCorpRegistry} from '../CorpGame';
import {recordingMarsBot} from '../RecordingMarsBot';

function createVenusGame(draftVariant: boolean): AutomaGame {
  const [game, human] = testGame(1, {
    automa: true,
    automaDifficulty: 'normal',
    venusNextExtension: true,
    draftVariant,
    boardName: BoardName.THARSIS,
  });
  const marsBot = game.automaHooks!.marsBot;
  marsBot.corp = getMarsBotCorp(CardName.STORMCRAFT_INCORPORATED)!;
  // Hoverlord gone, so MarsBot may spend its floaters on an extra card.
  game.milestones = game.milestones.filter((m) => m.name !== 'Hoverlord');
  marsBot.floaters = 5;
  return {game, human, marsBot};
}

describe('StormCraftIncorporatedMarsBot', () => {
  beforeEach(resetCorpRegistry);

  // The Setup and Round Start boxes (rulebook B p.1, p.3), then the effect
  it('adds a floater at setup and at each round start, and raises the temperature when floaters pay for an extra card', () => {
    const {marsBot, calls} = recordingMarsBot();

    STORMCRAFT_INCORPORATED_MARSBOT_CORP.setup!(marsBot);
    STORMCRAFT_INCORPORATED_MARSBOT_CORP.roundStart!(marsBot);
    STORMCRAFT_INCORPORATED_MARSBOT_CORP.effect!.onFloatersSpentForExtraCard!(marsBot);

    expect(calls).deep.eq(['addFloaters(1)', 'addFloaters(1)', 'raiseTemperature(1)']);
  });

  it('raises the temperature when it spends floaters for an extra card', () => {
    const {game, marsBot} = createVenusGame(false);
    game.generation = 2;
    const temperature = game.getTemperature();

    game.automaHooks!.handleResearchPhase();

    expect(marsBot.floaters).to.eq(1); // 5 + 1 at round start - 5
    expect(game.getTemperature()).to.eq(temperature + 2);
  });

  it('raises the temperature when it spends floaters to keep a 4th drafted card', () => {
    const {game, human, marsBot} = createVenusGame(true);
    const temperature = game.getTemperature();

    game.gotoResearchPhase();
    for (let round = 0; round < 4; round++) {
      const selectCard = cast(human.getWaitingFor(), SelectCard<IProjectCard>);
      selectCard.cb([selectCard.cards[0]]);
    }

    expect(marsBot.floaters).to.eq(1);
    expect(game.getTemperature()).to.eq(temperature + 2);
  });

  it('counts its temperature step among the ones MarsBot raised', () => {
    const {game, marsBot} = createVenusGame(false);
    game.generation = 2;

    game.automaHooks!.handleResearchPhase();

    expect(marsBot.temperatureRaises).to.eq(1);
  });

  it('counts no temperature step once the temperature is maxed', () => {
    const {game, marsBot} = createVenusGame(false);
    setTemperature(game, MAX_TEMPERATURE);
    game.generation = 2;

    game.automaHooks!.handleResearchPhase();

    expect(marsBot.temperatureRaises).to.eq(0);
  });

  it('does not raise the temperature without spending floaters', () => {
    const {game, marsBot} = createVenusGame(false);
    marsBot.floaters = 0;
    game.generation = 2;
    const temperature = game.getTemperature();

    game.automaHooks!.handleResearchPhase();

    expect(game.getTemperature()).to.eq(temperature);
  });
});
