import {expect} from 'chai';
import {Phase} from '@/common/Phase';
import {getAutomaMaxGeneration} from '@/common/automa/AutomaTypes';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {MINING_GUILD_MARSBOT_CORP} from '@/server/automa/corps/base/MiningGuildMarsBot';
import {createAutomaGame, resetCorpRegistry} from '../CorpGame';
import {recordingMarsBot} from '../RecordingMarsBot';

// Track index on the Tharsis board
const BUILDING = 0;

// Our reading: the card ticks for every 10 M€ MarsBot gains (njshaw2, BGG 3553988), so what
// is left of a gain after the card empties comes off the refilled card.
function miningGuild(mcOnCard: number, building: number) {
  const {marsBot} = createAutomaGame();
  marsBot.setCorpAndSetup(getMarsBotCorp(CardName.MINING_GUILD)!);
  marsBot.corpSpecificState.set('mcOnCard', mcOnCard);
  marsBot.marsBotBoard.tracks[0].position = building;
  return marsBot;
}

describe('MiningGuildMarsBot', () => {
  beforeEach(resetCorpRegistry);

  const effect = MINING_GUILD_MARSBOT_CORP.effect!;

  // The M€ MarsBot earns comes off the card, and MarsBot keeps it
  for (const run of [
    {gain: 5, card: 5, advances: 0},
    {mcOnCard: 2, gain: 5, card: 7, advances: 1},
    {mcOnCard: 2, gain: 25, card: 7, advances: 3},
    {mcOnCard: 2, building: 17, gain: 15, card: 10, advances: 1},
  ]) {
    it('counts down from 10, and advances the building track each time the card empties: ' + JSON.stringify(run), () => {
      const {marsBot, calls, corpState} = recordingMarsBot();
      MINING_GUILD_MARSBOT_CORP.setup!(marsBot);
      if (run.mcOnCard !== undefined) {
        corpState.set('mcOnCard', run.mcOnCard);
      }
      marsBot.marsBotBoard.tracks[BUILDING].position = run.building ?? 3;

      effect.onMcGained!(marsBot, run.gain);

      expect(corpState.get('mcOnCard')).eq(run.card);
      expect(calls).deep.eq(Array(run.advances).fill(`advanceTrack(${BUILDING})`));
    });
  }

  it('refills the card before the advance, so the M€ the advance earns comes off the new card', () => {
    const {marsBot, corpState} = recordingMarsBot({advanceTrack: () => effect.onMcGained!(marsBot, 2)});
    corpState.set('mcOnCard', 1);

    effect.onMcGained!(marsBot, 1);

    expect(corpState.get('mcOnCard')).eq(8);
  });

  // Like Philares (BGG 3513998), nothing advances after the game has ended
  it('stops counting down once the game has ended', () => {
    const {marsBot, calls, corpState} = recordingMarsBot();
    marsBot.game.phase = Phase.END;
    corpState.set('mcOnCard', 2);

    effect.onMcGained!(marsBot, 5);

    expect(corpState.get('mcOnCard')).eq(2);
    expect(calls).is.empty;
  });

  it('has 2 Building starting tags', () => {
    const corp = getMarsBotCorp(CardName.MINING_GUILD)!;
    expect(corp.tags).to.deep.eq([Tag.BUILDING, Tag.BUILDING]);
  });

  it('card starts at 10, and the M€ its starting tags earn count down from it', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.MINING_GUILD)!;
    const mcBefore = marsBot.turnResolver.megacredits;
    marsBot.setCorpAndSetup(corp);
    const earned = marsBot.turnResolver.megacredits - mcBefore;
    expect(earned).is.greaterThan(0);
    expect(marsBot.corpSpecificState.get('mcOnCard')).to.eq(10 - earned);
  });

  it('earning M€ counts down the card, bot keeps the earnings', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.MINING_GUILD)!;
    marsBot.setCorpAndSetup(corp);
    marsBot.corpSpecificState.set('mcOnCard', 10);
    // 5 MC earned: card counts down 10 → 5
    corp.effect!.onMcGained!(marsBot, 5);
    expect(marsBot.corpSpecificState.get('mcOnCard')).to.eq(5);
  });

  it('when card empties, refill, advance building track, and take the rest off the refilled card', () => {
    // Tharsis building #3 has no icon
    const marsBot = miningGuild(2, 2);
    marsBot.turnResolver.gainMc(5);
    expect(marsBot.corpSpecificState.get('mcOnCard')).to.eq(7);
    expect(marsBot.marsBotBoard.tracks[0].position).to.eq(3);
  });

  it('a gain that empties the card several times advances once per emptying', () => {
    // Tharsis building #3 and #4 have no icon, #5 gives TR
    const marsBot = miningGuild(2, 2);
    marsBot.turnResolver.gainMc(25);
    expect(marsBot.corpSpecificState.get('mcOnCard')).to.eq(7);
    expect(marsBot.marsBotBoard.tracks[0].position).to.eq(5);
  });

  it('stops once the building track reaches #18', () => {
    const marsBot = miningGuild(2, 17);
    marsBot.turnResolver.gainMc(15);
    expect(marsBot.corpSpecificState.get('mcOnCard')).to.eq(10);
    expect(marsBot.marsBotBoard.tracks[0].position).to.eq(18);
  });

  // Our reading, like Philares (TDaver, BGG 3513998): nothing advances after the game has ended
  it('stops counting down once the game has ended, after the final production', () => {
    const marsBot = miningGuild(2, 2);
    marsBot.game.generation = getAutomaMaxGeneration(marsBot.game.gameOptions.preludeExtension, marsBot.game.gameOptions.boardName);
    marsBot.game.phase = Phase.PRODUCTION;
    expect(marsBot.game.isDoneWithFinalProduction()).is.true;
    const mc = marsBot.turnResolver.megacredits;

    marsBot.turnResolver.gainMc(5);

    expect(marsBot.turnResolver.megacredits).to.eq(mc + 5);
    expect(marsBot.corpSpecificState.get('mcOnCard')).to.eq(2);
    expect(marsBot.marsBotBoard.tracks[0].position).to.eq(2);
  });

  it('takes the M€ the building track advance earns off the refilled card', () => {
    // Tharsis building #2 places an ocean, which pays M€
    const marsBot = miningGuild(1, 1);
    const mc = marsBot.turnResolver.megacredits;
    marsBot.turnResolver.gainMc(1);
    const earnedByAdvance = marsBot.turnResolver.megacredits - mc - 1;
    expect(earnedByAdvance).is.greaterThan(0);
    expect(marsBot.corpSpecificState.get('mcOnCard')).to.eq(10 - earnedByAdvance);
  });

  // Corp hook wiring
  it('counts down through turnResolver.gainMc', () => {
    const {marsBot} = createAutomaGame();
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.MINING_GUILD)!);
    marsBot.corpSpecificState.set('mcOnCard', 10);
    const mcBefore = marsBot.turnResolver.megacredits;
    marsBot.turnResolver.gainMc(4);
    expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 4);
    expect(marsBot.corpSpecificState.get('mcOnCard')).to.eq(6);
  });
});
