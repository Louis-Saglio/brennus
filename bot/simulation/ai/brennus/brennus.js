import { BaseAI } from "simulation/ai/common-api/baseAI.js";

/**
 * Brennus: AI bot for 0 A.D. — minimal no-op skeleton.
 *
 * Loads successfully, participates in the per-turn AI update loop, and
 * issues no commands. The init banner is the load canary used by the
 * headless smoke test: if it appears in stdout, the bot was constructed
 * and initialized without script errors.
 */
export function BrennusBot(settings)
{
	BaseAI.call(this, settings);
}

BrennusBot.prototype = Object.create(BaseAI.prototype);

BrennusBot.prototype.CustomInit = function(gameState)
{
	print(`[HARNESS] brennus: loaded for player ${this.player}\n`);
};

/** Intentionally does nothing (for now). */
BrennusBot.prototype.OnUpdate = function() {};
