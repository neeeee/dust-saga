# Dust Saga — Session Context

**Session IDs:** ses_2702 (Phase 0 fixes), Phase 1 & Phase 2 implementation
**Date:** April 15, 2026

---

## Project Overview

Browser-based MMORPG (re-imagining of Pandora Saga 2007). Monorepo:

- **`packages/client`** — Vue 3 + Babylon.js + TypeScript
- **`packages/server`** — Node.js + Socket.IO + TypeScript
- **`packages/shared`** — Shared types, constants, utils

---

## Phase 1: Character System Overhaul (Completed)

Replaced the flat 5-class system with the full race/job/stat system from design-goals.txt.

### New Files

| File | Purpose |
|------|---------|
| `shared/src/types/races.ts` | `Race` enum (6 races), `StatType` enum (STA/STR/AGI/DEX/SPI/INT), `StatPoints`, `RacialPassiveEffects` |
| `shared/src/types/jobs.ts` | `BaseClass` enum (4), `JobId` enum (24 jobs: 4 base → 8 sub → 12 final), `JobDefinition` with LP/MP formulas, `SkillProficiencies` |
| `shared/src/constants/races.ts` | 6 race definitions with base stats from design-goals.txt, `LEVEL_UP_BONUSES` [statPts, skillPts, _] per level (2–60), `STAT_POINT_COSTS` [cost, _] per stat value (1–99) |

### Key Changes

- **`shared/src/types/player.ts`** — `PlayerSession` now has: `race`, `jobId`, `baseClass`, `statPoints`, `unspentStatPoints`, `unspentSkillPoints`, `skillProficiencies`, `skillCooldowns`, `activeCast`, `statusEffects`. `PlayerStats` gained `magicAttack`.
- **`shared/src/constants/classes.ts`** — Replaced 5-class `CLASS_DEFINITIONS`/`getClassStats` with `calculateDerivedStats(race, jobId, level, statPoints)` and `calculateMaxLP/MP()` using job modifier formulas.
- **`shared/src/types/packets.ts`** — Added `STAT_ALLOCATE` (93), `JOB_ADVANCE` (94) packet types.
- **`server/src/core/auth/AuthManager.ts`** — Characters now persist `race`, `job_id`, `stat_points` (JSONB), `unspent_stat_points`, `unspent_skill_points`, `skill_proficiencies` (JSONB). `createCharacter` accepts race + jobId.
- **`server/src/core/database/DatabaseManager.ts`** — Schema updated with new columns + `runMigrations()` for ALTER TABLE on existing DBs.
- **`server/src/core/ecs/systems/PlayerSystem.ts`** — New `createSession()` with 12 params, `allocateStatPoint()`, `advanceJob()` (tier 2 at 20, tier 3 at 40), `recalcStats()`.
- **`server/src/core/network/NetworkServer.ts`** — Updated character CRUD for race+job, added `handleStatAllocate`/`handleJobAdvance` handlers.
- **`client/src/ui/CharacterSelect.vue`** — 2-step creation: 6-race grid (with stat preview + passive descriptions) → 4 base class grid (with HP/MP/ATK/DEF/MATK bar previews).
- **`client/src/core/network/NetworkClient.ts`** — Packet queue (`pendingPackets[]`) for early login/register clicks; `createCharacter` accepts race param.

### Job Tree (from design-goals.txt)

```
Warrior → Gladiator → Juggernaut / Dragoon
        → Knight    → Warlord / Paladin
Scout   → Archer      → Sniper / Hunter
        → Provocateur → Assassin / Saboteur
Acolyte → Priest  → Cleric / Enchanter
        → Ascetic → Monk / Exorcist
Mage    → Wizard   → Warlock / Conjurer
        → Sorcerer → Corruptor / Shadowblade
```

Note: The job IDs in `JobId` enum used placeholder names (e.g., THIEF, RANGER, BISHOP, SAGE, NECROMANCER). These should be updated to match design-goals.txt names (Provocateur, Saboteur, Ascetic, Exorcist, Conjurer, Corruptor) and the full 28-job tree. Currently only 24 jobs are in the enum.

### Race Base Stats (from design-goals.txt)

| Race | STA | STR | AGI | DEX | SPI | INT |
|------|-----|-----|-----|-----|-----|-----|
| Human | 5 | 5 | 5 | 5 | 5 | 5 |
| Elf | 3 | 3 | 6 | 4 | 7 | 7 |
| Dwarf | 6 | 7 | 5 | 6 | 3 | 3 |
| Myrine | 5 | 5 | 9 | 6 | 3 | 2 |
| Enkidu | 8 | 6 | 4 | 4 | 6 | 2 |
| Lapin | 3 | 1 | 6 | 5 | 9 | 6 |

---

## Phase 2: Skill & Combat System (Completed)

### New Files

| File | Lines | Purpose |
|------|-------|---------|
| `shared/src/types/skills.ts` | ~120 | `SkillCategoryId` (0/6/12/17/22), `DamageType`, `PhysicalDamageSubType` (slash/thrust/cleave/bash), `MagicalDamageSubType` (fire/ice/lightning/dark/holy), `SkillDefinition`, `SkillRequirement`, `SkillCooldownEntry`, `ActiveCast` |
| `shared/src/types/status.ts` | ~90 | `StatusEffectType` enum (12 effects), `StatusEffect` with duration/tick/stacking, `STATUS_EFFECT_DEFS`, helpers (`isCCImmune`, `isSilenced`, `isRooted`) |
| `shared/src/constants/skills.ts` | ~1973 | `SKILL_CATEGORIES` (5 categories, sub-skills) and `CLASS_SKILL_DATA` (full proficiency-based skill trees from design-goals.txt) |
| `shared/src/constants/classSkills.ts` | ~1408 | `CLASS_SPECIFIC_SKILLS` for all 28 jobs from design-goals.txt |
| `server/src/core/ecs/systems/SkillSystem.ts` | ~350 | Skill execution engine |

### SkillSystem Engine (`SkillSystem.ts`)

- `canUseSkill()` — checks: dead, casting, GCD, cooldown, passive, MP, silence, CC
- `beginCast()` — instant (castTime 0) vs channeled skills
- `executeSkill()` — deducts MP, applies cooldown + GCD, calculates damage (physical/magical split with defense), healing (SPI-scaled), auto-applies status effects for poison/burn/stun from skill descriptions
- `updateCooldowns()` — cleans expired cooldowns
- `checkCasting()` — checks if active cast completed
- `tickStatusEffects()` — DoT ticks (poison/burn/bleed), expiration cleanup
- `findSkillDefinition()` — looks up in both CLASS_SKILL_DATA and CLASS_SPECIFIC_SKILLS
- `getAvailableSkills()` — returns skills available to session

### Network Integration

- `SKILL_USE` packet (type 34) — client sends `{ skillName, targetId }`, server validates via `canUseSkill`, begins cast, executes, broadcasts damage/heal/status
- `COOLDOWN_UPDATE` packet (type 35) — sent back with cast start confirmation and post-use cooldown info
- Game loop ticks: cooldown cleanup, cast completion (with full damage/loot/xp flow), status effect DoT processing

### Skill Data Ported

All skills from `design-goals.txt` lines 1165–4379 were ported:
- **Melee (0):** Slash, Thrust, Cleave, Bash, Defend — each with 8–12 unlockable skills
- **Technique (6):** Shot, Alchemy, Assassination, Trap, Dodge — each with 8–12 skills
- **Prayer (12):** Grace, Blessing, Exorcism, Hymn — each with 8–10 skills
- **Magic (17):** Elemental, Invocation, Darkness, Confusion — each with 8–15 skills
- **Special (22):** Racial (empty), Horsemanship (3 skills)
- **Class-specific:** All 28 jobs (0–27) with 3–10 skills each

### Status Effects Implemented

12 types with definitions: poison (DoT, 10s/2s tick), burn (DoT, 5s/1s tick), freeze (CC, 3s, 50% slow), stun (CC, 2s), silence (CC, 5s, blocks skills), sleep (CC, 8s), knockdown (CC, 2s), charm (CC, 5s), bleed (DoT, 8s/2s tick), root (CC, 3s), slow (5s, 30%), haste (10s, 30% speed).

---

## Known Issues / Next Steps

1. **Job ID mismatch** — `JobId` enum has placeholder names (THIEF, RANGER, etc.) that don't match design-goals.txt job names (Provocateur, Saboteur, etc.). Should be updated to the full 28-job tree.
2. **Job modifiers** — The `jobModifiers` table from design-goals.txt (`[baseLP, baseMP, levelLP_Div, levelMP_Div, staLP_Div, spiMP_Div]` per job) is not yet ported. Current `JobDefinition` uses simplified LP/MP formulas.
3. **Job base stat modifiers** — `jobBaseStatModifiers` from design-goals.txt (per base class) not yet applied.
4. **Skill bar UI** — No client-side skill bar component yet. Skills can be triggered via network but there's no UI to drag skills or show cooldowns.
5. **Weapon/equipment restrictions** — Not yet implemented per class tier.
6. **Level-up stat point allocation UI** — No client UI for spending unspent stat points.
7. **Buff effect tables** — `buffEffectTable` data is ported in skill definitions but the buff application system (stat modification from buffs like Lapis Mediow defense scaling) is not implemented.
8. **Cross-category skill requirements** — The `meetsRequirements()` helper exists but skill unlock checking (whether player has allocated enough points into prerequisite skills) is not wired into the skill use flow.
9. **CLASS_SKILL_DATA keys** — Currently keyed by category ID (0, 6, 12, 17, 22). Skills have `reqPoints` that can be cross-category (e.g., Slash 60 + Dodge 15). The proficiency check needs player's skill allocation data.
10. **Skill proficiency allocation** — Players should allocate points into sub-skills (Slash, Thrust, etc.) on level up. The `skillProficiencies` field exists on `PlayerSession` but there's no allocation UI or server handler.

---

## Development Plan Status

- **Phase 1:** Character System Overhaul — **Complete**
- **Phase 2:** Skill & Combat System — **Complete** (engine + data; UI pending)
- **Phase 3:** The World — Astir & Nations — Not started
- **Phase 4:** PVP Foundation — Not started
- **Phase 5:** PVP Zones — Muldia & El Behd — Not started
- **Phase 6:** Ridelium War Zone — Not started
- **Phase 7:** Siegheim War Zone — Not started
- **Phase 8:** Supporting Systems — Not started
