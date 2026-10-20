import {ALL_TAGS} from '../../common/cards/Tag';

// Bonus and policy descriptions are plain text, since they are also shown in option titles, tooltips
// and the agenda help, none of which render icons. This converts one to markdown shortcodes for the log.

const RESOURCE = 'steel|titanium|plants?|energy|heat';
const TAG = ALL_TAGS.join('|');

const TAG_LIST = new RegExp(`\\b((?:${TAG})(?:(?:, | and | or )(?:${TAG}))*) tags?\\b`, 'gi');
const TAG_NAME = new RegExp(`\\b(${TAG})\\b`, 'gi');
const PRODUCTION = new RegExp(`\\b((?:${RESOURCE})(?: and (?:${RESOURCE}))*) production\\b`, 'g');
const RESOURCE_NAME = new RegExp(`\\b(${RESOURCE})\\b`, 'g');
const RESOURCE_AMOUNT = new RegExp(`(\\d+) (${RESOURCE})\\b`, 'g');
const RESOURCE_UNITS = /\b(steel|titanium) resources\b/g;

function resourceName(name: string): string {
  return name === 'plant' ? 'plants' : name;
}

export function descriptionWithIcons(description: string): string {
  return description
    .replace(TAG_LIST, (_match, tags: string) =>
      tags.replace(TAG_NAME, (tag) => `:tag:${tag.toLowerCase()}:`))
    .replace(/M€ production\b/g, ':p:megacredits:')
    .replace(PRODUCTION, (_match, resources: string) =>
      resources.replace(RESOURCE_NAME, (name) => `:p:${resourceName(name)}:`))
    .replace(/(\d+) M€/g, '$1:r:megacredits:')
    .replace(RESOURCE_AMOUNT, (_match, amount: string, name: string) => `${amount}:r:${resourceName(name)}:`)
    .replace(RESOURCE_UNITS, (_match, name: string) => `:r:${name}: resources`)
    .replace(/(\d+) microbes\b/g, '$1:cr:microbe:')
    .replace(/(\d+) floaters\b/g, '$1:cr:floater:')
    .replace(/(\d+) TR\b/g, '$1:icon:tr:')
    .replace(/\bTR\b/g, ':icon:tr:');
}
