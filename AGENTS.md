# Skill Creation Guide

## Where skills live

- **Weapon skills** (skill trees): `packages/shared/src/constants/skills.ts` — `CLASS_SKILL_DATA`
- **Class skills** (class-specific): `packages/shared/src/constants/classSkills.ts`
- **Types**: `packages/shared/src/types/skills.ts`
- **Debuff table**: `packages/shared/src/constants/debuffs.ts`
- **Buff table**: `packages/shared/src/types/status.ts` — `BuffEffectTable`

After editing skill definitions in shared, rebuild: `cd packages/shared && npm run build`

## How skill typing works

`inferSkillType()` in `packages/server/src/core/ecs/systems/SkillSystem.ts` determines what a skill does. The priority order is:

1. Explicit `skillType` on the definition (always wins if set)
2. `isPassive` → PASSIVE
3. `isRevive` → REVIVE
4. `isSong` → SONG
5. `sacrificeHeal` → SACRIFICE_HEAL
6. `mpDamage` → MP_DAMAGE
7. **`basePower > 0`** → DAMAGE_PHYSICAL or DAMAGE_MAGICAL (checked BEFORE debuff)
8. `isDebuff` or `debuffEffectTable` → DEBUFF
9. `invisible` → INVISIBILITY
10. `barrier` → BARRIER
11. `healing` → HEAL
12. `isBuff` or `buffEffectTable` → BUFF
13. `createItems` → CRAFT
14. `summonObject` → SUMMON

**Key rule**: If `basePower > 0`, the skill is typed as DAMAGE even if it also has `debuffEffectTable`. The debuffs are applied as secondary effects after damage is dealt. Pure debuff skills (no `basePower`) are typed as DEBUFF.

## Damage formula

```
baseDamage = basePower * (primaryStat + secondaryStat * 0.3) * attackMultiplier ± defenseStat * 0.5
```

- **`+`** when `damageVsLowDefense: true` (defense increases damage)
- **`-`** normally (defense reduces damage)

### Stat scaling

By default:
- Physical: primary = STR, secondary = DEX
- Magical: primary = INT (or magicAttack), secondary = SPI

Override with `scalingStat`:
```ts
scalingStat: 'DEX'  // Uses DEX as primary stat instead of STR
```

### Proficiency scaling

Add bonus damage from the skill's proficiency category level:
```ts
proficiencyBonus: 0.5  // Adds floor(proficiencyLevel * 0.5) to primary stat
```

## Examples

### Example 1: Simple physical damage

```ts
"Power Strike": {
  name: "Power Strike",
  reqPoints: 10,
  mpCost: 15,
  castTime: 0,
  cooldown: 5,
  duration: 0,
  description: "A strong melee attack",
  damageType: DamageType.PHYSICAL,
  damageSubType: PhysicalDamageSubType.SLASH,
  basePower: 2,
},
```

### Example 2: Damage + debuff with proc chance

Debuffs use `shouldApplyDebuff()` which rolls accuracy vs resistance. The chance comes from caster SPI and proficiency, not from a percentage field.

```ts
"Crippling Blow": {
  name: "Crippling Blow",
  reqPoints: 20,
  mpCost: 25,
  castTime: 0,
  cooldown: 8,
  duration: 0,
  description: "Damage with chance to slow",
  damageType: DamageType.PHYSICAL,
  damageSubType: PhysicalDamageSubType.SLASH,
  basePower: 2,
  debuffEffectTable: {
    speedDown: 0.15,  // 15% slow if it lands
  },
  debuffDuration: 10,
},
```

The debuff accuracy is calculated as: `computeDebuffAccuracy(casterSPI, proficiency, debuffCategory)` minus the target's resistance. Higher SPI and proficiency = more reliable debuff.

### Example 3: Physical damage scaling with DEX

```ts
"Precise Thrust": {
  name: "Precise Thrust",
  reqPoints: 15,
  mpCost: 18,
  castTime: 0,
  cooldown: 4,
  duration: 0,
  description: "A precise strike that scales with agility",
  damageType: DamageType.PHYSICAL,
  damageSubType: PhysicalDamageSubType.THRUST,
  basePower: 2,
  scalingStat: 'DEX',  // Uses DEX instead of STR for primary stat
},
```

### Example 4: Damage scaling with proficiency

```ts
"Master's Slash": {
  name: "Master's Slash",
  reqPoints: 30,
  mpCost: 30,
  castTime: 0,
  cooldown: 6,
  duration: 0,
  description: "Damage that increases with Slash proficiency",
  damageType: DamageType.PHYSICAL,
  damageSubType: PhysicalDamageSubType.SLASH,
  basePower: 2,
  proficiencyBonus: 0.5,  // +floor(Slash proficiency * 0.5) to effective STR
},
```

### Example 5: The user's requested example (all combined)

Physical, scales with DEX, scales with proficiency, damage + stun debuff:

```ts
"Dancer's Strike": {
  name: "Dancer's Strike",
  reqPoints: 40,
  mpCost: 35,
  castTime: 0,
  cooldown: 10,
  duration: 0,
  description: "A graceful strike that stuns. Scales with DEX and proficiency",
  damageType: DamageType.PHYSICAL,
  damageSubType: PhysicalDamageSubType.SLASH,
  basePower: 2,
  scalingStat: 'DEX',
  proficiencyBonus: 0.5,
  debuffEffectTable: {
    hasStun: { duration: 2 },  // 2 second stun if it lands
  },
  debuffDuration: 2,
},
```

### Example 6: AOE ground-targeted spell with knockback

```ts
"Ice Storm": {
  name: "Ice Storm",
  reqPoints: 54,
  mpCost: 112,
  castTime: 7.5,
  cooldown: 20,
  duration: 3,
  description: "Summon a storm of ice that damages and knocks back enemies",
  damageSubType: MagicalDamageSubType.ICE,
  basePower: 1,
  isAOE: true,
  aoeTargetMode: AOETargetMode.GROUND_TARGETED,
  aoeRadius: 6,
  pulseCount: 3,
  pulseInterval: 1000,
  debuffEffectTable: {
    hasKnockback: { knockbackDistance: 2 },
  },
  debuffDuration: 1,
},
```

### Example 7: Defense-scaling damage (Subvert / Psychic Blades)

```ts
Subvert: {
  name: "Subvert",
  // ...
  basePower: 3,
  damageVsLowDefense: true,  // Higher enemy defense = MORE damage
},
```

### Example 8: Pure buff

```ts
"Bless Weapon": {
  name: "Bless Weapon",
  // ...
  isBuff: true,
  duration: 480,
  buffEffectTable: {
    attackUp: 10,
    accuracyUp: 10,
  },
},
```

### Example 9: Self-buff with special effect

```ts
Hide: {
  // ...
  duration: 0,
  skillType: SkillType.UTILITY,
  buffEffectTable: { invisible: { stationaryOnly: true, mpCostPerSec: 2 } },
},
```

## Common pitfalls

1. **Don't set `skillType` unless you need to override inference.** The inferred type is almost always correct.

2. **`basePower > 0` makes it a damage skill.** Even with `debuffEffectTable`, the skill will deal damage AND apply debuffs. Pure debuff skills should have no `basePower`.

3. **Debuff proc chance is not a field.** It's derived from caster SPI + proficiency vs target resistance. The `debuffEffectTable` values define what happens WHEN the debuff lands, not the chance.

4. **`debuffDuration` is in seconds** (multiplied by 1000 internally). Buff `duration` is also in seconds.

5. **Always provide `name`** matching the object key in weapon skill trees. Class skills don't need `name`.

6. **For targeted party buffs**, don't set `selfBuffOnly`. The cast completion handler calls `applyBuffToTarget` on the target player.

## DebuffEffectTable properties

Defined in `packages/shared/src/constants/debuffs.ts`:

| Property | Type | Effect |
|----------|------|--------|
| `attackDown` | number | Reduces attack by N |
| `defenseDown` | number | Reduces defense by N |
| `speedDown` | number | Reduces attack speed by fraction (0.15 = 15%) |
| `accuracyDown` | number | Reduces accuracy |
| `dodgeDown` | number | Reduces dodge |
| `castSpeedDown` | number | Reduces cast speed |
| `moveSpeedDown` | number | Flat movement speed reduction |
| `damageTakenUp` | number | Increases damage taken |
| `hasStun` | `{ duration: number }` | Stun (seconds) |
| `hasFreeze` | `{ duration: number }` | Freeze (seconds) |
| `hasSleep` | `{ duration: number }` | Sleep (seconds) |
| `hasSilence` | `{ duration: number }` | Silence (seconds) |
| `hasKnockback` | `{ knockbackDistance: number }` | Pushes target back |
| `disablePhysicalAttacks` | boolean | Blocks physical attack skills |
| `attackHalved` | boolean | Halves primary stat for damage |
| `preventResurrect` | boolean | Prevents resurrection |
| `curse` | boolean | Curse effect |
| `preventFieldSpells` | boolean | Blocks field spells |
| `removeResistBuffs` | string[] | Removes resistance buffs (elements) |
| `debuffCategory` | DebuffCategory | Sets resist category ('ailment', 'stun', 'burn', etc.) |

## BuffEffectTable properties

Defined in `packages/shared/src/types/status.ts`:

Common ones: `attackUp`, `defenseUp`, `speedUp`, `accuracyUp`, `maxHpFlat`, `maxHpPercent`, `dodgeFlat`, `resistMods`, `moveSpeed`, `manaShield`, `invisible`, `barrierPhysical`, `barrierMagical`, `elementalAbsorption`, `devotion`, `magicalAid`, `blockingStance`, `defensiveMarch`, `spellInterruptResist`, `debuffResist`, `critResist`.

## Build commands

```bash
cd packages/shared && npm run build    # After editing skill definitions
cd packages/server && npx tsc --noEmit # Typecheck server
cd packages/client && npx tsc --noEmit # Typecheck client
```

---

# On-Hit Proc System (Planned)

## Overview

Physical attacks can trigger additional effects (debuffs, drains, etc.) via two sources:
1. **Souls** — Items socketed into weapon soul slots, providing flat % proc chances
2. **Weapon innate procs** — Built-in effects tied to rune gem enhancement level

Unlike skill-based debuffs, proc debuffs use **flat % chances** and do NOT scale with SPI or proficiency.

## Proc effect types

```ts
type ProcEffectType =
  | 'weaken'        // debuffCategory: 'weaken'
  | 'burn'          // BURN status, tickInterval: 1000
  | 'sleep'         // SLEEP status
  | 'freeze'        // FREEZE status
  | 'drainLife'     // Not a debuff — heal attacker for potency% of damage dealt
  | 'trip'          // debuffCategory: 'trip'
  | 'stun'          // STUN status, debuffCategory: 'stun'
  | 'poison'        // DOT, tickInterval: 3000
  | 'bleed'         // DOT, tickInterval: 2000
  | 'silence'       // SILENCE status
  | 'castSpeedDown' // DEBUFF_CAST_SPEED_DOWN
  | 'slow'          // SLOW status (move speed down, NOT freeze)
```

## Data model

### OnHitProc (per-proc definition)

```ts
interface OnHitProc {
  effect: ProcEffectType;
  baseChance: number;        // 0-1, flat roll (no SPI scaling)
  chancePerLevel?: number;   // Additional chance per enhancement level (weapon innate)
  minLevel?: number;         // Minimum enhancement level to unlock
  duration?: number;         // Seconds (for debuffs)
  potency?: number;          // For DOT damage, drain %, etc.
  element?: string;          // For element-locked procs (e.g. 'dark')
}
```

### Soul item definition

Souls are items with `type: ItemType.MATERIAL` (or a new `SOUL` type) that carry `onHitProcs`:

```ts
// In packages/shared/src/constants/items.ts
"Burning Soul": {
  id: "soul_burning",
  name: "Burning Soul",
  type: ItemType.MATERIAL,
  rarity: ItemRarity.RARE,
  stats: {},
  description: "15% chance to burn on physical hit",
  maxStack: 1,
  sellPrice: 1000,
  requiredLevel: 1,
  onHitProcs: [
    { effect: 'burn', baseChance: 0.15, duration: 5, potency: 10 }
  ],
},
```

Multiple procs can be on one soul:

```ts
"Cursed Soul": {
  onHitProcs: [
    { effect: 'weaken', baseChance: 0.10, duration: 10 },
    { effect: 'poison', baseChance: 0.20, duration: 15, potency: 8 },
    { effect: 'silence', baseChance: 0.05, duration: 3 },
  ],
},
```

### Weapon innate procs

Weapons can have `innateProcs` that scale with enhancement level and element:

```ts
// In item definition
"Mad Sword Nightvalguys": {
  // ... normal weapon stats ...
  innateProcs: [
    {
      effect: 'weaken',
      baseChance: 0.0,           // Base 0% at +0
      chancePerLevel: 0.02,      // +2% per enhancement level
      duration: 10,
      element: 'dark',           // Only active when enhanced with dark rune gem
    },
    {
      effect: 'drainLife',
      baseChance: 0.0,
      chancePerLevel: 0.0,
      minLevel: 6,               // Only at +6 or higher
      potency: 0.05,             // Drains 5% of damage dealt as HP
      element: 'dark',
    },
  ],
},
```

## Soul storage

Souls need to be tracked on the player. Add to `Equipment` interface or `PlayerSession`:

```ts
// On Equipment or PlayerSession
socketedSouls?: (InventoryItem | null)[];  // Indexed by weapon soul slot
```

## Proc evaluation engine

New file: `packages/server/src/core/combat/ProcSystem.ts`

```ts
function processOnHitProcs(
  attacker: PlayerSession,
  targetId: string,
  damageDealt: number,
  isPhysical: boolean,
  ctx: NetworkContext
): void {
  if (!isPhysical) return;

  const procs = collectProcs(attacker);  // From souls + weapon innate
  for (const proc of procs) {
    if (proc.minLevel && enhancementLevel < proc.minLevel) continue;
    const chance = proc.baseChance + (proc.chancePerLevel || 0) * enhancementLevel;
    if (Math.random() >= chance) continue;

    applyProcEffect(proc, attacker, targetId, damageDealt, ctx);
  }
}
```

### Proc → StatusEffect mapping

| Proc Type | StatusEffectType | Extra Fields | Resist Category |
|-----------|-----------------|--------------|----------------|
| weaken | BUFF_GENERIC | debuffCategory: 'weaken' | weaken |
| burn | BURN | tickInterval: 1000 | burn |
| sleep | SLEEP | | sleep |
| freeze | FREEZE | | freeze |
| drainLife | (heal, not debuff) | potency% of damageDealt → attacker HP | — |
| trip | BUFF_GENERIC | debuffCategory: 'trip' | trip |
| stun | STUN | debuffCategory: 'stun' | stun |
| poison | DEBUFF_DOT | dot: 'poison', potency | ailment |
| bleed | DEBUFF_DOT | dot: 'bleed', potency | bleed |
| silence | SILENCE | | ailment |
| castSpeedDown | DEBUFF_CAST_SPEED_DOWN | | disorder |
| slow | SLOW | | ailment |

### Key difference from skill debuffs

- **Skill debuffs**: Accuracy = `computeDebuffAccuracy(casterSPI, proficiency, category)` vs target resist. Rolled via `shouldApplyDebuff()`.
- **Proc debuffs**: Flat `Math.random() < chance`. Target resist still applies as a reduction to the chance. E.g. `effectiveChance = baseChance * (1 - targetResistPercent / 100)`.

## Integration points

Three places where `processOnHitProcs` must be called:

1. **Auto-attacks**: `combatHandlers.ts` → `handleAttack()` — after `damageInfo` is computed and target takes damage
2. **Manual attacks**: `combatHandlers.ts` → `handleManualAttack()` — for each hit result
3. **Physical skill damage**: `NetworkServer.ts` cast completion — after `applySingleTargetSkillDamage()` and `applyAOEDamageToTargets()` when `damageType === 'physical'`

## Dark enhancement specifics

Dark-enhanced weapons have special mechanics:

1. **Recoil damage**: Attacker takes self-damage on each physical hit. Reduced by enhancement level. Implementation: after dealing damage, apply `recoilDamage = baseRecoil * (1 - enhancementLevel * reductionPerLevel)` to attacker.
2. **Weaken proc**: Scales with enhancement level (via `chancePerLevel`).
3. **LP drain at +6**: Heals attacker for X% of physical damage dealt (via `drainLife` proc with `minLevel: 6`).

These are all data-driven via `innateProcs` on the weapon definition. The `element: 'dark'` field gates them to only activate when `weapon.enhancementElement === 'dark'`.

## Implementation order

1. **Shared types**: `OnHitProc`, `ProcEffectType`, add `onHitProcs` to `ItemDefinition`, add `innateProcs` to weapon defs
2. **Soul storage**: Add `socketedSouls` to player equipment model
3. **ProcSystem.ts**: `collectProcs()` + `processOnHitProcs()` + `applyProcEffect()`
4. **Integration**: Hook into auto-attack, manual attack, physical skill damage
5. **Dark enhancement**: Recoil damage + element-locked procs
6. **Souls UI**: Client socketing interface (deferred)


## Important Notes

1. Proficiency and skill point allocation are two separate systems
  - A player can allocate 26 points into a skill category and have 0 proficiency
  - Skills that scale off proficiency require PROFICIENCY at or above the thresholds in the definition
  - Consider this case: class can allocate 41 points in category. player allocates points to reach 26 in category, starting with 5 base in category. player proficiency in category is 0/26. player uses skills in category enough to get 3 proficiency points. player proficiency in category is now 3/26.


## Optimization Plan
Plan: Algorithmic Fixes (A) + Zone Sharding (B)
Problem statement (confirmed)
Single Node.js process, single thread, 30 TPS. With 200 players in one zone the dominant costs are:
- broadcastEntityStates (NetworkServer.ts:4268) — O(zones × players × enemies) brute-force scan, ignoring the spatial hash that already exists at NetworkServer.ts:97-98
- applyAOEDamageToTargets (NetworkServer.ts:2031) — per-target recompute of getEffectiveStats (4 status-array scans per call) + per-target broadcastInZone emits inside the loop
- tickAI (NetworkServer.ts:4171) — every enemy scanned every tick; the aiTickBucket/AI_TICK_STAGGER = 4 stagger field at NetworkServer.ts:101-102 is incremented and never read (dead code)
Target: graceful degradation under 200/zone bursts; realistic load 30-50/zone.
Phase A — Algorithmic fixes (single-process, no new concurrency)
A1. Cache getEffectiveStats on the session (highest leverage)
The existing precedent is session.statBreakdown, which is rebuilt only inside recalcStats and read everywhere. Mirror that pattern.
Change:
- Add session.effectiveStats: EffectiveStats | null (next to statBreakdown)
- Populate it inside PlayerSystem.recalcStats (PlayerSystem.ts:309-395) right after statBreakdown is computed (around line 379)
- Replace the 9 ephemeral getEffectiveStats callsites with reads from session.effectiveStats:
- SkillSystem.ts:429 (cast bar), :723 (damage calc)
- CombatSystem.ts:139, 155, 258, 270, 376 (auto/manual/enemy attacks)
- NetworkServer.ts:853, 1098 (debug — leave as live calls; not hot)
- This collapses AOE cost from "4 status scans × N targets" to "1 scan, once per recalcStats"
Critical correctness work — the 11 hazard sites where statusEffects mutates without a nearby recalcStats (these would silently read stale effectiveStats once cached). From the invalidation audit:
Site	Hazard
NetworkServer.ts:530	invisibility splice on damage taken
NetworkServer.ts:587	barrier-consumed splice
NetworkServer.ts:1605	protection removal filter
NetworkServer.ts:1628-1629	song fade-out mutates appliedAt/duration in place
NetworkServer.ts:2730-2731	song refresh mutates appliedAt/duration in place
skillHandlers.ts:315, 322	dispel buff/debuff on player
skillHandlers.ts:693	invisibility splice on manual attack
Add this.playerSys.recalcStats(target) (or a lighter markEffectiveStatsDirty) at each. The 4 in-place mutations (1628/1629/2730/2731) are the most dangerous because they don't even change the array reference — flag for explicit invalidation.
Time-dependence caveat: getEffectiveStats checks effect.appliedAt + effect.duration < Date.now() (status.ts:466,469). The cache is valid for one tick — recompute at tick start via the existing tickStatusEffects → recalcStats path (NetworkServer.ts:3683). Sub-tick granularity doesn't matter gameplay-wise (effects are seconds-scale).
Scope: PlayerSession only — enemies don't use getEffectiveStats (they have flat stats; DOTs tick via a fakeSession).
A2. Use the spatial hash in broadcastEntityStates
Currently the inner loop linearly scans all zone enemies per player. Replace with queryEnemiesNear(px, pz, INTEREST_RADIUS, zoneId) which already exists at NetworkServer.ts:295-301 and filters by zone.
// Before: for (let i = 0; i < aliveEnemies.length; i++) { ... dx*dx+dz*dz <= RADIUS_SQ }
// After:  const visible = this.queryEnemiesNear(px, pz, INTEREST_RADIUS, zoneId)
//                 .map(e => ({ id: e.id, position: e.data.position, ... }))
This drops the broadcast tick from O(P×E) to O(P × cell-density). At 200/200 with cell size 8 and interest radius 50, expected ~25-50 enemies per query instead of 200.
A3. Batch per-target damage broadcasts
In applyAOEDamageToTargets (NetworkServer.ts:2031-2218), the loop currently emits one DAMAGE + one STATS_UPDATE per target via broadcastInZone. Accumulate into arrays and emit a single BATCH_COMBAT packet at the end:
- New packet type BATCH_COMBAT { events: CombatEvent[] } where each event is the current DAMAGE/STATS_UPDATE payload tagged with targetId
- Client unwraps and dispatches to existing handlers (small client change)
- Same treatment for applySingleTargetSkillDamage and executeConeSkillInternal if they fan out
This reduces Socket.IO room-emit overhead (which is significant — each emit walks the room's socket list) from O(targets) to O(1) per AOE.
A4. Wire up the AI stagger buckets
In tickAI (NetworkServer.ts:4171), aiTickBucket is incremented mod 4 but never gates work. Add the gate inside AISystem.updateEnemies (or filter the enemy map fed to it):
// Only process enemies where hashId(enemyId) % AI_TICK_STAGGER === this.aiTickBucket
4× AI cost reduction at the cost of ~133ms aggro reaction time (fine for PvE). Hash must be stable across ticks — use a numeric hash of the enemy ID, not array index.
A5. Per-tick debuff-resist cache
getDebuffResist (NetworkServer.ts:969-992) recomputes STA/SPI math + Map lookups on every call, fired once per proc per target in AOE. Add session.resistCacheAt: number + session.resistCache: Map<category, percent>, cleared at tick start in tickPlayerUpdates. ~150 calls/tick → ~6/tick.
A6. Fix latent global scans (correctness, also unblocks sharding)
- spawnAOEZone (NetworkServer.ts:2424-2440) seeds entitiesInside by scanning all enemies + all players with no zone filter
- checkEntityAOEEntries (NetworkServer.ts:2933-2951) does pure distance test, no zone check
- removeSongProximityBuffs (NetworkServer.ts:1617) and removeBlockingProtectedBuffs (NetworkServer.ts:1599) scan global state.players
Add zone filters. These are latent bugs today and hard requirements for sharding.
Phase A expected impact
Fix	Hotpath cost reduction
A1 stat cache	~5-10× on damage calc (4 scans → 0 per hit)
A2 spatial broadcast	~5-10× on broadcast tick at 200/200
A3 batched emits	~N× packet overhead per AOE (N = targets)
A4 AI stagger	4× on AI tick
A5 resist cache	~10-25× on debuff-heavy AOE
A6 zone filters	Correctness; minor perf
Estimated effort: 3-5 days. Risk concentrated in A1's invalidation hazards — write a markEffectiveStatsDirty() helper and call it at every mutation site, then assert in dev that the cache is never read while dirty.
Phase B — Zone-sharded cluster
Architecture
                   ┌────────────────────────┐
                   │  Frontend / Router     │  (1 process)
                   │  - TLS, Socket.IO      │
                   │  - Sticky routing by   │
                   │    current zoneId      │
                   │  - Auth handshake      │
                   └──────────┬─────────────┘
                              │  redis adapter
          ┌───────────────────┼───────────────────┐
          │                   │                   │
   ┌──────▼─────┐     ┌──────▼─────┐     ┌──────▼─────┐
   │ Shard A    │     │ Shard B    │     │ Shard C    │  (N zone workers)
   │ zones 1-3  │     │ zones 4-6  │     │ zones 7-9  │
   │ own state  │     │ own state  │     │ own state  │
   └──────┬─────┘     └──────┬─────┘     └──────┬─────┘
          └──────────────────┼──────────────────┘
                              │
                   ┌──────────▼─────────────┐
                   │  Redis (broker)        │  (existing dep)
                   │  - presence: charId→shard
                   │  - pub/sub: chat, sendToPlayer
                   │  - party state
                   └────────────────────────┘
- One Node process per zone group (start with 1 process per high-population zone, group small zones). Each owns its NetworkServer + SpawnManager + SummonManager + zone-local trade/AOE/song state.
- Socket.IO @socket.io/redis-adapter for cross-shard emit — gives io.to('zone:X').emit across processes for free. Already-deployed Redis (DatabaseManager.ts:10) doubles as broker.
- Sticky routing by zoneId: when a socket connects, the frontend looks up the player's current zone → routes the connection to the owning shard. On zone change, either (a) migrate the socket to the new shard, or (b) keep the socket on the frontend and proxy packets over Redis to the owning shard (simpler, adds one hop of latency).
Broker surface (from cross-zone audit)
Concern	Classification	Broker mechanism
Party (PartySystem.ts:8-10)	Cross-zone write	Move parties/playerParty/lootPool to Redis (or dedicated party process); sendPartyUpdate fan-out via pub/sub
Global chat (chatHandlers.ts:42)	Cross-zone broadcast	Redis pub/sub channel chat:global
Targeted player lookups (~12 sites: NetworkServer.ts:3022,3479; skillHandlers.ts:71,271,288,313,320,423,468,494; combatHandlers.ts:37; deathHandlers.ts:100)	Cross-zone read + RPC	Presence map charId → shardId; if target not on local shard, publish rpc:${targetShard}:applyBuff etc.
Zone transition (zoneHandlers.ts:11-54)	The shard boundary	RPC: serialize session → cleanup old shard (summons, AOE, song buffs, trade) → register on new shard
Trade, songs (apply), AOE, summons, aggro	Zone-local	No broker work
Song/blocking cleanup (NetworkServer.ts:1599,1617)	Cross-zone scan	Either track buff recipients per-caster (directed cleanup, no scan) or pub/sub fan-out
Friends/mail/auction	N/A	Not implemented; defer
Migration path (in order)
1. Extract zone-scoped services from the NetworkServer god-object (4,824 lines). Carve out per-zone state containers; this is the bulk of the work and de-risks everything else. The existing ECS skeleton is unused but suggests the intended shape.
2. Add @socket.io/redis-adapter to the single process — no behavior change yet, but cross-instance broadcast now works. Verify zone rooms still scope correctly.
3. Add presence + sendToPlayer routing over Redis — replace the 12 state.players.get(targetId) cross-zone calls with "if local, do X; else publish RPC."
4. Move party state to Redis.
5. Implement zone-handoff RPC — serialize PlayerSession (already plain data per the survey, ~5-10 KB), run the existing disconnect cleanup on the old shard, run the existing character-load path on the new shard. Fix the existing summon/AOE/song leak bugs from the cross-zone audit as part of this.
6. Run 2 shards as a smoke test, then scale.
Phase B expected impact
- Linear horizontal scaling by zone count
- No locks, no shared mutable state, no worker_threads — each shard is today's architecture intact
- Caps a single shard at its zone's population; 200/zone burst only stresses one shard, others keep ticking
Estimated effort: 2-4 weeks dominated by step 1 (NetworkServer decomposition).
Recommended order
1. A1 + A2 first — biggest bang, ~2 days, unblocks everything else (sharded shards still need fast per-shard ticks)
2. A3, A4, A5 — quick wins, ~2 days
3. A6 — correctness prereq for B
4. B1 (decompose NetworkServer) — required regardless; even without sharding it makes the code maintainable
5. B2-B6 — sharding rollout
Key risks
- A1 cache invalidation is the one place a bug causes silent stale-damage. Mitigate with a markEffectiveStatsDirty() helper called from all mutation sites + a dev-mode assert.
- A3 client change — batching changes the wire format; coordinate with client or gate behind a feature flag.
- B1 NetworkServer decomposition — large mechanical refactor; do it incrementally behind the existing API surface to avoid breaking combat.
