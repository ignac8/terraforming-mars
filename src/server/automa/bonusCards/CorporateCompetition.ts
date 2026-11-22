import {BonusCardName} from '@/common/automa/BonusCardName';
import {CorporateCompetitionBase} from '@/server/automa/bonusCards/CorporateCompetitionBase';

export class CorporateCompetition extends CorporateCompetitionBase {
  constructor() {
    super(BonusCardName.CORPORATE_COMPETITION);
  }
}
