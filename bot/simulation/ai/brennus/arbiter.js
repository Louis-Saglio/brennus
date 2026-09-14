/**
 * Resource arbiter: the single authority for resource spending.
 *
 * The engine mirrors player resources once per AI turn; that frozen mirror
 * seeds the arbiter's ONE shared running balance at the start of every
 * block (resetBlock). Every manager spends against that same balance
 * through books()/spend()/check(): earlier pipeline stages' spends are
 * visible to later stages, so the declared pipeline order is the real
 * priority order and an order is only issued when the predicted balance
 * actually covers it. The balance re-seeds from the fresh mirror next
 * block, so prediction errors cannot accumulate.
 *
 * Every grant and denial is journaled (in-memory only: printing would
 * change the tagged timeline, and hot-path prints measurably slow the
 * sim). journal holds the current block's records, totals the per-tag
 * cumulative grant/deny counts — read them when auditing a golden diff.
 */
export function ResourceArbiter(bot)
{
	this.bot = bot;
	this.reserves = {};      // name -> {resource: amount}; reset every block
	this.holds = {};         // name -> true; reset every block
	this.declarations = {};  // name -> payload; sticky until re-declared (mirrors the old instance-flag lifetimes)
	this.balance = null;     // the shared per-block running balance
	this.journal = [];
	this.totals = {};
	// Per-block income estimate (EMA of gross inflow: mirror delta + what the
	// arbiter granted last block — engine deductions land within a turn of the
	// grant). Feeds the foodSplit.musterShare dial.
	this.income = { "food": 0, "wood": 0, "stone": 0, "metal": 0 };
	this.prevMirror = null;
}

ResourceArbiter.prototype.resetBlock = function()
{
	const mirror = this.bot.gameState.getResources();
	if (this.prevMirror)
	{
		const spent = { "food": 0, "wood": 0, "stone": 0, "metal": 0 };
		for (const j of this.journal)
			if (j.granted && j.cost)
				for (const res in spent)
					spent[res] += j.cost[res] || 0;
		for (const res of ["food", "wood", "stone", "metal"])
		{
			const gross = mirror[res] - this.prevMirror[res] + spent[res];
			this.income[res] = 0.7 * this.income[res] + 0.3 * gross;
		}
	}
	this.prevMirror = { "food": mirror.food, "wood": mirror.wood, "stone": mirror.stone, "metal": mirror.metal };
	this.reserves = {};
	this.holds = {};
	this.balance = mirror;
	this.journal = [];
};

/**
 * The shared running balance for this block. All "books" are the same
 * object: a manager's reads see every earlier spend in the block. (Before
 * this step each call site got its own fresh mirror copy and overdraws were
 * left for the engine's command order to resolve.)
 */
ResourceArbiter.prototype.books = function(tag)
{
	if (!this.balance)
		this.balance = this.bot.gameState.getResources();
	return this.balance;
};

/** The raw frozen mirror, for read-only reporting that must not see predicted spends (logStatus stock line). */
ResourceArbiter.prototype.mirror = function()
{
	return this.bot.gameState.getResources();
};

ResourceArbiter.prototype.record = function(tag, what, cost, granted)
{
	this.journal.push({ "tag": tag, "what": what, "cost": cost, "granted": granted });
	const t = this.totals[tag] || (this.totals[tag] = { "grant": 0, "deny": 0 });
	t[granted ? "grant" : "deny"]++;
};

/** Spend from the balance + journal the grant. Cost keys are zero-filled first: the engine's ResourcesManager.subtract turns missing keys into NaN (x -= undefined), and NaN poisons every later comparison on a shared balance (NaN < y is false, so canAfford would always pass). */
ResourceArbiter.prototype.spend = function(books, tag, cost, what)
{
	books.subtract({ "food": cost.food || 0, "wood": cost.wood || 0,
		"stone": cost.stone || 0, "metal": cost.metal || 0 });
	this.record(tag, what, cost, true);
};

/** Affordability gate + journaled denial. */
ResourceArbiter.prototype.check = function(books, tag, cost, what)
{
	const ok = books.canAfford(cost);
	this.record(tag, what, cost, ok);
	return ok;
};

/** A barter's sell side is a real engine-side deduction: record it as a spend so later stages see it gone. */
ResourceArbiter.prototype.spendSell = function(tag, sell, amount, what)
{
	const cost = { "food": 0, "wood": 0, "stone": 0, "metal": 0 };
	cost[sell] = amount;
	this.balance.subtract(cost);
	this.record(tag, what, cost, true);
};

/** Reserves: amounts later spenders must leave untouched. */
ResourceArbiter.prototype.reserve = function(name, amounts)
{
	this.reserves[name] = amounts;
};

ResourceArbiter.prototype.reserved = function(resource)
{
	let sum = 0;
	for (const r of Object.values(this.reserves))
		sum += r[resource] || 0;
	return sum;
};

/** All four reserved amounts as a cost-shaped object (the old phaseReserve reads). */
ResourceArbiter.prototype.reservedAll = function()
{
	return { "food": this.reserved("food"), "wood": this.reserved("wood"),
		"stone": this.reserved("stone"), "metal": this.reserved("metal") };
};

/** Holds: named per-block latches (e.g. construction paused after a research order). */
ResourceArbiter.prototype.hold = function(name)
{
	this.holds[name] = true;
	this.record("hold", name, null, true);
};

ResourceArbiter.prototype.held = function(name)
{
	return !!this.holds[name];
};

/** Declarations: sticky coordination state (demands, gaps) with the same lifetime as the instance flags they replace. */
ResourceArbiter.prototype.declare = function(name, payload)
{
	this.declarations[name] = payload;
};

ResourceArbiter.prototype.declared = function(name)
{
	return this.declarations[name];
};

/** Sticky state survives save/load; per-block state (reserves, holds, journal) does not. */
ResourceArbiter.prototype.serialize = function()
{
	return { "declarations": this.declarations,
		"income": this.income, "prevMirror": this.prevMirror };
};

ResourceArbiter.prototype.deserialize = function(data)
{
	this.declarations = data?.declarations || {};
	if (data?.income)
		this.income = data.income;
	if (data?.prevMirror)
		this.prevMirror = data.prevMirror;
};

ResourceArbiter.prototype.declaredAmount = function(name, resource)
{
	const p = this.declarations[name];
	return p ? p[resource] || 0 : 0;
};

/**
 * The spending pipeline, in priority order. Each stage gets fresh books on
 * the same frozen per-turn mirror and may declare reserves/holds/demands
 * that bind the later stages. Defense runs BEFORE the economy spenders
 * (research, women stream, construction): the early muster must draw from
 * the resource flow, not from stockpiles the boom never leaves behind
 * (agg1: floors of 250/250 never fired pre-boom — the boom spent everything
 * first — and the army stayed at 4 while Petra's 90-unit wave arrived).
 */
ResourceArbiter.prototype.spenders = [
	["defense", bot => bot.defenseManager.manageDefense()],
	["phaseUp", bot => bot.managePhaseUp()],
	["research", bot => bot.manageResearch()],
	["workers", bot => bot.trainWorkers()],
	["construction", bot => bot.manageConstruction()],
	["barter", bot => bot.manageBarter()],
	["expansion", bot => bot.manageExpansion()],
	["trade", bot => bot.manageTrade()]
];

ResourceArbiter.prototype.runSpenders = function()
{
	for (const [stage, fn] of this.spenders)
		fn(this.bot);
};
