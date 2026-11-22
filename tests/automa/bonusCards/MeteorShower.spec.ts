import {expect} from 'chai';
import {BonusCardName} from '@/common/automa/BonusCardName';
import {createBonusCard} from '@/server/automa/bonusCards/MarsBotBonusCards';
import {ProtectedHabitats} from '@/server/cards/base/ProtectedHabitats';
import {AsteroidDeflectionSystem} from '@/server/cards/promo/AsteroidDeflectionSystem';
import {MeteorShower} from '@/server/automa/bonusCards/MeteorShower';
import {testGame} from '../../TestGame';
import {createAutomaGame} from '../corps/CorpGame';
import {recordingMarsBot} from '../corps/RecordingMarsBot';

describe('MeteorShower', () => {
  for (const run of [
    {plants: 2, expected: {plantsLeft: 0, destroyed: false}},
    {plants: 3, expected: {plantsLeft: 0, destroyed: true}},
    {plants: 7, expected: {plantsLeft: 2, destroyed: true}},
  ] as const) {
    it('removes up to 5 plants and is destroyed once 3 are lost: ' + JSON.stringify(run), () => {
      const [game, human, botPlayer] = testGame(2);
      const {marsBot} = recordingMarsBot({game, player: botPlayer, humanPlayer: human});
      human.plants = run.plants;

      const destroyed = new MeteorShower().resolve(marsBot);

      expect(human.plants).eq(run.expected.plantsLeft);
      expect(destroyed).eq(run.expected.destroyed);
    });
  }

  it('is destroyed without removing plants when they are protected', () => {
    const [game, human, botPlayer] = testGame(2);
    const {marsBot} = recordingMarsBot({game, player: botPlayer, humanPlayer: human});
    human.plants = 10;
    human.playedCards.push(new ProtectedHabitats());

    const destroyed = new MeteorShower().resolve(marsBot);

    expect(human.plants).eq(10);
    expect(destroyed).is.true;
  });

  it('card is NOT destroyed when human loses <3 plants', () => {
    const {human, marsBot} = createAutomaGame();
    human.plants = 2;

    const b01 = createBonusCard(BonusCardName.METEOR_SHOWER);

    const destroyed = marsBot.actionDeck.playBonusCard(b01);

    expect(human.plants).to.eq(0);
    expect(destroyed).to.be.false;
  });

  it('card IS destroyed when human loses >=3 plants', () => {
    const {human, marsBot} = createAutomaGame();
    human.plants = 5;

    const b01 = createBonusCard(BonusCardName.METEOR_SHOWER);

    const destroyed = marsBot.actionDeck.playBonusCard(b01);

    expect(human.plants).to.eq(0);
    expect(destroyed).to.be.true;
  });

  it('is blocked by Asteroid Deflection System, and destroyed without removing plants', () => {
    const {human, marsBot} = createAutomaGame();
    human.plants = 10;
    human.playedCards.push(new AsteroidDeflectionSystem());

    const destroyed = createBonusCard(BonusCardName.METEOR_SHOWER).resolve(marsBot);

    expect(human.plants).to.eq(10);
    expect(destroyed).is.true;
  });
});
