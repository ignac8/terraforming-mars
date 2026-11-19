import {expect} from 'chai';
import {MARSBOT_BOARD_NAMES} from '../../src/common/automa/MarsBotBoards';
import {marsBotCanPlayGoal} from '../../src/common/automa/MarsBotGoals';
import {BoardName} from '../../src/common/boards/BoardName';
import {awardNames} from '../../src/common/ma/AwardName';
import {milestoneNames} from '../../src/common/ma/MilestoneName';
import {AutomaGameSetup} from '../../src/server/automa/AutomaGameSetup';
import {marsBotAwardNeeds, marsBotMilestoneNeeds} from '../../src/server/automa/marsBotGoalNeeds';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../src/server/game/GameOptions';

describe('marsBotGoalNeeds', () => {
  for (const run of [
    {name: 'Mayor', expected: []},
    {name: 'Tradesman', expected: ['venus']},
    {name: 'Lobbyist', expected: ['turmoil']},
    {name: 'Merchant3', expected: ['amazonisPlanitia']},
    {name: 'Networker', expected: undefined},
  ] as const) {
    it('milestone: ' + JSON.stringify(run), () => {
      expect(marsBotMilestoneNeeds(run.name)).deep.eq(run.expected);
    });
  }

  for (const run of [
    {name: 'Banker', expected: []},
    {name: 'Venuphile', expected: ['venus']},
    {name: 'Innovator', expected: ['amazonisPlanitia']},
    {name: 'Entrepreneur', expected: undefined},
  ] as const) {
    it('award: ' + JSON.stringify(run), () => {
      expect(marsBotAwardNeeds(run.name)).deep.eq(run.expected);
    });
  }

  // The create game form decides from the needs, the server from AutomaGameSetup. They have to agree in every game.
  for (const venus of [false, true]) {
    for (const turmoil of [false, true]) {
      for (const board of MARSBOT_BOARD_NAMES) {
        const run = {venus, turmoil, board};
        const options: GameOptions = {
          ...DEFAULT_GAME_OPTIONS,
          venusNextExtension: venus,
          turmoilExtension: turmoil,
          boardName: board,
          modularMA: false,
        };
        const game = {venus, turmoil, boards: [board]};

        it('matches the milestones the server accepts: ' + JSON.stringify(run), () => {
          const fromNeeds = milestoneNames.filter((name) => marsBotCanPlayGoal(marsBotMilestoneNeeds(name), game));
          expect(fromNeeds).deep.eq(milestoneNames.filter((name) => AutomaGameSetup.supportsMilestone(name, options)));
        });

        it('matches the awards the server accepts: ' + JSON.stringify(run), () => {
          const fromNeeds = awardNames.filter((name) => marsBotCanPlayGoal(marsBotAwardNeeds(name), game));
          expect(fromNeeds).deep.eq(awardNames.filter((name) => AutomaGameSetup.supportsAward(name, options)));
        });
      }
    }
  }
});

describe('marsBotCanPlayGoal', () => {
  it('counts a map it needs as there when the map is drawn from several', () => {
    const game = {venus: false, turmoil: false, boards: [BoardName.THARSIS, BoardName.AMAZONIS_PLANITIA]};
    expect(marsBotCanPlayGoal(['amazonisPlanitia'], game)).is.true;
    expect(marsBotCanPlayGoal(['amazonisPlanitia'], {...game, boards: [BoardName.THARSIS, BoardName.HELLAS]})).is.false;
  });
});
