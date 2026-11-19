import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {createBaseBonusCards} from '@/server/automa/MarsBotBonusCard';
import {createAutomaGame} from '../corps/CorpGame';

describe('ResearchAndDevelopmentMarsBot', () => {
  it('records cards resolved by Research and Development', () => {
    const {marsBot} = createAutomaGame();
    const rnd = createBaseBonusCards().find((c) => c.id === BonusCardId.B03_RESEARCH_AND_DEVELOPMENT)!;

    marsBot['bonusResolver'].resolve(rnd);

    expect(marsBot.playedProjectCards).to.have.length(1);
  });
});
