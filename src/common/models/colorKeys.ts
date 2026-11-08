// Keys in the server models that hold a player color, or an array of them.
export const COLOR_KEYS: ReadonlySet<string> = new Set([
  'color', 'coOwner', 'excavator', 'chairman', 'partyLeader', 'visitor', 'activePlayer',
  'lobby', 'passedPlayers', 'colonies', 'players', 'waitingFor',
  // Replays and rewind votes.
  'movers', 'viewerColor', 'defaultViewAs', 'viewAs', 'requester',
]);
