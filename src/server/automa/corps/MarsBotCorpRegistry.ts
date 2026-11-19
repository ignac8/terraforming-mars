import {CardName} from '../../../common/cards/CardName';
import {MarsBotCorp} from '../MarsBotCorp';
import {ALL_AUTOMA_MANIFESTS} from './AllAutomaManifests';

const INITIAL_CORPS: Partial<Record<CardName, MarsBotCorp>> = {};
for (const manifest of ALL_AUTOMA_MANIFESTS) {
  Object.assign(INITIAL_CORPS, manifest.corps);
}

let ALL_MARSBOT_CORPS: Partial<Record<CardName, MarsBotCorp>> = {...INITIAL_CORPS};

export function getMarsBotCorp(name: CardName): MarsBotCorp | undefined {
  return ALL_MARSBOT_CORPS[name];
}

export function getAllMarsBotCorps(): ReadonlyArray<MarsBotCorp> {
  return Object.values(ALL_MARSBOT_CORPS) as ReadonlyArray<MarsBotCorp>;
}

// Test helpers
export function clearMarsBotCorpRegistry(): void {
  ALL_MARSBOT_CORPS = {};
}

export function restoreMarsBotCorpRegistry(): void {
  ALL_MARSBOT_CORPS = {...INITIAL_CORPS};
}

export function registerMarsBotCorp(corp: MarsBotCorp): void {
  ALL_MARSBOT_CORPS[corp.name] = corp;
}
