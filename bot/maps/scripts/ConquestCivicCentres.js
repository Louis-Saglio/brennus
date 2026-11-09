/**
 * Brennus override of the public ConquestCivicCentres.js (kept intact
 * below the divider) plus worker-efficiency telemetry.
 *
 * Why this file: game-end hooks stay out of NonVisualTrigger.js, the
 * file a test harness replaces (the former kiln farm mounted its own copy
 * last). This file is also part of the autostart trigger set
 * (scripts/ConquestCivicCentres.js) and the victory condition is fixed at
 * conquest_civic_centers — so the telemetry runs in every match.
 *
 * Worker-efficiency telemetry:
 * every 200 ms of simulation time, player 1's gather-capable units are
 * sampled and, per resource class (wood, stone, metal, field, fruit):
 *   - gathered: units picked up,
 *   - theoretical: Σ live gather rate × tasked seconds,
 *   - taskedMs: time from gather-task assignment until idle/reassignment
 *     (approaching, gathering, walking back and dropping all count).
 * Class = what the worker actually gathers, by supply subtype:
 *   wood = wood.tree, stone = stone.rock, metal = metal.ore,
 *   field = food.grain, fruit = food.fruit.
 * Everything else (meat, *.ruins) is counted as a diagnostic (to
 * reconcile with the end-of-game statistics, which merge subtypes per
 * generic resource) but part of no bar. Efficiency = gathered ÷
 * theoretical. The summary is printed when the game ends (OnPlayerWon /
 * OnPlayerDefeated, next to the statistics JSON), plus per-5-minute
 * buckets.
 *
 * Mechanics this relies on (verified against the 0.28.0 source and
 * validated in headless matches against the statistics tracker's own
 * pick-up counts):
 * - carrying changes only on gather ticks (+1, ≥ 870 ms apart for rates
 *   ≤ 1.15) and on full drop-offs, so a 200 ms window contains at most
 *   one tick per worker: every pick-up is visible as a positive carry
 *   delta EXCEPT one case — when the pick-up fills the carry while the
 *   dropsite is already within gather range, the fill and the commit
 *   happen in the same sim turn and no sampling frequency can see it.
 *   That case is reconstructed from the drop: prev carry == max−1, now 0,
 *   the previous sample saw the worker GATHERING, and the worker is
 *   resuming the same gather task ⇒ +1 pick-up. (Without it,
 *   adjacent-dropsite classes undercount — fields ~5%.)
 * - the gather task's resource type lives in the "Gather" /
 *   "GatherNearPosition" order data; during the drop walk the active
 *   order's target is swapped to the dropsite and the supply is kept in
 *   formerTarget.
 * - GetTargetGatherRate returns the live per-second rate: template rate
 *   × techs/auras × the supply's diminishing-returns multiplier.
 *
 * Observation only: no RNG, no simulation state touched — deterministic.
 */

// ---------------------------------------------------------------------------
// Worker-efficiency telemetry.
// ---------------------------------------------------------------------------

// The five tracked classes, plus diagnostic classes:
// ruins and meat are counted (to reconcile with the end-of-game
// statistics, which merge subtypes per generic resource) but part of no
// bar.
const EFF_CLASSES = {
	"wood.tree": "wood",
	"stone.rock": "stone",
	"metal.ore": "metal",
	"food.grain": "field",
	"food.fruit": "fruit",
	"wood.ruins": "woodR",
	"stone.ruins": "stoneR",
	"metal.ruins": "metalR",
	"food.meat": "meat",
};

const EFF_CLASS_ORDER = ["wood", "stone", "metal", "field", "fruit"];

const EFF_DIAG_ORDER = ["woodR", "stoneR", "metalR", "meat"];

const EFF_BUCKET_MS = 5 * 60 * 1000; // per-5-minute buckets

// class → { gathered, theoretical, taskedMs, buckets[] }
const EFF = {};
for (const cls of EFF_CLASS_ORDER.concat(EFF_DIAG_ORDER))
	EFF[cls] = { "gathered": 0, "theoretical": 0, "taskedMs": 0, "buckets": [] };

// entity id → { lastCarry: { genericType: {amount, max} } } (snapshot on first sight)
const EFF_WORKERS = {};
let EFF_totalWorkerMs = 0; // Σ (player-1 gather-capable units × dt), for utilization
let EFF_lastTick = null;   // sim time of the previous sample
let EFF_maxBucket = 0;
let EFF_printed = false;

function EFF_newBucket()
{
	return { "gathered": 0, "theoretical": 0, "taskedMs": 0 };
}

Trigger.prototype.EfficiencySample = function()
{
	const cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
	const now = cmpTimer.GetTime();
	const dt = EFF_lastTick === null ? 0 : now - EFF_lastTick;
	EFF_lastTick = now;

	const bucket = Math.floor(now / EFF_BUCKET_MS);
	if (bucket > EFF_maxBucket)
		EFF_maxBucket = bucket;

	const seen = new Set();

	for (const ent of Engine.GetEntitiesWithInterface(IID_ResourceGatherer))
	{
		const cmpOwnership = Engine.QueryInterface(ent, IID_Ownership);
		if (!cmpOwnership || cmpOwnership.GetOwner() !== 1)
			continue;
		seen.add(ent);
		EFF_totalWorkerMs += dt;

		const cmpUnitAI = Engine.QueryInterface(ent, IID_UnitAI);
		if (!cmpUnitAI)
			continue;

		const state = cmpUnitAI.GetCurrentState();
		if (!state.startsWith("INDIVIDUAL.GATHER.") && !state.startsWith("INDIVIDUAL.RETURNRESOURCE."))
			continue;

		// The resource type lives in the "Gather" order: the current order in
		// the GATHER.* states, queued below the "ReturnResource" order in the
		// RETURNRESOURCE.* states.
		let gatherOrder = null;
		for (const order of cmpUnitAI.GetOrders())
			if (order.type === "Gather" || order.type === "GatherNearPosition")
			{
				gatherOrder = order;
				break;
			}
		if (!gatherOrder || !gatherOrder.data || !gatherOrder.data.type)
			continue;

		const cls = EFF_CLASSES[gatherOrder.data.type.generic + "." + gatherOrder.data.type.specific];

		const cmpGatherer = Engine.QueryInterface(ent, IID_ResourceGatherer);

		if (cls && dt > 0)
		{
			// During the drop walk the active Gather order's target is the
			// dropsite; the supply is the former target. GatherNearPosition
			// orders have no target at all (walking to find a new supply).
			let rateTarget = gatherOrder.data.target;
			if (state === "INDIVIDUAL.GATHER.RETURNINGRESOURCE" && gatherOrder.data.formerTarget)
				rateTarget = gatherOrder.data.formerTarget;

			const rec = EFF[cls];
			rec.taskedMs += dt;
			if (!rec.buckets[bucket])
				rec.buckets[bucket] = EFF_newBucket();
			rec.buckets[bucket].taskedMs += dt;

			const rate = rateTarget !== undefined ? cmpGatherer.GetTargetGatherRate(rateTarget) : 0;
			rec.theoretical += rate * dt / 1000;
			rec.buckets[bucket].theoretical += rate * dt / 1000;
		}

		// Count picked-up units as positive carry deltas attributed to the
		// current class. First sighting snapshots the carry without counting.
		let worker = EFF_WORKERS[ent];
		const carry = {};
		for (const c of cmpGatherer.GetCarryingStatus())
			carry[c.type] = { "amount": c.amount, "max": c.max };
		if (!worker)
		{
			EFF_WORKERS[ent] = { "lastCarry": carry };
			continue;
		}

		if (cls)
		{
			let gained = 0;
			for (const type of new Set([...Object.keys(worker.lastCarry), ...Object.keys(carry)]))
			{
				const prev = worker.lastCarry[type];
				const prevAmount = prev ? prev.amount : 0;
				const curAmount = carry[type] ? carry[type].amount : 0;
				if (curAmount > prevAmount)
					gained += curAmount - prevAmount;
				else if (curAmount === 0 && prev && prevAmount === prev.max - 1 &&
					worker.lastState === "INDIVIDUAL.GATHER.GATHERING" &&
					gatherOrder.data.type.generic === type &&
					(state === "INDIVIDUAL.GATHER.APPROACHING" || state === "INDIVIDUAL.GATHER.GATHERING"))
				{
					// Invisible fill: the pick-up that filled the carry and the
					// drop-off both happened in one window (dropsite within
					// gather range). Reconstruct it from the drop. The
					// previous-sample GATHERING state excludes the walk-off
					// partial drop (supply exhausted at max-1), which looks
					// identical but was already counted.
					gained += 1;
				}
			}
			if (gained > 0)
			{
				EFF[cls].gathered += gained;
				if (!EFF[cls].buckets[bucket])
					EFF[cls].buckets[bucket] = EFF_newBucket();
				EFF[cls].buckets[bucket].gathered += gained;
			}
		}
		worker.lastCarry = carry;
		worker.lastState = state;
	}

	// Drop bookkeeping for units no longer ours (destroyed or captured).
	for (const ent in EFF_WORKERS)
		if (!seen.has(+ent))
			delete EFF_WORKERS[ent];
};

// ---------------------------------------------------------------------------
// Map snapshots: where every unit and building is, every 30 s of sim time.
//
// Purpose: a top-down, exact picture of a match that can be rendered offline
// (tools/mapview.py) and compared across seeds — the cheap complement to a
// visual replay, which shows one match in detail but cannot scale to a batch.
//
// One stdout line per snapshot, JSON after the tag:
//   [HARNESS] map {"t": <sim seconds>, "1": [[id,kind,state,x,z], ...], "2": [...]}
// kind:  1 worker, 2 soldier, 3 cavalry, 4 siege, 5 building, 6 civic centre (class CivCentre)
// state: 0 idle, 1 gathering, 2 attacking, 3 moving/other
// x,z are metres rounded to 1 m (map is size*4 metres across). Observation
// only: no RNG, no simulation state touched — deterministic.
// ---------------------------------------------------------------------------

const MAP_KINDS = [
	{ "kind": 6, "class": "CivCentre" },
	{ "kind": 5, "class": "Structure" },
	{ "kind": 4, "class": "Siege" },
	{ "kind": 3, "class": "Cavalry" },
	{ "kind": 2, "class": "CitizenSoldier" },
	{ "kind": 1, "class": "Worker" }
];

// entity id -> { name, kind }. The sim Identity component exposes no class list
// (ICmpIdentity has only civ/phenotype/selection group), so the classes come
// from the template, as `Identity.Classes._string` (token lists are read that
// way from sim scripts — see simulation/components/AlertRaiser.js).
const MAP_KIND_CACHE = new Map();

function MAP_kind(ent)
{
	const cmpTemplateManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_TemplateManager);
	const name = cmpTemplateManager.GetCurrentTemplateName(ent) || "";
	const cached = MAP_KIND_CACHE.get(ent);
	if (cached && cached.name === name)
		return cached.kind;

	let kind = 0;
	if (name)
	{
		const tpl = cmpTemplateManager.GetTemplate(name);
		const classes = tpl && tpl.Identity && tpl.Identity.Classes ?
			String(tpl.Identity.Classes._string || "") : "";
		for (const k of MAP_KINDS)
			if (classes.indexOf(k.class) !== -1)
			{
				kind = k.kind;
				break;
			}
	}
	MAP_KIND_CACHE.set(ent, { "name": name, "kind": kind });
	return kind;
}

function MAP_state(ent, kind)
{
	if (kind >= 5)
		return 0;
	const cmpUnitAI = Engine.QueryInterface(ent, IID_UnitAI);
	if (!cmpUnitAI)
		return 0;
	const state = cmpUnitAI.GetCurrentState();
	if (state.indexOf("IDLE") !== -1)
		return 0;
	if (state.indexOf("GATHER") !== -1)
		return 1;
	if (state.indexOf("ATTACK") !== -1 || state.indexOf("COMBAT") !== -1)
		return 2;
	return 3;
}

Trigger.prototype.MapSnapshot = function()
{
	const t0 = Date.now();
	const now = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer).GetTime() / 1000;
	const per = { "1": [], "2": [] };
	for (const ent of Engine.GetEntitiesWithInterface(IID_Position))
	{
		const cmpOwnership = Engine.QueryInterface(ent, IID_Ownership);
		const owner = cmpOwnership ? cmpOwnership.GetOwner() : -1;
		if (owner !== 1 && owner !== 2)
			continue;
		const kind = MAP_kind(ent);
		if (!kind)
			continue;
		const cmpPosition = Engine.QueryInterface(ent, IID_Position);
		if (!cmpPosition.IsInWorld())
			continue;
		const pos = cmpPosition.GetPosition2D();
		per[owner].push("[" + ent + "," + kind + "," + MAP_state(ent, kind) + "," +
			Math.round(pos.x) + "," + Math.round(pos.y) + "]");
	}
	print("[HARNESS] map {\"t\":" + now.toFixed(0) +
		",\"dt\":" + (Date.now() - t0) +
		",\"1\":[" + per["1"].join(",") + "],\"2\":[" + per["2"].join(",") + "]}\n");
};

// ---------------------------------------------------------------------------
// Layout snapshots: every structure's true footprint, every 2 min of sim time.
//
// Purpose: measure base clutter offline (tools/layout.py) — obstruction
// rectangles, not dots, so free sides, street widths and path detours can be
// computed exactly. One stdout line per snapshot:
//   [HARNESS] layout {"t": <sim s>, "1": [[name,x,z,angle,w,d,blocks], ...], "2": [...]}
// name: template short name (foundations get a trailing "*"), x,z metres
// (0.1 m), angle radians (0.01), w,d obstruction size, blocks 1 when the
// obstruction blocks movement (fields do not). Observation only.
// ---------------------------------------------------------------------------

const LAYOUT_TPL_CACHE = new Map();

function LAYOUT_tpl(name)
{
	let rec = LAYOUT_TPL_CACHE.get(name);
	if (rec !== undefined)
		return rec;
	const tpl = Engine.QueryInterface(SYSTEM_ENTITY, IID_TemplateManager).GetTemplate(name);
	const st = tpl && tpl.Obstruction && tpl.Obstruction.Static;
	const classes = tpl && tpl.Identity && tpl.Identity.Classes ? String(tpl.Identity.Classes._string || "") : "";
	rec = null;
	if (st && classes.indexOf("Structure") !== -1)
		rec = {
			"short": name.replace(/^foundation\|/, "").split("/").pop() + (name.indexOf("foundation|") === 0 ? "*" : ""),
			"w": +st["@width"], "d": +st["@depth"],
			"blocks": String(tpl.Obstruction.BlockMovement) === "false" ? 0 : 1
		};
	LAYOUT_TPL_CACHE.set(name, rec);
	return rec;
}

Trigger.prototype.LayoutSnapshot = function()
{
	const now = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer).GetTime() / 1000;
	const cmpTemplateManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_TemplateManager);
	const per = { "1": [], "2": [] };
	for (const ent of Engine.GetEntitiesWithInterface(IID_Obstruction))
	{
		const cmpOwnership = Engine.QueryInterface(ent, IID_Ownership);
		const owner = cmpOwnership ? cmpOwnership.GetOwner() : -1;
		if (owner !== 1 && owner !== 2)
			continue;
		const rec = LAYOUT_tpl(cmpTemplateManager.GetCurrentTemplateName(ent) || "");
		if (!rec)
			continue;
		const cmpPosition = Engine.QueryInterface(ent, IID_Position);
		if (!cmpPosition || !cmpPosition.IsInWorld())
			continue;
		const pos = cmpPosition.GetPosition2D();
		per[owner].push("[\"" + rec.short + "\"," + pos.x.toFixed(1) + "," + pos.y.toFixed(1) + "," +
			cmpPosition.GetRotation().y.toFixed(2) + "," + rec.w + "," + rec.d + "," + rec.blocks + "]");
	}
	print("[HARNESS] layout {\"t\":" + now.toFixed(0) +
		",\"1\":[" + per["1"].join(",") + "],\"2\":[" + per["2"].join(",") + "]}\n");
};

Trigger.prototype.PrintEfficiency = function()
{
	if (EFF_printed)
		return;
	EFF_printed = true;

	print("[HARNESS] worker-efficiency player 1: gathered / theoretical / efficiency / tasked time; per-5min buckets\n");
	const minutes = [];
	for (let i = 0; i <= EFF_maxBucket; ++i)
		minutes.push(String(i * 5).padStart(2) + "m");
	print("[HARNESS] bucket minutes:  " + minutes.join("  ") + "\n");

	for (const cls of EFF_CLASS_ORDER)
	{
		const rec = EFF[cls];
		const eff = rec.theoretical > 0 ? (100 * rec.gathered / rec.theoretical).toFixed(1) : "-";
		const per = [];
		for (let i = 0; i <= EFF_maxBucket; ++i)
		{
			const b = rec.buckets[i];
			per.push(b && b.theoretical > 0 ? String(Math.round(100 * b.gathered / b.theoretical)).padStart(4) : "   -");
		}
		print("[HARNESS] " + cls.padEnd(6) +
			" gathered=" + String(Math.round(rec.gathered)).padStart(6) +
			" theoretical=" + rec.theoretical.toFixed(1).padStart(9) +
			" efficiency=" + String(eff).padStart(6) + "%" +
			" tasked=" + (rec.taskedMs / 60000).toFixed(1).padStart(6) + "min" +
			" buckets=[" + per.join(" ") + "]%\n");
	}

	// Diagnostic classes (no bars): ruins + meat, for reconciling with the
	// statistics' per-generic-type gathered counters.
	for (const cls of EFF_DIAG_ORDER)
	{
		const rec = EFF[cls];
		print("[HARNESS] " + cls.padEnd(6) +
			" gathered=" + String(Math.round(rec.gathered)).padStart(6) +
			" tasked=" + (rec.taskedMs / 60000).toFixed(1).padStart(6) + "min\n");
	}

	if (EFF_totalWorkerMs > 0)
	{
		let tasked = 0;
		for (const cls of EFF_CLASS_ORDER)
			tasked += EFF[cls].taskedMs;
		print("[HARNESS] utilization=" + (100 * tasked / EFF_totalWorkerMs).toFixed(1) + "%" +
			" (tasked " + (tasked / 60000).toFixed(1) + "min of " +
			(EFF_totalWorkerMs / 60000).toFixed(1) + "min total worker-min)\n");
	}
};

{
	const cmpTrigger = Engine.QueryInterface(SYSTEM_ENTITY, IID_Trigger);

	// Worker-efficiency telemetry: sample every 200 ms of sim time
	// (pick-ups and drop-offs must not straddle one window — see the file
	// header).
	cmpTrigger.RegisterTrigger("OnInterval", "EfficiencySample", { "enabled": true, "delay": 200, "interval": 200 });

	// Map snapshots: every 30 s of sim time (see the section above).
	cmpTrigger.RegisterTrigger("OnInterval", "MapSnapshot", { "enabled": true, "delay": 30000, "interval": 30000 });

	// Layout snapshots: every 2 min of sim time (see the section above).
	cmpTrigger.RegisterTrigger("OnInterval", "LayoutSnapshot", { "enabled": true, "delay": 120000, "interval": 120000 });

	// Print the summary when the game ends, next to the statistics JSON.
	cmpTrigger.RegisterTrigger("OnPlayerWon", "PrintEfficiency", { "enabled": true });
	cmpTrigger.RegisterTrigger("OnPlayerDefeated", "PrintEfficiency", { "enabled": true });

	// ----------------------------------------------------------------
	// Public ConquestCivicCentres.js, unchanged:
	// ----------------------------------------------------------------
	cmpTrigger.ConquestAddVictoryCondition({
		"classFilter": "CivilCentre+!Foundation",
		"defeatReason": markForTranslation("%(player)s has been defeated (lost all civic centers).")
	});
	cmpTrigger.ConquestAddVictoryCondition({
		"classFilter": "ConquestCritical CivilCentre+!Foundation",
		"defeatReason": markForTranslation("%(player)s has been defeated (lost all civic centers and critical units and structures).")
	});
}
