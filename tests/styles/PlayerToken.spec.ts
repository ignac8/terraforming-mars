import {expect} from 'chai';
import fs from 'fs';
import less from 'less';
import {Color, PLAYER_COLORS} from '@/common/Color';

describe('player-token', () => {
  it('has a token for every color the server can send as a delegate', async () => {
    const filename = 'src/styles/common.less';
    const output = await less.render(fs.readFileSync(filename, 'utf8'), {filename});
    const colors: ReadonlyArray<Color> = [...PLAYER_COLORS, 'neutral', 'bronze'];
    for (const color of colors) {
      expect(output.css, color).to.include(`.player-token.${color} {`);
    }
  });
});
