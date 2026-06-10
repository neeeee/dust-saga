# Dust Saga — Development Plan

## Phase 1: Character System Overhaul

Replace the current 5 flat classes with the 4 base class system, 6 races, and 6-stat allocation.

### 1.1 Shared Types & Constants
- Add race enum (Human, Elf, Dwarf, Myrine, Enkidu, Lapin)
- Add race data: `raceBaseStats`, `racialSkills` with passive effects
- Add base class enum (Warrior, Scout, Acolyte, Mage)
- Add job tree: 4 base → 8 sub → 16 final classes with `baseClass` mapping
- Add stat enum (STA, STR, AGI, DEX, SPI, INT)
- Port `levelUpBonuses` table (stat points per level)
- Port `statPointCosts` table (cost to raise a stat from X to X+1)
- Port `jobModifiers` table (LP/MP formulas per job)
- Port `jobBaseStatModifiers` table
- Add `maxLevel: 60`, `maxStatValue: 99`

### 1.2 Character Data Model
- Update `PlayerSession` / character schema to include: `race`, `jobId`, `statPoints` (STA/STR/AGI/DEX/SPI/INT), `unspentStatPoints`, `unspentSkillPoints`, `skillProficiencies` (Melee/Technique/Prayer/Magic/Special category points), `classSkillAllocations`
- Update mock DB in `AuthManager` to persist new fields
- Update DB schema in `DatabaseManager` for new columns

### 1.3 Stat & LP/MP Calculation
- Implement LP calculation: `baseLP + (levelLP_Div * level) + (staLP_Div * STA)` using `jobModifiers`
- Implement MP calculation: `baseMP + (levelMP_Div * level) + (spiMP_Div * SPI)` using `jobModifiers`
- Implement `getClassStats` replacement using race + job base stats + allocated stat points
- Level-up grants stat points from `levelUpBonuses` table

### 1.4 Class Advancement
- Base class starts at level 1
- Sub-class unlocked at level 20 (e.g., Warrior → Gladiator or Knight)
- Final class unlocked at level 40 (e.g., Gladiator → Juggernaut or Dragoon)
- Advancement via class trainer NPCs in nation cities
- Each advancement inherits parent class skills and unlocks class-specific skills

### 1.5 Character Creation UI
- Update character create screen: race selection (6 options with racial skill descriptions), base class selection (4 options)
- Remove current 5-class selection
- Show race/class stat previews

### 1.6 Racial Passive System
- Implement racial passives as always-on modifiers
- Human: +10 melee skill (1H), ailment duration -50%, potion effectiveness +15%
- Elf: +3 ranged range, spell MP cost -15%, charm resistance +20%
- Dwarf: 1% chance take fatal damage for party member, axe/blunt damage +10%, 3% survive fatal with 1HP
- Myrine: crit chance +5%, 5% dodge, chance convert damage to MP
- Enkidu: physical damage taken -10%, 2H weapon damage +10%, boost Lapin party members' physical defense
- Lapin: magic resistance +10%, MP regen +15%, boost Enkidu party members' magic defense

---

## Phase 2: Skill & Combat System

### 2.1 Skill Proficiency System
- 5 skill categories with IDs: Melee (0), Technique (6), Prayer (12), Magic (17), Special (22)
- Each category contains individual skills (e.g., Slash, Thrust, Cleave under Melee)
- Players allocate skill points into these individual skills on level up
- Skills unlock at proficiency thresholds (e.g., 8 Slash → Slice)
- Cross-category requirements supported (e.g., Slash 60 + Dodge 15 → Swing)
- Port full `classSkillData` and `classSpecificSkillData` tables

### 2.2 Skill Execution Engine
- Skill cast flow: select target → begin cast → cast bar → execute → apply effect → start cooldown
- Parameters per skill: `mpCost`, `castTime`, `cooldown`, `duration`
- Instant cast skills (castTime: 0) execute immediately
- Channeled skills lock the player in place
- Passive skills apply permanent modifiers
- GCD (global cooldown) between skills

### 2.3 Combat Mechanics
- Damage calculation: attack power vs defense, weapon type modifiers, racial bonuses, buff/debuff modifiers
- Physical damage types: slash, thrust, cleave, bash
- Magical damage types: fire, ice, lightning, dark, holy
- Critical hits: chance based on AGI/racial/class modifiers, multiplier based on skill
- Accuracy vs dodge calculation (AGI-based)
- Block mechanics (shield required, reduces damage)
- Knockback, knockdown, stun, interrupt mechanics

### 2.4 Status Effects
- Implement status effect types: poison, burn, freeze, stun, silence, sleep, knockdown, charm, bleed, root, slow, haste
- Effects have: duration, tick interval (for DoTs), potency, source
- Buff/debuff stacking rules (same type overwrites, different types stack)
- BuffEffectTable system for complex stat-modifying buffs (e.g., Lapis Mediow defense scaling)

### 2.5 Weapon & Equipment System
- Weapon types: 1H sword, 2H sword, spear, axe, blunt, 2H blunt, bow, crossbow, dagger, knuckles, wand, shield
- Equipment slots: weapon, off-hand, head, body, legs, hands, feet, accessory
- Equipment restrictions per class tier (e.g., Shadowblade: 1H sword + small shield only, no plate/leather)
- Weapon mastery passives (Sword Mastery, Axe Mastery, Lance Mastery, Arrow Mastery)

### 2.6 Skill Bar UI
- Drag skills from skill list to skill bar slots
- Show cooldown timers, MP costs, cast range
- Keybinds 1-0 for skill bar slots
- Show cast bar above character during cast time skills

---

## Phase 3: The World — Astir & Nations

### 3.1 Zone Architecture
- Astir Central Plaza (hub, safe zone, no PVP)
  - Northern Confederation Road → Northern Soplar Highway → Mountains of Jortio → Varik Confederation → Leapoltz Gorge
  - Eastern Royal Street → Eastern Soplar Highway → Nelstadt Plains → Kingdom of St. Pfelstein → Montorie Plains
  - Western Imperial Way → Western Soplar Highway → Himurart Desert → Latugan Empire → Tumblejean Sand Sea
- JSON map files for each zone with terrain, structures, teleporters, NPC positions

### 3.2 Nation System
- 3 nations: Varik Confederation, Kingdom of St. Pfelstein, Latugan Empire
- Player chooses nation when first leaving Astir (or via nation NPC)
- Nation determines: city access, ally/enemy players, respawn city
- Non-nation maps are PVP zones (except Seicaville when not at war)

### 3.3 Nation City NPCs (same set per nation)
- Innkeeper: set respawn point on death
- Weapon Merchant: buy weapons
- Armor Merchant: buy armor
- Class Trainers: Mage, Acolyte, Warrior, Scout — for class advancement quests
- PVP Point Trader: spend PVP points on gear
- PVP Rank NPC: increase PVP rank
- PVP Medal Trader: medals from PVP zone mob drops → gear
- Warehouse Manager: player storage (shared across characters)
- Blacksmith: weapon upgrades and enchantment
- Consumable Shop: potions, food, ammo
- Crafting NPC: craft items from recipes (recipes from mob drops)
- PVP Zone Teleporter: teleport to Muldia, El Behd
- War NPCs: Ridelium, Siegheim, Seicaville registration and teleport

---

## Phase 4: PVP Foundation

### 4.1 Faction & Flagging
- Visual indicator: red aura on enemy nation players
- Opposing nation players cannot: read each other's say/party/shout chat, PM each other in PVP zones
- Same-nation players see blue/neutral aura
- PVP toggle: always-on in PVP zones, off in safe zones (Astir, nation cities)

### 4.2 PVP Combat
- Player vs player damage using same combat formulas as PVE
- Friendly fire disabled for same nation
- Healing/buffing only affects party members and same-nation players
- Kill credit: last hit determines killer
- Death in PVP: no XP loss, respawn at innkeeper or nearest respawn point

### 4.3 PVP Points & Ranks
- PVP points earned from: killing enemy players, war participation, tower captures
- PVP rank tiers based on accumulated points
- PVP medals: random drops from enemies in PVP zones (Muldia, El Behd)
- PVP vendors: spend points/medals for gear

### 4.4 Party System
- Party size: up to 8 players
- Cross-nation parties allowed in safe zones only
- In PVP zones, party is same-nation only
- Party leader can invite/kick
- Party XP/loot sharing
- Party buffs affect all members (e.g., Guardian, Battle Prayer)

---

## Phase 5: PVP Zones — Muldia & El Behd

### 5.1 Muldia
- General PvEvP map: regular enemies + world bosses for all nations
- Enemies drop loot and PVP medals
- Players from all 3 nations share the map — open PVP between nations
- Multiple exits/entrances connecting to El Behd and nation roads

### 5.2 El Behd
- Leveling-focused PvEvP map with dense mob spawns for AOE grinding
- Higher enemy density, faster respawn, more XP
- Same PVP rules as Muldia
- Connected to Muldia at several points on the map

### 5.3 Shared Features
- Both zones have teleporter NPCs at entrances
- Both zones drop PVP medals from enemies
- Both zones have varied enemy types suited to different level ranges
- Both zones are non-nation territory (PVP enabled)

---

## Phase 6: Ridelium War Zone

### 6.1 War Basics
- 48v48v48 player war
- Scheduled war times (determined later)
- Registration via NPC in nation cities
- Players teleported to Ridelium map at war start

### 6.2 Tower Capture
- Towers on the map have guard towers protecting them
- Destroy guard towers → access to core stone
- Destroy core stone → capture tower for your nation
- Towers provide strategic respawn points

### 6.3 Power Points & Bugle Calls
- Starting power points: 6000 (adjusted by consecutive win/loss streaks)
- Bugle calls every 10 minutes: tally tower ownership, apply point modifiers
- Kill enemy player: +5 points
- Die to enemy: -points
- Commander dies: -100 points
- Own 0 towers at bugle call: -1000 points
- Own 5 towers: +500, scaling up to 9 towers: +3500

### 6.4 War End & Rewards
- War duration: 1 hour
- Nation with most power points wins
- Victory: reduced starting points next war, increased item drop rates
- Defeat: bonus starting points next war
- Tower-based rewards: Tower of Training (XP bonus), Tower of Fortune (drop bonus), Tower of Victory (PVP point bonus)

---

## Phase 7: Siegheim War Zone

### 7.1 Schedule & Registration
- Every Sunday, 8:30 PM - 11:00 PM
- Level 45+ with nation affiliation required
- 200 per nation (150 regular soldiers, 50 volunteers)
- Commander-in-Chief: 1 per nation (lottery from applicants)
- Deputy Commander: 3 per nation (lottery from applicants)
- Regular soldiers: lottery if oversubscribed, registration closes 30 min before war
- Volunteers: can register any time during war, queue system with waitlist

### 7.2 Main Camp System
- 3 main bases on the map, one per nation
- Commander-in-Chief selects base location (priority by previous war performance)
- Auto-assignment defaults: Empire→D12, Kingdom→H3, Alliance→M12
- Master Core: destroy = instant defeat for that nation
- Door (Gate): blocks enemy entry, defense scales with bases owned, cannot be healed
- No Memorize/Transport within main camp

### 7.3 Base System (16 Bases)
- Start unclaimed with no guard towers
- Core: destroy enemy core → capture base
- Safe Wall: blocks enemy entry while guard towers exist, reappears if tower rebuilt
- Guard Towers (2 per base): built via Shellneat Ore points, repaired via Curelight Ore
- Respawn Crystal: activated via Crystal Tear points, provides spawn point for regular soldiers
- Core auto-recovery: allied characters in base area regenerate cores at intervals
- Lost base = reset all construction/activation points

### 7.4 Base Items
- Distributed at war start and each bugle call to all living characters
- Shellneat Ore: accumulate points → build guard tower
- Curelight Ore: restore guard tower HP
- Crystal Tear: accumulate points → activate respawn crystal
- Rivaslite Ore: fully restore base functions
- Dropped on death (transferred to killer), lost on logout or non-player death

### 7.5 Power Points & Victory
- Starting: 12000 (adjusted by streak)
- Bugle calls every 10 minutes with base ownership modifiers (-1400 at 0 bases up to victory at 16)
- Base defense bonus: +50 per defense, scaling with consecutive defenses
- Kill enemy soldier: +5, kill commander: +500, kill deputy: +100
- Instant victory: both enemy nations at 0 points, both master cores destroyed, or all 16 bases captured
- Instant defeat: your nation at 0 points or your master core destroyed

### 7.6 Commander Skills
- Commander-in-Chief cloak: 3 skills (ATK+aura damage, maxLP+regen, movespeed)
- Deputy Commander cloaks (choose 1 of 3):
  - Cloak 1: magic resist+knockback resist, defense+ranged evade
  - Cloak 2: object damage+, MP regen over time
  - Cloak 3: ATK+MATK+, or huge ATK+MATK+ with movespeed penalty
- Only one skill usable per life (until commander dies)

### 7.7 Respawn System
- Regular soldiers: respawn on map (select base with working crystal + guard tower)
- Volunteers: die → removed from map, queued volunteers enter in order
- Respawn costs 10 faction points (waived if auto-respawned at HQ)
- 15s invincibility after respawn (breaks on first move)

### 7.8 Map Features
- Terrain effects: forest areas reduce mounted movement speed
- Commander minimap: shows friendly force distribution, updated periodically
- Overall map: shows party members, nation party leaders, nation characters color-coded

---

## Phase 8: Supporting Systems

### 8.1 Guild System
- Guild creation and management
- Guild castles in Seicaville
- Guild ranks and permissions
- Seicaville: PVP off when visiting own guild castle (war not active)

### 8.2 Mount System
- Summon Horse skill (Horsemanship category, reqPoints: 20)
- Horse Guardian: take damage for horse
- Horse Charge (Passive): charge at target dealing damage
- Mounted combat: reduced stats based on Horsemanship proficiency and class
  - Non-riding classes retain 30-50% of ATK/MATK/cast speed
  - Hunter retains up to 80% at high proficiency
  - Shadowblade up to 90%, Paladin up to 90%, Dragoon up to 100%
- Some skills unusable while mounted without Jousting/Horse Archer/Median Riding passives

### 8.3 Crafting System
- Crafting NPCs in nation cities
- Recipes drop from mobs
- Crafting materials from gathering and mob drops
- Alchemy crafting (Scout line): potions, poisons, antidotes

### 8.4 Warehouse/Storage
- Warehouse Manager NPC in nation cities
- Shared storage across characters on same account
- Deposit/withdraw items and gold

### 8.5 Weapon Enhancement
- Blacksmith NPC: upgrade weapons (+1 through +10)
- Enchantment system: add elemental attributes (fire, ice, lightning, dark, holy)
- Enhancement affects skill scaling (e.g., Summon Plant element depends on weapon enhancement)
- Failure chances and material costs

### 8.6 Innkeeper & Respawn
- Set respawn point at any Innkeeper NPC
- On death: respawn at bound innkeeper or nearest friendly respawn point
- Respawn with temporary invulnerability

---

## Implementation Priority

**Start with Phase 1.** The current character system (5 flat classes, simple linear stats) is incompatible with the design. Everything downstream — skills, combat, equipment, PVP — depends on the race/class/stat foundation being correct.

Phase 1 deliverables:
1. Shared types and constants (race data, job tree, stat tables)
2. Updated character data model and persistence
3. LP/MP calculation engine
4. Updated character creation UI (race + base class)
5. Racial passive framework
6. Level-up stat point allocation UI
