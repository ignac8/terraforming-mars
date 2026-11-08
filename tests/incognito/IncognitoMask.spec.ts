import {expect} from 'chai';
import {IncognitoMask, incognitoMask, maskModel, maskText, unmaskColor} from '@/server/incognito/IncognitoMask';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {Game} from '@/server/Game';
import {Phase} from '@/common/Phase';
import {Color, PLAYER_COLORS, PLAYER_COLOR_LABELS, PlayerColor} from '@/common/Color';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {InputError} from '@/server/inputs/InputError';
import {AWARD_DETAIL_MESSAGE} from '@/common/game/VictoryPointsBreakdown';

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

  it('undefined when off, at END, or for an id of no seat', () => {
    const [off, offPlayer] = testGame(3);
    expect(incognitoMask(off, offPlayer.id)).is.undefined;

    const [ended, endedPlayer] = testGame(3, {incognito: true, judgeLink: true});
    ended.phase = Phase.END;
    expect(incognitoMask(ended, endedPlayer.id)).is.undefined;
    expect(incognitoMask(ended, ended.spectatorId)).is.undefined;
    expect(incognitoMask(ended, ended.judgeId!)).is.undefined;

    const [judged, judgedPlayer] = testGame(3, {incognito: true, judgeLink: true});
    expect(incognitoMask(judged, 'jnobody')).is.undefined;
    expect(incognitoMask(judged, 'pnobody')).is.undefined;
    expect(incognitoMask(judged, judgedPlayer.id)).is.not.undefined;

    const [unjudged] = testGame(3, {incognito: true});
    expect(unjudged.judgeId).is.undefined;
    expect(incognitoMask(unjudged, 'jnobody')).is.undefined;
  });

  it('judge mask covers every seat, like the spectator\'s', () => {
    const [game, player, player2, player3] = testGame(3, {incognito: true, judgeLink: true});

    const mask = incognitoMask(game, game.judgeId!);

    expect(mask?.colors.size).eq(3);
    expect(new Set(mask?.colors.values()).size).eq(3);
    for (const fake of mask?.colors.values() ?? []) {
      expect(PLAYER_COLORS).includes(fake);
    }
    expect([...(mask?.names.keys() ?? [])]).has.members([player.name, player2.name, player3.name]);
    for (const seat of [player, player2, player3]) {
      const fake = mask?.colors.get(seat.color) as Color;
      expect(mask?.reverse.get(fake)).eq(seat.color);
      expect(mask?.names.get(seat.name)).eq(label(fake));
    }
  });

  it('judge mask is its own mapping, drawn from the judge id', () => {
    const [game] = testGame(3, {incognito: true, judgeLink: true});
    // The mapping is seeded by the viewer's id, so only the id decides which of the 10 colors a seat gets.
    const maskOf = (judgeId: `j${string}`) => {
      game.judgeId = judgeId;
      return incognitoMask(game, judgeId)?.colors;
    };

    const first = maskOf('jfirst');
    const second = maskOf('jsecond');

    expect(first?.size).eq(3);
    expect(first).not.deep.eq(second);
    expect(maskOf('jfirst')).deep.eq(first);
    expect(first).not.deep.eq(incognitoMask(game, game.spectatorId)?.colors);
  });

  it('judge mask is stable across calls and a serialize round trip, and nothing is stored for it', () => {
    const [game] = testGame(3, {incognito: true, judgeLink: true});
    const judgeId = game.judgeId!;

    const mask = incognitoMask(game, judgeId);

    expect(mask).is.not.undefined;
    expect(incognitoMask(game, judgeId)).deep.eq(mask);
    const serialized = game.serialize();
    expect(JSON.stringify(serialized)).does.not.include('"reverse"');
    const restored = Game.deserialize(serialized);
    expect(restored.judgeId).eq(judgeId);
    expect(incognitoMask(restored, judgeId)).deep.eq(mask);
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

    const args = maskModel({message: AWARD_DETAIL_MESSAGE, messageArgs: ['1st', 'Miner', 'Alice']}, mask);
    const text = maskModel({type: LogMessageDataType.STRING, value: 'Alice: 3 / Bob: 1'}, mask);
    const raw = maskModel({type: LogMessageDataType.RAW_STRING, value: 'Alice: 3 / Bob: 1'}, mask);

    expect(args).deep.eq({message: AWARD_DETAIL_MESSAGE, messageArgs: ['1st', 'Miner', fakeAlice]});
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
      awards: [
        {message: AWARD_DETAIL_MESSAGE, messageArgs: ['1st', 'Miner', 'Alice']},
        {message: AWARD_DETAIL_MESSAGE, messageArgs: ['2nd', 'Miner', fakeOfFirst]},
      ],
      log: {type: LogMessageDataType.STRING, value: `Alice: 1 / ${fakeOfFirst}: 2`},
    }, mask);

    expect(fakeFirst).not.eq(fakeSecond);
    expect(masked.players).deep.eq([
      {color: fakeFirst, name: label(fakeFirst)},
      {color: fakeSecond, name: label(fakeSecond)},
    ]);
    expect(masked.awards.map((award) => award.messageArgs[2])).deep.eq([label(fakeFirst), label(fakeSecond)]);
    expect(masked.log.value).eq(`${label(fakeFirst)}: 1 / ${label(fakeSecond)}: 2`);
    expect(maskText(`Alice and ${fakeOfFirst}`, mask)).eq(`${label(fakeFirst)} and ${label(fakeSecond)}`);
    expect(unmaskColor(fakeFirst as Color, mask)).eq(first.color);
    expect(unmaskColor(fakeSecond as Color, mask)).eq(second.color);
  });

  it('maskModel rewrites only the funder of an award detail, so an opponent named like a milestone or award stays out', () => {
    const [game, player, mayor] = testGame(3, {incognito: true});
    mayor.name = 'Mayor';
    const mask = incognitoMask(game, player.id);

    const masked = maskModel({
      detailsMilestones: [{message: 'Claimed ${0} milestone', messageArgs: ['Mayor'], victoryPoint: 5}],
      detailsAwards: [{message: AWARD_DETAIL_MESSAGE, messageArgs: ['1st', 'Mayor', 'Mayor'], victoryPoint: 5}],
    }, mask);

    expect(masked).deep.eq({
      detailsMilestones: [{message: 'Claimed ${0} milestone', messageArgs: ['Mayor'], victoryPoint: 5}],
      detailsAwards: [{message: AWARD_DETAIL_MESSAGE, messageArgs: ['1st', 'Mayor', label(mask?.colors.get(mayor.color))], victoryPoint: 5}],
    });
  });

  it('maskModel labels a playerName by its color, so a shared name keeps the own seat real', () => {
    const [game, player, other] = testGame(3, {incognito: true});
    player.name = 'Alice';
    other.name = 'Alice';
    const mask = incognitoMask(game, player.id);
    const fake = mask?.colors.get(other.color);

    const masked = maskModel({
      milestones: [
        {name: 'Mayor', playerName: 'Alice', color: player.color},
        {name: 'Banker', playerName: 'Alice', color: other.color},
      ],
    }, mask);

    expect(fake).is.not.undefined;
    expect(masked).deep.eq({
      milestones: [
        {name: 'Mayor', playerName: 'Alice', color: player.color},
        {name: 'Banker', playerName: label(fake), color: fake},
      ],
    });
  });

  it('maskModel keeps a playerName next to neutral, and maps one without a color by name', () => {
    const [game, player, alice] = testGame(3, {incognito: true});
    alice.name = 'Alice';
    const mask = incognitoMask(game, player.id);
    const fake = label(mask?.colors.get(alice.color));

    const masked = maskModel({neutral: {playerName: 'Alice', color: 'neutral'}, bare: {playerName: 'Alice'}}, mask);

    expect(masked).deep.eq({neutral: {playerName: 'Alice', color: 'neutral'}, bare: {playerName: fake}});
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
    expect(unmaskColor('NEUTRAL', mask)).eq('NEUTRAL');
    expect(unmaskColor(fake, undefined)).eq(fake);
  });

  it('unmaskColor rejects the real color of an opponent that nobody is shown as', () => {
    const mask: IncognitoMask = {
      colors: new Map<Color, Color>([['red', 'green'], ['yellow', 'purple']]),
      reverse: new Map<Color, Color>([['green', 'red'], ['purple', 'yellow']]),
      names: new Map(),
    };

    expect(() => unmaskColor('red', mask)).to.throw(InputError, 'Unknown player');
    expect(() => unmaskColor('yellow', mask)).to.throw(InputError, 'Unknown player');
    expect(unmaskColor('green', mask)).eq('red');
    expect(unmaskColor('blue', mask)).eq('blue');
    expect(unmaskColor('red', undefined)).eq('red');
  });

  it('unmaskColor maps a real color that is also a fake through the fake', () => {
    const mask: IncognitoMask = {
      colors: new Map<Color, Color>([['red', 'green'], ['yellow', 'red']]),
      reverse: new Map<Color, Color>([['green', 'red'], ['red', 'yellow']]),
      names: new Map(),
    };

    expect(unmaskColor('red', mask)).eq('yellow');
    expect(() => unmaskColor('yellow', mask)).to.throw(InputError, 'Unknown player');
  });
});
