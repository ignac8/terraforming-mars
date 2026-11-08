import {expect} from 'chai';
import {shuffleSeats} from '../../src/server/incognito/shuffleSeats';
import {SeededRandom} from '../../src/common/utils/Random';

describe('shuffleSeats', () => {
  const seats = ['a', 'b', 'c', 'd', 'e', 'f'];

  it('returns a permutation of the seats', () => {
    const shuffled = shuffleSeats(seats, new SeededRandom(0.1));

    expect(shuffled).has.length(seats.length);
    expect([...shuffled].sort()).deep.eq(seats);
  });

  it('orders the seats by the random source', () => {
    const first = shuffleSeats(seats, new SeededRandom(0.1));
    const second = shuffleSeats(seats, new SeededRandom(0.2));

    expect(first).not.deep.eq(second);
  });

  it('leaves the input alone', () => {
    const input = [...seats];

    const shuffled = shuffleSeats(input, new SeededRandom(0.1));

    expect(input).deep.eq(seats);
    expect(shuffled).is.not.eq(input);
  });
});
