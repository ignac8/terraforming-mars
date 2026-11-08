import {expect} from 'chai';
import {incognitoMask, maskModel, maskText, unmaskColor} from '@/server/incognito/IncognitoMask';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {Game} from '@/server/Game';
import {Phase} from '@/common/Phase';
import {Color, PLAYER_COLORS, PLAYER_COLOR_LABELS, PlayerColor} from '@/common/Color';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';

function label(color: Color | undefined): string {
  return PLAYER_COLOR_LABELS[color as PlayerColor];
}

describe('IncognitoMask', () => {
  it('opponents get distinct fake colors, own seat untouched', () => {
    const [game, player, player2, player3] = testGame(3, {incognito: true});

    const mask = incognitoMask(game, player.id);

    expect(mask?.colors.size).eq(2);
    expect(mask?.colors.has(player.color)).is.false;
    const fakes = [mask?.colors.get(player2.color), mask?.colors.get(player3.color)];
    expect(new Set(fakes).size).eq(2);
    for (const fake of fakes) {
      expect(PLAYER_COLORS).includes(fake);
      expect(fake).not.eq(player.color);
    }
    expect(mask?.reverse.get(fakes[0] as Color)).eq(player2.color);
    expect(mask?.reverse.get(fakes[1] as Color)).eq(player3.color);
    expect([...(mask?.names.keys() ?? [])]).has.members([player2.name, player3.name]);
  });

  it('spectator mask covers every seat', () => {
    const [game] = testGame(3, {incognito: true});

    const mask = incognitoMask(game, game.spectatorId);

    expect(mask?.colors.size).eq(3);
    expect(new Set(mask?.colors.values()).size).eq(3);
    expect(mask?.names.size).eq(3);
  });

  it('stable across calls and a serialize round trip', () => {
    const [game, player] = testGame(3, {incognito: true});

    const mask = incognitoMask(game, player.id);

    expect(mask).is.not.undefined;
    expect(incognitoMask(game, player.id)).deep.eq(mask);
    const restored = Game.deserialize(game.serialize());
    expect(incognitoMask(restored, player.id)).deep.eq(mask);
  });

  it('different viewers get independent mappings', () => {
    // Only the viewer's id differs between the two games, and the color pools do not.
    const viewerMask = (idSuffix: string) => {
      const viewer = TestPlayer.BLUE.newPlayer({name: 'player1', idSuffix});
      const players = [viewer, TestPlayer.RED.newPlayer({name: 'player2'}), TestPlayer.YELLOW.newPlayer({name: 'player3'})];
      const game = Game.newInstance('game-id', players, viewer, 'spectator-id', {incognito: true});
      return incognitoMask(game, viewer.id);
    };

    const first = viewerMask('-a');
    const second = viewerMask('-b');

    expect(first?.colors.size).eq(2);
    expect(first?.colors).not.deep.eq(second?.colors);
  });

  it('undefined when off, at END, or for the judge id', () => {
    const [off, offPlayer] = testGame(3);
    expect(incognitoMask(off, offPlayer.id)).is.undefined;

    const [ended, endedPlayer] = testGame(3, {incognito: true});
    ended.phase = Phase.END;
    expect(incognitoMask(ended, endedPlayer.id)).is.undefined;
    expect(incognitoMask(ended, ended.spectatorId)).is.undefined;

    const [judged, judgedPlayer] = testGame(3, {incognito: true});
    judged.judgeId = 'jjudge';
    expect(incognitoMask(judged, judged.judgeId)).is.undefined;
    expect(incognitoMask(judged, 'pnobody')).is.undefined;
    expect(incognitoMask(judged, judgedPlayer.id)).is.not.undefined;
  });

  it('maskModel rewrites color keys, PLAYER log data, player names and playerName', () => {
    const [game, player, alice] = testGame(3, {incognito: true});
    alice.name = 'Alice';
    const mask = incognitoMask(game, player.id);
    const fake = mask?.colors.get(alice.color);
    const model = {
      players: [{color: alice.color, name: 'Alice'}],
      spaces: [{color: alice.color}, {color: 'neutral'}, {color: 'bronze'}],
      milestones: [{playerName: 'Alice', color: alice.color}],
      card: {name: 'Ants'},
      log: {data: [
        {type: LogMessageDataType.PLAYER, value: alice.color},
        {type: LogMessageDataType.STRING, value: alice.color},
      ]},
    };
    const original = structuredClone(model);

    const masked = maskModel(model, mask);

    expect(fake).is.not.undefined;
    expect(masked).deep.eq({
      players: [{color: fake, name: label(fake)}],
      spaces: [{color: fake}, {color: 'neutral'}, {color: 'bronze'}],
      milestones: [{playerName: label(fake), color: fake}],
      card: {name: 'Ants'},
      log: {data: [
        {type: LogMessageDataType.PLAYER, value: fake},
        {type: LogMessageDataType.STRING, value: alice.color},
      ]},
    });
    expect(model).deep.eq(original);
  });

  it('maskModel keeps the own seat and rewrites arrays under color keys', () => {
    const [game, player, other] = testGame(3, {incognito: true});
    const mask = incognitoMask(game, player.id);
    const fake = mask?.colors.get(other.color);

    const masked = maskModel({
      passedPlayers: [other.color, player.color],
      thisPlayer: {color: player.color, name: player.name},
    }, mask);

    expect(masked).deep.eq({
      passedPlayers: [fake, player.color],
      thisPlayer: {color: player.color, name: player.name},
    });
  });

  it('maskModel rewrites VP detail args and "name: " runs in message strings', () => {
    const [game, player, alice, bob] = testGame(3, {incognito: true});
    alice.name = 'Alice';
    bob.name = 'Bob';
    const mask = incognitoMask(game, player.id);
    const fakeAlice = label(mask?.colors.get(alice.color));
    const fakeBob = label(mask?.colors.get(bob.color));

    const args = maskModel({messageArgs: ['1st', 'Miner', 'Alice']}, mask);
    const text = maskModel({type: LogMessageDataType.STRING, value: 'Alice: 3 / Bob: 1'}, mask);
    const raw = maskModel({type: LogMessageDataType.RAW_STRING, value: 'Alice: 3 / Bob: 1'}, mask);

    expect(args).deep.eq({messageArgs: ['1st', 'Miner', fakeAlice]});
    expect(text.value).eq(`${fakeAlice}: 3 / ${fakeBob}: 1`);
    expect(raw.value).eq(`${fakeAlice}: 3 / ${fakeBob}: 1`);
  });

  it('maskModel leaves names outside its rules, and a milestone or award name next to a color', () => {
    const [game, player, mayor] = testGame(3, {incognito: true});
    mayor.name = 'Mayor';
    const mask = incognitoMask(game, player.id);
    const fake = mask?.colors.get(mayor.color);

    const masked = maskModel({
      messageArgs: ['Mayor wins'],
      card: {type: LogMessageDataType.CARD, value: 'Mayor: '},
      milestone: {name: 'Mayor', playerName: 'Mayor', color: mayor.color},
      award: {name: 'Banker', color: mayor.color},
    }, mask);

    expect(masked).deep.eq({
      messageArgs: ['Mayor wins'],
      card: {type: LogMessageDataType.CARD, value: 'Mayor: '},
      milestone: {name: 'Mayor', playerName: label(fake), color: fake},
      award: {name: 'Banker', color: fake},
    });
  });

  it('maskModel does not double-map a real name that equals a fake label', () => {
    const [game, player, first, second] = testGame(3, {incognito: true});
    const fakeOfFirst = label(incognitoMask(game, player.id)?.colors.get(first.color));
    first.name = 'Alice';
    second.name = fakeOfFirst;
    const mask = incognitoMask(game, player.id);
    const fakeFirst = mask?.colors.get(first.color);
    const fakeSecond = mask?.colors.get(second.color);

    const masked = maskModel({
      players: [{color: first.color, name: 'Alice'}, {color: second.color, name: fakeOfFirst}],
      messageArgs: ['Alice', fakeOfFirst],
      log: {type: LogMessageDataType.STRING, value: `Alice: 1 / ${fakeOfFirst}: 2`},
    }, mask);

    expect(fakeFirst).not.eq(fakeSecond);
    expect(masked.players).deep.eq([
      {color: fakeFirst, name: label(fakeFirst)},
      {color: fakeSecond, name: label(fakeSecond)},
    ]);
    expect(masked.messageArgs).deep.eq([label(fakeFirst), label(fakeSecond)]);
    expect(masked.log.value).eq(`${label(fakeFirst)}: 1 / ${label(fakeSecond)}: 2`);
    expect(maskText(`Alice and ${fakeOfFirst}`, mask)).eq(`${label(fakeFirst)} and ${label(fakeSecond)}`);
    expect(unmaskColor(fakeFirst as Color, mask)).eq(first.color);
    expect(unmaskColor(fakeSecond as Color, mask)).eq(second.color);
  });

  it('maskModel returns the input itself without a mask', () => {
    const model = {color: 'red', name: 'Alice'};

    expect(maskModel(model, undefined)).eq(model);
  });

  it('maskText replaces opponent names in free text', () => {
    const [game, player, alice] = testGame(3, {incognito: true});
    alice.name = 'Alice';
    const mask = incognitoMask(game, player.id);
    const fake = label(mask?.colors.get(alice.color));

    expect(maskText('This space is land claimed by Alice', mask)).eq(`This space is land claimed by ${fake}`);
    expect(maskText('Alice, Alice\'s tile, Alicetown and SuperAlice', mask)).eq(`${fake}, ${fake}'s tile, Alicetown and SuperAlice`);
  });

  it('maskText leaves text alone for a player with an empty name', () => {
    const [game, player, nameless] = testGame(3, {incognito: true});
    nameless.name = '';
    const mask = incognitoMask(game, player.id);

    expect(maskText('Nothing - to hide', mask)).eq('Nothing - to hide');
  });

  it('maskText keeps the own name, and returns the text itself without a mask', () => {
    const [game, player] = testGame(3, {incognito: true});
    const mask = incognitoMask(game, player.id);

    expect(maskText(`Owned by ${player.name}`, mask)).eq(`Owned by ${player.name}`);
    expect(maskText('Owned by Alice', undefined)).eq('Owned by Alice');
  });

  it('unmaskColor maps a fake color back to the real one and passes other colors through', () => {
    const [game, player, other] = testGame(3, {incognito: true});
    const mask = incognitoMask(game, player.id);
    const fake = mask?.colors.get(other.color) as Color;

    expect(unmaskColor(fake, mask)).eq(other.color);
    expect(unmaskColor(player.color, mask)).eq(player.color);
    expect(unmaskColor('neutral', mask)).eq('neutral');
    expect(unmaskColor(fake, undefined)).eq(fake);
  });
});
