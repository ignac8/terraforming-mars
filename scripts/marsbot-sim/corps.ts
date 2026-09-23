import {CardName} from '../../src/common/cards/CardName';
import {AUTOMA_BASE_MANIFEST} from '../../src/server/automa/corps/AutomaBaseManifest';

/** The 12 base-game + Corporate Era corporations the scripted player can start with. */
export const HUMAN_CORPS: ReadonlyArray<CardName> = [
  CardName.CREDICOR, CardName.ECOLINE, CardName.HELION, CardName.INTERPLANETARY_CINEMATICS,
  CardName.INVENTRIX, CardName.MINING_GUILD, CardName.PHOBOLOG, CardName.SATURN_SYSTEMS,
  CardName.TERACTOR, CardName.THARSIS_REPUBLIC, CardName.THORGATE, CardName.UNITED_NATIONS_MARS_INITIATIVE,
];

/** MarsBot's 12 base-game corporations from Rulebook B (C01-C12). */
export const BOT_BASE_CORPS: ReadonlyArray<CardName> = Object.keys(AUTOMA_BASE_MANIFEST.corps) as Array<CardName>;
