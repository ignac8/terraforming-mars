import {Message} from '../../common/logs/Message';
import {BasePlayerInput} from '../PlayerInput';
import {IPlayer} from '../IPlayer';
import {InputResponse, isSelectPlayerResponse} from '../../common/inputs/InputResponse';
import {SelectPlayerModel} from '../../common/models/PlayerInputModel';
import {ColorWithNeutral} from '../../common/Color';
import {InputError} from './InputError';
import {incognitoMask, unmaskColor} from '../incognito/IncognitoMask';

const NOT_AVAILABLE = 'Player not available';

export class SelectPlayer extends BasePlayerInput<IPlayer> {
  constructor(public players: ReadonlyArray<IPlayer>, title: string | Message, buttonLabel: string = 'Save') {
    super('player', title);
    this.buttonLabel = buttonLabel;
  }

  public override toModel(): SelectPlayerModel {
    return {
      title: this.title,
      buttonLabel: this.buttonLabel,
      type: 'player',
      players: this.players.map((player) => player.color),
    };
  }

  public process(input: InputResponse, viewer: IPlayer) {
    if (!isSelectPlayerResponse(input)) {
      throw new InputError('Not a valid SelectPlayerResponse');
    }
    // In an incognito game the answer holds the color that the player was shown.
    let color: ColorWithNeutral;
    try {
      color = unmaskColor(input.player, incognitoMask(viewer.game, viewer.id));
    } catch {
      // A color that was never shown is refused like any other that is not among the players.
      throw new InputError(NOT_AVAILABLE);
    }
    const foundPlayer = this.players.find((player) => player.color === color);
    if (foundPlayer === undefined) {
      throw new InputError(NOT_AVAILABLE);
    }
    return this.cb(foundPlayer);
  }
}
