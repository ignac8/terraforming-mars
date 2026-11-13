import {expect} from 'chai';
import {AutomaGameSetup} from '../../src/server/automa/AutomaGameSetup';
import {GameOptions} from '../../src/server/game/GameOptions';
import {awardManifest} from '../../src/server/awards/Awards';
import {milestoneManifest} from '../../src/server/milestones/Milestones';
import {BoardName} from '../../src/common/boards/BoardName';
import {AwardName} from '../../src/common/ma/AwardName';
import {MilestoneName} from '../../src/common/ma/MilestoneName';

const OPTIONS = {venusNextExtension: true, turmoilExtension: true} as GameOptions;
const AMAZONIS_OPTIONS = {...OPTIONS, boardName: BoardName.AMAZONIS_PLANITIA, modularMA: false} as GameOptions;

function supportedMilestones(options: GameOptions): Array<MilestoneName> {
  return (Object.keys(milestoneManifest.all) as Array<MilestoneName>).filter((name) => AutomaGameSetup.supportsMilestone(name, options));
}

function supportedAwards(options: GameOptions): Array<AwardName> {
  return (Object.keys(awardManifest.all) as Array<AwardName>).filter((name) => AutomaGameSetup.supportsAward(name, options));
}

describe('automaDescription', () => {
  it('every milestone and award MarsBot plays against has one', () => {
    for (const name of supportedMilestones(OPTIONS)) {
      expect(milestoneManifest.createOrThrow(name).automaDescription, name).is.a('string');
    }
    for (const name of supportedAwards(OPTIONS)) {
      expect(awardManifest.createOrThrow(name).automaDescription, name).is.a('string');
    }
  });

  it('every milestone and award MarsBot plays against on Amazonis Planitia has one', () => {
    const milestones = supportedMilestones(AMAZONIS_OPTIONS);
    const awards = supportedAwards(AMAZONIS_OPTIONS);

    expect(milestones).to.include('Merchant3');
    expect(awards).to.include.members(['Innovator', 'Physicist']);
    for (const name of milestones) {
      expect(milestoneManifest.createOrThrow(name).automaDescription, name).is.a('string');
    }
    for (const name of awards) {
      expect(awardManifest.createOrThrow(name).automaDescription, name).is.a('string');
    }
  });
});
