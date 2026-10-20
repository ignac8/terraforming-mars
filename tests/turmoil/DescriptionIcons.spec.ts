import {expect} from 'chai';
import {descriptionWithIcons} from '../../src/server/turmoil/DescriptionIcons';
import {ALL_PARTIES} from '../../src/server/turmoil/Turmoil';
import {policyDescription} from '../../src/server/turmoil/Policy';

describe('DescriptionIcons', () => {
  const examples: ReadonlyArray<[string, string]> = [
    ['Gain 1 M€ for each building tag you have', 'Gain 1:r:megacredits: for each :tag:building: you have'],
    ['Gain 1 M€ for each plant, microbe and animal tag you have', 'Gain 1:r:megacredits: for each :tag:plant:, :tag:microbe: and :tag:animal: you have'],
    ['When you play an animal, plant or microbe tag, gain 2 M€', 'When you play an :tag:animal:, :tag:plant: or :tag:microbe:, gain 2:r:megacredits:'],
    ['Gain 1 M€ for each Venus, Earth and Jovian tag you have', 'Gain 1:r:megacredits: for each :tag:venus:, :tag:earth: and :tag:jovian: you have'],
    ['Cards with science tag requirements may be played with 1 less science tag', 'Cards with :tag:science: requirements may be played with 1 less :tag:science:'],
    ['When you place a tile ON MARS, gain 1 steel', 'When you place a tile ON MARS, gain 1:r:steel:'],
    ['When you place a tile, gain 1 plant', 'When you place a tile, gain 1:r:plants:'],
    ['Spend 5 M€ to gain 3 plants or add 2 microbes to ANY card', 'Spend 5:r:megacredits: to gain 3:r:plants: or add 2:cr:microbe: to ANY card'],
    ['Spend 4 M€ to gain 2 titanium or add 2 floaters to ANY card', 'Spend 4:r:megacredits: to gain 2:r:titanium: or add 2:cr:floater: to ANY card'],
    ['Your steel resources are worth 1 M€ extra', 'Your :r:steel: resources are worth 1:r:megacredits: extra'],
    ['Gain 1 heat for each heat production you have', 'Gain 1:r:heat: for each :p:heat: you have'],
    ['Pay 10 M€ to increase your energy and heat production 1 step', 'Pay 10:r:megacredits: to increase your :p:energy: and :p:heat: 1 step'],
    ['When you raise a global parameter, decrease your M€ production 1 step per step raised if possible', 'When you raise a global parameter, decrease your :p:megacredits: 1 step per step raised if possible'],
    ['The player(s) with the lowest TR gains 1 TR', 'The player(s) with the lowest :icon:tr: gains 1:icon:tr:'],
    ['When you take an action that raises TR, you MUST pay 3 M€ per step raised', 'When you take an action that raises :icon:tr:, you MUST pay 3:r:megacredits: per step raised'],
    ['Your global requirements are +/- 2 steps', 'Your global requirements are +/- 2 steps'],
  ];

  for (const [description, expected] of examples) {
    it(description, () => {
      expect(descriptionWithIcons(description)).eq(expected);
    });
  }

  it('leaves no resource, tag or TR text in any bonus or policy', () => {
    const descriptions = Object.values(ALL_PARTIES).flatMap((PartyClass) => {
      const party = new PartyClass();
      return [
        ...party.bonuses.map((bonus) => bonus.description),
        ...party.policies.map((policy) => policyDescription(policy, undefined)),
      ];
    });
    expect(descriptions).is.not.empty;
    for (const description of descriptions) {
      // Shortcodes contain resource names, so drop them before looking for plain text.
      const text = descriptionWithIcons(description).replace(/:[a-z]+:[a-zA-Z0-9-]+:/g, '');
      expect(text, description).does.not.match(/M€|\bTR\b|\b(steel|titanium|plants?|energy|heat|microbes|floaters|tags?)\b/);
    }
  });
});
