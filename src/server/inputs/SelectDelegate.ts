import {Message} from '../../common/logs/Message';
import {BasePlayerInput} from '../PlayerInput';
import {IPlayer} from '../IPlayer';
import {NeutralPlayer} from '../turmoil/Turmoil';
import {InputResponse, isSelectDelegateResponse} from '../../common/inputs/InputResponse';
import {SelectDelegateModel} from '../../common/models/PlayerInputModel';
import {InputError} from './InputError';
import {incognitoMask, unmaskColor} from '../incognito/IncognitoMask';

export class SelectDelegate extends BasePlayerInput<IPlayer | NeutralPlayer> {
  constructor(
    public players: ReadonlyArray<IPlayer | NeutralPlayer>,
    title: string | Message) {
    super('delegate', title);
  }

  public override toModel(): SelectDelegateModel {
    return {
      type: 'delegate',
      title: this.title,
      buttonLabel: this.buttonLabel,
      players: this.players.map((player) => player === 'NEUTRAL' ? 'NEUTRAL' : player.color),
    };
  }

  public process(input: InputResponse, viewer: IPlayer) {
    if (!isSelectDelegateResponse(input)) {
      throw new InputError('Not a valid SelectDelegateResponse');
    }
    // In an incognito game the answer holds the color that the player was shown.
    const color = unmaskColor(input.player, incognitoMask(viewer.game, viewer.id));
    for (const player of this.players) {
      if (player === 'NEUTRAL') {
        if (color !== 'NEUTRAL') {
          continue;
        }
      } else {
        if (color !== player.color) {
          continue;
        }
      }
      return this.cb(player);
    }
    throw new InputError('Player not available');
  }
}
