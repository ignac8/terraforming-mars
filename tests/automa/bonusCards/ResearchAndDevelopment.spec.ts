import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {createBaseBonusCards} from '@/server/automa/bonusCards/MarsBotBonusCards';
import {ResearchAndDevelopment} from '@/server/automa/bonusCards/ResearchAndDevelopment';
import {IProjectCard} from '@/server/cards/IProjectCard';
import {Mine} from '@/server/cards/base/Mine';
import {createAutomaGame} from '../corps/CorpGame';
import {recordingMarsBot} from '../corps/RecordingMarsBot';

describe('ResearchAndDevelopment', () => {
  it('resolves the top project card', () => {
    const played: Array<IProjectCard> = [];
    const {marsBot} = recordingMarsBot({resolveProjectCard: (card) => played.push(card)});
    const mine = new Mine();
    marsBot.game.projectDeck.drawPile.push(mine);

    const destroyed = new ResearchAndDevelopment().resolve(marsBot);

    expect(played).deep.eq([mine]);
    expect(destroyed).is.false;
  });

  it('records cards resolved by Research and Development', () => {
    const {marsBot} = createAutomaGame();
    const rnd = createBaseBonusCards().find((c) => c.id === BonusCardId.B03_RESEARCH_AND_DEVELOPMENT)!;

    marsBot['bonusResolver'].resolve(rnd);

    expect(marsBot.playedProjectCards).to.have.length(1);
  });
});
