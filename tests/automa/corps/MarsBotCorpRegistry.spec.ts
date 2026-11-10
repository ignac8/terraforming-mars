import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {getAllMarsBotCorps, getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {resetCorpRegistry} from './CorpGame';

describe('MarsBotCorpRegistry', () => {
  beforeEach(resetCorpRegistry);

  it('all 12 base game corps are registered', () => {
    expect(getMarsBotCorp(CardName.CREDICOR)).to.not.be.undefined;
    expect(getMarsBotCorp(CardName.ECOLINE)).to.not.be.undefined;
    expect(getMarsBotCorp(CardName.HELION)).to.not.be.undefined;
    expect(getMarsBotCorp(CardName.INTERPLANETARY_CINEMATICS)).to.not.be.undefined;
    expect(getMarsBotCorp(CardName.INVENTRIX)).to.not.be.undefined;
    expect(getMarsBotCorp(CardName.MINING_GUILD)).to.not.be.undefined;
    expect(getMarsBotCorp(CardName.PHOBOLOG)).to.not.be.undefined;
    expect(getMarsBotCorp(CardName.SATURN_SYSTEMS)).to.not.be.undefined;
    expect(getMarsBotCorp(CardName.TERACTOR)).to.not.be.undefined;
    expect(getMarsBotCorp(CardName.THARSIS_REPUBLIC)).to.not.be.undefined;
    expect(getMarsBotCorp(CardName.THORGATE)).to.not.be.undefined;
    expect(getMarsBotCorp(CardName.UNITED_NATIONS_MARS_INITIATIVE)).to.not.be.undefined;
  });

  it('corp names match CardName enum', () => {
    expect(getMarsBotCorp(CardName.CREDICOR)!.name).to.eq(CardName.CREDICOR);
    expect(getMarsBotCorp(CardName.SATURN_SYSTEMS)!.name).to.eq(CardName.SATURN_SYSTEMS);
    expect(getMarsBotCorp(CardName.THARSIS_REPUBLIC)!.name).to.eq(CardName.THARSIS_REPUBLIC);
    expect(getMarsBotCorp(CardName.UNITED_NATIONS_MARS_INITIATIVE)!.name).to.eq(CardName.UNITED_NATIONS_MARS_INITIATIVE);
  });

  it('all 46 corps registered (12 base + 34 expansion)', () => {
    expect(getAllMarsBotCorps().length).to.eq(46);
  });
});
