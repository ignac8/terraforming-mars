import {expect} from 'chai';
import {AutomaGameSetup} from '../../src/server/automa/AutomaGameSetup';
import {GameOptions} from '../../src/server/game/GameOptions';
import {awardManifest} from '../../src/server/awards/Awards';
import {milestoneManifest} from '../../src/server/milestones/Milestones';
import {AwardName} from '../../src/common/ma/AwardName';
import {MilestoneName} from '../../src/common/ma/MilestoneName';

describe('automaDescription', () => {
  it('every milestone and award MarsBot plays against has one', () => {
    const options = {venusNextExtension: true, turmoilExtension: true} as GameOptions;
    for (const name of Object.keys(milestoneManifest.all) as Array<MilestoneName>) {
      if (AutomaGameSetup.supportsMilestone(name, options)) {
        expect(milestoneManifest.createOrThrow(name).automaDescription, name).is.a('string');
      }
    }
    for (const name of Object.keys(awardManifest.all) as Array<AwardName>) {
      if (AutomaGameSetup.supportsAward(name, options)) {
        expect(awardManifest.createOrThrow(name).automaDescription, name).is.a('string');
      }
    }
  });
});
