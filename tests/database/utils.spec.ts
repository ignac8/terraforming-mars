import {expect} from 'chai';
import {DEFAULT_COMPRESS_COMPLETED_GAMES_DAYS} from '../../src/server/database/utils';

describe('database utils', () => {
  it('compresses completed games 14 days after they end by default', () => {
    expect(DEFAULT_COMPRESS_COMPLETED_GAMES_DAYS).eq('14');
  });
});
