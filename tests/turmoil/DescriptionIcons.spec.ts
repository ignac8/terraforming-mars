import {expect} from 'chai';
import {descriptionWithIcons} from '../../src/server/turmoil/DescriptionIcons';

describe('DescriptionIcons', () => {
  const examples: ReadonlyArray<[string, string]> = [
    ['Gain 1 M€ for each plant, microbe and animal tag you have', 'Gain 1:r:megacredits: for each :tag:plant:, :tag:microbe: and :tag:animal: you have'],
    ['Your steel resources are worth 1 M€ extra', 'Your :r:steel: resources are worth 1:r:megacredits: extra'],
    ['When you place a tile, gain 1 plant', 'When you place a tile, gain 1:r:plants:'],
    ['Pay 10 M€ to increase your energy and heat production 1 step', 'Pay 10:r:megacredits: to increase your :p:energy: and :p:heat: 1 step'],
    ['The player(s) with the lowest TR gains 1 TR', 'The player(s) with the lowest :icon:tr: gains 1:icon:tr:'],
    ['Your global requirements are +/- 2 steps', 'Your global requirements are +/- 2 steps'],
  ];

  for (const [description, expected] of examples) {
    it(description, () => {
      expect(descriptionWithIcons(description)).eq(expected);
    });
  }
});
