import {Tag} from '../../../common/cards/Tag';
import {Resource} from '../../../common/Resource';
import {TrackDefinition} from '../../../common/automa/AutomaTypes';

const TRACK_BUILDING: TrackDefinition = {
  tags: [Tag.BUILDING],
  productions: [Resource.STEEL],
  layout: [undefined, undefined, undefined, undefined, undefined, 'temperature', 'greenery', 'tag_science', 'milestone', 'greenery', 'city', undefined, 'ocean', 'tag_space', 'greenery', 'city', 'temperature', undefined, 'tr5'],
};

const TRACK_SPACE: TrackDefinition = {
  tags: [Tag.SPACE],
  productions: [Resource.TITANIUM],
  layout: [undefined, 'advance', undefined, 'tr3', 'tr2', undefined, 'ocean', 'venus', 'tr2', 'award', undefined, 'tr3', 'ocean', undefined, 'temperature', undefined, 'tr4', undefined, 'tr6'],
};

const TRACK_EVENT: TrackDefinition = {
  tags: [Tag.EVENT],
  productions: [Resource.MEGACREDITS],
  layout: [undefined, 'city', 'advance', undefined, 'ocean', undefined, 'floater2', 'milestone', 'temperature', 'temperature', 'award', undefined, 'tr4', 'temperature', 'greenery', 'advance', 'temperature2', undefined, 'tr5'],
};

const TRACK_SCIENCE: TrackDefinition = {
  tags: [Tag.SCIENCE, Tag.ANIMAL],
  productions: [],
  layout: [undefined, 'greenery', undefined, 'ocean', 'temperature', 'city', 'ocean', 'greenery', 'greenery', 'milestone', 'temperature', 'ocean', 'tr3', 'temperature', 'tr4', 'advance', undefined, 'temperature', 'tr7'],
};

const TRACK_ENERGY: TrackDefinition = {
  tags: [Tag.POWER, Tag.JOVIAN],
  productions: [Resource.ENERGY],
  layout: [undefined, 'advance', 'floater', undefined, 'floater2', 'tr3', 'advance', 'award', 'city', 'greenery', 'greenery', 'advance', 'ocean', undefined, 'city', 'greenery', undefined, 'temperature', 'tr8'],
};

const TRACK_EARTH: TrackDefinition = {
  tags: [Tag.EARTH, Tag.CITY],
  productions: [Resource.HEAT],
  layout: [undefined, undefined, 'temperature', 'city', 'ocean', undefined, 'city', 'advance', 'temperature', 'greenery', 'advance', 'city', 'greenery', 'tr4', 'greenery', 'advance', undefined, 'city', 'tr7'],
};

const TRACK_PLANT: TrackDefinition = {
  tags: [Tag.PLANT, Tag.MICROBE],
  productions: [Resource.PLANTS],
  layout: [undefined, 'advance', 'greenery', 'advance', 'greenery', undefined, 'milestone', 'advance', 'ocean', 'tr3', 'award', 'temperature', 'tr3', 'greenery', 'greenery', 'ocean', 'greenery', undefined, 'tr6'],
};

export const AMAZONIS_PLANITIA_MARSBOT_BOARD: ReadonlyArray<TrackDefinition> = [
  TRACK_BUILDING,
  TRACK_SPACE,
  TRACK_EVENT,
  TRACK_SCIENCE,
  TRACK_ENERGY,
  TRACK_EARTH,
  TRACK_PLANT,
];
