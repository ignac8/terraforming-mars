import {BoardBuilder} from './BoardBuilder';
import {Random} from '../../common/utils/Random';
import {GameOptions} from '../game/GameOptions';
import {MarsBoard} from './MarsBoard';

/**
 * The official Amazonis Planitia "Big Board" edition: a regular hexagon with side 6 (91 spaces,
 * rows [6,7,8,9,10,11,10,9,8,7,6]) and extended global parameter tracks (oceans 11, temperature
 * +14, oxygen 18, Venus 33).
 *
 * NOTE: the exact official ocean / volcanic / placement-bonus layout is TBD. This is a
 * structurally-valid placeholder: tile counts and shape match the official board, but every space
 * has an empty bonus array and the ocean / restricted / volcanic positions are placeholders.
 */
const VENUS_FIELD_VALUES: ReadonlyArray<number> = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 31, 32, 33];

export class AmazonisBigBoard extends MarsBoard {
  public static newInstance(gameOptions: GameOptions, rng: Random): AmazonisBigBoard {
    const builder = new BoardBuilder(gameOptions, rng);

    // Placeholder layout: all spaces have empty bonuses; only the space type matters for now.
    // 12 ocean spaces; two volcanic and the single restricted space are clustered together as a
    // "caldera" zone (y=7) so the centre of the board stays open land rather than a blocked hex.

    // y=0 (6)
    builder.land().ocean().land().land().land().land();
    // y=1 (7)
    builder.ocean().volcanic().land().land().land().land().land();
    // y=2 (8)
    builder.land().land().ocean().land().land().land().land().land();
    // y=3 (9)
    builder.land().land().land().ocean().land().land().land().land().land();
    // y=4 (10)
    builder.land().land().land().land().ocean().land().land().land().land().land();
    // y=5 (11, widest row) — centre space (x=5) is open land
    builder.ocean().land().land().land().land().land().land().land().land().land().ocean();
    // y=6 (10)
    builder.land().land().land().land().land().ocean().land().land().land().land();
    // y=7 (9) — caldera zone: volcanic + restricted adjacent
    builder.land().land().ocean().land().land().volcanic().restricted().land().land();
    // y=8 (8)
    builder.land().land().land().land().ocean().land().land().land();
    // y=9 (7)
    builder.land().land().land().ocean().land().land().land();
    // y=10 (6)
    builder.land().land().ocean().land().land().land();

    // The numbered mars spaces are prefixed with 'a' (e.g. 'a03'..'a93') so they do not collide
    // with the fixed reserved ids the off-board expansion colonies use ('69'..'78'), which fall
    // inside this big board's numeric range. (The Moon board prefixes its spaces 'm##' for the
    // same reason.) build() handles shuffling internally when shuffleMapOption is set.
    const spaces = builder.build([6, 7, 8, 9, 10, 11, 10, 9, 8, 7, 6], 'a');
    return new AmazonisBigBoard(spaces);
  }

  public override get maxOceanTiles(): number {
    return 11;
  }

  public override get maxTemperature(): number {
    return 14;
  }

  public override get maxOxygenLevel(): number {
    return 18;
  }

  public override get maxVenusScale(): number {
    return 33;
  }

  public override get venusFieldValues(): ReadonlyArray<number> {
    return VENUS_FIELD_VALUES;
  }
}
