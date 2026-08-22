/**
 * Brennus harness override of the public NonVisualTrigger.js.
 *
 * Loaded by the engine in every -autostart-nonvisual game (the autostart
 * code adds "scripts/NonVisualTrigger.js" as a custom trigger script; the
 * brennus mod is mounted after public, so this copy wins).
 *
 * Two jobs:
 * 1. Print per-player statistics JSON at game end (same as public).
 * 2. End the game at a fixed in-game time limit so headless runs always
 *    exit cleanly (metadata.json + statistics) instead of relying on
 *    wall-clock timeout, which skips both. At the limit, player 1 (the
 *    bot under test) is marked as won.
 */

/**
 * This will print the statistics at the end of a game.
 * In order for this to work, the player's state has to be changed before the event.
 */
Trigger.prototype.EndGameAction = function()
{
	if (!this.once || Engine.QueryInterface(SYSTEM_ENTITY, IID_PlayerManager).GetActivePlayers().length)
		return;

	this.once = false;

	for (const player of Engine.GetEntitiesWithInterface(IID_StatisticsTracker))
	{
		const cmpStatisticsTracker = Engine.QueryInterface(player, IID_StatisticsTracker);
		if (cmpStatisticsTracker)
			print(cmpStatisticsTracker.GetStatisticsJSON() + "\n");
	}
};

Trigger.prototype.TimeLimitReached = function()
{
	print(`[HARNESS] time limit reached (${this.timeLimitMinutes} in-game minutes), marking player 1 as won\n`);
	Engine.QueryInterface(SYSTEM_ENTITY, IID_EndGameManager).MarkPlayersAsWon(
		[1],
		n => "Time limit reached (brennus test harness).",
		n => "Time limit reached (brennus test harness).");
};

{
	const cmpTrigger = Engine.QueryInterface(SYSTEM_ENTITY, IID_Trigger);
	cmpTrigger.RegisterTrigger("OnPlayerWon", "EndGameAction", { "enabled": true });
	cmpTrigger.RegisterTrigger("OnPlayerDefeated", "EndGameAction", { "enabled": true });
	cmpTrigger.once = true;

	// Goal 8: the match must end at the 30 in-game-minute mark so the
	// end-of-game statistics snapshot the 30-minute state.
	cmpTrigger.timeLimitMinutes = 30;
	cmpTrigger.DoAfterDelay(cmpTrigger.timeLimitMinutes * 60 * 1000, "TimeLimitReached", {});
}
