import {expect} from 'chai';
import {setTranslationContext, translateMessage} from '@/client/directives/i18n';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Message} from '@/common/logs/Message';

describe('translateMessage', () => {
  const removePlantsFrom = (): Message => ({
    message: 'Remove plants from ${0}',
    data: [{type: LogMessageDataType.PLAYER, value: 'bronze'}],
  });

  it('names MarsBot instead of showing its color', () => {
    setTranslationContext({
      players: [{color: 'blue', name: 'Alice'}],
      game: {marsBot: {name: 'MarsBot', color: 'bronze'}},
    } as unknown as PlayerViewModel);

    expect(translateMessage(removePlantsFrom())).eq('Remove plants from MarsBot');
  });

  it('names human players', () => {
    setTranslationContext({
      players: [{color: 'blue', name: 'Alice'}],
      game: {marsBot: undefined},
    } as unknown as PlayerViewModel);

    expect(translateMessage({
      message: 'Remove plants from ${0}',
      data: [{type: LogMessageDataType.PLAYER, value: 'blue'}],
    })).eq('Remove plants from Alice');
  });
});
