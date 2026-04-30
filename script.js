import { gameData } from "./gameData.js";
import { skills } from "./skills/jobSkillValues.js";
import { setBonuses } from "./items/setBonuses.js";
import { classSkillData, proficiencySkills } from "./skills/classSkillData.js";
import { classSpecificSkillData } from "./skills/classSpecificSkillData.js";

// --- CONSTANTS ---
const PRIMARY_STATS = ["sta", "str", "agi", "dex", "spi", "int"];
const GEAR_SLOTS_WITH_SOULS = [
  "weapon",
  "shield",
  "head",
  "torso",
  "belt",
  "gloves",
  "pants",
  "boots",
];

// --- GLOBAL EQUIPMENT DATA ---
let globalEquipmentData = {};
let globalSoulsData = [];

// --- CHARACTER STATE ---
const character = {
  level: 1, // Default to 1
  raceId: 0, // Default Human
  racialSkillId: 0, // Default Fighting Spirit
  jobId: 0, // Default Warrior (job ID 0 in gameData)
  addedStats: { sta: 0, str: 0, agi: 0, dex: 0, spi: 0, int: 0 },
  equipment: {
    weapon: "weapon-none",
    shield: "shield-none",
    head: "head-none",
    torso: "torso-none",
    gloves: "gloves-none",
    pants: "pants-none",
    boots: "boots-none",
    cape: "cape-none",
    earring1: "earring1-none",
    earring2: "earring2-none",
    necklace: "necklace-none",
    belt: "belt-none",
    ring1: "ring1-none",
    ring2: "ring2-none",
  },
  equipmentEnhancements: {}, // { [itemId]: enhancementLevel }
  souls: {
    weapon: ["none", "none", "none"],
    shield: ["none"],
    head: ["none"],
    torso: ["none", "none", "none"],
    belt: ["none", "none", "none"],
    gloves: ["none"],
    pants: ["none", "none", "none"],
    boots: ["none"],
  },
  equippedSouls: {}, // { [slot]: string[] }
  isMounted: false, // Horsemanship toggle state
  buffs: {},
  enchanterSpi: {},
  skills: {}, // { [skillId]: { adeptness: 0, potential: 0 } }
  points: {
    totalStat: 0,
    spentStat: 0,
    totalSkill: 0,
    spentSkill: 0,
    totalUnallocated: 0,
    spentUnallocated: 0,
  },
  finalStats: {},
};

// --- DOM ELEMENTS CACHE ---
const elements = {
  level: document.getElementById("level"),
  race: document.getElementById("race"),
  racialSkill: document.getElementById("racial-skill"),
  job: document.getElementById("job"),
  displayRace: document.getElementById("display-race"),
  displayRacialSkill: document.getElementById("display-racial-skill"),
  displayJob: document.getElementById("display-job"),

  addedStatInputs: {
    sta: document.getElementById("base-sta"),
    str: document.getElementById("base-str"),
    agi: document.getElementById("base-agi"),
    dex: document.getElementById("base-dex"),
    spi: document.getElementById("base-spi"),
    int: document.getElementById("base-int"),
  },
  statCosts: {
    sta: document.getElementById("cost-sta"),
    str: document.getElementById("cost-str"),
    agi: document.getElementById("cost-agi"),
    dex: document.getElementById("cost-dex"),
    spi: document.getElementById("cost-spi"),
    int: document.getElementById("cost-int"),
  },
  buffBonuses: {
    sta: document.getElementById("buff-bonus-sta"),
    str: document.getElementById("buff-bonus-str"),
    agi: document.getElementById("buff-bonus-agi"),
    dex: document.getElementById("buff-bonus-dex"),
    spi: document.getElementById("buff-bonus-spi"),
    int: document.getElementById("buff-bonus-int"),
  },
  weaponTypeSelector: document.getElementById("equip-weapon-type"),
  equipmentSelectors: {
    weapon: document.getElementById("equip-weapon"),
    shield: document.getElementById("equip-shield"),
    head: document.getElementById("equip-head"),
    torso: document.getElementById("equip-torso"),
    gloves: document.getElementById("equip-gloves"),
    pants: document.getElementById("equip-pants"),
    boots: document.getElementById("equip-boots"),
    cape: document.getElementById("equip-cape"),
    earring1: document.getElementById("equip-earring1"),
    earring2: document.getElementById("equip-earring2"),
    necklace: document.getElementById("equip-necklace"),
    belt: document.getElementById("equip-belt"),
    ring1: document.getElementById("equip-ring1"),
    ring2: document.getElementById("equip-ring2"),
  },
  enhancementSelectors: {
    weapon: document.getElementById("equip-weapon-enhancement"),
    shield: document.getElementById("equip-shield-enhancement"),
    head: document.getElementById("equip-head-enhancement"),
    torso: document.getElementById("equip-torso-enhancement"),
    gloves: document.getElementById("equip-gloves-enhancement"),
    pants: document.getElementById("equip-pants-enhancement"),
    boots: document.getElementById("equip-boots-enhancement"),
  },
  soulSelectors: {
    weapon: [
      document.getElementById("equip-weapon-soul1"),
      document.getElementById("equip-weapon-soul2"),
      document.getElementById("equip-weapon-soul3"),
    ],
    shield: [document.getElementById("equip-shield-soul1")],
    head: [document.getElementById("equip-head-soul1")],
    torso: [
      document.getElementById("equip-torso-soul1"),
      document.getElementById("equip-torso-soul2"),
      document.getElementById("equip-torso-soul3"),
    ],
    belt: [
      document.getElementById("equip-belt-soul1"),
      document.getElementById("equip-belt-soul2"),
      document.getElementById("equip-belt-soul3"),
    ],
    gloves: [document.getElementById("equip-gloves-soul1")],
    pants: [
      document.getElementById("equip-pants-soul1"),
      document.getElementById("equip-pants-soul2"),
      document.getElementById("equip-pants-soul3"),
    ],
    boots: [document.getElementById("equip-boots-soul1")],
  },
  outputs: {
    sta: document.getElementById("total-sta"),
    str: document.getElementById("total-str"),
    agi: document.getElementById("total-agi"),
    dex: document.getElementById("total-dex"),
    spi: document.getElementById("total-spi"),
    int: document.getElementById("total-int"),

    lp: document.getElementById("total-lp"),
    mp: document.getElementById("total-mp"),

    atk: document.getElementById("total-atk"),
    def: document.getElementById("total-def"),
    matk: document.getElementById("total-matk"),

    dodge: document.getElementById("total-dodge"),
    acc: document.getElementById("total-acc"),
    accFront: document.getElementById("total-acc-front"),
    crit: document.getElementById("total-crit"),
    reHorse: document.getElementById("total-re-horse"),

    // Additional derived stats
    pot: document.getElementById("pot"),
    lpHeal: document.getElementById("lp-heal"),
    lpRecovery: document.getElementById("lp-recovery"),
    mpRecovery: document.getElementById("mp-recovery"),
    lpPer2Sec: document.getElementById("lp-per-2sec"),
    mpPer2Sec: document.getElementById("mp-per-2sec"),
    redMp: document.getElementById("red-mp"),
    incMp: document.getElementById("inc-mp"),

    frontAtk: document.getElementById("front-atk"),
    backAtk: document.getElementById("back-atk"),
    atkSpd: document.getElementById("atk-spd"),

    frontDef: document.getElementById("front-def"),
    backDef: document.getElementById("back-def"),
    phyRes: document.getElementById("phy-res"),
    magRes: document.getElementById("mag-res"),
    magDamageReduction: document.getElementById("mag-damage-red"),
    phyResFront: document.getElementById("phy-res-front"),
    phyResBack: document.getElementById("phy-res-back"),

    criD: document.getElementById("cri-d"),
    criRes: document.getElementById("cri-res"),
    cdamRes: document.getElementById("cdam-res"),

    melEva: document.getElementById("mel-eva"),
    ranEva: document.getElementById("ran-eva"),
    magEva: document.getElementById("mag-eva"),

    melee: document.getElementById("melee"),
    range: document.getElementById("range"),
    fireR: document.getElementById("fire-r"),

    iceR: document.getElementById("ice-r"),
    thundR: document.getElementById("thund-r"),
    poisonR: document.getElementById("poison-r"),
    charmR: document.getElementById("charm-r"),
    lightR: document.getElementById("light-r"),
    darkR: document.getElementById("dark-r"),

    tripR: document.getElementById("trip-r"),
    stunR: document.getElementById("stun-r"),
    bleedR: document.getElementById("bleed-r"),
    freezeR: document.getElementById("freeze-r"),
    burnR: document.getElementById("burn-r"),
    sleepR: document.getElementById("sleep-r"),
    curseR: document.getElementById("curse-r"),
    weakR: document.getElementById("weak-r"),

    knockbackR: document.getElementById("knockback-r"),
    knockdownR: document.getElementById("knockdown-r"),
    ailmentR: document.getElementById("ailment-r"),
    disorderR: document.getElementById("disorder-r"),

    castSpd: document.getElementById("cast-spd"),
    castTime: document.getElementById("cast-time"),
    cooldown: document.getElementById("cooldown"),

    moveSpd: document.getElementById("move-spd"),
    townMsp: document.getElementById("town-msp"),
  },
  setBonusList: document.getElementById("set-bonus-list"),
  skillsDisplay: document.getElementById("skills-display"),
  points: {
    stat: document.getElementById("points-stat"),
    skill: document.getElementById("points-skill"),
    unallocated: document.getElementById("points-unallocated"),
  },
  resetButtons: {
    statusPoints: document.getElementById("reset-status-points"),
    abilityPoints: document.getElementById("reset-ability-points"),
  },
  // Modal elements
  skillPreviewButton: document.getElementById("preview-skills"),
  skillPreviewModal: document.getElementById("skill-preview-modal"),
  modalClose: document.querySelector("#skill-preview-modal .close"),
  unlockedSkillsDisplay: document.getElementById("unlocked-skills-display"),

  buffsModalButton: document.getElementById("buffs-modal-btn"),
  buffsModal: document.getElementById("buffs-modal"),
  equipmentModalButton: document.getElementById("equipment-modal-btn"),
  equipmentModal: document.getElementById("equipment-modal"),
  horsmanshipToggle: document.getElementById("horsemanship-toggle"),
  // Soul containers resolved dynamically from DOM when needed
};

/**
 * Initializes skill levels based on job and sets up default values.
 * This function is critical for setting the "base" skill levels for a job.
 */
function initializeSkills() {
  character.skills = {}; // Reset all skills
  const jobInfo = gameData.jobs[character.jobId];
  const jobSkillData = skills[character.jobId];

  if (!jobSkillData) {
    console.warn(`No skill data found for job ID ${character.jobId}`);
    return;
  }

  // Initialize all skills with their base values from jobSkillValues.js
  for (const categoryId in jobSkillData) {
    if (categoryId === "name") continue; // Skip the job name

    const category = jobSkillData[categoryId];
    for (const skillData of category.skills) {
      character.skills[skillData.id] = {
        adeptness: skillData.minAdeptness, // Base adeptness from job
        potential: skillData.minAdeptness,
      };
    }
  }

  initializeSkillBuffs();
}

/**
 * Renders the skill panel based on character.skills state.
 */
/**
 * Calculates the total proficiency (adeptness) for each skill category
 */
function calculateCategoryProficiencies() {
  const proficiencies = {
    melee: 0,
    technique: 0,
    prayer: 0,
    magic: 0,
    special: 0,
  };

  // Map category IDs to proficiency names
  const categoryMapping = {
    0: "melee", // Melee category
    6: "technique", // Technique category
    12: "prayer", // Prayer category
    17: "magic", // Magic category
    22: "special", // Special category
  };

  for (const categoryId in gameData.skills) {
    const category = gameData.skills[categoryId];
    const proficiencyKey = categoryMapping[categoryId];

    if (proficiencyKey) {
      for (const skillData of category.skills) {
        const currentSkill = character.skills[skillData.id];
        if (currentSkill) {
          proficiencies[proficiencyKey] += currentSkill.adeptness;
        }
      }
    }
  }

  return proficiencies;
}

function renderSkillsPanel() {
  let html = "";

  for (const categoryId in gameData.skills) {
    const category = gameData.skills[categoryId];
    let categoryAdeptnessSum = 0;
    let categoryMaxPotentialSum = 0;

    // Calculate actual category sums based on current character skills and job data
    for (const skillData of category.skills) {
      const currentSkill = character.skills[skillData.id];
      if (currentSkill) {
        categoryAdeptnessSum += currentSkill.adeptness;

        // Get max potential from job data
        const jobSkillData = skills[character.jobId];
        let maxPotential = 0;
        if (jobSkillData) {
          for (const catId in jobSkillData) {
            if (catId === "name") continue;
            const cat = jobSkillData[catId];
            const skill = cat.skills.find((s) => s.id === skillData.id);
            if (skill) {
              maxPotential = skill.maxPotential;
              break;
            }
          }
        }
        categoryMaxPotentialSum += maxPotential;
      }
    }

    // Category Header - show the calculated totals
    html += `<div class="sim-row skill-category">
                <span>${category.name}</span>
                <span>${categoryAdeptnessSum} / ${categoryMaxPotentialSum}</span>
             </div>`;

    for (const skillData of category.skills) {
      const currentSkill = character.skills[skillData.id];
      if (!currentSkill) continue;

      const currentAdeptness = currentSkill.adeptness;

      // Get max potential from job data
      const jobSkillData = skills[character.jobId];
      let maxPotential = 0;
      let baseAdeptness = 0;
      if (jobSkillData) {
        for (const catId in jobSkillData) {
          if (catId === "name") continue;
          const cat = jobSkillData[catId];
          const skill = cat.skills.find((s) => s.id === skillData.id);
          if (skill) {
            maxPotential = skill.maxPotential;
            baseAdeptness = skill.minAdeptness;
            break;
          }
        }
      }

      // Calculate bar width as percentage of max potential
      const barWidth =
        maxPotential > 0 ? (currentAdeptness / maxPotential) * 100 : 0;

      // Determine bar color based on skill level
      let barClass = "skill-level-line";
      if (currentAdeptness >= maxPotential) {
        barClass += " max-gradient"; // Black to blue gradient when at max
      } else if (currentAdeptness > baseAdeptness) {
        barClass += " filled-gradient"; // Green gradient when filled
      } else {
        barClass += " empty"; // Empty when at base level
      }

      html += `
        <div class="sim-row skill-row">
          <span class="skill-name">${skillData.name.substring(0, 4)}</span>
          <div class="skill-level-line-container">
            <div class="${barClass}" style="width: ${barWidth}%;"></div>
          </div>
          <span class="skill-numerical-display">${currentAdeptness} / ${maxPotential}</span>
          <div class="skill-add-sub-controls">
            <button class="skill-btn" data-skill-id="${skillData.id}" data-type="adeptness" data-amount="-1">-</button>
            <button class="skill-btn" data-skill-id="${skillData.id}" data-type="adeptness" data-amount="1">+</button>
            <button class="skill-btn skill-btn-wide" data-skill-id="${skillData.id}" data-type="adeptness" data-amount="-10">-10</button>
            <button class="skill-btn skill-btn-wide" data-skill-id="${skillData.id}" data-type="adeptness" data-amount="10">+10</button>
            <button class="skill-btn skill-btn-wide" data-skill-id="${skillData.id}" data-type="adeptness" data-amount="min">Min</button>
            <button class="skill-btn skill-btn-wide" data-skill-id="${skillData.id}" data-type="adeptness" data-amount="max">Max</button>
            <span class="cost-display">SP: 1</span>
          </div>
        </div>
      `;
    }
  }
  elements.skillsDisplay.innerHTML = html;

  elements.skillsDisplay.querySelectorAll(".skill-btn").forEach((button) => {
    button.addEventListener("click", handleSkillButtonClick);
  });
}

/**
 * Handles clicks on skill +/- buttons.
 */
function handleSkillButtonClick(event) {
  const button = event.target;
  const skillId = parseInt(button.dataset.skillId, 10);
  const type = button.dataset.type; // 'adeptness' only
  const amountStr = button.dataset.amount;

  const skill = character.skills[skillId];
  if (!skill) return;

  const currentValue = skill[type];

  // Get the base values and max potential for this skill from the current job
  const jobSkillData = skills[character.jobId];
  let baseAdeptnessForJob = 0;
  let maxPotentialForJob = gameData.maxSkillValue;

  if (jobSkillData) {
    // Find the skill in the job data
    for (const categoryId in jobSkillData) {
      if (categoryId === "name") continue;
      const category = jobSkillData[categoryId];
      const skillData = category.skills.find((s) => s.id === skillId);
      if (skillData) {
        baseAdeptnessForJob = skillData.minAdeptness;
        maxPotentialForJob = skillData.maxPotential;
        break;
      }
    }
  }

  let newValue;
  let pointsToAllocate;

  if (amountStr === "max") {
    // Max button: allocate to reach maximum potential
    newValue = maxPotentialForJob;
    pointsToAllocate = newValue - currentValue;
  } else if (amountStr === "min") {
    // Min button: reduce to base adeptness
    newValue = baseAdeptnessForJob;
    pointsToAllocate = newValue - currentValue; // This will be negative (refund)
  } else {
    // Regular numeric amount (+1, -1, +10, -10)
    const amount = parseInt(amountStr, 10);
    if (amount < 0) {
      // For negative amounts, only allow if currentValue is above the minimum
      if (currentValue > baseAdeptnessForJob) {
        // Don't allow to go below the minimum
        newValue = Math.max(currentValue + amount, baseAdeptnessForJob);
        pointsToAllocate = newValue - currentValue;
      } else {
        // Already at minimum, do nothing
        newValue = currentValue;
        pointsToAllocate = 0;
      }
    } else {
      // For positive amounts, proceed as normal
      newValue = currentValue + amount;
      pointsToAllocate = amount;
    }
  }

  // Check limits first
  if (newValue < baseAdeptnessForJob || newValue > maxPotentialForJob) {
    return; // Cannot go below base adeptness or above max potential
  }

  if (type === "adeptness") {
    if (pointsToAllocate > 0) {
      // Adding points - check if we have enough skill points
      if (
        character.points.spentSkill + pointsToAllocate <=
        character.points.totalSkill
      ) {
        character.points.spentSkill += pointsToAllocate;
        skill[type] = newValue;
      } else {
        // Not enough skill points - allocate as many as possible
        const availablePoints =
          character.points.totalSkill - character.points.spentSkill;
        if (availablePoints > 0) {
          character.points.spentSkill += availablePoints;
          skill[type] = currentValue + availablePoints;
        }
        return;
      }
    } else if (pointsToAllocate < 0) {
      // Subtracting points (refund)
      const refundAmount = Math.abs(pointsToAllocate);
      character.points.spentSkill -= refundAmount;
      skill[type] = newValue;
    }
  }

  runCalculations(); // Recalculate and re-render
}

async function fetchEquipmentData() {
  const equipmentFiles = {
    head: "helmets",
    torso: "chest",
    gloves: "gloves",
    pants: "pants",
    boots: "boots",
    weapon_1h_sword: "weapons-1h-sword",
    weapon_2h_sword: "weapons-2h-sword",
    weapon_1h_wand: "weapons-1h-wand",
    weapon_2h_wand: "weapons-2h-wand",
    weapon_1h_blunt: "weapons-1h-blunt",
    weapon_2h_blunt: "weapons-2h-blunt",
    weapon_1h_axe: "weapons-1h-axe",
    weapon_2h_axe: "weapons-2h-axe",
    weapon_1h_spear: "weapons-1h-spear",
    weapon_2h_spear: "weapons-2h-spear",
    weapon_bow: "weapons-bow",
    weapon_crossbow: "weapons-crossbow",
    weapon_dagger: "weapons-dagger",
    weapon_claw: "weapons-claw",
    shield: "shields",
    earring1: "earrings",
    earring2: "earrings",
    necklace: "necklaces",
    belt: "belts",
    ring1: "rings",
    ring2: "rings",
    cape: "capes",
  };

  const equipmentData = {};

  for (const [slot, filename] of Object.entries(equipmentFiles)) {
    try {
      const response = await fetch(`js/items/${filename}.csv`);
      if (!response.ok) {
        console.warn(
          `Failed to load ${filename}.csv: ${response.status} ${response.statusText}`,
        );
        continue;
      }
      const csvText = await response.text();
      const items = parseCSV(csvText, slot, filename);
      equipmentData[slot] = items;
    } catch (error) {
      console.error(`Error loading ${filename}.csv:`, error);
    }
  }

  globalEquipmentData = equipmentData;
  return equipmentData;
}

async function fetchSoulsData() {
  try {
    const response = await fetch(`js/items/souls.csv`);
    if (!response.ok) {
      console.warn(
        `Failed to load souls.csv: ${response.status} ${response.statusText}`,
      );
      globalSoulsData = [];
      return [];
    }
    const csvText = await response.text();
    const souls = parseSoulsCSV(csvText);
    globalSoulsData = souls;
    return souls;
  } catch (error) {
    console.error("Error loading souls.csv:", error);
    globalSoulsData = [];
    return [];
  }
}

function parseSoulsCSV(csvText) {
  const lines = csvText.trim().split("\n");
  const headers = lines[0].split(","); // name,type,stats,enhancement,description
  const souls = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) continue;

    let values = line.split(",");
    if (values.length < headers.length) {
      while (values.length < headers.length) values.push("");
    } else if (values.length > headers.length) {
      const base = values.slice(0, headers.length - 1);
      const tail = values.slice(headers.length - 1).join(",");
      values = [...base, tail];
    }

    const name = values[0]?.trim() || "";
    const typeCell = values[1]?.trim() || "";
    const statsCell = values[2]?.trim() || "";
    const effectsCell = values[3]?.trim() || "";
    const description = (values[4] || "").trim();

    // Build types array; support semicolon-separated list; allow 'all'
    const types = typeCell
      ? typeCell.split(";").map((t) => t.trim().toLowerCase())
      : [];

    // Create a stable id
    const id = `soul-${name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-]/g, "")}`;

    souls.push({
      id,
      name,
      types,
      stats: parseEffects(statsCell),
      effects: parseEffects(effectsCell),
      description,
    });
  }

  return souls;
}

function parseCSV(csvText, slot, filename) {
  const lines = csvText.trim().split("\n");
  const headers = lines[0].split(",");
  const items = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    let values = line.split(",");
    if (values.length < headers.length) {
      while (values.length < headers.length) {
        values.push("");
      }
    } else if (values.length > headers.length) {
      const base = values.slice(0, headers.length - 1);
      const tail = values.slice(headers.length - 1).join(",");
      values = [...base, tail];
    }

    const item = {
      id: `${slot}-${values[0].toLowerCase().replace(/\s+/g, "-")}`,
      name: values[0],
      lvlreq: parseInt(values[1]) || 0,
      // atk/def parsed conditionally below based on filename
      slots: parseInt(values[3]) || 0,
      stats: parseEffects(values[4]),
      effects: parseEffects(values[5]),
      equipclass: (values[6] || "").trim(), // Keep equipclass as raw string for job filtering
      setBonus: parseEffects(values[7]),
      description: (values[8] || "").trim(), // Add description column support
      slot: slot,
    };

    // Determine whether this CSV represents weapons to decide whether column[2] is ATK or DEF
    const isWeaponFile =
      typeof filename === "string" && filename.startsWith("weapons");
    const atkOrDefValue = parseInt(values[2]) || 0;
    if (isWeaponFile) {
      item.atk = atkOrDefValue;
    } else {
      item.def = atkOrDefValue;
    }

    items.push(item);
  }

  return items;
}

function parseEffects(effectsString) {
  const effects = {};

  if (!effectsString) {
    return effects;
  }

  // Split by semicolon first to handle multiple enhancement blocks
  const effectPhrases = effectsString.split(";");
  let hasEnhancement = false;

  effectPhrases.forEach((phrase) => {
    const trimmedPhrase = phrase.trim();

    if (trimmedPhrase === "") {
      return;
    }

    // Check if this phrase is an enhancement effect
    const enhancementMatch = trimmedPhrase.match(/^enhancement:(\d+):(.+)$/);
    const exactEnhancementMatchA = trimmedPhrase.match(
      /^enhancement:(\d+):exact:(.+)$/,
    );
    // Support alternate ordering: enhancement:exact:<level>:<effects>
    const exactEnhancementMatchB = trimmedPhrase.match(
      /^enhancement:exact:(\d+):(.+)$/,
    );
    const progressiveEnhancementMatch = trimmedPhrase.match(
      /^enhancement:(\d+)-(\d+):(.+)$/,
    );

    if (
      enhancementMatch ||
      exactEnhancementMatchA ||
      exactEnhancementMatchB ||
      progressiveEnhancementMatch
    ) {
      let match,
        enhancementLevel,
        enhancementEffects,
        isExact,
        isProgressive,
        maxLevel;

      if (progressiveEnhancementMatch) {
        match = progressiveEnhancementMatch;
        enhancementLevel = parseInt(match[1]);
        maxLevel = parseInt(match[2]);
        enhancementEffects = match[3];
        isExact = false;
        isProgressive = true;
      } else {
        match =
          enhancementMatch || exactEnhancementMatchA || exactEnhancementMatchB;
        enhancementLevel = parseInt(match[1]);
        enhancementEffects = match[2];
        isExact = !!(exactEnhancementMatchA || exactEnhancementMatchB);
        isProgressive = false;
        maxLevel = null;
      }

      // If this is the first enhancement, create the enhancement object
      if (!hasEnhancement) {
        effects.enhancement = {
          level: enhancementLevel,
          exact: isExact,
          progressive: isProgressive,
          maxLevel: maxLevel,
          effects: parseEnhancementEffects(enhancementEffects),
        };
        hasEnhancement = true;
      } else {
        // If there are multiple enhancements, merge them
        // For exact enhancements, use the highest level
        if (enhancementLevel > effects.enhancement.level) {
          effects.enhancement.level = enhancementLevel;
        }
        // If any enhancement is exact, mark the whole thing as exact
        if (isExact) {
          effects.enhancement.exact = true;
        }
        // If any enhancement is progressive, mark the whole thing as progressive
        if (isProgressive) {
          effects.enhancement.progressive = true;
          effects.enhancement.maxLevel = maxLevel;
        }
        // Merge the effects
        const additionalEffects = parseEnhancementEffects(enhancementEffects);
        Object.assign(effects.enhancement.effects, additionalEffects);
      }
      return;
    }

    // Regular effect parsing
    const match = trimmedPhrase.match(/^(.*?)([+\-*/])(.*)$/);

    if (match) {
      const key = match[1].trim();
      const operator = match[2].trim();
      let value = match[3].trim();

      if (value.endsWith("%")) {
        // Different stats handle percentages differently:
        // - LP and MP: actual percentages (divide by 100)
        // - Cast speed: expects decimal (divide by 100)
        // - All others: whole numbers (don't divide)
        if (key === "lp" || key === "mp" || key === "castspeed") {
          value = parseFloat(value.replace("%", "")) / 100;
        } else {
          value = parseFloat(value.replace("%", ""));
        }
      } else {
        value = isNaN(parseFloat(value)) ? value : parseFloat(value);
      }

      effects[key] = {
        operator: operator,
        value: value,
      };
    } else {
      effects[trimmedPhrase] = true;
    }
  });

  return effects;
}

function parseEnhancementEffects(effectsString) {
  const effects = {};
  const effectPhrases = effectsString.split(";");

  effectPhrases.forEach((phrase) => {
    const trimmedPhrase = phrase.trim();
    if (trimmedPhrase === "") return;

    const match = trimmedPhrase.match(/^(.*?)([+\-*/])(.*)$/);
    if (match) {
      const key = match[1].trim();
      const operator = match[2].trim();
      let value = match[3].trim();

      if (value.endsWith("%")) {
        // In enhancements, only cast speed should be treated as percentage
        // LP and MP are flat values, not percentages
        if (key === "castspeed") {
          value = parseFloat(value.replace("%", "")) / 100;
        } else {
          value = parseFloat(value.replace("%", ""));
        }
      } else {
        value = isNaN(parseFloat(value)) ? value : parseFloat(value);
      }

      effects[key] = {
        operator: operator,
        value: value,
      };
    }
  });

  return effects;
}

/**
 * Populates UI dropdowns from the gameData object.
 */
async function populateDropdowns() {
  // Races
  elements.race.innerHTML = gameData.races
    .map((r) => `<option value="${r.id}">${r.name}</option>`)
    .join("");
  elements.race.value = character.raceId; // Set initial value

  // Jobs
  elements.job.innerHTML = gameData.jobs
    .map((j) => `<option value="${j.id}">${j.name}</option>`)
    .join("");
  elements.job.value = character.jobId; // Set initial value

  // Racial Skills - Dynamically populate based on selected race
  populateRacialSkillDropdown();

  // Equipment - will be populated asynchronously
  await populateEquipmentSelectors();
  await populateSoulSelectors();

  // Wire up weapon type selection handling once selectors are populated
  if (elements.weaponTypeSelector) {
    elements.weaponTypeSelector.addEventListener("change", () => {
      const selectedTypeKey = elements.weaponTypeSelector.value;
      const weaponSelector = elements.equipmentSelectors.weapon;

      if (!selectedTypeKey) {
        // No type selected: disable weapon selector and clear choices
        if (weaponSelector) {
          weaponSelector.disabled = true;
          weaponSelector.innerHTML = `<option value="weapon-none">Select a weapon type first</option>`;
          weaponSelector.value = `weapon-none`;
        }
        // Clear current equipped weapon in state
        character.equipment.weapon = "weapon-none";
        runCalculations();
        return;
      }

      // Populate weapon selector from the chosen type's items
      const items = globalEquipmentData[selectedTypeKey] || [];
      if (weaponSelector) {
        if (items.length === 0) {
          weaponSelector.disabled = true;
          weaponSelector.innerHTML = `<option value="weapon-none">No weapons available</option>`;
          weaponSelector.value = `weapon-none`;
        } else {
          // Filter items based on job compatibility
          const compatibleItems = items.filter((item) =>
            isItemEquippableByCurrentJob(item),
          );

          if (compatibleItems.length === 0) {
            weaponSelector.disabled = true;
            weaponSelector.innerHTML = `<option value="weapon-none">No compatible weapons</option>`;
            weaponSelector.value = `weapon-none`;
          } else {
            // Sort so None first if present
            const sortedItems = compatibleItems.slice().sort((a, b) => {
              if (a.name === "None") return -1;
              if (b.name === "None") return 1;
              return a.name.localeCompare(b.name);
            });
            weaponSelector.innerHTML = sortedItems
              .map(
                (item) =>
                  `<option value="${item.id}">${item.name} (${item.slots ?? 0} slots)</option>`,
              )
              .join("");
            weaponSelector.disabled = false;

            // Choose current equipped if it belongs to this list; otherwise default to None or first
            const currentId = character.equipment.weapon;
            const exists = sortedItems.some((i) => i.id === currentId);
            if (exists) {
              weaponSelector.value = currentId;
            } else {
              const noneOption = sortedItems.find((i) => i.name === "None");
              weaponSelector.value = noneOption
                ? noneOption.id
                : sortedItems[0].id;
              character.equipment.weapon = weaponSelector.value; // Update character state
            }
          }
        }
      }

      // Mirror the filtered items into a generic weapon slot list so downstream lookups work
      // Consumers of globalEquipmentData expect weapon items under the 'weapon' slot.
      const allWeaponItems = globalEquipmentData[selectedTypeKey] || [];
      const compatibleWeaponItems = allWeaponItems.filter((item) =>
        isItemEquippableByCurrentJob(item),
      );
      globalEquipmentData.weapon = compatibleWeaponItems.map((item) => ({
        ...item,
      }));

      // Update state and recalc
      if (weaponSelector) {
        character.equipment.weapon = weaponSelector.value;
      }
      runCalculations();

      // Update souls UI for weapon slot after type change selection applied
      if (GEAR_SLOTS_WITH_SOULS.includes("weapon")) {
        updateSoulSelectorsForSlot("weapon");
      }
    });
  }
}

async function ensureSoulsLoaded() {
  if (globalSoulsData.length > 0) return;
  try {
    const response = await fetch("js/items/souls.csv");
    if (!response.ok) return;
    const csvText = await response.text();
    // Reuse parseCSV with a neutral slot key 'souls'
    globalSoulsData = parseCSV(csvText, "souls", "souls");
  } catch (e) {
    console.warn("Failed to load souls.csv", e);
  }
}

function getSoulOptionsHTML() {
  const options = ['<option value="">None</option>'];
  for (const soul of globalSoulsData) {
    if (!soul || !soul.id || !soul.name) continue;
    options.push(`<option value="${soul.id}">${soul.name}</option>`);
  }
  return options.join("");
}

function findEquipmentItemById(slot, itemId) {
  const list = globalEquipmentData[slot] || [];
  return list.find((it) => it.id === itemId) || null;
}

/**
 * Checks if an item is equippable by the current job based on the equipclass column.
 * @param {Object} item - The equipment item to check
 * @returns {boolean} - True if the item can be equipped by the current job
 */
function isItemEquippableByCurrentJob(item) {
  if (!item || !item.equipclass || item.equipclass.trim() === "") {
    return true; // If no equipclass restriction, allow all jobs
  }

  // Get current job name and normalize it
  const currentJob = gameData.jobs[character.jobId];
  if (!currentJob) {
    return false;
  }

  // Normalize job name by removing whitespace and converting to lowercase
  const normalizedJobName = currentJob.name.trim().toLowerCase();

  // Parse equipclass - it's a semicolon-separated list
  const allowedClasses = item.equipclass
    .split(";")
    .map((cls) => cls.trim().toLowerCase());

  // Check if current job is in the allowed classes
  return allowedClasses.includes(normalizedJobName);
}

function queryEquipmentSlotContainer(slot) {
  // Map from slot to container element that holds its controls
  // We use known label/select structure from index.html
  // Find the select for the slot and return its closest '.equipment-slot'
  const select = elements.equipmentSelectors[slot];
  if (!select) return null;
  return select.closest(".equipment-slot");
}

function clearExistingSoulControls(container, slot) {
  if (!container) return;
  // Remove any existing soul label/selects for this slot
  const selects = container.querySelectorAll(`[id^="equip-${slot}-soul"]`);
  selects.forEach((el) => el.remove());
  // Remove the leading Soul label if it is now orphaned (only if followed by no soul selects)
  const labels = Array.from(container.querySelectorAll("label"));
  for (const label of labels) {
    const forAttr = label.getAttribute("for") || "";
    const isSoulForAttr = forAttr.startsWith(`equip-${slot}-soul`);
    const isSoulText =
      (label.textContent || "").trim().toLowerCase() === "soul";
    if (isSoulForAttr || isSoulText) {
      label.remove();
    }
  }
}

function ensureSoulLabel(container, slot) {
  // Insert a single label before the first soul select for consistency
  const label = document.createElement("label");
  label.setAttribute("for", `equip-${slot}-soul1`);
  label.textContent = "Soul";
  container.appendChild(label);
}

function createSoulSelect(slot, index) {
  const select = document.createElement("select");
  select.id = `equip-${slot}-soul${index}`;
  select.className = "equip-selector";
  select.innerHTML = getSoulOptionsHTML();

  // Restore selection from state if present
  const saved = (character.equippedSouls[slot] || [])[index - 1] || "";
  select.value = saved;

  // Save changes to state on change
  select.addEventListener("change", (e) => {
    const value = e.target.value;
    const arr = character.equippedSouls[slot] || [];
    arr[index - 1] = value;
    character.equippedSouls[slot] = arr;
    runCalculations();
    updateSkillPreviewModal();
  });

  return select;
}

function updateSoulSelectorsForSlot(slot) {
  // If souls not yet loaded, load and retry once
  if (!globalSoulsData || globalSoulsData.length === 0) {
    ensureSoulsLoaded().then(() => updateSoulSelectorsForSlot(slot));
    return;
  }
  const container = queryEquipmentSlotContainer(slot);
  if (!container) return;

  const currentItemId = elements.equipmentSelectors[slot]?.value || "";
  const item = findEquipmentItemById(slot, currentItemId);
  const numSlots = item?.slots || 0;

  // Normalize saved souls array to current capacity
  const savedArr = character.equippedSouls[slot] || [];
  if (savedArr.length !== numSlots) {
    character.equippedSouls[slot] = savedArr.slice(0, Math.max(0, numSlots));
  }

  // Clear existing soul controls
  clearExistingSoulControls(container, slot);

  if (numSlots <= 0) return;

  ensureSoulLabel(container, slot);
  for (let i = 1; i <= numSlots; i++) {
    const select = createSoulSelect(slot, i);
    container.appendChild(select);
  }
}
/**
 * Populates equipment selectors in the equipment modal.
 */
async function populateEquipmentSelectors() {
  try {
    const equipmentData = await fetchEquipmentData();
    await fetchSoulsData();
    await ensureSoulsLoaded();

    // Build weapon type options dynamically from available weapon keys
    const weaponTypeSelector = elements.weaponTypeSelector;
    if (weaponTypeSelector) {
      const weaponTypeEntries = Object.entries(equipmentData).filter(
        ([slotKey]) => slotKey.startsWith("weapon_"),
      );

      // Create placeholder first option
      const weaponTypeOptions = [
        `<option value="">-- Select weapon type --</option>`,
      ];
      for (const [slotKey, items] of weaponTypeEntries) {
        // human-friendly label from the filename mapping in fetchEquipmentData
        // slotKey looks like weapon_1h_sword → label "1h sword"
        const label = slotKey.replace(/^weapon_/, "").replace(/_/g, " ");
        weaponTypeOptions.push(`<option value="${slotKey}">${label}</option>`);
      }
      weaponTypeSelector.innerHTML = weaponTypeOptions.join("");
    }

    // Ensure weapon select is disabled until a type is chosen
    if (elements.equipmentSelectors.weapon) {
      const hasSelectedType = !!(
        elements.weaponTypeSelector && elements.weaponTypeSelector.value
      );
      elements.equipmentSelectors.weapon.disabled = !hasSelectedType;
      if (!hasSelectedType) {
        elements.equipmentSelectors.weapon.innerHTML = `<option value="weapon-none">Select a weapon type first</option>`;
        elements.equipmentSelectors.weapon.value = `weapon-none`;
      }
    }

    for (const slot in elements.equipmentSelectors) {
      const selector = elements.equipmentSelectors[slot];
      if (!selector) {
        console.warn(`Selector not found for slot: ${slot}`);
        continue;
      }

      if (slot === "weapon") {
        continue;
      }

      if (equipmentData[slot] && equipmentData[slot].length > 0) {
        // Filter items based on job compatibility
        const compatibleItems = equipmentData[slot].filter((item) =>
          isItemEquippableByCurrentJob(item),
        );

        // Sort items so "None" options appear first
        const sortedItems = compatibleItems.sort((a, b) => {
          if (a.name === "None") return -1;
          if (b.name === "None") return 1;
          return a.name.localeCompare(b.name);
        });

        if (sortedItems.length > 0) {
          selector.innerHTML = sortedItems
            .map(
              (item) =>
                `<option value="${item.id}">${item.name} (${item.slots ?? 0} slots)</option>`,
            )
            .join("");

          // Check if current equipment is still valid for this job
          const currentItemId = character.equipment[slot] || `${slot}-none`;
          const isCurrentItemValid = sortedItems.some(
            (item) => item.id === currentItemId,
          );

          if (isCurrentItemValid) {
            selector.value = currentItemId;
          } else {
            // Current item is not compatible with job, default to None or first available
            const noneOption = sortedItems.find((item) => item.name === "None");
            selector.value = noneOption ? noneOption.id : sortedItems[0].id;
            character.equipment[slot] = selector.value; // Update character state
          }
        } else {
          // No compatible items for this job
          selector.innerHTML = `<option value="${slot}-none">No compatible items</option>`;
          selector.value = `${slot}-none`;
          character.equipment[slot] = `${slot}-none`;
        }
      } else {
        // Create a "None" option for empty slots
        selector.innerHTML = `<option value="${slot}-none">None</option>`;
        selector.value = `${slot}-none`;
        console.warn(`No items found for slot: ${slot}`);
      }
    }

    // Populate enhancement dropdowns
    populateEnhancementSelectors();
    // Populate soul dropdowns
    populateSoulSelectors();
    // Initialize souls UI per slot for current selections
    for (const slot of GEAR_SLOTS_WITH_SOULS) {
      updateSoulSelectorsForSlot(slot);
    }
  } catch (error) {
    console.error("Error populating equipment selectors:", error);
  }
}

/**
 * Populates enhancement selectors in the equipment modal.
 */
function populateEnhancementSelectors() {
  for (const slot in elements.enhancementSelectors) {
    const selector = elements.enhancementSelectors[slot];
    if (!selector) continue;

    // Create enhancement options from 0 to 10
    const options = [];
    for (let i = 0; i <= 10; i++) {
      options.push(`<option value="${i}">+${i}</option>`);
    }

    selector.innerHTML = options.join("");

    const currentItemId = character.equipment[slot];
    const currentEnhancement =
      character.equipmentEnhancements[currentItemId] || 0;
    selector.value = currentEnhancement;
  }
}

function populateSoulSelectors() {
  if (!globalSoulsData || globalSoulsData.length === 0) return;

  const slotsWithSouls = Object.keys(elements.soulSelectors);

  for (const slot of slotsWithSouls) {
    const selectors = elements.soulSelectors[slot] || [];
    // Filter souls allowed for this slot
    const allowedSouls = globalSoulsData.filter((soul) => {
      if (!soul || !soul.name) return false;
      if (soul.name.toLowerCase() === "none") return true;
      if (!soul.types || soul.types.length === 0) return false;
      return (
        soul.types.includes("all") || soul.types.includes(slot.toLowerCase())
      );
    });

    // Sort: 'none' first, then alphabetical
    const sorted = allowedSouls.slice().sort((a, b) => {
      const aIsNone = a.name.toLowerCase() === "none";
      const bIsNone = b.name.toLowerCase() === "none";
      if (aIsNone && !bIsNone) return -1;
      if (!aIsNone && bIsNone) return 1;
      return a.name.localeCompare(b.name);
    });

    const optionsHTML = sorted
      .map((soul) => {
        const value = soul.name.toLowerCase() === "none" ? "none" : soul.id;
        const label = soul.name.toLowerCase() === "none" ? "None" : soul.name;
        return `<option value="${value}">${label}</option>`;
      })
      .join("");

    selectors.forEach((selector, idx) => {
      if (!selector) return;
      selector.innerHTML = optionsHTML;
      const current = character.souls?.[slot]?.[idx] ?? "none";
      selector.value = current;
      selector.addEventListener("change", () => {
        if (!character.souls[slot]) character.souls[slot] = [];
        character.souls[slot][idx] = selector.value;
        runCalculations();
      });
    });
  }
}

/**
 * Dynamically populates the racial skill dropdown based on the selected race.
 * This function also determines and sets the *default* racial skill for the job.
 */
function populateRacialSkillDropdown() {
  const currentRaceId = parseInt(elements.race.value, 10);
  const currentJobId = parseInt(elements.job.value, 10);

  const racialSkillsData = gameData.racialSkills[currentRaceId];
  let racialSkillsForRace = [];
  let defaultRacialSkillId = 0; // Default to the first racial skill for the race

  if (racialSkillsData && racialSkillsData.skills) {
    racialSkillsForRace = racialSkillsData.skills.map((skill) => skill.name);
  }

  elements.racialSkill.innerHTML = racialSkillsForRace
    .map((skillName, index) => `<option value="${index}">${skillName}</option>`)
    .join("");

  elements.racialSkill.value = defaultRacialSkillId; // Set the default based on job
  character.racialSkillId = defaultRacialSkillId; // Update character state

  elements.displayRace.textContent = gameData.races[currentRaceId].name;
  elements.displayRacialSkill.textContent =
    racialSkillsForRace[character.racialSkillId] || "";
  elements.displayJob.textContent = gameData.jobs[currentJobId].name;
}

function readInputs() {
  let level = parseInt(elements.level.value, 10);
  // Enforce level limits
  level = Math.max(1, Math.min(gameData.maxLevel, level));
  if (level !== parseInt(elements.level.value, 10)) {
    elements.level.value = level;
  }
  character.level = level;

  character.raceId = parseInt(elements.race.value, 10);
  character.racialSkillId = parseInt(elements.racialSkill.value, 10); // NEW
  character.jobId = parseInt(elements.job.value, 10);

  // Get the racial base stats for the current race
  const raceStats = gameData.raceBaseStats[character.raceId];
  const jobInfo = gameData.jobs[character.jobId];
  const jobModifiers = gameData.jobBaseStatModifiers[jobInfo.baseClass];

  for (const stat of PRIMARY_STATS) {
    // Calculate the base stat (racial + job modifier)
    const baseStat = raceStats[stat] + jobModifiers[stat];

    // Read the total stat value from the input field
    let totalStat = parseInt(elements.addedStatInputs[stat].value, 10) || 0;

    // Enforce minimum: total stat cannot go below base stat
    totalStat = Math.max(baseStat, totalStat);

    // Enforce maximum: total stat cannot exceed 99
    totalStat = Math.min(99, totalStat);

    // Update the input field if it was outside limits
    if (totalStat !== parseInt(elements.addedStatInputs[stat].value, 10)) {
      elements.addedStatInputs[stat].value = totalStat;
    }

    // Calculate additional stats as the difference between total and base
    character.addedStats[stat] = Math.max(0, totalStat - baseStat);
  }

  for (const slot in elements.equipmentSelectors) {
    character.equipment[slot] = elements.equipmentSelectors[slot].value;
  }

  // Read souls selections
  if (!character.souls) character.souls = {};
  for (const slot in elements.soulSelectors) {
    const selectors = elements.soulSelectors[slot];
    if (!selectors) continue;
    character.souls[slot] = selectors.map((sel) => (sel ? sel.value : "none"));
  }
}

function runCalculations() {
  readInputs();

  calculateTotalPoints();

  const baseStats = getCombinedBaseStats();
  calculateSpentStatPoints(baseStats);

  const bonuses = { description: [], stats: {} };
  applyEquipmentBonuses(bonuses);
  applySoulsBonuses(bonuses);
  applySetBonuses(bonuses);
  applyRacialSkillEffects(bonuses);
  applySkillBuffEffects(bonuses);
  applyPrayerProficiencySpiBonus(bonuses);

  // Calculate uncapped stats for derived stat calculations
  const uncappedStats = {};
  for (const stat of PRIMARY_STATS) {
    const total =
      baseStats[stat] + character.addedStats[stat] + (bonuses.stats[stat] || 0);
    uncappedStats[stat] = total;
    character.finalStats[stat] = Math.min(gameData.maxStatValue, total);
  }

  // Apply SPI-based buff effects after final stats are calculated
  if (bonuses.spiBasedEffects) {
    for (const effect of bonuses.spiBasedEffects) {
      // Use enchanter SPI instead of current character SPI
      const enchanterSpi =
        character.enchanterSpi[effect.buffId] || effect.data[0]?.value || 33;
      applySpiBasedBuffEffects(
        effect.skillName,
        effect.data,
        bonuses,
        enchanterSpi,
      );
    }
  }

  calculateDerivedStats(bonuses, uncappedStats);

  updateStatCostIndicators(); // Update cost indicators for stat increases
  updateUI(bonuses);
}

/**
 * Priest, Cleric, and Enchanter gain +1 SPI by default, plus +1 SPI per 10 Prayer proficiency.
 * They begin with base Prayer proficiency (~15), so they effectively start at +2 SPI.
 */
function applyPrayerProficiencySpiBonus(bonuses) {
  const eligibleJobsForBonus = new Set([15, 16, 17]); // Priest, Cleric, Enchanter
  if (!eligibleJobsForBonus.has(character.jobId)) return;

  const proficiencies = calculateCategoryProficiencies();
  const prayerProficiency = proficiencies.prayer || 0;

  const spiBonusFromPrayer = 1 + Math.floor(prayerProficiency / 10);
  if (spiBonusFromPrayer > 0) {
    bonuses.stats.spi = (bonuses.stats.spi || 0) + spiBonusFromPrayer;
    bonuses.description.push(`Prayer proficiency: +${spiBonusFromPrayer} SPI`);
  }
}

function getCombinedBaseStats() {
  const combined = {};
  const raceStats = gameData.raceBaseStats[character.raceId];
  const jobInfo = gameData.jobs[character.jobId];
  const jobModifiers = gameData.jobBaseStatModifiers[jobInfo.baseClass]; // Use baseClass from jobInfo

  for (const stat of PRIMARY_STATS) {
    // Job modifiers are always applied to base stats
    combined[stat] = raceStats[stat] + jobModifiers[stat];
  }
  return combined;
}

/**
 * Applies stats from equipped items.
 */
function applyEquipmentBonuses(bonuses) {
  for (const slot in character.equipment) {
    const itemId = character.equipment[slot];

    // Find the item in the global equipment data
    let item = null;
    if (globalEquipmentData[slot]) {
      item = globalEquipmentData[slot].find((item) => item.id === itemId);
    }

    if (item) {
      // Add item description to bonuses if it exists and isn't empty
      if (item.description && item.description.trim() !== "") {
        bonuses.description.push(`${item.name}: ${item.description}`);
      }

      // Apply stats bonuses
      if (item.stats) {
        for (const stat in item.stats) {
          const statValue = item.stats[stat];
          if (statValue && statValue.value !== undefined) {
            if (statValue.operator === "+") {
              bonuses.stats[stat] =
                (bonuses.stats[stat] || 0) + statValue.value;
            } else if (statValue.operator === "-") {
              bonuses.stats[stat] =
                (bonuses.stats[stat] || 0) - statValue.value;
            }
          }
        }
      }

      // Apply effects bonuses
      if (item.effects) {
        for (const effect in item.effects) {
          const effectValue = item.effects[effect];

          // Handle enhancement effects
          if (effect === "enhancement" && effectValue && effectValue.level) {
            // Get current enhancement level for this item (default to 0)
            const currentEnhancement =
              character.equipmentEnhancements?.[itemId] || 0;

            let shouldApply = false;
            let enhancementMultiplier = 1;

            if (effectValue.exact) {
              // Exact enhancement: only apply if current level equals the required level
              shouldApply = currentEnhancement === effectValue.level;
            } else if (effectValue.progressive) {
              // Progressive enhancement: apply if current level is within the range
              shouldApply =
                currentEnhancement >= effectValue.level &&
                currentEnhancement <= effectValue.maxLevel;
              if (shouldApply) {
                // Calculate progressive value: base value + (current level - start level)
                enhancementMultiplier =
                  1 + (currentEnhancement - effectValue.level);
              }
            } else {
              // Regular enhancement: apply if current level is at least the required level
              enhancementMultiplier = Math.floor(
                currentEnhancement / effectValue.level,
              );
              shouldApply = enhancementMultiplier > 0;
            }

            if (shouldApply && effectValue.effects) {
              for (const [
                enhancementEffect,
                enhancementEffectValue,
              ] of Object.entries(effectValue.effects)) {
                const totalValue =
                  enhancementEffectValue.value * enhancementMultiplier;

                // Check if this is a primary stat
                if (PRIMARY_STATS.includes(enhancementEffect)) {
                  // Apply to bonuses.stats for UI display
                  if (enhancementEffectValue.operator === "+") {
                    bonuses.stats[enhancementEffect] =
                      (bonuses.stats[enhancementEffect] || 0) + totalValue;
                  } else if (enhancementEffectValue.operator === "-") {
                    bonuses.stats[enhancementEffect] =
                      (bonuses.stats[enhancementEffect] || 0) - totalValue;
                  }
                } else {
                  // Apply to bonuses directly for other effects
                  if (enhancementEffectValue.operator === "+") {
                    bonuses[enhancementEffect] =
                      (bonuses[enhancementEffect] || 0) + totalValue;
                  } else if (enhancementEffectValue.operator === "-") {
                    bonuses[enhancementEffect] =
                      (bonuses[enhancementEffect] || 0) - totalValue;
                  }
                }
              }
            }
            continue;
          }

          // Handle regular effects
          if (effectValue && effectValue.value !== undefined) {
            if (effectValue.operator === "+") {
              bonuses[effect] = (bonuses[effect] || 0) + effectValue.value;
            } else if (effectValue.operator === "-") {
              bonuses[effect] = (bonuses[effect] || 0) - effectValue.value;
            }
          }
        }
      }
    }
  }
}

// Applies bonuses from selected souls to the bonuses object
function applySoulsBonuses(bonuses) {
  if (!character.souls || !globalSoulsData) return;

  const slots = Object.keys(character.souls);
  for (const slot of slots) {
    const selectedSoulIds = character.souls[slot] || [];
    const equippedItemIdForSlot = character.equipment?.[slot];
    const currentEnhancementLevel = equippedItemIdForSlot
      ? character.equipmentEnhancements?.[equippedItemIdForSlot] || 0
      : 0;

    for (const soulId of selectedSoulIds) {
      if (!soulId || soulId === "none") continue;
      const soul = globalSoulsData.find((s) => s.id === soulId);
      if (!soul) continue;

      // Apply stats
      if (soul.stats) {
        for (const stat in soul.stats) {
          const statValue = soul.stats[stat];
          if (statValue && statValue.value !== undefined) {
            if (PRIMARY_STATS.includes(stat)) {
              if (statValue.operator === "+") {
                bonuses.stats[stat] =
                  (bonuses.stats[stat] || 0) + statValue.value;
              } else if (statValue.operator === "-") {
                bonuses.stats[stat] =
                  (bonuses.stats[stat] || 0) - statValue.value;
              }
            } else {
              if (statValue.operator === "+") {
                bonuses[stat] = (bonuses[stat] || 0) + statValue.value;
              } else if (statValue.operator === "-") {
                bonuses[stat] = (bonuses[stat] || 0) - statValue.value;
              }
            }
          }
        }
      }

      // Apply effects, including enhancement-gated ones
      if (soul.effects) {
        for (const effect in soul.effects) {
          const effectValue = soul.effects[effect];

          if (effect === "enhancement" && effectValue && effectValue.level) {
            let shouldApply = false;
            let enhancementMultiplier = 1;

            if (effectValue.exact) {
              shouldApply = currentEnhancementLevel === effectValue.level;
            } else if (effectValue.progressive) {
              shouldApply =
                currentEnhancementLevel >= effectValue.level &&
                currentEnhancementLevel <= effectValue.maxLevel;
              if (shouldApply) {
                enhancementMultiplier =
                  1 + (currentEnhancementLevel - effectValue.level);
              }
            } else {
              enhancementMultiplier = Math.floor(
                currentEnhancementLevel / effectValue.level,
              );
              shouldApply = enhancementMultiplier > 0;
            }

            if (shouldApply && effectValue.effects) {
              for (const [enhEffect, enhEffectValue] of Object.entries(
                effectValue.effects,
              )) {
                const totalValue = enhEffectValue.value * enhancementMultiplier;
                if (PRIMARY_STATS.includes(enhEffect)) {
                  if (enhEffectValue.operator === "+") {
                    bonuses.stats[enhEffect] =
                      (bonuses.stats[enhEffect] || 0) + totalValue;
                  } else if (enhEffectValue.operator === "-") {
                    bonuses.stats[enhEffect] =
                      (bonuses.stats[enhEffect] || 0) - totalValue;
                  }
                } else {
                  if (enhEffectValue.operator === "+") {
                    bonuses[enhEffect] = (bonuses[enhEffect] || 0) + totalValue;
                  } else if (enhEffectValue.operator === "-") {
                    bonuses[enhEffect] = (bonuses[enhEffect] || 0) - totalValue;
                  }
                }
              }
            }
            continue;
          }

          if (effectValue && effectValue.value !== undefined) {
            if (PRIMARY_STATS.includes(effect)) {
              if (effectValue.operator === "+") {
                bonuses.stats[effect] =
                  (bonuses.stats[effect] || 0) + effectValue.value;
              } else if (effectValue.operator === "-") {
                bonuses.stats[effect] =
                  (bonuses.stats[effect] || 0) - effectValue.value;
              }
            } else {
              if (effectValue.operator === "+") {
                bonuses[effect] = (bonuses[effect] || 0) + effectValue.value;
              } else if (effectValue.operator === "-") {
                bonuses[effect] = (bonuses[effect] || 0) - effectValue.value;
              }
            }
          } else if (typeof effectValue === "boolean" && effectValue) {
            bonuses.description.push(`${soul.name}: ${effect}`);
          }
        }
      }

      if (soul.description) {
        bonuses.description.push(soul.description);
      }
    }
  }
}

/**
 * Checks for and applies set bonuses.
 */
function applySetBonuses(bonuses) {
  const equippedItemIds = new Set(Object.values(character.equipment));

  for (const set of setBonuses) {
    const hasAllItems = set.requiredItems.every((itemId) =>
      equippedItemIds.has(itemId),
    );
    if (hasAllItems) {
      bonuses.description.push(set.bonus.description);
      for (const stat in set.bonus.stats) {
        bonuses.stats[stat] =
          (bonuses.stats[stat] || 0) + set.bonus.stats[stat];
      }
    }
  }
}

/**
 * Collects all skills with buffEffectTable from both skill data files.
 * Returns an array of {name, buffId, buffEffectTable, description} objects.
 */
function getAllSkillBuffs() {
  const skillBuffs = [];

  // Helper function to extract buffs from a skill category
  function extractBuffsFromCategory(skills, categoryName) {
    for (const [skillName, skillData] of Object.entries(skills)) {
      if (skillData.buffEffectTable) {
        const buffId = `skill-${categoryName}-${skillName}`
          .toLowerCase()
          .replace(/\s+/g, "-");
        skillBuffs.push({
          name: skillName,
          buffId: buffId,
          buffEffectTable: skillData.buffEffectTable,
          description: skillData.description || `${skillName} buff effect`,
          category: categoryName,
        });
      }
    }
  }

  // Search through classSkillData
  for (const [classId, classData] of Object.entries(classSkillData)) {
    if (classData.skills) {
      for (const category of classData.skills) {
        if (category.skills) {
          extractBuffsFromCategory(category.skills, category.name);
        }
      }
    }
  }

  // Search through classSpecificSkillData
  for (const [classId, skillsData] of Object.entries(classSpecificSkillData)) {
    // classSpecificSkillData has skills directly under job ID, not under a .skills property
    if (skillsData && typeof skillsData === "object") {
      const jobName =
        gameData.jobs[parseInt(classId)]?.name || `Job ${classId}`;
      extractBuffsFromCategory(skillsData, `${jobName} Specific`);
    }
  }

  return skillBuffs;
}

/**
 * Initializes skill buffs in the character.buffs object.
 */
function initializeSkillBuffs() {
  const skillBuffs = getAllSkillBuffs();

  // Add each skill buff to character.buffs if not already present
  for (const skillBuff of skillBuffs) {
    if (!(skillBuff.buffId in character.buffs)) {
      character.buffs[skillBuff.buffId] = false;
    }
  }
}

/**
 * Looks up detailed skill data from classSkillData and classSpecificSkillData.
 * Returns null if not found.
 */
function getDetailedSkillData(skillName) {
  // Search through classSkillData
  for (const [classId, classData] of Object.entries(classSkillData)) {
    if (classData.skills) {
      for (const category of classData.skills) {
        if (category.skills && category.skills[skillName]) {
          return category.skills[skillName];
        }
      }
    }
  }

  // Search through classSpecificSkillData
  for (const [classId, skillsData] of Object.entries(classSpecificSkillData)) {
    // classSpecificSkillData has skills directly under job ID, not under a .skills property
    if (skillsData && skillsData[skillName]) {
      return skillsData[skillName];
    }
  }

  return null;
}

/**
 * Calculates the effective MP cost for a skill based on character stats and bonuses.
 */
function calculateEffectiveMpCost(baseMpCost, bonuses) {
  if (!baseMpCost) return 0;

  let effectiveCost = baseMpCost;

  // Apply MP cost reduction from racial skills
  if (bonuses.mpCostReduction) {
    effectiveCost = Math.ceil(
      (effectiveCost * (100 - bonuses.mpCostReduction)) / 100,
    );
  }

  // Apply MP cost reduction from set bonuses
  if (bonuses.stats.redMp) {
    const reduction = Math.abs(bonuses.stats.redMp);
    effectiveCost = Math.ceil((effectiveCost * (100 - reduction)) / 100);
  }

  return Math.max(1, effectiveCost); // Minimum 1 MP
}

/**
 * Calculates the effective cast time for a skill based on character stats and bonuses.
 */
function calculateEffectiveCastTime(baseCastTime, bonuses) {
  if (!baseCastTime) return 0;

  let effectiveTime = baseCastTime;

  // Apply cast speed bonus from DEX (from finalStats.castSpd)
  const castSpeedBonus = character.finalStats.castSpd || 100;
  effectiveTime = effectiveTime * (100 / castSpeedBonus);

  // Apply cast time reduction from skill buffs (like Saltio)
  if (bonuses.castTimeReduction) {
    effectiveTime = (effectiveTime * (100 - bonuses.castTimeReduction)) / 100;
  }

  return Math.max(0.1, effectiveTime); // Minimum 0.1 seconds
}

/**
 * Calculates the effective cooldown for a skill based on character stats and bonuses.
 */
function calculateEffectiveCooldown(baseCooldown, bonuses) {
  if (!baseCooldown) return 0;

  let effectiveCooldown = baseCooldown;

  // Apply cooldown reduction from INT (from finalStats.cooldown)
  const cooldownReduction = character.finalStats.cooldown || 100;
  effectiveCooldown = effectiveCooldown * (cooldownReduction / 100);

  return Math.max(0.1, effectiveCooldown); // Minimum 0.1 seconds
}

/**
 * Applies SPI-based buff effects like Lapis Mediow.
 * This function should be called after final stats are calculated.
 */
function applySpiBasedBuffEffects(skillName, spiData, bonuses, enchanterSpi) {
  // Find the appropriate SPI tier
  let selectedTier = null;
  for (const tier of spiData) {
    if (enchanterSpi >= tier.value) {
      selectedTier = tier;
    }
  }

  if (!selectedTier || !selectedTier.Blessing) return;

  // For now, use the highest tier blessing (could be made configurable)
  const blessing = selectedTier.Blessing[selectedTier.Blessing.length - 1];

  if (blessing && blessing.def) {
    bonuses.stats.def = (bonuses.stats.def || 0) + blessing.def;
  }

  if (blessing && blessing.dodgeChance) {
    bonuses.dodgeChance = (bonuses.dodgeChance || 0) + blessing.dodgeChance;
  }
}

/**
 * Applies active skill buff effects to the bonuses object.
 */
function applySkillBuffEffects(bonuses) {
  const skillBuffs = getAllSkillBuffs();

  for (const skillBuff of skillBuffs) {
    const isActive = character.buffs[skillBuff.buffId];
    if (!isActive) continue;

    const effects = skillBuff.buffEffectTable;

    // Add description
    bonuses.description.push(`${skillBuff.name}: ${skillBuff.description}`);

    // Apply stat bonuses
    for (const [stat, value] of Object.entries(effects)) {
      if (PRIMARY_STATS.includes(stat)) {
        // Direct stat bonus (e.g., str: 9)
        if (!bonuses.stats[stat]) bonuses.stats[stat] = 0;
        bonuses.stats[stat] += value;
      } else if (stat === "castTime") {
        // Cast time reduction (e.g., castTime: -50)
        bonuses.castTimeReduction =
          (bonuses.castTimeReduction || 0) + Math.abs(value);
      } else if (stat === "lp") {
        // LP bonus handling
        if (typeof value === "string" && value.includes("+")) {
          // Complex LP formula like "15.00 + 250"
          const parts = value.split("+").map((p) => parseFloat(p.trim()));
          if (parts.length === 2) {
            bonuses.lpBuff = (bonuses.lpBuff || 0) + parts[1]; // Add flat amount
            bonuses.lpPercentBuff =
              (bonuses.lpPercentBuff || 0) + parts[0] / 100; // Add percentage
          }
        } else if (typeof value === "number") {
          // Simple numeric LP bonus
          bonuses.lpBuff = (bonuses.lpBuff || 0) + value;
        } else {
          bonuses.lpBuff = (bonuses.lpBuff || 0) + value;
        }
      } else if (stat === "spiValues") {
        // Complex SPI-based effects (like Lapis Mediow)
        // Store for later processing after final stats are calculated
        bonuses.spiBasedEffects = bonuses.spiBasedEffects || [];
        bonuses.spiBasedEffects.push({
          skillName: skillBuff.name,
          buffId: skillBuff.buffId,
          data: value,
        });
      }
    }
  }
}

/**
 * Applies racial skill effects to the character.
 */
function applyRacialSkillEffects(bonuses) {
  const racialSkillsData = gameData.racialSkills[character.raceId];
  if (!racialSkillsData || !racialSkillsData.skills) return;

  const selectedSkill = racialSkillsData.skills[character.racialSkillId];
  if (!selectedSkill || !selectedSkill.effect) return;

  const effect = selectedSkill.effect;

  // Add description of the racial skill effect
  bonuses.description.push(
    `${selectedSkill.name}: ${selectedSkill.description}`,
  );

  // Apply effects based on type
  switch (effect.type) {
    case "meleeSkillBonus":
      // +10 to melee skill with one-handed weapons
      bonuses.meleeSkillBonus = effect.value;
      break;
    case "ailmentDurationReduction":
      // Reduce duration of ailments by 50%
      bonuses.ailmentDurationReduction = effect.value;
      break;
    case "potionEffectiveness":
      // Increase potion effectiveness by 15%
      bonuses.potionEffectiveness = effect.value;
      break;
    case "rangedRangeBonus":
      // Increase ranged range by 3
      bonuses.rangedRangeBonus = effect.value;
      break;
    case "mpCostReduction":
      // Reduce MP cost of spells by 15%
      bonuses.mpCostReduction = effect.value;
      break;
    case "charmResistance":
      // Increase charm resistance by 20%
      bonuses.charmResistance = effect.value;
      break;
    case "damageBonus":
      // Increase damage with specific weapon types
      if (effect.condition === "axeOrBlunt") {
        bonuses.axeBluntDamageBonus = effect.value;
      } else if (effect.condition === "2HandedWeapon") {
        bonuses.twoHandedDamageBonus = effect.value;
      }
      break;
    case "criticalHitChance":
      // Increased critical hit chance by 5%
      bonuses.criticalHitChance = effect.value;
      break;
    case "damageToMPConversion":
      // Chance to convert 10% damage taken into MP
      bonuses.damageToMPConversion = effect.value;
      break;
    case "dodgeChance":
      // 5% chance to dodge damage
      bonuses.dodgeChance = effect.value;
      break;
    case "physicalDamageReduction":
      // Reduce damage taken by 10%
      bonuses.physicalDamageReduction = effect.value;
      break;
    case "physicalDefense":
      // Boosts physical defense (party effect)
      bonuses.physicalDefense = effect.value;
      break;
    case "magicalDefense":
      // Boosts magical defense (party effect)
      bonuses.magicalDefense = effect.value;
      break;
    case "magicResistance":
      // Increase magic resistance
      bonuses.magicResistance = effect.value;
      break;
    case "mpRegeneration":
      // MP regeneration
      bonuses.mpRegeneration = effect.value;
      break;
    default:
      // Handle "none" effects or other undefined effects gracefully
      break;
  }
}
/**
 * Calculates derived stats based on the final primary stats.
 * @param {Object} bonuses - The bonuses object containing equipment/skill bonuses
 * @param {Object} uncappedStats - The uncapped stat values for calculations that should go beyond 99
 */
function calculateDerivedStats(bonuses = {}, uncappedStats = null) {
  const stats = character.finalStats;
  // Use uncapped stats for calculations that should go beyond 99, fall back to capped stats if not provided
  const calculationStats = uncappedStats || stats;
  const level = character.level;
  const mod =
    gameData.jobModifiers[character.jobId] || gameData.jobModifiers[0];

  // LP Calculation
  const levelLPComponent = Math.ceil(level * (100 / mod[2]));
  const staMultiplier = Math.ceil(100 / mod[4]);
  const staLPComponent = Math.ceil(calculationStats.sta * staMultiplier);
  let totalLp = mod[0] + levelLPComponent + staLPComponent;

  // Apply LP buff from skills (e.g., Divine Aid)
  if (bonuses.lpPercentBuff) {
    // Apply percentage increase first
    totalLp = Math.floor(totalLp * (1 + bonuses.lpPercentBuff));
  }

  if (bonuses.lpBuff) {
    // Apply flat increase
    totalLp += bonuses.lpBuff;
  }

  // Apply LP bonus from equipment
  if (bonuses.lp) {
    totalLp += bonuses.lp;
  }

  stats.lp = totalLp;

  // MP Calculation
  const levelMPComponent = Math.ceil(level * (100 / mod[3]));
  const spiMultiplier = Math.ceil(100 / mod[5]);
  const spiMPComponent = Math.ceil(calculationStats.spi * spiMultiplier);
  let totalMp = mod[1] + levelMPComponent + spiMPComponent;

  // Apply MP bonus from equipment
  if (bonuses.mp) {
    totalMp += bonuses.mp;
  }

  stats.mp = totalMp;

  // POT (Potential) - Potion effectiveness
  let potValue = 100; // Base 100%

  // STA bonus: Math.floor((STA^2 * 2) / 1000)
  const staBonus = Math.floor((Math.pow(calculationStats.sta, 2) * 2) / 1000);
  potValue += staBonus;

  // Warrior class bonus: +10% for all warrior classes
  if (character.jobId >= 0 && character.jobId <= 6) {
    // Warrior class range
    potValue += 10;
  }

  // Alchemy skill bonus: +15 for Acolyte class (job 14-20)
  if (character.jobId >= 14 && character.jobId <= 20) {
    potValue += 15;
  }

  // Recovery increase: +10 per 10 points in melee skills (if level >= 12 and warrior class)
  if (character.level >= 12 && character.jobId >= 0 && character.jobId <= 6) {
    const meleeSkill = character.skills[1]; // Slash skill as representative
    if (meleeSkill) {
      const meleeBonus = Math.floor(meleeSkill.adeptness / 10) * 10;
      potValue += meleeBonus;
    }
  }

  // Apply racial skill bonus for potion effectiveness
  if (bonuses.potionEffectiveness) {
    potValue += bonuses.potionEffectiveness;
  }

  stats.pot = potValue;

  // LP Heal - base 100%
  stats.lpHeal = 100;
  if (bonuses.lpHeal) {
    stats.lpHeal += bonuses.lpHeal;
  }

  // LP Recovery Amount - natural LP recovery per tick
  let lpRecovery =
    Math.floor(stats.lp / 35) + Math.floor(calculationStats.sta / 3);

  // Apply equipment bonuses for LP recovery
  if (bonuses.lpRecovery) {
    lpRecovery += bonuses.lpRecovery;
  }

  stats.lpRecovery = lpRecovery;

  // MP Recovery Amount - natural MP recovery per tick
  let mpRecovery =
    Math.floor(stats.mp / 25) + Math.floor(calculationStats.spi / 3);

  // Apply equipment bonuses for MP recovery
  if (bonuses.mpRecovery) {
    mpRecovery += bonuses.mpRecovery;
  }

  stats.mpRecovery = mpRecovery;

  // LP per 2 seconds - recovery from skills/effects over time
  let lpPer2Sec = 0;

  // Reclaim skill effect (placeholder for skill implementation)
  // tmp[1] += (Flag['13_7']) ? 15 + Math.floor(Number($('InBuff_0').value) / 10) + Math.floor((Status['Skill'][13][0] + Status['Skill'][13][1]) / 10): 0;

  // Restoration skill effect (placeholder for skill implementation)
  // tmp[1] += (Flag['13_9']) ? 7 + Math.floor(Number($('InBuff_0').value) / 5) + Math.floor((Status['Skill'][13][0] + Status['Skill'][13][1]) / 10): 0;

  // Apply equipment bonuses for LP per 2 sec
  if (bonuses.lpPer2Sec) {
    lpPer2Sec += bonuses.lpPer2Sec;
  }

  stats.lpPer2Sec = lpPer2Sec;

  // MP per 2 seconds - recovery from skills/effects over time
  let mpPer2Sec = 0;

  // Rex Naturalis skill effect (placeholder for skill implementation)
  // tmp[1] += (Flag['15_0']) ? 5: 0;

  // Apply equipment bonuses for MP per 2 sec
  if (bonuses.mpPer2Sec) {
    mpPer2Sec += bonuses.mpPer2Sec;
  }

  stats.mpPer2Sec = mpPer2Sec;

  // Calculate MP cost reduction from both racial skills and set bonuses
  let totalMpReduction = 0;

  if (bonuses.stats.redMp) {
    // Set bonus redMp is negative for reduction (e.g., -5 means 5% reduction)
    totalMpReduction += Math.abs(bonuses.stats.redMp);
  }

  // Also check for mp effect from equipment (MP reduction)
  if (bonuses.mp) {
    totalMpReduction += Math.abs(bonuses.mp);
  }

  stats.redMp = 100 - totalMpReduction;
  stats.incMp = 0;

  if (bonuses.incMp) {
    stats.incMp += bonuses.incMp;
  }

  // ATK Calculations
  stats.atk = Math.floor(calculationStats.str / 2); // STR/2 only, gear added separately when equipped
  for (const slot in character.equipment) {
    const itemId = character.equipment[slot];

    // Find the item in the global equipment data
    let item = null;
    if (globalEquipmentData[slot]) {
      item = globalEquipmentData[slot].find((item) => item.id === itemId);
    }

    if (item?.atk && typeof item.def == "undefined") {
      stats.atk += item.atk;
    }
  }

  // Front ATK bonus - base 0%
  stats.frontAtk = 0;

  // Back ATK bonus - base 15%
  stats.backAtk = 15;

  // Max ATK - base 5
  stats.maxAtk = 5;

  // MATK Calculations
  let matkValue = 100;

  // INT bonus to MATK - approximately 0.376% per INT point
  if (calculationStats.int >= 5) {
    matkValue += (calculationStats.int - 4) * 0.376;
  }

  if (character.jobId >= 22 && character.jobId <= 24) {
    matkValue += 10;
  }

  const equippedWeaponId = character.equipment.weapon;
  if (equippedWeaponId.includes("staff")) {
    matkValue += 10;
  }

  // Add elemental proficiency bonus to MATK
  const elementalSkill = character.skills[18]; // Elemental skill ID
  if (elementalSkill) {
    const elementalBonus = elementalSkill.adeptness * 0.106; // 0.106% per point
    matkValue += elementalBonus;
  }

  stats.matk = matkValue;

  // DEF Calculations
  stats.def = 0;
  for (const slot in character.equipment) {
    const itemId = character.equipment[slot];

    // Find the item in the global equipment data
    let item = null;
    if (globalEquipmentData[slot]) {
      item = globalEquipmentData[slot].find((item) => item.id === itemId);
    }

    if (item?.def && typeof item.atk == "undefined") {
      stats.def += item.def;
    }
  }

  // Apply DEF bonus from buffs
  if (bonuses.stats.def) {
    stats.def += bonuses.stats.def;
  }

  // Front DEF bonus
  stats.frontDef = Math.floor(stats.def * 1.1);

  // Back DEF bonus
  stats.backDef = Math.floor(stats.def * 0.9);

  // Physical Resistance - base 0%
  stats.phyRes = 0;
  stats.phyResFront = 0;
  stats.phyResBack = 0;
  // Magical Resistance - base 0%
  stats.magRes = 0;
  stats.magDamageReduction = 0;

  if (bonuses.magDamageReduction) {
    stats.magDamageReduction += bonuses.magDamageReduction;
  }

  // Accuracy
  stats.acc = level + calculationStats.dex;
  stats.accFront = stats.acc; // Same as acc, only changes with gear

  // Critical calculations
  stats.crit = 1 + Math.floor(calculationStats.dex / 10);

  // Apply racial skill bonus for critical hit chance
  if (bonuses.criticalHitChance) {
    stats.crit += bonuses.criticalHitChance;
  }

  // Apply equipment crit bonus
  if (bonuses.crit) {
    stats.crit += bonuses.crit;
  }

  stats.criD = 100; // Critical damage bonus (base 100%, only increased by gear)
  stats.criRes = 0; // Critical resistance - base 0%
  stats.cdamRes = 100; // Critical damage resistance - base 100%

  // Dodge - base 5
  function calculateDodge() {
    let totalAgi = character.finalStats.agi;
    console.log(character.finalStats);
    let dodge = character.level + totalAgi;
    let bonus = 0;
    if (totalAgi >= 140) bonus = 98;
    else if (totalAgi >= 130) bonus = 85;
    else if (totalAgi >= 120) bonus = 72;
    else if (totalAgi >= 110) bonus = 61;
    else if (totalAgi >= 100) bonus = 50;
    else if (totalAgi >= 90) bonus = 41;
    else if (totalAgi >= 80) bonus = 32;
    else if (totalAgi >= 70) bonus = 25;
    else if (totalAgi >= 60) bonus = 18;
    else if (totalAgi >= 50) bonus = 13;
    else if (totalAgi >= 40) bonus = 8;
    else if (totalAgi >= 30) bonus = 5;
    else if (totalAgi >= 20) bonus = 2;
    else if (totalAgi >= 10) bonus = 1;

    console.log(`dodge: ${dodge}`);
    console.log(`bonus: ${bonus}`);
    console.log(dodge + bonus);
    return dodge + bonus;
  }
  stats.dodge = calculateDodge();

  // Apply racial skill bonus for dodge chance
  if (bonuses.dodgeChance) {
    stats.dodge += bonuses.dodgeChance;
  }

  // Evasion types
  stats.melEva = 0; // Melee evasion - base 0%
  stats.ranEva = 0; // Range evasion - base 0%
  stats.magEva = 0; // Magic evasion - base 0%

  // Attack types - weapon range values only change with gear
  if (bonuses.rangedRangeBonus) {
    stats.range = bonuses.rangedRangeBonus;
  } else {
    stats.range = "---"; // Range attack - no base value
  }
  if (bonuses.meleeRangeBonus) {
    stats.melee = bonuses.meleeRangeBonus;
  } else {
    stats.melee = "---"; // Melee range - no base value
  }

  // Attack Speed - base 100%
  stats.atkSpd = 100;

  // Cast Speed - starts at 100%, increases by 5% every 10 DEX
  stats.castSpd = 100 + Math.floor(calculationStats.dex / 10) * 5;

  // Apply cast speed bonuses from equipment
  if (bonuses.castspeed) {
    stats.castSpd += bonuses.castspeed * 100;
  }

  // Cast time - base 100%, reduced by skill buffs only (not equipment)
  let baseCastTime = 100;
  if (bonuses.castTimeReduction) {
    baseCastTime = Math.floor(
      (baseCastTime * (100 - bonuses.castTimeReduction)) / 100,
    );
  }
  stats.castTime = baseCastTime;

  // Cooldown - -2% every 10 INT (base 100%)
  stats.cooldown = Math.max(0, 100 - Math.floor(calculationStats.int / 10) * 2);

  // Movement Speed - base 100%
  stats.moveSpd = 100;
  stats.townMsp = 100;

  // Elemental Resistances (base values, can be modified by equipment)
  stats.fireR = 0;
  stats.iceR = 0;
  stats.thundR = 0;
  stats.poisonR = 0;
  stats.charmR = 0;
  stats.lightR = 0;
  stats.darkR = 0;

  // Ailments and Disorders
  stats.knockbackR = 0;
  stats.knockdownR = 0;
  stats.stunR = 0;
  stats.burnR = 0;
  stats.tripR = 0;
  stats.bleedR = 0;
  stats.freezeR = 0;
  stats.sleepR = 0;
  stats.curseR = 0;
  stats.weakR = 0;
  stats.silenceR = 0;
  stats.ailmentR = Math.floor(calculationStats.sta / 28) * 7;
  stats.disorderR = Math.floor(calculationStats.spi / 28) * 7;

  // Apply resistance bonuses directly to stats
  const resistanceKeyMap = {
    magicres: "magRes",
    fireres: "fireR",
    iceres: "iceR",
    thundres: "thundR",
    poisonres: "poisonR",
    lightres: "lightR",
    darkres: "darkR",
    charmres: "charmR",
    charmResistance: "charmR",
    tripres: "tripR",
    stunres: "stunR",
    bleedres: "bleedR",
    freezeres: "freezeR",
    sleepres: "sleepR",
    curseres: "curseR",
    weakres: "weakR",
    physicalDamageReduction: "phyRes",
    knockbackres: "knockbackR",
    knockdownres: "knockdownR",
    silenceres: "silenceR",
    ailmentres: "ailmentR",
    disorderres: "disorderR",
  };

  for (const [bonusKey, bonusValue] of Object.entries(bonuses)) {
    const statKey = resistanceKeyMap[bonusKey];
    if (statKey) {
      stats[statKey] += Number(bonusValue) || 0;
    }
  }

  // Apply horsemanship stat modifications if mounted
  if (character.isMounted) {
    applyHorsemanshipModifications(stats);
  }
}

/**
 * Applies horsemanship stat modifications when mounted.
 * Modifies atk, matk, and castSpd based on horsemanship proficiency and job class.
 */
function applyHorsemanshipModifications(stats) {
  // Get horsemanship skill proficiency (skill ID 24 is Horsemanship)
  const horsemanshipSkill = character.skills[24];
  const horsemanshipProficiency = horsemanshipSkill
    ? horsemanshipSkill.adeptness
    : 0;

  // Map job IDs to horsemanship retention data indices
  let retentionDataKey;
  switch (character.jobId) {
    case 10: // Hunter
      retentionDataKey = 1;
      break;
    case 27: // Shadowblade
      retentionDataKey = 2;
      break;
    case 6: // Paladin
      retentionDataKey = 3;
      break;
    case 3: // Dragoon
      retentionDataKey = 4;
      break;
    default:
      retentionDataKey = "nonRiding";
      break;
  }

  // Get the retention percentages for this class
  const retentionData =
    gameData.horsemanShipStatRetentionPercents[retentionDataKey];
  if (
    !retentionData ||
    !retentionData.profValues ||
    !retentionData.profValues[0]
  ) {
    return; // No data available
  }

  // Find the appropriate proficiency tier
  const profTiers = retentionData.profValues[0];
  let retentionPercentages = null;

  // Find the highest tier that the character qualifies for
  const availableTiers = Object.keys(profTiers)
    .map(Number)
    .sort((a, b) => b - a);
  for (const tier of availableTiers) {
    if (horsemanshipProficiency >= tier) {
      retentionPercentages = profTiers[tier];
      break;
    }
  }

  if (!retentionPercentages) {
    return; // No applicable tier found
  }

  // Apply the stat reductions (these are retention percentages, so we multiply by them)
  if (retentionPercentages.atk !== undefined) {
    stats.atk = Math.floor(stats.atk * retentionPercentages.atk);
  }
  if (retentionPercentages.matk !== undefined) {
    stats.matk = stats.matk * retentionPercentages.matk;
  }
  if (retentionPercentages.castspeed !== undefined) {
    stats.castSpd = Math.floor(stats.castSpd * retentionPercentages.castspeed);
  }
}

function calculateTotalPoints() {
  let totalStat = 0;
  let totalSkill = 0;
  let totalUnallocated = 0;

  for (let i = 2; i <= character.level; i++) {
    const bonus = gameData.levelUpBonuses[i];
    if (bonus) {
      totalStat += bonus[0];
      totalSkill += bonus[1];
      totalUnallocated += bonus[2];
    }
  }
  character.points.totalStat = totalStat;
  character.points.totalSkill = totalSkill;
  character.points.totalUnallocated = totalUnallocated;
}

function calculateSpentStatPoints(baseStats) {
  let totalCost = 0;
  for (const stat of PRIMARY_STATS) {
    const startValue = baseStats[stat];
    const addedValue = character.addedStats[stat];
    const endValue = startValue + addedValue;

    if (endValue > gameData.maxStatValue) {
      character.addedStats[stat] = Math.max(
        0,
        gameData.maxStatValue - startValue,
      );
      elements.addedStatInputs[stat].value = character.addedStats[stat];
      const cappedEndValue = startValue + character.addedStats[stat];

      for (let i = startValue; i < cappedEndValue; i++) {
        totalCost += gameData.statPointCosts[i + 1]?.[0] || 0;
      }
      if (cappedEndValue > gameData.maxStatValue) {
        totalCost = Infinity;
      }
    } else {
      for (let i = startValue; i < endValue; i++) {
        totalCost += gameData.statPointCosts[i + 1]?.[0] || 0;
      }
    }
  }
  character.points.spentStat = totalCost;
}

function updateStatCostIndicators() {
  const raceStats = gameData.raceBaseStats[character.raceId];
  const jobInfo = gameData.jobs[character.jobId];
  const jobModifiers = gameData.jobBaseStatModifiers[jobInfo.baseClass];

  for (const stat of PRIMARY_STATS) {
    const baseStat = raceStats[stat] + jobModifiers[stat];
    const currentTotalStat = baseStat + character.addedStats[stat];
    const nextLevel = currentTotalStat + 1;

    if (nextLevel > gameData.maxStatValue) {
      elements.statCosts[stat].textContent = "--";
    } else {
      const cost = gameData.statPointCosts[nextLevel]?.[0] || 0;
      elements.statCosts[stat].textContent = cost + "p";
    }
  }
}

function updateUI(bonuses) {
  // Update display values for racial skill and job based on selected values
  const selectedRace = gameData.races[character.raceId];
  const selectedJob = gameData.jobs[character.jobId];

  elements.displayRace.textContent = selectedRace ? selectedRace.name : "";
  // Ensure racial skill name is retrieved correctly
  const racialSkillsForCurrentRace = gameData.racialSkills[character.raceId];
  const selectedRacialSkill =
    racialSkillsForCurrentRace?.skills?.[character.racialSkillId];
  elements.displayRacialSkill.textContent = selectedRacialSkill?.name || "";
  elements.displayJob.textContent = selectedJob ? selectedJob.name : "";

  // Update primary stat displays and buff bonuses
  for (const stat of PRIMARY_STATS) {
    const totalElement = elements.outputs[stat];
    const inputElement = elements.addedStatInputs[stat];
    const buffBonusElement = elements.buffBonuses[stat];

    if (totalElement) {
      const combinedBase = getCombinedBaseStats()[stat]; // Get base stat after race/job modifiers
      const added = character.addedStats[stat];
      const final = character.finalStats[stat]; // This is capped at 99

      // Calculate uncapped final total for display
      const totalStat = combinedBase + added;
      const gearBonus = bonuses.stats[stat] || 0;
      const uncappedFinal = totalStat + gearBonus;

      // Set the input field to show the total stat (base + additional)
      inputElement.value = totalStat;

      // Display as "Allocated (Final)" where Allocated = base + additional and Final = after gear (uncapped)
      totalElement.innerHTML = `${totalStat} (${uncappedFinal})`;
    }

    // Update buff bonus display
    if (buffBonusElement) {
      const buffBonus = bonuses.stats[stat] || 0;
      if (buffBonus !== 0) {
        const sign = buffBonus > 0 ? "+" : "";
        buffBonusElement.classList.toggle("stat-bonus-positive", buffBonus > 0);
        buffBonusElement.classList.toggle("stat-bonus-negative", buffBonus < 0);
        buffBonusElement.textContent = `${sign}${buffBonus}`;
        buffBonusElement.style.display = "inline";
      } else {
        buffBonusElement.textContent = "";
        buffBonusElement.style.display = "none";
      }
    }
  }

  // Update skill preview modal if it's open
  updateSkillPreviewModal();
  // Update other outputs
  elements.outputs.lp.textContent = Math.floor(character.finalStats.lp);
  elements.outputs.mp.textContent = Math.floor(character.finalStats.mp);
  elements.outputs.atk.textContent = Math.floor(character.finalStats.atk);
  elements.outputs.def.textContent = Math.floor(character.finalStats.def);
  elements.outputs.matk.textContent =
    character.finalStats.matk.toFixed(1) + "%"; // MATK as percentage with 1 decimal place
  elements.outputs.dodge.textContent = Math.floor(character.finalStats.dodge);
  elements.outputs.acc.textContent = Math.floor(character.finalStats.acc);
  elements.outputs.accFront.textContent = Math.floor(
    character.finalStats.accFront,
  );
  elements.outputs.crit.textContent =
    Math.floor(character.finalStats.crit) + "%";

  // Update additional derived stats
  elements.outputs.pot.textContent = Math.floor(character.finalStats.pot);
  elements.outputs.lpHeal.textContent =
    Math.floor(character.finalStats.lpHeal) + "%";

  // Only update recovery stats if the elements exist (might not be in HTML yet)
  if (elements.outputs.lpRecovery) {
    elements.outputs.lpRecovery.textContent = Math.floor(
      character.finalStats.lpRecovery || 0,
    );
  }

  if (elements.outputs.mpRecovery) {
    elements.outputs.mpRecovery.textContent = Math.floor(
      character.finalStats.mpRecovery || 0,
    );
  }

  if (elements.outputs.lpPer2Sec) {
    elements.outputs.lpPer2Sec.textContent = Math.floor(
      character.finalStats.lpPer2Sec || 0,
    );
  }

  if (elements.outputs.mpPer2Sec) {
    elements.outputs.mpPer2Sec.textContent = Math.floor(
      character.finalStats.mpPer2Sec || 0,
    );
  }

  elements.outputs.redMp.textContent = Math.floor(character.finalStats.redMp);
  elements.outputs.incMp.textContent = Math.floor(character.finalStats.incMp);

  elements.outputs.frontAtk.textContent = Math.floor(
    character.finalStats.frontAtk,
  );
  elements.outputs.backAtk.textContent = Math.floor(
    character.finalStats.backAtk,
  );

  elements.outputs.frontDef.textContent = Math.floor(
    character.finalStats.frontDef,
  );
  elements.outputs.backDef.textContent = Math.floor(
    character.finalStats.backDef,
  );

  elements.outputs.phyRes.textContent =
    Math.floor(character.finalStats.phyRes) + "%";
  elements.outputs.magRes.textContent =
    Math.floor(character.finalStats.magRes) + "%";

  elements.outputs.criD.textContent =
    Math.floor(character.finalStats.criD) + "%";
  elements.outputs.criRes.textContent =
    Math.floor(character.finalStats.criRes) + "%";
  elements.outputs.cdamRes.textContent =
    Math.floor(character.finalStats.cdamRes) + "%";

  elements.outputs.melEva.textContent =
    Math.floor(character.finalStats.melEva) + "%";
  elements.outputs.ranEva.textContent =
    Math.floor(character.finalStats.ranEva) + "%";
  elements.outputs.magEva.textContent =
    Math.floor(character.finalStats.magEva) + "%";

  elements.outputs.melee.textContent = character.finalStats.melee;
  elements.outputs.range.textContent = character.finalStats.range;

  elements.outputs.atkSpd.textContent =
    Math.floor(character.finalStats.atkSpd) + "%";
  elements.outputs.castSpd.textContent =
    Math.floor(character.finalStats.castSpd) + "%";
  elements.outputs.castTime.textContent =
    Math.floor(character.finalStats.castTime) + "%";

  elements.outputs.cooldown.textContent =
    Math.floor(character.finalStats.cooldown) + "%";

  elements.outputs.fireR.textContent =
    Math.floor(character.finalStats.fireR) + "%";
  elements.outputs.iceR.textContent =
    Math.floor(character.finalStats.iceR) + "%";
  elements.outputs.thundR.textContent =
    Math.floor(character.finalStats.thundR) + "%";
  elements.outputs.poisonR.textContent =
    Math.floor(character.finalStats.poisonR) + "%";
  elements.outputs.charmR.textContent =
    Math.floor(character.finalStats.charmR) + "%";
  elements.outputs.lightR.textContent =
    Math.floor(character.finalStats.lightR) + "%";
  elements.outputs.darkR.textContent =
    Math.floor(character.finalStats.darkR) + "%";

  elements.outputs.tripR.textContent =
    Math.floor(character.finalStats.tripR) + "%";
  elements.outputs.stunR.textContent =
    Math.floor(character.finalStats.stunR) + "%";
  elements.outputs.freezeR.textContent =
    Math.floor(character.finalStats.freezeR) + "%";
  elements.outputs.burnR.textContent =
    Math.floor(character.finalStats.burnR) + "%";
  elements.outputs.sleepR.textContent =
    Math.floor(character.finalStats.sleepR) + "%";
  elements.outputs.weakR.textContent =
    Math.floor(character.finalStats.weakR) + "%";
  elements.outputs.curseR.textContent =
    Math.floor(character.finalStats.curseR) + "%";
  elements.outputs.bleedR.textContent =
    Math.floor(character.finalStats.bleedR) + "%";
  elements.outputs.knockdownR.textContent =
    Math.floor(character.finalStats.knockdownR) + "%";
  elements.outputs.knockbackR.textContent =
    Math.floor(character.finalStats.knockbackR) + "%";
  elements.outputs.ailmentR.textContent =
    Math.floor(character.finalStats.ailmentR) + "%";
  elements.outputs.disorderR.textContent =
    Math.floor(character.finalStats.disorderR) + "%";

  elements.outputs.moveSpd.textContent =
    Math.floor(character.finalStats.moveSpd) + "%";
  elements.outputs.townMsp.textContent =
    Math.floor(character.finalStats.townMsp) + "%";

  elements.points.stat.textContent = `${character.points.totalStat - character.points.spentStat}/${character.points.totalStat}`;
  elements.points.stat.classList.toggle(
    "overspent",
    character.points.totalStat < character.points.spentStat,
  );

  elements.points.skill.textContent = `${character.points.totalSkill - character.points.spentSkill}/${character.points.totalSkill}`;
  elements.points.skill.classList.toggle(
    "overspent",
    character.points.totalSkill < character.points.spentSkill,
  );

  elements.points.unallocated.textContent = `${character.points.totalUnallocated - character.points.spentUnallocated}/${character.points.totalUnallocated}`;
  elements.points.unallocated.classList.toggle(
    "overspent",
    character.points.totalUnallocated < character.points.spentUnallocated,
  );

  if (bonuses.description.length > 0) {
    elements.setBonusList.innerHTML = bonuses.description
      .map((d) => `<li>${d}</li>`)
      .join("");
  } else {
    elements.setBonusList.innerHTML = "<li>None</li>";
  }

  updateStatCostIndicators(); // Update cost indicators for stat increases
  renderSkillsPanel(); // Re-render skills to update bars and levels
}

/**
 * Handles job or race changes by reinitializing skills and running calculations.
 */
function handleJobRaceChange() {
  readInputs();

  // Re-initialize skills on job/race change to get base skill levels
  initializeSkills();

  // Update racial skill dropdown when race changes
  populateRacialSkillDropdown();

  // Update input fields to show new total stats (racial base + job modifiers + additional)
  const raceStats = gameData.raceBaseStats[character.raceId];
  const jobInfo = gameData.jobs[character.jobId];
  const jobModifiers = gameData.jobBaseStatModifiers[jobInfo.baseClass];

  for (const stat of PRIMARY_STATS) {
    const baseStat = raceStats[stat] + jobModifiers[stat];
    const totalStat = baseStat + character.addedStats[stat];

    // Update the input field value and min attribute
    elements.addedStatInputs[stat].value = totalStat;
    elements.addedStatInputs[stat].min = baseStat;
  }

  // Update equipment selectors to reflect new job restrictions
  // Only repopulate if equipment data is already loaded
  if (Object.keys(globalEquipmentData).length > 0) {
    populateEquipmentSelectors().catch((error) => {
      console.error(
        "Error updating equipment selectors for job change:",
        error,
      );
    });
  }

  // Run the rest of the calculations
  runCalculations();
}

/**
 * Resets status points to the current race and job base values.
 */
function resetStatusPoints() {
  // Get the current race and job base stats
  const raceStats = gameData.raceBaseStats[character.raceId];
  const jobInfo = gameData.jobs[character.jobId];
  const jobModifiers = gameData.jobBaseStatModifiers[jobInfo.baseClass];

  // Reset additional stats to 0
  for (const stat of PRIMARY_STATS) {
    character.addedStats[stat] = 0;
  }

  // Update input fields to show base stats only
  for (const stat of PRIMARY_STATS) {
    const baseStat = raceStats[stat] + jobModifiers[stat];
    elements.addedStatInputs[stat].value = baseStat;
    elements.addedStatInputs[stat].min = baseStat;
  }

  // Recalculate everything
  runCalculations();
}

/**
 * Resets ability points to the current job base values.
 */
function resetAbilityPoints() {
  // Reset spent skill points to 0
  character.points.spentSkill = 0;

  // Re-initialize skills to get base values for current job
  initializeSkills();

  // Re-render the skills panel
  renderSkillsPanel();

  // Recalculate everything
  runCalculations();
}

/**
 * Calculates which skills are unlocked based on current skill levels.
 * Returns an object with skill data organized by skill tree categories.
 */
function calculateUnlockedSkills() {
  const unlockedSkills = {};

  // Get job skill data to determine what skill categories this job can access
  const jobSkillData = skills[character.jobId];
  if (!jobSkillData) {
    console.warn(`No job skill data found for job ID ${character.jobId}`);
    return unlockedSkills;
  }

  // Process each skill category that exists in classSkillData
  for (const categoryId in classSkillData) {
    const categoryIdNum = parseInt(categoryId, 10);
    const categorySkillData = classSkillData[categoryIdNum];

    if (!categorySkillData || !categorySkillData.skills) {
      continue;
    }

    // Check if the current job has access to this skill category
    const jobCategoryData = jobSkillData[categoryIdNum];
    if (!jobCategoryData || !jobCategoryData.skills) {
      continue; // Job doesn't have access to this skill category
    }

    // Check if any skill in this category has maxPotential > 0 for this job
    const hasAccessToCategory = jobCategoryData.skills.some(
      (skill) => skill.maxPotential > 0,
    );
    if (!hasAccessToCategory) {
      continue; // Job has no potential in this skill category
    }

    const categoryName = jobCategoryData.name;
    unlockedSkills[categoryName] = {
      name: categoryName,
      skills: [],
    };

    // Process each skill tree in this category
    for (const skillTree of categorySkillData.skills) {
      const skillTreeName = skillTree.name;
      const skillTreeId = skillTree.id;

      if (!skillTree.skills) {
        continue;
      }

      // Get current skill level for this specific skill tree
      const currentSkillLevel = character.skills[skillTreeId]?.adeptness || 0;

      // Process each individual skill in the tree
      for (const skillName in skillTree.skills) {
        const skillData = skillTree.skills[skillName];

        // Check if skill is unlocked
        let isUnlocked = false;
        let requirementText = "";

        if (typeof skillData.reqPoints === "number") {
          // Simple number requirement - check against current skill level in this tree
          isUnlocked = currentSkillLevel >= skillData.reqPoints;
          requirementText = `${skillTreeName} ${skillData.reqPoints}`;
        } else if (typeof skillData.reqPoints === "object") {
          // Multiple skill requirements
          isUnlocked = true;
          const requirements = [];

          for (const reqSkillName in skillData.reqPoints) {
            const reqLevel = skillData.reqPoints[reqSkillName];

            // Find the skill ID by name
            let reqSkillId = null;
            for (const catId in gameData.skills) {
              const category = gameData.skills[catId];
              const skill = category.skills.find(
                (s) => s.name === reqSkillName,
              );
              if (skill) {
                reqSkillId = skill.id;
                break;
              }
            }

            if (reqSkillId) {
              const currentReqSkillLevel =
                character.skills[reqSkillId]?.adeptness || 0;
              if (currentReqSkillLevel < reqLevel) {
                isUnlocked = false;
              }
              requirements.push(`${reqSkillName} ${reqLevel}`);
            }
          }

          requirementText = requirements.join(", ");
        }

        unlockedSkills[categoryName].skills.push({
          name: skillName,
          description: skillData.description,
          requirement: requirementText,
          isUnlocked: isUnlocked,
          mpCost: skillData.mpCost,
          castTime: skillData.castTime,
          cooldown: skillData.cooldown,
          duration: skillData.duration,
          skillTree: skillTreeName,
        });
      }
    }

    // If no skills were added to this category, remove it
    if (unlockedSkills[categoryName].skills.length === 0) {
      delete unlockedSkills[categoryName];
    }
  }

  // Add class-specific skills
  const classSpecificSkills = classSpecificSkillData[character.jobId];
  if (classSpecificSkills && Object.keys(classSpecificSkills).length > 0) {
    const jobInfo = gameData.jobs[character.jobId];
    const categoryName = `${jobInfo.name} Skills`;

    if (!unlockedSkills[categoryName]) {
      unlockedSkills[categoryName] = {
        name: categoryName,
        skills: [],
      };
    }

    for (const skillName in classSpecificSkills) {
      const skillData = classSpecificSkills[skillName];

      // Check if skill is unlocked
      let isUnlocked = false;
      let requirementText = "";

      if (skillData.reqLevel !== undefined) {
        // Level requirement
        isUnlocked = character.level >= skillData.reqLevel;
        requirementText = `Level ${skillData.reqLevel}`;
      } else if (skillData.reqPoints !== undefined) {
        // Skill point requirements (similar to other skills)
        if (typeof skillData.reqPoints === "number") {
          // This shouldn't happen for class skills, but handle it just in case
          requirementText = `Unknown requirement ${skillData.reqPoints}`;
        } else if (typeof skillData.reqPoints === "object") {
          // Multiple skill requirements
          isUnlocked = true;
          const requirements = [];

          for (const reqSkillName in skillData.reqPoints) {
            const reqLevel = skillData.reqPoints[reqSkillName];

            // Find the skill ID by name
            let reqSkillId = null;
            for (const catId in gameData.skills) {
              const category = gameData.skills[catId];
              const skill = category.skills.find(
                (s) => s.name === reqSkillName,
              );
              if (skill) {
                reqSkillId = skill.id;
                break;
              }
            }

            if (reqSkillId) {
              const currentReqSkillLevel =
                character.skills[reqSkillId]?.adeptness || 0;
              if (currentReqSkillLevel < reqLevel) {
                isUnlocked = false;
              }
              requirements.push(`${reqSkillName} ${reqLevel}`);
            } else {
              // Skill not found, mark as not unlocked
              isUnlocked = false;
              requirements.push(`${reqSkillName} ${reqLevel} (unknown skill)`);
            }
          }

          requirementText = requirements.join(", ");
        }
      } else {
        // No requirements specified
        isUnlocked = true;
        requirementText = "None";
      }

      unlockedSkills[categoryName].skills.push({
        name: skillName,
        description: skillData.description,
        requirement: requirementText,
        isUnlocked: isUnlocked,
        mpCost: skillData.mpCost,
        castTime: skillData.castTime,
        cooldown: skillData.cooldown,
        duration: skillData.duration,
        skillTree: "Class Specific",
      });
    }

    // If no skills were added to this category, remove it
    if (unlockedSkills[categoryName].skills.length === 0) {
      delete unlockedSkills[categoryName];
    }
  }

  // Add proficiency-based skills
  const proficiencies = calculateCategoryProficiencies();

  for (const categoryName in proficiencySkills) {
    const categorySkills = proficiencySkills[categoryName];
    const currentProficiency = proficiencies[categoryName] || 0;

    // Only add category if there are skills to show
    const availableSkills = [];

    for (const skillData of categorySkills) {
      const isUnlocked = currentProficiency >= skillData.requiredProficiency;
      const requirementText = `${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)} Proficiency ${skillData.requiredProficiency}`;

      availableSkills.push({
        name: skillData.name,
        description: skillData.description,
        requirement: requirementText,
        isUnlocked: isUnlocked,
        mpCost: skillData.mpCost,
        castTime: skillData.castTime,
        cooldown: skillData.cooldown,
        duration: skillData.duration,
        skillTree: "Proficiency",
        currentProficiency: currentProficiency,
        requiredProficiency: skillData.requiredProficiency,
      });
    }

    if (availableSkills.length > 0) {
      const displayCategoryName = `${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)} Mastery`;
      unlockedSkills[displayCategoryName] = {
        name: displayCategoryName,
        skills: availableSkills,
      };
    }
  }

  return unlockedSkills;
}

/**
 * Displays the unlocked skills in the modal.
 */
function displayUnlockedSkills() {
  try {
    const unlockedSkills = calculateUnlockedSkills();
    let html = "";

    // Get current job info for display
    const jobInfo = gameData.jobs[character.jobId];
    const jobName = jobInfo.name.trim();
    const baseClass = jobInfo.baseClass;

    if (Object.keys(unlockedSkills).length === 0) {
      html = `<div class="no-skills-message">
              <p><strong>No skills available for ${jobName}.</strong></p>
              <p>This job may not have access to any skill categories with unlockable skills,</p>
              <p>or the skill data for this job's categories hasn't been added yet.</p>
            </div>`;
    } else {
      html += `<div class="job-info"><p><strong>Skills for ${jobName}:</strong></p></div>`;

      for (const categoryName in unlockedSkills) {
        const skillCategory = unlockedSkills[categoryName];

        html += `<div class="unlocked-skill-category">
                 <h3>${skillCategory.name}</h3>`;

        if (skillCategory.skills.length === 0) {
          html += `<p>No skills available in this category.</p>`;
        } else {
          // Group skills by skill tree for better organization
          const skillsByTree = {};
          for (const skill of skillCategory.skills) {
            if (!skillsByTree[skill.skillTree]) {
              skillsByTree[skill.skillTree] = [];
            }
            skillsByTree[skill.skillTree].push(skill);
          }

          // Display skills grouped by tree
          for (const treeName in skillsByTree) {
            html += `<div class="skill-tree-group">
                     <h4>${treeName} Skills</h4>`;

            for (const skill of skillsByTree[treeName]) {
              const statusClass = skill.isUnlocked ? "unlocked" : "locked";
              const reqClass = skill.isUnlocked ? "met" : "not-met";

              // Get detailed skill data for stats calculation
              const detailedSkillData = getDetailedSkillData(skill.name);
              let skillStatsHtml = "";

              if (detailedSkillData) {
                // Build base stats (always show for all skills)
                let baseStatsParts = [];
                if (detailedSkillData.mpCost > 0)
                  baseStatsParts.push(`MP: ${detailedSkillData.mpCost}`);
                if (detailedSkillData.castTime > 0)
                  baseStatsParts.push(
                    `Cast: ${detailedSkillData.castTime.toFixed(1)}s`,
                  );
                if (detailedSkillData.cooldown > 0)
                  baseStatsParts.push(
                    `Cooldown: ${detailedSkillData.cooldown.toFixed(1)}s`,
                  );
                if (detailedSkillData.duration > 0)
                  baseStatsParts.push(
                    `Duration: ${detailedSkillData.duration}s`,
                  );

                let baseStatsHtml = "";
                if (baseStatsParts.length > 0) {
                  baseStatsHtml = `<div class="skill-modal-stats-base">Base: ${baseStatsParts.join(" | ")}</div>`;
                }

                // For unlocked skills, also show modified stats
                let modifiedStatsHtml = "";
                if (skill.isUnlocked) {
                  // Calculate bonuses for this skill calculation
                  const bonuses = { description: [], stats: {} };
                  applyEquipmentBonuses(bonuses);
                  applySetBonuses(bonuses);
                  applyRacialSkillEffects(bonuses);
                  applySkillBuffEffects(bonuses);

                  // Calculate effective values
                  const effectiveMp = calculateEffectiveMpCost(
                    detailedSkillData.mpCost,
                    bonuses,
                  );
                  const effectiveCastTime = calculateEffectiveCastTime(
                    detailedSkillData.castTime,
                    bonuses,
                  );
                  const effectiveCooldown = calculateEffectiveCooldown(
                    detailedSkillData.cooldown,
                    bonuses,
                  );
                  const duration = detailedSkillData.duration || 0;

                  // Build modified stats string (only if different from base)
                  let modifiedStatsParts = [];
                  if (
                    detailedSkillData.mpCost > 0 &&
                    effectiveMp !== detailedSkillData.mpCost
                  ) {
                    modifiedStatsParts.push(`MP: ${effectiveMp}`);
                  }
                  if (
                    detailedSkillData.castTime > 0 &&
                    Math.abs(effectiveCastTime - detailedSkillData.castTime) >
                      0.01
                  ) {
                    modifiedStatsParts.push(
                      `Cast: ${effectiveCastTime.toFixed(1)}s`,
                    );
                  }
                  if (
                    detailedSkillData.cooldown > 0 &&
                    Math.abs(effectiveCooldown - detailedSkillData.cooldown) >
                      0.01
                  ) {
                    modifiedStatsParts.push(
                      `Cooldown: ${effectiveCooldown.toFixed(1)}s`,
                    );
                  }

                  if (modifiedStatsParts.length > 0) {
                    modifiedStatsHtml = `<div class="skill-modal-stats">Modified: ${modifiedStatsParts.join(" | ")}</div>`;
                  }
                }

                skillStatsHtml = baseStatsHtml + modifiedStatsHtml;
              }

              // Add proficiency progress for proficiency-based skills
              let proficiencyProgressHtml = "";
              if (
                skill.skillTree === "Proficiency" &&
                skill.currentProficiency !== undefined &&
                skill.requiredProficiency !== undefined
              ) {
                const progressPercent = Math.min(
                  100,
                  (skill.currentProficiency / skill.requiredProficiency) * 100,
                );
                const progressClass = skill.isUnlocked
                  ? "completed"
                  : "incomplete";
                proficiencyProgressHtml = `
                <div class="proficiency-progress">
                  <div class="proficiency-progress-text">
                    Progress: ${skill.currentProficiency} / ${skill.requiredProficiency} (${progressPercent.toFixed(1)}%)
                  </div>
                  <div class="proficiency-progress-bar">
                    <div class="proficiency-progress-fill ${progressClass}" style="width: ${progressPercent}%"></div>
                  </div>
                </div>
              `;
              }

              html += `
              <div class="unlocked-skill-item ${statusClass}">
                <div class="skill-name-unlock">${skill.name}</div>
                <div class="skill-description-unlock">${skill.description}</div>
                ${skillStatsHtml}
                ${proficiencyProgressHtml}
                <div class="skill-requirement ${reqClass}">
                  Req: ${skill.requirement}
                </div>
              </div>
            `;
            }

            html += `</div>`;
          }
        }

        html += `</div>`;
      }
    }

    elements.unlockedSkillsDisplay.innerHTML = html;
  } catch (error) {
    console.error("Error displaying unlocked skills:", error);
    elements.unlockedSkillsDisplay.innerHTML =
      '<div class="error-message">Error loading skills. Please check the console for details.</div>';
  }
}

/**
 * Opens the skill preview modal.
 */
function openSkillPreviewModal() {
  displayUnlockedSkills();
  elements.skillPreviewModal.style.display = "block";
}

/**
 * Updates the skill preview modal if it's open.
 */
function updateSkillPreviewModal() {
  if (elements.skillPreviewModal.style.display === "block") {
    displayUnlockedSkills();
  }
}

/**
 * Closes the skill preview modal.
 */
function closeSkillPreviewModal() {
  elements.skillPreviewModal.style.display = "none";
}

/**
 * Gets the SPI breakpoints for a skill with spiValues.
 */
function getSpiBreakpoints(spiData) {
  return spiData.map((tier) => tier.value).sort((a, b) => a - b);
}

/**
 * Populates the buffs modal with skill buffs.
 */
function populateBuffsModal() {
  const buffsDisplay = document.getElementById("buffs-display");
  const skillBuffs = getAllSkillBuffs();

  let html = "";

  // Skill buffs section
  if (skillBuffs.length > 0) {
    html += '<div class="buff-section">';
    html += "<h3>Skill Buffs</h3>";
    html += '<div class="buff-grid">';

    for (const skillBuff of skillBuffs) {
      const isChecked = character.buffs[skillBuff.buffId] ? "checked" : "";
      const hasSpiValues = skillBuff.buffEffectTable.spiValues;

      const effectsText = Object.entries(skillBuff.buffEffectTable)
        .map(([stat, value]) => {
          if (PRIMARY_STATS.includes(stat)) {
            return `+${value} ${stat.toUpperCase()}`;
          } else if (stat === "castTime") {
            return `${value}% Cast Time`;
          } else if (stat === "lp") {
            if (typeof value === "string" && value.includes("+")) {
              return `LP: ${value}`;
            } else {
              return `+${value} LP`;
            }
          } else if (stat === "spiValues") {
            return `(SPI-based)`;
          }
          return `${stat}: ${value}`;
        })
        .join(", ");

      html += `
        <div class="buff-item-container">
          <label class="buff-item">
            <input type="checkbox" id="buff-${skillBuff.buffId}" data-buff="${skillBuff.buffId}" ${isChecked}>
            <span>${skillBuff.name} (${effectsText})</span>
          </label>
      `;

      // Add SPI dropdown for skills with spiValues (Prayer category skills)
      if (
        hasSpiValues &&
        (skillBuff.category === "Blessing" || skillBuff.category === "Hymn")
      ) {
        const spiBreakpoints = getSpiBreakpoints(
          skillBuff.buffEffectTable.spiValues,
        );
        const currentSpi =
          character.enchanterSpi[skillBuff.buffId] || spiBreakpoints[0];

        html += `
          <div class="enchanter-spi-controls" style="margin-left: 20px; margin-top: 5px;">
            <label for="spi-${skillBuff.buffId}">Enchanter SPI:</label>
            <select id="spi-${skillBuff.buffId}" data-buff-id="${skillBuff.buffId}">
        `;

        for (const spiValue of spiBreakpoints) {
          const selected = spiValue === currentSpi ? "selected" : "";
          html += `<option value="${spiValue}" ${selected}>${spiValue}</option>`;
        }

        html += `
            </select>
          </div>
        `;
      }

      html += "</div>";
    }

    html += "</div></div>";
  }

  buffsDisplay.innerHTML = html;

  // Add event listeners for all buff checkboxes
  buffsDisplay
    .querySelectorAll('input[type="checkbox"]')
    .forEach((checkbox) => {
      checkbox.addEventListener("change", handleBuffChange);
    });

  // Add event listeners for SPI dropdowns
  buffsDisplay.querySelectorAll('select[id^="spi-"]').forEach((dropdown) => {
    dropdown.addEventListener("change", handleEnchanterSpiChange);
  });
}

/**
 * Handles buff checkbox changes.
 */
function handleBuffChange(event) {
  const buffId = event.target.dataset.buff;
  const isChecked = event.target.checked;

  character.buffs[buffId] = isChecked;
  runCalculations();
  updateSkillPreviewModal(); // Update skill stats in modal
}

/**
 * Handles enchanter SPI dropdown changes.
 */
function handleEnchanterSpiChange(event) {
  const buffId = event.target.dataset.buffId;
  const spiValue = parseInt(event.target.value);

  character.enchanterSpi[buffId] = spiValue;
  runCalculations();
  updateSkillPreviewModal(); // Update skill stats in modal
}

/**
 * Opens the buffs modal.
 */
function openBuffsModal() {
  populateBuffsModal();
  elements.buffsModal.style.display = "block";
}

/**
 * Closes the buffs modal.
 */
function closeBuffsModal() {
  elements.buffsModal.style.display = "none";
}

/**
 * Opens the equipment modal.
 */
function openEquipmentModal() {
  populateEquipmentSelectors();
  elements.equipmentModal.style.display = "block";
}

/**
 * Closes the equipment modal.
 */
function closeEquipmentModal() {
  elements.equipmentModal.style.display = "none";
}

/**
 * Toggles horsemanship (mounted) state and updates button appearance.
 */
function toggleHorsemanship() {
  character.isMounted = !character.isMounted;

  // Update button appearance
  const button = elements.horsmanshipToggle;
  if (character.isMounted) {
    button.classList.add("active");
    button.innerHTML = "<span>🐎 Dismount</span>";
  } else {
    button.classList.remove("active");
    button.innerHTML = "<span>🐎 Mount</span>";
  }

  // Recalculate stats with new horsemanship state
  runCalculations();
  updateSkillPreviewModal();
}

/**
 * Exports character data to JSON format and downloads it as a file.
 */
function exportCharacter() {
  // Read current inputs to ensure we have the latest data
  readInputs();

  // Get current derived stats
  const bonuses = { description: [], stats: {} };
  applyEquipmentBonuses(bonuses);
  applySetBonuses(bonuses);
  applyRacialSkillEffects(bonuses);
  applySkillBuffEffects(bonuses);

  const baseStats = getCombinedBaseStats();
  calculateDerivedStats(bonuses); // This modifies character.finalStats

  // Create export object matching the structure of exportExample.json
  const exportData = {
    level: character.level,
    race: gameData.races[character.raceId]?.name || "Unknown",
    job: gameData.jobs[character.jobId]?.name || "Unknown",
    racialSkill:
      gameData.racialSkills[character.raceId]?.skills?.[character.racialSkillId]
        ?.name || "Unknown",
    statusPoints: {
      sta: character.finalStats.sta,
      str: character.finalStats.str,
      agi: character.finalStats.agi,
      dex: character.finalStats.dex,
      spi: character.finalStats.spi,
      int: character.finalStats.int,
    },
    equipment: {
      weapon: character.equipment.weapon,
      shield: character.equipment.shield,
      head: character.equipment.head,
      torso: character.equipment.torso,
      gloves: character.equipment.gloves,
      pants: character.equipment.pants,
      boots: character.equipment.boots,
      cape: character.equipment.cape,
      earring1: character.equipment.earring1,
      earring2: character.equipment.earring2,
      necklace: character.equipment.necklace,
      belt: character.equipment.belt,
      ring1: character.equipment.ring1,
      ring2: character.equipment.ring2,
    },
    abilityPoints: {},
    derivedStats: {
      hp: Math.round(character.finalStats.lp || 0),
      mp: Math.round(character.finalStats.mp || 0),
      acc: Math.round(character.finalStats.acc || 0),
      accFront: Math.round(character.finalStats.accFront || 0),
      atk: Math.round(character.finalStats.atk || 0),
      dodge: Math.round(character.finalStats.dodge || 0),
      def: Math.round(character.finalStats.def || 0),
      crit: Math.round(character.finalStats.crit || 0),
      critDamage: Math.round(character.finalStats.criD || 0),
      critChance: Math.round(character.finalStats.criRes || 0),
      reducedMpCost: Math.round(character.finalStats.redMp || 0),
      frontDamageIncrease: Math.round(character.finalStats.frontAtk || 0),
      backDamageIncrease: Math.round(character.finalStats.backAtk || 0),
      magicAttack: Math.round(character.finalStats.matk || 0),
      frontDamageResistance: Math.round(character.finalStats.frontDef || 0),
      backDamageResistance: Math.round(character.finalStats.backDef || 0),
      critDamageResistance: Math.round(character.finalStats.cdamRes || 0),
      meleeEvasion: Math.round(character.finalStats.melEva || 0),
      rangedEvasion: Math.round(character.finalStats.ranEva || 0),
      magicEvasion: Math.round(character.finalStats.magEva || 0),
      magicResistance: Math.round(character.finalStats.magRes || 0),
      fireResistance: Math.round(character.finalStats.fireR || 0),
      iceResistance: Math.round(character.finalStats.iceR || 0),
      lightningResistance: Math.round(character.finalStats.thundR || 0),
      poisonResistance: Math.round(character.finalStats.poisonR || 0),
      charmResistance: Math.round(character.finalStats.charmR || 0),
      lightResistance: Math.round(character.finalStats.lightR || 0),
      darkResistance: Math.round(character.finalStats.darkR || 0),
      atkSpeed: Math.round(character.finalStats.atkSpd || 0),
      castSpeed: Math.round(character.finalStats.castSpd || 0),
      castTime: Math.round(character.finalStats.castTime || 0),
      cooldown: Math.round(character.finalStats.cooldown || 0),
      lpHealPercent: Math.round(character.finalStats.lpHeal || 0),
      potionEfficiency: Math.round(character.finalStats.pot || 0),
    },
    skills: {},
  };

  // Populate ability points with actual skill names and adeptness levels
  const jobSkillData = skills[character.jobId];
  if (jobSkillData) {
    for (const categoryId in jobSkillData) {
      if (categoryId === "name") continue;

      const category = jobSkillData[categoryId];
      for (const skillData of category.skills) {
        const skillId = skillData.id;
        const skillLevel = character.skills[skillId]?.adeptness || 0;
        // Use skill name as the key (lowercase, no spaces)
        const skillName = (skillData.name || skillId)
          .toLowerCase()
          .replace(/\s+/g, "");
        exportData.abilityPoints[skillName] = skillLevel;
      }
    }
  }

  // Populate skills array with actual unlocked skill names
  const unlockedSkills = calculateUnlockedSkills();

  // Collect all unlocked skill names
  const unlockedSkillNames = [];
  for (const categoryName in unlockedSkills) {
    const category = unlockedSkills[categoryName];
    for (const skill of category.skills) {
      if (skill.isUnlocked) {
        unlockedSkillNames.push(skill.name);
      }
    }
  }

  // Fill the skills array with unlocked skill names or "skillX-none"
  for (let i = 1; i <= 31; i++) {
    if (i <= unlockedSkillNames.length) {
      exportData.skills[`skill${i}`] = unlockedSkillNames[i - 1];
    } else {
      exportData.skills[`skill${i}`] = `skill${i}-none`;
    }
  }

  // Convert to JSON string
  const jsonString = JSON.stringify(exportData, null, 4);

  // Create and download the file
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `character_export_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Handles stat button actions for +1/+5/MAX and -1/-5/MIN
 */
function handleStatButton(stat, action, amount) {
  // Ensure current inputs are read
  readInputs();

  const baseStats = getCombinedBaseStats();
  // Recompute spent to know remaining points
  calculateSpentStatPoints(baseStats);

  const maxStat = gameData.maxStatValue || 99;
  let added = character.addedStats[stat] || 0;
  const base = baseStats[stat] || 0;

  const getNextCost = (currentTotal) => {
    const nextLevel = currentTotal + 1;
    return gameData.statPointCosts[nextLevel]?.[0] || 0;
  };

  const getRemaining = () =>
    character.points.totalStat - character.points.spentStat;

  if (action === "inc") {
    let steps = amount;
    while (steps > 0 && base + added < maxStat) {
      const cost = getNextCost(base + added);
      if (cost <= getRemaining()) {
        added += 1;
        character.points.spentStat += cost; // optimistic update for remaining calc during loop
        steps -= 1;
      } else {
        break;
      }
    }
  } else if (action === "dec") {
    let steps = amount;
    while (steps > 0 && added > 0) {
      // Refund using previous level cost
      const prevTotal = base + added; // current total
      const prevCost = gameData.statPointCosts[prevTotal]?.[0] || 0;
      added -= 1;
      character.points.spentStat = Math.max(
        0,
        character.points.spentStat - prevCost,
      );
      steps -= 1;
    }
  } else if (action === "max") {
    // Increase until we run out of points or reach cap
    while (base + added < maxStat) {
      const cost = getNextCost(base + added);
      if (cost <= getRemaining()) {
        added += 1;
        character.points.spentStat += cost;
      } else {
        break;
      }
    }
  } else if (action === "min") {
    // Reset to racial+job base
    while (added > 0) {
      const prevTotal = base + added;
      const prevCost = gameData.statPointCosts[prevTotal]?.[0] || 0;
      added -= 1;
      character.points.spentStat = Math.max(
        0,
        character.points.spentStat - prevCost,
      );
    }
  }

  // Write back to hidden input as total stat, then recalc
  const newTotal = Math.min(maxStat, base + added);
  if (elements.addedStatInputs[stat]) {
    elements.addedStatInputs[stat].value = newTotal;
  }

  runCalculations();
  updateSkillPreviewModal();
}

// --- Event Listeners and Initial Population (Same as before) ---
document.getElementById("race").addEventListener("change", handleJobRaceChange);
document
  .getElementById("racial-skill")
  .addEventListener("change", runCalculations); // NEW listener
document.getElementById("job").addEventListener("change", handleJobRaceChange); // Add listener for job changes

document.getElementById("level").addEventListener("input", (event) => {
  const value = parseInt(event.target.value) || 1;
  const min = parseInt(event.target.min) || 1;
  const max = parseInt(event.target.max) || 55;

  // Enforce min/max limits
  if (value < min) {
    event.target.value = min;
  } else if (value > max) {
    event.target.value = max;
  }

  runCalculations();
  updateSkillPreviewModal(); // Update skill stats in modal
}); // Add listener for level changes

for (const statInput of Object.values(elements.addedStatInputs)) {
  let inputTimeout;

  // Select all text when input is focused (allows easy replacement)
  statInput.addEventListener("focus", (event) => {
    event.target.select();
  });

  // Handle input changes with debounced validation
  statInput.addEventListener("input", (event) => {
    // Clear any existing timeout
    if (inputTimeout) {
      clearTimeout(inputTimeout);
    }

    // Don't run calculations immediately while typing
    // Only validate for extremely high values that would break things
    const inputValue = event.target.value.trim();
    if (inputValue !== "" && !isNaN(parseInt(inputValue))) {
      const value = parseInt(inputValue);
      // Only enforce a reasonable upper limit to prevent extreme values
      if (value > 999) {
        event.target.value = 99;
        runCalculations();
        updateSkillPreviewModal();
        return;
      }
    }

    // Debounce the calculations - only run after user stops typing for 300ms
    inputTimeout = setTimeout(() => {
      const finalValue = event.target.value.trim();

      if (finalValue === "" || isNaN(parseInt(finalValue))) {
        // Don't run calculations for empty/invalid values
        return;
      }

      runCalculations();
      updateSkillPreviewModal();
    }, 300);
  });

  // Handle when user finishes editing (loses focus)
  statInput.addEventListener("blur", (event) => {
    // Clear any pending timeout since we're handling this immediately
    if (inputTimeout) {
      clearTimeout(inputTimeout);
    }

    const inputValue = event.target.value.trim();

    // If empty or invalid, reset to minimum
    if (inputValue === "" || isNaN(parseInt(inputValue))) {
      const min = parseInt(event.target.min) || 0;
      event.target.value = min;
      runCalculations();
      updateSkillPreviewModal();
      return;
    }

    const value = parseInt(inputValue);
    const min = parseInt(event.target.min) || 0;
    const max = parseInt(event.target.max) || 99;

    // Enforce both min/max limits when user finishes editing
    if (value < min) {
      event.target.value = min;
    } else if (value > max) {
      event.target.value = max;
    }

    runCalculations();
    updateSkillPreviewModal(); // Update skill stats in modal
  });
}
for (const equipSelector of Object.values(elements.equipmentSelectors)) {
  equipSelector.addEventListener("change", (event) => {
    // Update enhancement dropdown for this slot
    const slot = Object.keys(elements.equipmentSelectors).find(
      (key) => elements.equipmentSelectors[key] === event.target,
    );

    if (slot && elements.enhancementSelectors[slot]) {
      const itemId = event.target.value;
      const currentEnhancement = character.equipmentEnhancements[itemId] || 0;
      elements.enhancementSelectors[slot].value = currentEnhancement;
    }

    // Rebuild souls UI for this slot based on selected item's slots
    if (slot && GEAR_SLOTS_WITH_SOULS.includes(slot)) {
      updateSoulSelectorsForSlot(slot);
    }

    runCalculations();
    updateSkillPreviewModal(); // Update skill stats in modal
  });
}

// Add event listeners for enhancement selectors
for (const [slot, enhancementSelector] of Object.entries(
  elements.enhancementSelectors,
)) {
  if (enhancementSelector) {
    enhancementSelector.addEventListener("change", (event) => {
      const itemId = character.equipment[slot];
      const enhancementLevel = parseInt(event.target.value) || 0;

      if (itemId && itemId !== `${slot}-none`) {
        character.equipmentEnhancements[itemId] = enhancementLevel;
      } else {
        // Remove enhancement if no item is equipped
        delete character.equipmentEnhancements[itemId];
      }

      runCalculations();
      updateSkillPreviewModal(); // Update skill stats in modal
    });
  }
}

// Add event listeners for reset buttons
elements.resetButtons.statusPoints.addEventListener("click", resetStatusPoints);
elements.resetButtons.abilityPoints.addEventListener(
  "click",
  resetAbilityPoints,
);

// Add event listeners for modals
elements.skillPreviewButton.addEventListener("click", openSkillPreviewModal);
elements.modalClose.addEventListener("click", closeSkillPreviewModal);
elements.buffsModalButton.addEventListener("click", openBuffsModal);
elements.equipmentModalButton.addEventListener("click", openEquipmentModal);

// Add event listener for horsemanship toggle
elements.horsmanshipToggle.addEventListener("click", toggleHorsemanship);

// Add event listener for export button
document
  .getElementById("export-character")
  .addEventListener("click", exportCharacter);

// Event delegation for stat control buttons
document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (!target.classList.contains("stat-btn")) return;

  const stat = target.dataset.stat;
  const action = target.dataset.action;
  const amount = parseInt(target.dataset.amount || "0", 10);

  if (!PRIMARY_STATS.includes(stat)) return;

  handleStatButton(stat, action, amount);
});

// Close modal when clicking outside of it or on close button
window.addEventListener("click", (event) => {
  if (event.target === elements.skillPreviewModal) {
    closeSkillPreviewModal();
  }
  if (event.target === elements.buffsModal) {
    closeBuffsModal();
  }
  if (event.target === elements.equipmentModal) {
    closeEquipmentModal();
  }
});

// Add close button listeners for new modals
document.querySelectorAll(".modal .close").forEach((closeButton) => {
  closeButton.addEventListener("click", (event) => {
    const modal = event.target.closest(".modal");
    modal.style.display = "none";
  });
});

document.addEventListener("DOMContentLoaded", () => {
  // Set initial default values to match the image
  elements.level.value = character.level;
  elements.race.value = character.raceId;
  elements.racialSkill.value = character.racialSkillId;
  elements.job.value = character.jobId;

  // Set input fields to show total stats (racial base + job modifiers + additional)
  const raceStats = gameData.raceBaseStats[character.raceId];
  const jobInfo = gameData.jobs[character.jobId];
  const jobModifiers = gameData.jobBaseStatModifiers[jobInfo.baseClass];

  for (const stat of PRIMARY_STATS) {
    const baseStat = raceStats[stat] + jobModifiers[stat];
    const totalStat = baseStat + character.addedStats[stat];

    // Set the input field value and min attribute
    elements.addedStatInputs[stat].value = totalStat;
    elements.addedStatInputs[stat].min = baseStat;
  }

  populateDropdowns().then(() => {
    initializeSkills();
    runCalculations();
    // Ensure souls data available early
    ensureSoulsLoaded();
  });
});
