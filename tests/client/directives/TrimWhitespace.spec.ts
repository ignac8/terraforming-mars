import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {defineComponent, h, nextTick, PropType, withDirectives} from 'vue';
import {globalConfig} from '../components/getLocalVue';
import PlayersOverview from '@/client/components/overview/PlayersOverview.vue';
import {trimWhitespace} from '@/client/directives/TrimWhitespace';
import {fakePublicPlayerModel, fakeViewModel} from '../components/testHelpers';
import {PublicPlayerModel, ViewModel} from '@/common/models/PlayerModel';

// PlayerHome and SpectatorHome put the directive on PlayersOverview.
const Host = defineComponent({
  props: {playerView: {type: Object as PropType<ViewModel>, required: true}},
  render() {
    return withDirectives(h(PlayersOverview, {playerView: this.playerView}), [[trimWhitespace]]);
  },
});

function mountOverview(playerView: ViewModel) {
  const errors: Array<unknown> = [];
  const wrapper = mount(Host, {
    global: {
      ...globalConfig.global,
      stubs: {PlayerInfo: true, OtherPlayer: true, OverviewSettings: true},
      config: {...globalConfig.global.config, errorHandler: (err) => errors.push(err)},
    },
    props: {playerView},
  });
  return {wrapper, errors};
}

function colorsOnScreen(wrapper: ReturnType<typeof mountOverview>['wrapper']) {
  const infos = wrapper.findAllComponents({name: 'PlayerInfo'});
  return Array.from(wrapper.element.querySelectorAll('player-info-stub'))
    .map((el) => infos.find((info) => info.element === el)?.props('player').color);
}

describe('trimWhitespace', () => {
  const blue = fakePublicPlayerModel({color: 'blue', name: 'blue'});
  const red = fakePublicPlayerModel({color: 'red', name: 'red'});

  it('removes whitespace between elements and keeps the empty text nodes Vue anchors lists to', () => {
    const div = document.createElement('div');
    div.append(document.createTextNode(' '), document.createElement('span'), document.createTextNode(''), document.createTextNode('\n  '));
    trimWhitespace.mounted(div);
    expect(Array.from(div.childNodes).map((node) => node.nodeName)).deep.eq(['SPAN', '#text']);
  });

  // A spectator's players start with the first player of the generation, so they rotate at every new generation.
  it('lets PlayersOverview reorder the players', async () => {
    const spectator = (players: Array<PublicPlayerModel>) => fakeViewModel({players, thisPlayer: undefined, color: 'neutral'});
    const {wrapper, errors} = mountOverview(spectator([blue, red]));

    await wrapper.setProps({playerView: spectator([red, blue])});
    await nextTick();

    expect(errors).deep.eq([]);
    expect(colorsOnScreen(wrapper)).deep.eq(['red', 'blue']);
  });

  it('lets PlayersOverview change whose view it is', async () => {
    const view = (thisPlayer: PublicPlayerModel) => fakeViewModel({players: [blue, red], thisPlayer, color: thisPlayer.color});
    const {wrapper, errors} = mountOverview(view(red));

    await wrapper.setProps({playerView: view(blue)});
    await nextTick();

    expect(errors).deep.eq([]);
    expect(colorsOnScreen(wrapper)).deep.eq(['red', 'blue']);
  });
});
