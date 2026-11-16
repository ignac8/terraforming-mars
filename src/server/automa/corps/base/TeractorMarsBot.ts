import {CubeType} from '@/common/automa/AutomaTypes';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {MarsBotCorp} from '@/server/automa/MarsBotCorp';
import {whiteTrackCubes} from '@/server/automa/corps/BaseGameCorps';

// ---- C09 Teractor ----
// Draft: Earth. Setup: +25 MC, white cubes on Earth track (all positions).
// Effect: each advance on Earth track gives +2 MC.
export class TeractorMarsBot extends MarsBotCorp {
  constructor() {
    super({
      name: CardName.TERACTOR,
      description: 'Draft: Earth. Setup: +25 MC, white cubes on Earth track. Each Earth track advance earns 2 MC.',
      draftPriority: {type: 'tags', tags: [Tag.EARTH]},
      trackCubes: whiteTrackCubes(5),
      trackCubesTriggerEveryAdvance: true,
    });
  }

  public override setup(marsBot: IMarsBot): void {
    marsBot.gainMc(25);
    marsBot.game.log('MarsBot (Teractor): +25 M€');
  }

  public override onTrackCubeTrigger(marsBot: IMarsBot, trackIndex: number, _position: number, cubeType: CubeType): void {
    if (cubeType === 'white' && trackIndex === 5) {
      marsBot.gainMc(2);
      marsBot.game.log('MarsBot (Teractor): Earth track advance, +2 M€');
    }
  }
}
