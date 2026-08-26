import { BaseAI } from "simulation/ai/common-api/baseAI.js";

// dict: resource name -> weight (number); sums to 1, constant for now.
// A zero weight means no worker is ever sent to that resource.
const GATHER_WEIGHTS = { food: 0.5, wood: 0.5, metal: 0, stone: 0 };

// number: the bot plays every that many turns
const PLAY_EVERY_N_TURN = 8;

/**
 * @param {object} settings — engine-provided player settings: { player,
 *   difficulty, behavior } (see the AI engine API docs).
 */
export function LouisBot(settings) {
  BaseAI.call(this, settings);
}

LouisBot.prototype = Object.create(BaseAI.prototype);

/**
 * @param {Iterable<Entity>} structures — own structures to scan.
 * @param {string} ccType — template name of the civic centre, e.g.
 *   "structures/gaul/civil_centre".
 * @returns {Entity|undefined} the player's civic centre.
 */
function findCivicCentre(structures, ccType) {
  // Entity: one own structure
  for (const entity of structures)
    if (entity.templateName() === ccType) return entity;
  return undefined;
}

/**
 * @param {Array<{pos: [number, number], food: number}>} supplies — food
 *   supplies with their positions and current amounts.
 * @param {[number, number]} civic_centre_pos — civic centre position.
 * @returns {{anchor: [number, number], food: number, bushes: number,
 *   median: [number, number]}|undefined}
 */
function findFarmCluster(supplies, civic_centre_pos) {
  // object or undefined: best cluster found so far
  let best;
  // number: distance from the civic centre to the best anchor
  let best_distance = Infinity;
  // object { pos, food }: one supply, the circle anchor
  for (const anchor of supplies) {
    // array of { pos, food }: supplies inside the 20 m circle
    const members = supplies.filter(
      (supply) =>
        Math.hypot(
          supply.pos[0] - anchor.pos[0],
          supply.pos[1] - anchor.pos[1],
        ) <= 20,
    );
    // number: total food in the circle
    const food = members.reduce((sum, supply) => sum + supply.food, 0);
    if (food < 500) continue;
    // number: distance from the anchor to the civic centre
    const distance = Math.hypot(
      anchor.pos[0] - civic_centre_pos[0],
      anchor.pos[1] - civic_centre_pos[1],
    );
    if (distance < best_distance) {
      best_distance = distance;
      best = {
        anchor: anchor.pos,
        food: food,
        bushes: members.length,
        median: geometricMedian(members.map((supply) => supply.pos)),
      };
    }
  }
  return best;
}

/**
 * 50 iterations settle the typical handful of bushes.
 * @param {Array<[number, number]>} points — positions to serve.
 * @returns {[number, number]} the geometric median.
 */
function geometricMedian(points) {
  // number: x of the iterate
  let x = 0;
  // number: z of the iterate
  let z = 0;
  // [number, number]: one position
  for (const point of points) {
    x += point[0];
    z += point[1];
  }
  x /= points.length;
  z /= points.length;
  // number: Weiszfeld iteration index
  for (let iteration = 0; iteration < 50; ++iteration) {
    // number: weighted sum over x
    let weighted_x = 0;
    // number: weighted sum over z
    let weighted_z = 0;
    // number: total weight
    let weight_sum = 0;
    // [number, number]: one position
    for (const point of points) {
      // number: distance to the iterate, floored to avoid division by zero
      const distance = Math.max(0.01, Math.hypot(point[0] - x, point[1] - z));
      weighted_x += point[0] / distance;
      weighted_z += point[1] / distance;
      weight_sum += 1 / distance;
    }
    x = weighted_x / weight_sum;
    z = weighted_z / weight_sum;
  }
  return [x, z];
}

/**
 * @param {Array<{id: number, pos: [number, number]}>} candidates — units to
 *   rank.
 * @param {[number, number]} target_pos — reference position.
 * @param {number} count — how many ids to return.
 * @returns {Array<number>} ids of the nearest candidates.
 */
function nearestIds(candidates, target_pos, count) {
  return candidates
    .map((candidate) => ({
      id: candidate.id,
      distance_squared:
        (candidate.pos[0] - target_pos[0]) *
          (candidate.pos[0] - target_pos[0]) +
        (candidate.pos[1] - target_pos[1]) * (candidate.pos[1] - target_pos[1]),
    }))
    .sort((a, b) => a.distance_squared - b.distance_squared)
    .slice(0, count)
    .map((candidate) => candidate.id);
}

/**
 * @param {{half_w: number, half_d: number, angle: number, pass: object,
 *   mask: number, terr: object, player: number}} placement — building half
 *   extents, placement angle, passability map, passability class mask,
 *   territory map and player id, all from the game state.
 * @param {[number, number]} center — ideal spot to search around.
 * @param {number} max_radius — search distance from `center`, in meters.
 * @param {Array<[number, number]>} failed_spots — spots to skip.
 * @returns {[number, number]|undefined}
 */
function findPlacementSpot(placement, center, max_radius, failed_spots) {
  // number: ring radius in meters
  for (let radius = 0; radius <= max_radius; radius += 2)
    // number: sample index around the ring
    for (let sample_index = 0; sample_index < 64; ++sample_index) {
      // number: angle of this sample
      const angle = (sample_index * 2 * Math.PI) / 64;
      // number: candidate x coordinate
      const x = center[0] + radius * Math.cos(angle);
      // number: candidate z coordinate
      const z = center[1] + radius * Math.sin(angle);
      // [number, number]: one rejected spot
      if (
        failed_spots.some(
          (spot) => Math.abs(spot[0] - x) < 8 && Math.abs(spot[1] - z) < 8,
        )
      )
        continue;
      if (
        placementOK(
          x,
          z,
          placement.half_w,
          placement.half_d,
          placement.angle,
          placement.pass,
          placement.mask,
          placement.terr,
          placement.player,
        )
      )
        return [x, z];
    }
  return undefined;
}

/**
 * @param {number} x, z — candidate position.
 * @param {number} half_width, half_depth — building half width and half depth.
 * @param {number} angle — building rotation in radians.
 * @param {object} passability_map — passability map: { width, height,
 *   cellSize, data: Uint16Array }.
 * @param {number} mask — passability class bitmask to test (set bit means
 *   impassable).
 * @param {object} territory_map — territory map: { width, height, cellSize,
 *   data: Uint8Array }.
 * @param {number} player — player id that must own the territory box.
 * @returns {boolean}
 */
function placementOK(
  x,
  z,
  half_width,
  half_depth,
  angle,
  passability_map,
  mask,
  territory_map,
  player,
) {
  // number: half width inflated by 0.75 m
  const inflated_half_width = half_width + 0.75;
  // number: half depth inflated by 0.75 m
  const inflated_half_depth = half_depth + 0.75;
  // number: extent of the rotated footprint on x
  const extent_x =
    inflated_half_width * Math.abs(Math.cos(angle)) +
    inflated_half_depth * Math.abs(Math.sin(angle));
  // number: extent of the rotated footprint on z
  const extent_z =
    inflated_half_width * Math.abs(Math.sin(angle)) +
    inflated_half_depth * Math.abs(Math.cos(angle));

  // number: size of one passability cell
  const cell_size = passability_map.cellSize;
  // number: lowest cell index covered on x
  const x_min = Math.floor((x - extent_x) / cell_size);
  // number: highest cell index covered on x
  const x_max = Math.floor((x + extent_x) / cell_size);
  // number: lowest cell index covered on z
  const z_min = Math.floor((z - extent_z) / cell_size);
  // number: highest cell index covered on z
  const z_max = Math.floor((z + extent_z) / cell_size);
  if (
    x_min < 0 ||
    z_min < 0 ||
    x_max >= passability_map.width ||
    z_max >= passability_map.height
  )
    return false;
  // number: cosine of the placement angle
  const cos_angle = Math.cos(angle);
  // number: sine of the placement angle
  const sin_angle = Math.sin(angle);
  // number: cell index along z
  for (let cell_z = z_min; cell_z <= z_max; ++cell_z)
    // number: cell index along x
    for (let cell_x = x_min; cell_x <= x_max; ++cell_x) {
      // number: cell centre offset from the candidate, on x
      const offset_x = (cell_x + 0.5) * cell_size - x;
      // number: cell centre offset from the candidate, on z
      const offset_z = (cell_z + 0.5) * cell_size - z;
      // number: offset rotated into the footprint frame, on x
      const rotated_x = offset_x * cos_angle + offset_z * sin_angle;
      // number: offset rotated into the footprint frame, on z
      const rotated_z = -offset_x * sin_angle + offset_z * cos_angle;
      if (
        Math.abs(rotated_x) <= inflated_half_width &&
        Math.abs(rotated_z) <= inflated_half_depth &&
        passability_map.data[cell_x + cell_z * passability_map.width] & mask
      )
        return false;
    }

  // number: size of one territory cell
  const territory_cell_size = territory_map.cellSize;
  // number: lowest territory cell index covered on x
  const territory_x_min = Math.floor((x - extent_x) / territory_cell_size);
  // number: highest territory cell index covered on x
  const territory_x_max = Math.floor((x + extent_x) / territory_cell_size);
  // number: lowest territory cell index covered on z
  const territory_z_min = Math.floor((z - extent_z) / territory_cell_size);
  // number: highest territory cell index covered on z
  const territory_z_max = Math.floor((z + extent_z) / territory_cell_size);
  if (
    territory_x_min < 0 ||
    territory_z_min < 0 ||
    territory_x_max >= territory_map.width ||
    territory_z_max >= territory_map.height
  )
    return false;
  // number: territory cell index along z
  for (
    let territory_cell_z = territory_z_min;
    territory_cell_z <= territory_z_max;
    ++territory_cell_z
  )
    // number: territory cell index along x
    for (
      let territory_cell_x = territory_x_min;
      territory_cell_x <= territory_x_max;
      ++territory_cell_x
    )
      if (
        (territory_map.data[
          territory_cell_x + territory_cell_z * territory_map.width
        ] &
          0x1f) !==
        player
      )
        return false;
  return true;
}

/**
 * Falls back to the generic type, like the engine's own lookup.
 * @param {object|undefined} rates — worker's resourceGatherRates() output,
 *   subtype name -> rate.
 * @param {string} subtype — full subtype, e.g. "food.fruit".
 * @param {string} generic_type — generic type, e.g. "food".
 * @returns {number}
 */
function templateRate(rates, subtype, generic_type) {
  if (!rates) return 0;
  return +rates[subtype] || +rates[generic_type] || 0;
}

/**
 * @param {object} template_rates — worker's resourceGatherRates() output.
 * @param {{id: number, generic: string, specific: string,
 *   gatherer_count: number, max_gatherers: number,
 *   diminishing_return: number, measured_rate: number,
 *   measured_template_rate: number}} source — one free gatherer slot.
 * @returns {number}
 */
function estimateSourceRate(template_rates, source) {
  // number: the worker's template rate on this subtype, 0 if it cannot gather it
  const template_rate = templateRate(
    template_rates,
    source.specific,
    source.generic,
  );
  if (template_rate <= 0) return 0;
  if (source.measured_rate > 0)
    return (
      source.measured_rate * (template_rate / source.measured_template_rate)
    );
  return (
    template_rate * Math.pow(source.diminishing_return, source.gatherer_count)
  );
}

/**
 * @param {object} assignment_by_worker_id — worker id -> { resource,
 *   source_id, subtype }.
 * @param {object} carried_amount_by_worker_id — worker id -> last seen
 *   carried amount.
 * @param {object} measured_rate_by_worker_id — worker id -> { rate, turn }.
 * @param {object} last_delivery_time_by_worker_id — worker id -> delivery
 *   time in milliseconds.
 * @param {Array<string>} dead_worker_ids — worker ids whose entity is gone.
 * @returns {{assignment_by_worker_id: object,
 *   carried_amount_by_worker_id: object, measured_rate_by_worker_id: object,
 *   last_delivery_time_by_worker_id: object}}
 */
function pruneWorkers(
  assignment_by_worker_id,
  carried_amount_by_worker_id,
  measured_rate_by_worker_id,
  last_delivery_time_by_worker_id,
  dead_worker_ids,
) {
  // dict: worker id -> { resource, source_id, subtype }, pruned copy
  const new_assignment_by_worker_id = { ...assignment_by_worker_id };
  // dict: worker id -> last seen carried amount, pruned copy
  const new_carried_amount_by_worker_id = {
    ...carried_amount_by_worker_id,
  };
  // dict: worker id -> { rate, turn }, pruned copy
  const new_measured_rate_by_worker_id = { ...measured_rate_by_worker_id };
  // dict: worker id -> last delivery time in milliseconds, pruned copy
  const new_last_delivery_time_by_worker_id = {
    ...last_delivery_time_by_worker_id,
  };

  // string: id of a worker that died
  for (const worker_id of dead_worker_ids) {
    delete new_assignment_by_worker_id[worker_id];
    delete new_carried_amount_by_worker_id[worker_id];
    delete new_measured_rate_by_worker_id[worker_id];
    delete new_last_delivery_time_by_worker_id[worker_id];
  }

  return {
    assignment_by_worker_id: new_assignment_by_worker_id,
    carried_amount_by_worker_id: new_carried_amount_by_worker_id,
    measured_rate_by_worker_id: new_measured_rate_by_worker_id,
    last_delivery_time_by_worker_id: new_last_delivery_time_by_worker_id,
  };
}

/**
 * @param {object} carried_amount_by_worker_id — worker id -> last seen
 *   carried amount.
 * @param {object} measured_rate_by_worker_id — worker id -> { rate, turn }.
 * @param {object} last_delivery_time_by_worker_id — worker id -> delivery
 *   time in milliseconds.
 * @param {Array<{worker_id: string, carried_now: number}>} live_workers —
 *   assigned workers that still exist, with their current carried amount.
 * @param {number} time_ms — current simulation time in milliseconds.
 * @param {number} turn — current bot turn, stamped into new rate records.
 * @returns {{carried_amount_by_worker_id: object,
 *   measured_rate_by_worker_id: object,
 *   last_delivery_time_by_worker_id: object}}
 */
function measureGatheringRates(
  carried_amount_by_worker_id,
  measured_rate_by_worker_id,
  last_delivery_time_by_worker_id,
  live_workers,
  time_ms,
  turn,
) {
  // dict: worker id -> last seen carried amount, refreshed copy
  const new_carried_amount_by_worker_id = { ...carried_amount_by_worker_id };
  // dict: worker id -> { rate, turn }, updated copy
  const new_measured_rate_by_worker_id = { ...measured_rate_by_worker_id };
  // dict: worker id -> last delivery time in milliseconds, stamped copy
  const new_last_delivery_time_by_worker_id = {
    ...last_delivery_time_by_worker_id,
  };

  // object { worker_id, carried_now }: one live worker
  for (const worker of live_workers) {
    // string: worker id, dict key
    const worker_id = worker.worker_id;
    // number: current carried amount
    const carried_now = worker.carried_now;
    if (new_carried_amount_by_worker_id[worker_id] > 0 && carried_now === 0) {
      // number: milliseconds since the previous delivery
      const elapsed_ms =
        time_ms - (new_last_delivery_time_by_worker_id[worker_id] ?? time_ms);
      if (elapsed_ms > 0)
        // object: { rate: number, turn: number }
        new_measured_rate_by_worker_id[worker_id] = {
          rate:
            (new_carried_amount_by_worker_id[worker_id] * 1000) / elapsed_ms,
          turn: turn,
        };
      new_last_delivery_time_by_worker_id[worker_id] = time_ms;
    }
    new_carried_amount_by_worker_id[worker_id] = carried_now;
  }

  return {
    carried_amount_by_worker_id: new_carried_amount_by_worker_id,
    measured_rate_by_worker_id: new_measured_rate_by_worker_id,
    last_delivery_time_by_worker_id: new_last_delivery_time_by_worker_id,
  };
}

/**
 * @param {Array<{id: number, template_rates: object}>} workers — idle
 *   gatherers with their template rates.
 * @param {object} committed_rate_by_resource — resource -> sum of rates
 *   already committed.
 * @param {object} free_slots_by_resource — resource -> array of source
 *   records, as in estimateSourceRate.
 * @param {object} weights — resource -> weight.
 * @returns {Array<{worker_id: number, source_id: number}>}
 */
function assignIdleWorkers(
  workers,
  committed_rate_by_resource,
  free_slots_by_resource,
  weights,
) {
  // dict: resource name -> remaining source records (local copies)
  const remaining_slots_by_resource = {};
  // string: resource name
  for (const resource of Object.keys(free_slots_by_resource))
    remaining_slots_by_resource[resource] = free_slots_by_resource[
      resource
    ].map((source) => ({ ...source }));
  // dict: resource name -> running committed rate, including this pass's choices
  const running_rate_by_resource = { ...committed_rate_by_resource };
  // array of { worker_id, source_id }: the assignment decisions
  const assignment_pairs = [];
  // object { id, template_rates }: one idle worker
  for (const worker of workers) {
    // string or undefined: resource picked for this worker
    let best_resource;
    // object or undefined: source record picked for this worker
    let best_source;
    // number: score of the best choice so far
    let best_score = Infinity;
    // string: resource name
    for (const resource of Object.keys(remaining_slots_by_resource)) {
      if (
        !(weights[resource] > 0) ||
        remaining_slots_by_resource[resource].length === 0
      )
        continue;
      // object or undefined: best source of this resource for this worker
      let source;
      // number: its estimated rate
      let best_rate = 0;
      // object: one source record of this resource
      for (const candidate of remaining_slots_by_resource[resource]) {
        // number: estimated rate of this worker on that source
        const rate = estimateSourceRate(worker.template_rates, candidate);
        if (rate > best_rate) {
          best_rate = rate;
          source = candidate;
        }
      }
      if (!source) continue;
      // number: scaled share of this resource after adding the slot
      const score =
        (running_rate_by_resource[resource] + best_rate) / weights[resource];
      if (score < best_score) {
        best_score = score;
        best_resource = resource;
        best_source = source;
      }
    }
    if (!best_source) continue;
    assignment_pairs.push({ worker_id: worker.id, source_id: best_source.id });
    running_rate_by_resource[best_resource] += estimateSourceRate(
      worker.template_rates,
      best_source,
    );
    best_source.gatherer_count += 1;
    if (best_source.gatherer_count >= best_source.max_gatherers)
      remaining_slots_by_resource[best_resource] = remaining_slots_by_resource[
        best_resource
      ].filter((source) => source !== best_source);
  }
  return assignment_pairs;
}

/**
 * The worker pass: the impure layer around the pure functions, the only
 * place that reads the simulation and posts gather orders.
 * @param {object} worker_state — { assignment_by_worker_id,
 *   carried_amount_by_worker_id, measured_rate_by_worker_id,
 *   last_delivery_time_by_worker_id }.
 * @param {GameState} game_state — this player's game state.
 * @param {number} turn — current bot turn, stamped into new rate records.
 * @returns {object} the updated worker_state.
 */
function manageWorkers(worker_state, game_state, turn) {
  // dict: worker id -> { resource, source_id, subtype }
  let assignment_by_worker_id = worker_state.assignment_by_worker_id || {};
  // dict: worker id -> last seen carried amount (number)
  let carried_amount_by_worker_id =
    worker_state.carried_amount_by_worker_id || {};
  // dict: worker id -> { rate: number, turn: number }
  let measured_rate_by_worker_id =
    worker_state.measured_rate_by_worker_id || {};
  // dict: worker id -> last delivery time in milliseconds (number)
  let last_delivery_time_by_worker_id =
    worker_state.last_delivery_time_by_worker_id || {};

  // number: current simulation time in milliseconds
  const time_ms = game_state.getTimeElapsed();

  // A table entry only holds while the worker is alive and busy: an idle
  // worker's gather order has ended, its entry is stale.
  ({
    assignment_by_worker_id,
    carried_amount_by_worker_id,
    measured_rate_by_worker_id,
    last_delivery_time_by_worker_id,
  } = pruneWorkers(
    assignment_by_worker_id,
    carried_amount_by_worker_id,
    measured_rate_by_worker_id,
    last_delivery_time_by_worker_id,
    Object.keys(assignment_by_worker_id).filter((worker_id) => {
      // Entity or undefined: the worker, undefined if it died
      const worker = game_state.getEntityById(+worker_id);
      return !worker || worker.isIdle();
    }),
  ));

  ({
    carried_amount_by_worker_id,
    measured_rate_by_worker_id,
    last_delivery_time_by_worker_id,
  } = measureGatheringRates(
    carried_amount_by_worker_id,
    measured_rate_by_worker_id,
    last_delivery_time_by_worker_id,
    Object.keys(assignment_by_worker_id).map((worker_id) => ({
      worker_id: worker_id,
      carried_now: +(
        (game_state.getEntityById(+worker_id).resourceCarrying() || [])[0]
          ?.amount ?? 0
      ),
    })),
    time_ms,
    turn,
  ));

  // dict: resource name -> committed gather rate (number)
  const committed_rate_by_resource = { food: 0, wood: 0, metal: 0, stone: 0 };
  // [string, object]: worker id and its assignment record
  for (const [worker_id, assignment] of Object.entries(
    assignment_by_worker_id,
  )) {
    // number: measured rate, 0 before the first delivery
    let rate = measured_rate_by_worker_id[worker_id]?.rate;
    if (!rate) {
      // Entity or undefined: the assigned worker
      const worker = game_state.getEntityById(+worker_id);
      if (worker)
        rate = templateRate(
          worker.resourceGatherRates(),
          assignment.subtype,
          assignment.resource,
        );
    }
    committed_rate_by_resource[assignment.resource] += rate || 0;
  }

  // The resource collections are maintained globally by the shared
  // script, no full map scan here.
  // dict: resource name -> array of source records (see estimateSourceRate)
  const free_slots_by_resource = {};
  // string: resource name
  for (const resource of Object.keys(GATHER_WEIGHTS)) {
    // array of source records: free slots of this resource
    const slots = [];
    // Entity: one resource supply
    for (const supply of game_state.getResourceSupplies(resource).values()) {
      // [number, number] or undefined: supply position
      const pos = supply.position();
      // object { generic, specific } or undefined: supply type
      const supply_type = supply.resourceSupplyType();
      if (!pos || !supply_type || supply.resourceSupplyAmount() <= 0) continue;
      // number: gatherer cap of the supply
      const max_gatherers = supply.maxGatherers();
      // number: gatherers currently on it, including en route
      const gatherer_count = supply.resourceSupplyNumGatherers();
      if (max_gatherers <= 0 || gatherer_count >= max_gatherers) continue;
      slots.push({
        id: supply.id(),
        generic: supply_type.generic,
        specific: supply_type.generic + "." + supply_type.specific,
        gatherer_count: gatherer_count,
        max_gatherers: max_gatherers,
        diminishing_return: supply.getDiminishingReturns(),
        measured_rate: 0,
        measured_template_rate: 0,
      });
    }
    free_slots_by_resource[resource] = slots;
  }

  // array of source records: the free slots of one resource
  for (const slots of Object.values(free_slots_by_resource))
    // object: one source record
    for (const source of slots) {
      // number: summed measured rates of workers on this source
      let measured_sum = 0;
      // number: summed template rates of those workers
      let template_sum = 0;
      // number: how many workers had a measurement
      let measured_count = 0;
      // [string, object]: worker id and its assignment record
      for (const [worker_id, assignment] of Object.entries(
        assignment_by_worker_id,
      ))
        if (assignment.source_id === source.id) {
          // Entity or undefined: the worker on this source
          const worker = game_state.getEntityById(+worker_id);
          if (!worker) continue;
          // number: template rate of the worker on this source's subtype
          const template_rate = templateRate(
            worker.resourceGatherRates(),
            source.specific,
            source.generic,
          );
          if (
            template_rate > 0 &&
            measured_rate_by_worker_id[worker_id]?.rate
          ) {
            measured_sum += measured_rate_by_worker_id[worker_id].rate;
            template_sum += template_rate;
            measured_count++;
          }
        }
      if (measured_count > 0) {
        source.measured_rate = measured_sum / measured_count;
        source.measured_template_rate = template_sum / measured_count;
      }
    }

  // Sorted by id so the greedy below is deterministic.
  // array of { id: number, template_rates: object }: idle gatherers
  const idle_gatherers = game_state
    .getOwnUnits()
    .toEntityArray()
    .filter(
      (ent) =>
        ent.isGatherer() &&
        ent.isIdle() &&
        ent.position() &&
        assignment_by_worker_id[ent.id()] === undefined,
    )
    .map((ent) => ({
      id: ent.id(),
      template_rates: ent.resourceGatherRates(),
    }))
    .sort((a, b) => a.id - b.id);

  // array of { worker_id, source_id }: pairs to order
  const new_assignments = assignIdleWorkers(
    idle_gatherers,
    committed_rate_by_resource,
    free_slots_by_resource,
    GATHER_WEIGHTS,
  );
  if (new_assignments.length > 0) {
    // dict: resource name -> how many workers were assigned there this pass
    const assigned_count_by_resource = {};
    // object { worker_id, source_id }: one pair
    for (const pair of new_assignments) {
      // Entity or undefined: worker to order
      const worker = game_state.getEntityById(pair.worker_id);
      // Entity or undefined: source it should gather
      const source = game_state.getEntityById(pair.source_id);
      if (!worker || !source) continue;
      worker.gather(source);
      // object { generic, specific }: type of the chosen source
      const supply_type = source.resourceSupplyType();
      assignment_by_worker_id[pair.worker_id] = {
        resource: supply_type.generic,
        source_id: pair.source_id,
        subtype: supply_type.generic + "." + supply_type.specific,
      };
      assigned_count_by_resource[supply_type.generic] =
        (assigned_count_by_resource[supply_type.generic] || 0) + 1;
    }
    print(
      `[HARNESS] louis-bot: t=${(time_ms / 60000).toFixed(1)}m assigned ${new_assignments.length} idle ${JSON.stringify(assigned_count_by_resource)}\n`,
    );
  }

  return {
    assignment_by_worker_id,
    carried_amount_by_worker_id,
    measured_rate_by_worker_id,
    last_delivery_time_by_worker_id,
  };
}

/**
 * @param {GameState} gameState — this player's game state.
 */
LouisBot.prototype.CustomInit = function (gameState) {
  print(`[HARNESS] louis-bot: loaded for player ${this.player}\n`);
};

/**
 * The top of the call stack: the only place that reads the engine and posts
 * commands, everything below is pure data transformation.
 * No parameters.
 */
LouisBot.prototype.OnUpdate = function () {
  // GameState: this player's game state
  const game_state = this.gameState;
  if (game_state.playerData.state !== "active") return;

  if (this.turn % PLAY_EVERY_N_TURN !== 0) {
    this.turn++;
    return;
  }

  // number: this bot's turn counter
  const turn = this.turn;
  // object or undefined: state stashed by Deserialize
  const saved_state = this.saved_state;
  // object: { assignment_by_worker_id, carried_amount_by_worker_id,
  //   measured_rate_by_worker_id, last_delivery_time_by_worker_id }
  const worker_state = this.worker_state ?? saved_state?.worker_state ?? {};

  this.worker_state = manageWorkers(worker_state, game_state, turn);
  this.turn = turn + 1;
};

/**
 * Plain structured-cloneable data only, no live Entity references.
 * @returns {object} the bot state to persist in saved games.
 */
LouisBot.prototype.Serialize = function () {
  return {
    worker_state: this.worker_state,
  };
};

/**
 * The state is only stashed here; OnUpdate restores it on the first update
 * after load.
 * @param {object} data — plain object returned by Serialize.
 * @param {SharedScript} sharedScript — the shared script instance.
 */
LouisBot.prototype.Deserialize = function (data, sharedScript) {
  this.saved_state = data || {};
  this.isDeserialized = true;
};
