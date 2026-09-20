// Common code shared between PlayerHome and SpectatorHome:
// hotkey navigation, the keyboard shortcuts dialog, tile view cycling,
// the device-width viewport and setting the document title on mount.
import {defineComponent} from 'vue';
import {GameModel} from '@/common/models/GameModel';
import {SpaceId} from '@/common/Types';
import {KeyboardNavigation} from '@/client/components/KeyboardNavigation';
import {nextTileView, TileView} from '@/client/components/board/TileView';
import {setDocumentTitle} from '@/client/utils/documentTitle';

type DataModel = {
  tileView: TileView;
  keyboardShortcutOpened: boolean;
  hotkeyTargets: Array<Element>;
  previousViewport: string;
}

export const HomeMixin = defineComponent({
  name: 'HomeMixin',
  data(): DataModel {
    return {
      tileView: 'show',
      keyboardShortcutOpened: false,
      hotkeyTargets: [],
      previousViewport: '',
    };
  },
  computed: {
    // Consumers must define `game`.
    // eslint-disable-next-line vue/return-in-computed-property
    game(): GameModel {
      throw new Error('HomeMixin consumers must override the `game` computed property.');
    },
  },
  methods: {
    navigatePage(event: KeyboardEvent) {
      // Most '?' are shifted, so process this before the action that exits early with modifiers
      if (event.key === '?') {
        this.keyboardShortcutOpened = !this.keyboardShortcutOpened;
        return;
      }
      if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      const ids: Partial<Record<string, string>> = {
        [KeyboardNavigation.GAMEBOARD]: 'shortkey-board',
        [KeyboardNavigation.PLAYERSOVERVIEW]: 'shortkey-playersoverview',
        [KeyboardNavigation.HAND]: 'shortkey-hand',
        [KeyboardNavigation.COLONIES]: 'shortkey-colonies',
      };
      const inputSource = event.target as Node;
      if (inputSource.nodeName.toLowerCase() !== 'input') {
        const id = ids[event.code];
        if (id) {
          const el = document.getElementById(id);
          if (el) {
            event.preventDefault();
            el.scrollIntoView({block: 'center', inline: 'center', behavior: 'smooth'});
          }
        } else if (event.code.startsWith('Digit')) {
          const ASCII_ONE = '1'.charCodeAt(0);
          const index = event.code.charCodeAt(5) - ASCII_ONE;
          if (index >= 0 && index < this.hotkeyTargets.length) {
            const el = this.hotkeyTargets[index];
            if (el) {
              el.scrollIntoView({block: 'start', inline: 'center', behavior: 'smooth'});
            }
          }
        }
      }
    },
    cycleTileView(): void {
      this.tileView = nextTileView(this.tileView);
    },
    // Consumers must set `ref="gameBoardView"` on their <GameBoardView> for this to have any effect.
    onSpaceClicked(spaceId: SpaceId): void {
      const gameBoardView = this.$refs.gameBoardView as {highlightSpace: (spaceId: SpaceId) => void} | undefined;
      gameBoardView?.highlightSpace(spaceId);
    },
  },
  mounted() {
    setDocumentTitle(this.game.name);
    // Set the viewport width to width=device-width so mobile browsers lay the game out at their
    // actual CSS viewport width and mobile.less can respond to it. The global viewport is
    // width=1260, which shrinks the whole desktop layout to fit a phone.
    // TODO: Once responsiveness covers the whole project, this code should be removed and the tag in index.html should be updated directly.
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport !== null) {
      this.previousViewport = viewport.getAttribute('content') ?? '';
      viewport.setAttribute(
        'content',
        'width=device-width, initial-scale=1, viewport-fit=cover',
      );
    }
    window.addEventListener('keydown', this.navigatePage);
    const targets = this.$el.getElementsByClassName('hotkey-target');
    for (let i = 0; i < targets.length; i++) {
      const element = targets.item(i);
      if (element) {
        this.hotkeyTargets.push(element);
      }
    }
  },
  beforeUnmount() {
    document
      .querySelector('meta[name="viewport"]')
      ?.setAttribute('content', this.previousViewport);
  },
  unmounted() {
    window.removeEventListener('keydown', this.navigatePage);
  },
});
