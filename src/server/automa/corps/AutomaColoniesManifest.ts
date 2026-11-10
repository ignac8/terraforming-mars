import {CardName} from '../../../common/cards/CardName';
import {AutomaManifest} from './AutomaManifest';
import {ARIDOR_MARSBOT_CORP} from './colonies/AridorMarsBot';
import {ARKLIGHT_MARSBOT_CORP} from './colonies/ArklightMarsBot';
import {POLYPHEMOS_MARSBOT_CORP} from './colonies/PolyphemosMarsBot';
import {POSEIDON_MARSBOT_CORP} from './colonies/PoseidonMarsBot';

export const AUTOMA_COLONIES_MANIFEST: AutomaManifest = {
  corps: {
    [CardName.ARIDOR]: ARIDOR_MARSBOT_CORP,
    [CardName.ARKLIGHT]: ARKLIGHT_MARSBOT_CORP,
    [CardName.POLYPHEMOS]: POLYPHEMOS_MARSBOT_CORP,
    [CardName.POSEIDON]: POSEIDON_MARSBOT_CORP,
  },
};
