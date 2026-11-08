// Keys in the server models that hold a player color, or an array of them.
export const COLOR_KEYS: ReadonlySet<string> = new Set([
  'color', 'coOwner', 'excavator', 'chairman', 'partyLeader', 'visitor', 'activePlayer',
  'lobby', 'passedPlayers', 'colonies', 'players', 'waitingFor',
  // Replays and rewind votes.
  'movers', 'viewerColor', 'defaultViewAs', 'viewAs', 'requester',
  // The owner of a private log line, which the judge's copy and a finished game's carry in place of a player id.
  'owner',
]);
