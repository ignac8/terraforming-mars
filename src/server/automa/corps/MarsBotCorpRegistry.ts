import {MarsBotCorpId, IMarsBotCorp} from '../../../common/automa/MarsBotCorpTypes';

const ALL_MARSBOT_CORPS: Map<MarsBotCorpId, IMarsBotCorp> = new Map();

export function registerMarsBotCorp(corp: IMarsBotCorp): void {
  if (ALL_MARSBOT_CORPS.has(corp.id)) {
    throw new Error(`MarsBot corp ${corp.id} is already registered`);
  }
  ALL_MARSBOT_CORPS.set(corp.id, corp);
}

export function getMarsBotCorp(id: string): IMarsBotCorp | undefined {
  return ALL_MARSBOT_CORPS.get(id as MarsBotCorpId);
}

export function getAllMarsBotCorps(): ReadonlyArray<IMarsBotCorp> {
  return Array.from(ALL_MARSBOT_CORPS.values());
}

/** Clear registry (for testing). */
export function clearMarsBotCorpRegistry(): void {
  ALL_MARSBOT_CORPS.clear();
}
