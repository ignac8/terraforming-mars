import {expect} from 'chai';
import {DEFAULT_COMPRESS_COMPLETED_GAMES_DAYS, compressCutoffSeconds, daysAgoToSeconds} from '../../src/server/database/utils';

describe('database utils', () => {
  it('compresses completed games 14 days after they end by default', () => {
    expect(DEFAULT_COMPRESS_COMPLETED_GAMES_DAYS).eq('14');
  });

  describe('compressCutoffSeconds', () => {
    const day = 86400;
    const now = () => Math.round(Date.now() / 1000);

    it('counts back from now', () => {
      expect(compressCutoffSeconds('3')).closeTo(now() - 3 * day, 2);
      expect(compressCutoffSeconds('0')).closeTo(now(), 2);
    });

    for (const invalid of [undefined, '', 'abc', '-5']) {
      it(`falls back to the default for ${JSON.stringify(invalid)}`, () => {
        expect(compressCutoffSeconds(invalid)).closeTo(now() - 14 * day, 2);
      });
    }
  });

  it('daysAgoToSeconds still accepts negative days, which purging uses', () => {
    expect(daysAgoToSeconds('-1', 0)).greaterThan(Math.round(Date.now() / 1000));
  });
});
