import {expect} from 'chai';
import {PLAYER_COLORS, PLAYER_COLOR_LABELS} from '../../src/common/Color';

describe('Color', () => {
  it('labels exactly the player colors', () => {
    expect(Object.keys(PLAYER_COLOR_LABELS).sort()).deep.eq([...PLAYER_COLORS].sort());
  });

  it('labels each color by its capitalized id', () => {
    expect(PLAYER_COLOR_LABELS).deep.eq({
      red: 'Red',
      green: 'Green',
      yellow: 'Yellow',
      blue: 'Blue',
      black: 'Black',
      purple: 'Purple',
      orange: 'Orange',
      pink: 'Pink',
      turquoise: 'Turquoise',
      clear: 'Clear',
    });
  });
});
