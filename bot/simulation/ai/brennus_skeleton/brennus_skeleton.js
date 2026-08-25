import { BaseAI } from "simulation/ai/common-api/baseAI.js";

/**
 * Brennus skeleton: loads and does nothing.
 *
 * Starting point for a new bot: copy this directory, rename it, and fill in
 * CustomInit/OnUpdate. No OnUpdate override here — BaseAI's empty one is the
 * cheapest possible per-turn cost.
 *
 * The init banner is the load canary used by the headless smoke test: if it
 * appears in stdout, the bot was constructed and initialized without script
 * errors.
 */
export function BrennusSkeleton(settings)
{
	BaseAI.call(this, settings);
}

BrennusSkeleton.prototype = Object.create(BaseAI.prototype);

BrennusSkeleton.prototype.CustomInit = function(gameState)
{
	print(`[HARNESS] brennus-skeleton: loaded for player ${this.player}\n`);
};
