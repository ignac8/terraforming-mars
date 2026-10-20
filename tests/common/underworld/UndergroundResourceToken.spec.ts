import {expect} from 'chai';
import {
  UNDERGROUND_RESOURCE_TOKENS,
  undergroundResourceTokenDescription,
  undergroundResourceTokenMarkdown,
} from '../../../src/common/underworld/UndergroundResourceToken';

describe('UndergroundResourceToken', () => {
  it('describes every token in plain text and markdown', () => {
    expect(Object.keys(undergroundResourceTokenMarkdown)).to.have.members([...UNDERGROUND_RESOURCE_TOKENS]);
    expect(Object.keys(undergroundResourceTokenDescription)).to.have.members([...UNDERGROUND_RESOURCE_TOKENS]);
  });

  it('markdown only uses shortcode kinds that exist', () => {
    const kinds = new Set(['r', 'p', 'cr', 'tag', 'icon']);
    for (const token of UNDERGROUND_RESOURCE_TOKENS) {
      for (const match of undergroundResourceTokenMarkdown[token].matchAll(/:([a-z]+):[a-zA-Z0-9-]+:/g)) {
        expect(kinds.has(match[1]), `${token}: ${match[0]}`).is.true;
      }
    }
  });

  it('plain descriptions have no shortcodes, since menus cannot render them', () => {
    for (const token of UNDERGROUND_RESOURCE_TOKENS) {
      expect(undergroundResourceTokenDescription[token], token).does.not.match(/:[a-z]+:[a-zA-Z0-9-]+:/);
    }
  });
});
