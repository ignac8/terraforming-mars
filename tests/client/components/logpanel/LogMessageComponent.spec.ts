import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import LogMessageComponent from '@/client/components/logpanel/LogMessageComponent.vue';
import {fakePublicPlayerModel, fakeViewModel} from '../testHelpers';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageType} from '@/common/logs/LogMessageType';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {CardName} from '@/common/cards/CardName';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import {Resource} from '@/common/Resource';
import {CardResource} from '@/common/CardResource';
import {playerColorClass} from '@/common/utils/utils';
import {UndergroundResourceToken} from '@/common/underworld/UndergroundResourceToken';

describe('LogMessageComponent', () => {
  it('mounts without errors', () => {
    const wrapper = shallowMount(LogMessageComponent, {
      ...globalConfig,
      props: {
        message: new LogMessage(LogMessageType.DEFAULT, 'Test message', []),
        viewModel: fakeViewModel(),
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('marks a line that has an owner with the owner color', () => {
    const message = new LogMessage(LogMessageType.DEFAULT, 'Test message', []);
    message.owner = 'red';
    const wrapper = shallowMount(LogMessageComponent, {
      ...globalConfig,
      props: {message, viewModel: fakeViewModel()},
    });

    expect(wrapper.find('li > .' + playerColorClass('red', 'bg')).exists()).is.true;
  });

  it('names the owner on the owner marker', () => {
    const message = new LogMessage(LogMessageType.DEFAULT, 'Test message', []);
    message.owner = 'red';
    const players = [
      fakePublicPlayerModel({color: 'blue', name: 'Bob'}),
      fakePublicPlayerModel({color: 'red', name: 'Alice'}),
    ];
    const wrapper = shallowMount(LogMessageComponent, {
      ...globalConfig,
      props: {message, viewModel: fakeViewModel({players})},
    });

    expect(wrapper.find('.log-owner').attributes('title')).to.equal('Alice');
  });

  it('shows the chat icon on an owned line and the clock on a system line', () => {
    const owned = new LogMessage(LogMessageType.DEFAULT, 'Test message', []);
    owned.owner = 'red';
    const system = new LogMessage(LogMessageType.DEFAULT, 'Test message', []);
    const iconOf = (message: LogMessage) => shallowMount(LogMessageComponent, {
      ...globalConfig,
      props: {message, viewModel: fakeViewModel()},
    }).findAll('li > span[title]').at(-1)!.text();

    expect(iconOf(owned)).to.equal('\u{1f4ac}');
    expect(iconOf(system)).to.equal('\u{1f551}');
  });

  it('renders no owner marker on a line without an owner', () => {
    const wrapper = shallowMount(LogMessageComponent, {
      ...globalConfig,
      props: {
        message: new LogMessage(LogMessageType.DEFAULT, 'Test message', []),
        viewModel: fakeViewModel(),
      },
    });

    expect(wrapper.find('.log-owner').exists()).is.false;
    expect(wrapper.find('[class*="player_bg_color_"]').exists()).is.false;
  });

  it('renders CARD type as a single card span', () => {
    const message = new LogMessage(LogMessageType.DEFAULT, '${0}', [
      {type: LogMessageDataType.CARD, value: CardName.ANTS},
    ]);
    const wrapper = shallowMount(LogMessageComponent, {
      ...globalConfig,
      props: {
        message,
        viewModel: fakeViewModel(),
      },
    });

    const cardContainer = wrapper.find('.log-card').element.parentElement!;
    expect(cardContainer.innerHTML).to.equal(
      '<span class="log-card background-color-active">Ants</span>',
    );
  });

  it('renders CARDS type as multiple card spans with locale-correct separator in English', () => {
    const message = new LogMessage(
      LogMessageType.DEFAULT,
      '${0}',
      [{type: LogMessageDataType.CARDS, value: [CardName.ALGAE, CardName.BIRDS, CardName.CELESTIC]}]);

    const wrapper = shallowMount(LogMessageComponent, {
      ...globalConfig,
      props: {message, viewModel: fakeViewModel()},
    });

    const cardsContainer = wrapper.find('.log-card').element.parentElement!;
    expect(cardsContainer.innerHTML).to.equal(
      '<span class="log-card background-color-automated">Algae</span>' +
      ', ' +
      '<span class="log-card background-color-active">Birds</span>' +
      ', and ' +
      '<span class="log-card background-color-corporation">Celestic</span>',
    );
  });

  it('renders CARDS type as multiple card spans', () => {
    const message = new LogMessage(LogMessageType.DEFAULT, '${0}', [
      {type: LogMessageDataType.CARDS, value: [CardName.ANTS, CardName.ECOLINE, CardName.BIRDS]},
    ]);
    const wrapper = shallowMount(LogMessageComponent, {
      ...globalConfig,
      props: {
        message,
        viewModel: fakeViewModel(),
      },
    });

    const cardsContainer = wrapper.find('.log-card').element.parentElement!;
    expect(cardsContainer.innerHTML).to.equal(
      '<span class="log-card background-color-active">Ants</span>' +
      ', ' +
      '<span class="log-card background-color-corporation">Ecoline</span>' +
      ', and ' +
      '<span class="log-card background-color-active">Birds</span>',
    );
  });

  it('renders CARDS with locale-correct separator for French (fr)', () => {
    PreferencesManager.INSTANCE.set('lang', 'fr');
    try {
      const message = new LogMessage(
        LogMessageType.DEFAULT,
        '${0}',
        [{type: LogMessageDataType.CARDS, value: [CardName.ALGAE, CardName.BIRDS, CardName.CELESTIC]}]);
      const wrapper = shallowMount(LogMessageComponent, {
        ...globalConfig,
        props: {message, viewModel: fakeViewModel()},
      });
      // French conjunction list format: "A, B et C" (no Oxford comma)
      const cardsContainer = wrapper.find('.log-card').element.parentElement!;
      expect(cardsContainer.innerHTML).to.equal(
        '<span class="log-card background-color-automated">Algae</span>' +
        ', ' +
        '<span class="log-card background-color-active">Birds</span>' +
        ' et ' +
        '<span class="log-card background-color-corporation">Celestic</span>',
      );
    } finally {
      PreferencesManager.resetForTest();
    }
  });

  it('renders CARDS with locale-correct separator for Japanese (jp)', () => {
    PreferencesManager.INSTANCE.set('lang', 'jp');
    try {
      const message = new LogMessage(
        LogMessageType.DEFAULT,
        '${0}',
        [{type: LogMessageDataType.CARDS, value: [CardName.ALGAE, CardName.BIRDS, CardName.CELESTIC]}]);
      const wrapper = shallowMount(LogMessageComponent, {
        ...globalConfig,
        props: {message, viewModel: fakeViewModel()},
      });
      // Japanese conjunction list format: "A、B、C" (Japanese comma separator)
      const cardsContainer = wrapper.find('.log-card').element.parentElement!;
      expect(cardsContainer.innerHTML).to.equal(
        '<span class="log-card background-color-automated">Algae</span>' +
        '、' +
        '<span class="log-card background-color-active">Birds</span>' +
        '、' +
        '<span class="log-card background-color-corporation">Celestic</span>',
      );
    } finally {
      PreferencesManager.resetForTest();
    }
  });

  it('renders icons in plain text and STRING data', () => {
    const message = new LogMessage(LogMessageType.DEFAULT, 'spent :r:energy: for ${0}', [
      {type: LogMessageDataType.STRING, value: ':p:megacredits:'},
    ]);
    const wrapper = shallowMount(LogMessageComponent, {
      ...globalConfig,
      props: {message, viewModel: fakeViewModel()},
    });

    const html = wrapper.html();
    expect(html).includes('<span class="markdown-resource resource_icon--energy"></span>');
    expect(html).includes(
      '<span class="markdown-production"><span class="markdown-resource resource_icon--megacredits"></span></span>');
  });

  it('renders RESOURCE, PRODUCTION, and CARD_RESOURCE data as icons', () => {
    const message = new LogMessage(LogMessageType.DEFAULT, '${0} ${1} ${2}', [
      {type: LogMessageDataType.RESOURCE, value: Resource.STEEL},
      {type: LogMessageDataType.PRODUCTION, value: Resource.HEAT},
      {type: LogMessageDataType.CARD_RESOURCE, value: CardResource.SYNDICATE_FLEET},
    ]);
    const wrapper = shallowMount(LogMessageComponent, {
      ...globalConfig,
      props: {message, viewModel: fakeViewModel()},
    });

    const html = wrapper.html();
    expect(html).includes('<span class="markdown-resource resource_icon--steel"></span>');
    expect(html).includes(
      '<span class="markdown-production"><span class="markdown-resource resource_icon--heat"></span></span>');
    expect(html).includes('<span class="markdown-resource card-resource-syndicate-fleet"></span>');
  });

  function undergroundTokenHtml(token: UndergroundResourceToken): string {
    const message = new LogMessage(LogMessageType.DEFAULT, '${0}', [
      {type: LogMessageDataType.UNDERGROUND_TOKEN, value: token},
    ]);
    const wrapper = shallowMount(LogMessageComponent, {
      ...globalConfig,
      props: {message, viewModel: fakeViewModel()},
    });
    return wrapper.find('.log-excavation-token').html();
  }

  it('renders UNDERGROUND_TOKEN data as icons', () => {
    expect(undergroundTokenHtml('titanium2')).includes(
      '2<span class="markdown-resource resource_icon--titanium"></span>');
    expect(undergroundTokenHtml('corruption1')).includes(
      '1<span class="markdown-resource resource_icon--corruption"></span>');
    expect(undergroundTokenHtml('steel1production')).includes(
      '1<span class="markdown-production"><span class="markdown-resource resource_icon--steel"></span></span>');
    expect(undergroundTokenHtml('microbe2')).includes(
      '2<span class="markdown-resource card-resource-microbe"></span>');
    expect(undergroundTokenHtml('tr')).includes('1<span class="markdown-icon markdown-icon-tr"></span>');
    expect(undergroundTokenHtml('sciencetag')).includes('1<span class="markdown-tag tag-science"></span>');
  });

  it('renders UNDERGROUND_TOKEN data without icons as plain text', () => {
    const html = undergroundTokenHtml('card2');

    expect(html).includes('draw 2 cards');
    expect(html).does.not.include('markdown-');
  });

  it('translates UNDERGROUND_TOKEN data before rendering icons', () => {
    PreferencesManager.INSTANCE.set('lang', 'de');
    (window as any)._translations = {'1:r:titanium: and 1:r:plants:': '1:r:titanium: und 1:r:plants:'};
    try {
      const html = undergroundTokenHtml('titaniumandplant');

      expect(html).includes('resource_icon--titanium"></span> und 1<span class="markdown-resource resource_icon--plants">');
    } finally {
      PreferencesManager.resetForTest();
      delete (window as any)._translations;
    }
  });
});
