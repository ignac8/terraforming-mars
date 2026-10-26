import {SelectOption} from './SelectOption';

// No prompt offers this option any more. It stays so upstream merges apply cleanly.
export class UndoActionOption extends SelectOption {
  constructor() {
    // No AndThen
    super('Undo last action', 'Undo');
    this.warnings = ['undoBestEffort'];
  }
}
