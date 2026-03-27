---
name: automa-finalize
description: Run the automa post-session finalization process. Use after implementing automa features or fixing bugs.
---

# Automa Finalize Process

Run these steps in order after any automa code changes:

## Step 1: Verify Code Extraction
- Check `src/server/Game.ts` for any automa logic beyond thin hook delegations (`this.automaHooks?.method()`)
- Check `src/server/Player.ts` for any automa-specific code beyond the single `handleHumanCardPlayed` call
- If any automa business logic has crept into base classes, move it to `src/server/automa/` files
- Report what was found and fixed

## Step 2: Write/Update Tests
- For every bug fix or new feature in this session, write a test in `tests/automa/`
- Follow existing patterns in `tests/automa/MarsBot.spec.ts`
- Use `testGame(1, {automaOption: true, automaDifficulty: 'normal', boardName: BoardName.THARSIS})` to create test games
- Cover: the fix itself, edge cases, and regression prevention
- Run tests to verify they pass: `npm run test:server`

## Step 3: Run /simplify
- Run `/simplify` on all files changed in this session
- Fix any issues found

## Step 4: Run Tests Again
- Run `npm run test:server` and fix any failures
- The 3 pre-existing failures in ServerModel.spec.ts and ApiGame.spec.ts are known and acceptable

## Step 5: Update Automa Documentation
- Update `automa/AUTOMA-DESIGN.md` with any new features, fixes, or architectural changes
- Keep the implementation status checklist up to date

## Step 6: Build
- Run `npm run build` and verify clean build (warnings about bundle size are OK)

## Step 7: Ask About Server Restart
- Ask the user: "Restart the server now? (You may be mid-game)"
- Only restart if the user confirms

## Step 8: Ask About Commit
- Ask the user: "Commit these changes?"
- If yes, commit only code files (ts, vue, less) - no docs, no claude files unless asked
- Do NOT include AI attribution in commit messages (per upstream contributing guide)
