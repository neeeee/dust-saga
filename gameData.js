export const gameData = {
  maxLevel: 60,
  maxStatValue: 99,
  maxSkillValue: 120,
  levelUpBonuses: {
    2: [6, 1, 0],
    3: [6, 1, 0],
    4: [6, 1, 0],
    5: [6, 1, 0],
    6: [6, 1, 0],
    7: [6, 1, 0],
    8: [6, 1, 0],
    9: [6, 1, 0],
    10: [8, 1, 0],
    11: [8, 2, 0],
    12: [8, 2, 0],
    13: [8, 2, 0],
    14: [8, 2, 0],
    15: [8, 2, 0],
    16: [8, 2, 0],
    17: [8, 2, 0],
    18: [8, 2, 0],
    19: [8, 2, 0],
    20: [10, 2, 0],
    21: [10, 3, 0],
    22: [10, 3, 0],
    23: [10, 3, 0],
    24: [10, 3, 0],
    25: [10, 3, 0],
    26: [10, 3, 0],
    27: [10, 3, 0],
    28: [10, 3, 0],
    29: [10, 3, 0],
    30: [12, 3, 0],
    31: [12, 3, 0],
    32: [12, 3, 0],
    33: [12, 3, 0],
    34: [12, 3, 0],
    35: [12, 3, 0],
    36: [12, 3, 0],
    37: [12, 3, 0],
    38: [12, 3, 0],
    39: [12, 3, 0],
    40: [14, 3, 0],
    41: [14, 3, 0],
    42: [14, 3, 0],
    43: [14, 3, 0],
    44: [14, 3, 0],
    45: [14, 3, 0],
    46: [14, 3, 0],
    47: [14, 3, 0],
    48: [14, 3, 0],
    49: [14, 3, 0],
    50: [16, 3, 0],
    51: [8, 3, 0],
    52: [8, 3, 0],
    53: [8, 3, 0],
    54: [8, 3, 0],
    55: [8, 3, 0],
    56: [2, 2, 0],
    57: [2, 2, 0],
    58: [2, 2, 0],
    59: [2, 2, 0],
    60: [2, 2, 0],
  },
  statPointCosts: {
    1: [2, 1],
    2: [2, 1],
    3: [2, 1],
    4: [2, 1],
    5: [2, 1],
    6: [2, 1],
    7: [2, 1],
    8: [2, 1],
    9: [2, 1],
    10: [2, 1],
    11: [2, 1],
    12: [2, 1],
    13: [2, 1],
    14: [2, 1],
    15: [2, 1],
    16: [2, 1],
    17: [2, 1],
    18: [2, 1],
    19: [2, 1],
    20: [2, 1],
    21: [2, 1],
    22: [2, 1],
    23: [2, 1],
    24: [2, 1],
    25: [2, 1],
    26: [2, 1],
    27: [2, 1],
    28: [2, 1],
    29: [2, 1],
    30: [2, 1],
    31: [3, 1],
    32: [3, 1],
    33: [3, 1],
    34: [3, 1],
    35: [3, 1],
    36: [3, 1],
    37: [3, 1],
    38: [3, 1],
    39: [3, 1],
    40: [3, 1],
    41: [3, 1],
    42: [3, 1],
    43: [3, 1],
    44: [3, 1],
    45: [3, 1],
    46: [3, 1],
    47: [3, 1],
    48: [3, 1],
    49: [3, 1],
    50: [3, 1],
    51: [4, 1],
    52: [4, 1],
    53: [4, 1],
    54: [4, 1],
    55: [4, 1],
    56: [4, 1],
    57: [4, 1],
    58: [4, 1],
    59: [4, 1],
    60: [4, 1],
    61: [4, 1],
    62: [4, 1],
    63: [4, 1],
    64: [4, 1],
    65: [4, 1],
    66: [4, 1],
    67: [4, 1],
    68: [4, 1],
    69: [4, 1],
    70: [4, 1],
    71: [5, 1],
    72: [5, 1],
    73: [5, 1],
    74: [5, 1],
    75: [5, 1],
    76: [5, 1],
    77: [5, 1],
    78: [5, 1],
    79: [5, 1],
    80: [5, 1],
    81: [5, 1],
    82: [5, 1],
    83: [5, 1],
    84: [5, 1],
    85: [5, 1],
    86: [5, 1],
    87: [5, 1],
    88: [5, 1],
    89: [5, 1],
    90: [5, 1],
    91: [6, 1],
    92: [6, 1],
    93: [6, 1],
    94: [6, 1],
    95: [6, 1],
    96: [6, 1],
    97: [6, 1],
    98: [6, 1],
    99: [6, 1],
  },
  races: [
    { id: 0, name: "Human" },
    { id: 1, name: "Elf" },
    { id: 2, name: "Dwarf" },
    { id: 3, name: "Myrine" },
    { id: 4, name: "Enkidu" },
    { id: 5, name: "Lapin" },
  ],
  racialSkills: {
    0: {
      name: "Human",
      skills: [
        {
          id: 0,
          name: "Fighting Spirit",
          description: "+10 to melee skill with one-handed weapons",
          effect: {
            type: "meleeSkillBonus",
            value: 10,
            condition: "oneHandedWeapon",
          },
        },
        {
          id: 1,
          name: "Adaptibility",
          description: "Reduce duration of ailments by 50%",
          effect: {
            type: "ailmentDurationReduction",
            value: 50,
          },
        },
        {
          id: 2,
          name: "Alchemy",
          description: "Increase potion effectiveness by 15%",
          effect: {
            type: "potionEffectiveness",
            value: 15,
          },
        },
      ],
    },
    1: {
      name: "Elf",
      skills: [
        {
          id: 0,
          name: "Eagle Eye",
          description: "Increase ranged range by 3",
          effect: {
            type: "rangedRangeBonus",
            value: 3,
          },
        },
        {
          id: 1,
          name: "Nature's Harmony",
          description: "Reduce MP cost of spells by 15%",
          effect: {
            type: "mpCostReduction",
            value: 15,
          },
        },
        {
          id: 2,
          name: "Steadfastness",
          description: "Increase charm resistance by 20%",
          effect: {
            type: "charmResistance",
            value: 20,
          },
        },
      ],
    },
    2: {
      name: "Dwarf",
      skills: [
        {
          id: 0,
          name: "StrongHearted",
          description: "Very small chance to live deadly damage",
          effect: "none",
        },
        {
          id: 1,
          name: "Filial Piety",
          description:
            "Chance to take damage for a party member with low HP. May only work with other Dwarfs",
          effect: "none",
        },
        {
          id: 2,
          name: "Dwarf Spirit",
          description: "Increase axe and blunt damage by 10%",
          effect: {
            type: "damageBonus",
            value: 10,
            condition: "axeOrBlunt",
          },
        },
      ],
    },
    3: {
      name: "Myrine",
      skills: [
        {
          id: 0,
          name: "Acute Senses",
          description: "Increased critical hit chance by 5%",
          effect: {
            type: "criticalHitChance",
            value: 5,
          },
        },
        {
          id: 1,
          name: "Calmness",
          description: "Chance to convert 10% damage taken into MP",
          effect: {
            type: "damageToMPConversion",
            value: 10,
          },
        },
        {
          id: 2,
          name: "Sharpness",
          description: "5% chance to dodge damage",
          effect: {
            type: "dodgeChance",
            value: 5,
          },
        },
      ],
    },
    4: {
      name: "Enkidu",
      skills: [
        {
          id: 0,
          name: "Stone Skin",
          description: "Reduce physical damage taken by 10%",
          effect: {
            type: "physicalDamageReduction",
            value: 10,
          },
        },
        {
          id: 1,
          name: "Strong Arm",
          description: "Increase damage of 2-handed weapons by 10%",
          effect: {
            type: "damageBonus",
            value: 10,
            condition: "2HandedWeapon",
          },
        },
        {
          id: 2,
          name: "Lapin Support",
          description:
            "Boosts physical defense of Lapins in party. Effect increases as the number of Lapins increases",
          effect: {
            type: "physicalDefenseBonus",
            value: 10,
            condition: "lapinInParty",
          },
        },
      ],
    },
    5: {
      name: "Lapin",
      skills: [
        {
          id: 0,
          name: "Magic Resistance",
          description: "Increase magic resistance by 10%",
          effect: {
            type: "magicResistance",
            value: 10,
          },
        },
        {
          id: 1,
          name: "Inner Light",
          description: "MP regeneration increases by 15%",
          effect: {
            type: "mpRegeneration",
            value: 15,
          },
        },
        {
          id: 2,
          name: "Enkidu Support",
          description:
            "Boosts magical defense of Enkidu in party. Effect increases as the number of Enkidu increases",
          effect: {
            type: "magicalDefenseBonus",
            value: 10,
            condition: "enkiduInParty",
          },
        },
      ],
    },
  },
  raceBaseStats: {
    0: { sta: 5, str: 5, agi: 5, dex: 5, spi: 5, int: 5 }, // Human
    1: { sta: 3, str: 3, agi: 6, dex: 4, spi: 7, int: 7 }, // Elf
    2: { sta: 6, str: 7, agi: 5, dex: 6, spi: 3, int: 3 }, // Dwarf
    3: { sta: 5, str: 5, agi: 9, dex: 6, spi: 3, int: 2 }, // Myrine
    4: { sta: 8, str: 6, agi: 4, dex: 4, spi: 6, int: 2 }, // Enkidu
    5: { sta: 3, str: 1, agi: 6, dex: 5, spi: 9, int: 6 }, // Lapin
  },
  horsemanShipStatRetentionPercents: {
    nonRiding: {
      profValues: [
        {
          0: {
            matk: 0.3,
            atk: 0.3,
            castspeed: 0.3,
          },
          10: {
            matk: 0.4,
            atk: 0.4,
            castspeed: 0.4,
          },
          20: {
            matk: 0.5,
            atk: 0.5,
            castspeed: 0.5,
          },
          30: {
            matk: 0.5,
            atk: 0.5,
            castspeed: 0.5,
          },
          40: {
            matk: 0.5,
            atk: 0.5,
            castspeed: 0.5,
          },
          50: {
            matk: 0.5,
            atk: 0.5,
            castspeed: 0.5,
          },
          60: {
            matk: 0.5,
            atk: 0.5,
            castspeed: 0.5,
          },
          70: {
            matk: 0.5,
            atk: 0.5,
            castspeed: 0.5,
          },
        },
      ],
    }, // non-riding class`
    1: {
      profValues: [
        {
          0: {
            matk: 0.3,
            atk: 0.3,
            castspeed: 0.3,
          },
          10: {
            matk: 0.4,
            atk: 0.4,
            castspeed: 0.4,
          },
          20: {
            matk: 0.5,
            atk: 0.5,
            castspeed: 0.5,
          },
          30: {
            matk: 0.6,
            atk: 0.6,
            castspeed: 0.6,
          },
          40: {
            matk: 0.7,
            atk: 0.7,
            castspeed: 0.7,
          },
          50: {
            matk: 0.8,
            atk: 0.8,
            castspeed: 0.8,
          },
          60: {
            matk: 0.8,
            atk: 0.8,
            castspeed: 0.8,
          },
          70: {
            matk: 0.8,
            atk: 0.8,
            castspeed: 0.8,
          },
        },
      ],
    }, // hunter
    2: {
      profValues: [
        {
          0: {
            matk: 0.4,
            atk: 0.4,
            castspeed: 0.4,
          },
          10: {
            matk: 0.5,
            atk: 0.5,
            castspeed: 0.5,
          },
          20: {
            matk: 0.6,
            atk: 0.6,
            castspeed: 0.6,
          },
          30: {
            matk: 0.7,
            atk: 0.7,
            castspeed: 0.7,
          },
          40: {
            matk: 0.7,
            atk: 0.7,
            castspeed: 0.7,
          },
          50: {
            matk: 0.9,
            atk: 0.9,
            castspeed: 0.9,
          },
          60: {
            matk: 0.9,
            atk: 0.9,
            castspeed: 0.9,
          },
          70: {
            matk: 0.9,
            atk: 0.9,
            castspeed: 0.9,
          },
        },
      ],
    }, // shadowblade
    3: {
      profValues: [
        {
          0: {
            matk: 0.5,
            atk: 0.5,
            castspeed: 0.5,
          },
          10: {
            matk: 0.6,
            atk: 0.6,
            castspeed: 0.6,
          },
          20: {
            matk: 0.7,
            atk: 0.7,
            castspeed: 0.7,
          },
          30: {
            matk: 0.8,
            atk: 0.8,
            castspeed: 0.8,
          },
          40: {
            matk: 0.9,
            atk: 0.9,
            castspeed: 0.9,
          },
          50: {
            matk: 0.9,
            atk: 0.9,
            castspeed: 0.9,
          },
          60: {
            matk: 0.9,
            atk: 0.9,
            castspeed: 0.9,
          },
          70: {
            matk: 0.9,
            atk: 0.9,
            castspeed: 0.9,
          },
        },
      ],
    }, // paladin
    4: {
      profValues: [
        {
          0: {
            matk: 0.5,
            atk: 0.5,
            castspeed: 0.5,
          },
          10: {
            matk: 0.6,
            atk: 0.6,
            castspeed: 0.6,
          },
          20: {
            matk: 0.7,
            atk: 0.7,
            castspeed: 0.7,
          },
          30: {
            matk: 0.8,
            atk: 0.8,
            castspeed: 0.8,
          },
          40: {
            matk: 0.9,
            atk: 0.9,
            castspeed: 0.9,
          },
          50: {
            matk: 1.0,
            atk: 1.0,
            castspeed: 1.0,
          },
          60: {
            matk: 1.0,
            atk: 1.0,
            castspeed: 1.0,
          },
          70: {
            matk: 1.0,
            atk: 1.0,
            castspeed: 1.0,
          },
        },
      ],
    }, // dragoon
  },
  skills: {
    0: {
      name: "Melee",
      skills: [
        { id: 1, name: "Slash" },
        { id: 2, name: "Thrust" },
        { id: 3, name: "Cleave" },
        { id: 4, name: "Bash" },
        { id: 5, name: "Defend" },
      ],
    },
    6: {
      name: "Technique",
      skills: [
        { id: 7, name: "Shot" },
        { id: 8, name: "Alchemy" },
        { id: 9, name: "Assassination" },
        { id: 10, name: "Trap" },
        { id: 11, name: "Dodge" },
      ],
    },
    12: {
      name: "Prayer",
      skills: [
        { id: 13, name: "Grace" },
        { id: 14, name: "Blessing" },
        { id: 15, name: "Exorcism" },
        { id: 16, name: "Hymn" },
      ],
    },
    17: {
      name: "Magic",
      skills: [
        { id: 18, name: "Elemental" },
        { id: 19, name: "Invocation" },
        { id: 20, name: "Darkness" },
        { id: 21, name: "Confusion" },
      ],
    },
    22: {
      name: "Special",
      skills: [
        { id: 23, name: "Racial" },
        { id: 24, name: "Horsemanship" },
      ],
    },
  },

  jobs: [
    { id: 0, name: "Warrior", baseClass: 0 },
    { id: 1, name: "  Gladiator", baseClass: 0 },
    { id: 2, name: "    Juggernaut", baseClass: 0 },
    { id: 3, name: "    Dragoon", baseClass: 0 },
    { id: 4, name: "  Knight", baseClass: 0 },
    { id: 5, name: "    Warlord", baseClass: 0 },
    { id: 6, name: "    Paladin", baseClass: 0 },
    { id: 7, name: "Scout", baseClass: 1 },
    { id: 8, name: "  Archer", baseClass: 1 },
    { id: 9, name: "    Sniper", baseClass: 1 },
    { id: 10, name: "   Hunter", baseClass: 1 },
    { id: 11, name: " Provocateur", baseClass: 1 },
    { id: 12, name: "   Assassin", baseClass: 1 },
    { id: 13, name: "   Saboteur", baseClass: 1 },
    { id: 14, name: "Acolyte", baseClass: 2 },
    { id: 15, name: " Priest", baseClass: 2 },
    { id: 16, name: "   Cleric", baseClass: 2 },
    { id: 17, name: "   Enchanter", baseClass: 2 },
    { id: 18, name: " Ascetic", baseClass: 2 },
    { id: 19, name: "   Monk", baseClass: 2 },
    { id: 20, name: "   Exorcist", baseClass: 2 },
    { id: 21, name: "Mage", baseClass: 3 },
    { id: 22, name: "  Wizard", baseClass: 3 },
    { id: 23, name: "   Warlock", baseClass: 3 },
    { id: 24, name: "   Conjurer", baseClass: 3 },
    { id: 25, name: "  Sorcerer", baseClass: 3 },
    { id: 26, name: "   Corruptor", baseClass: 3 },
    { id: 27, name: "   Shadowblade", baseClass: 3 },
  ],

  jobBaseStatModifiers: {
    0: { sta: 2, str: 3, agi: -1, dex: 1, spi: -1, int: 0 }, // Warrior-type
    1: { sta: 0, str: 2, agi: 1, dex: 2, spi: -1, int: 0 }, // Scout-type
    2: { sta: 0, str: 2, agi: -1, dex: 0, spi: 1, int: 2 }, // Acolyte-type
    3: { sta: -1, str: 1, agi: -1, dex: 1, spi: 1, int: 3 }, // Mage-type
  },

  // [baseLP, baseMP, levelLP_Div, levelMP_Div, staLP_Div, spiMP_Div]
  jobModifiers: {
    // --- Warrior Line ---
    0: [98, 16, 5.847, 44.55, 15.5, 48.3], // Warrior
    1: [148, 28, 3.188, 36.7, 8.465, 39.5], // Gladiator
    2: [298, 98, 1.9601, 32.2, 2.2836, 34.8], // Juggernaut
    3: [149, 98, 2.0033, 30.9, 3.572, 33.3], // Dragoon
    4: [149, 118, 2.975, 29.15, 7.881, 31.4], // Knight
    5: [498, 179, 1.1493, 25.8, 2.0618, 20.589], // Warlord
    6: [398, 178, 1.4285, 24.7, 2.2322, 19.94], // Paladin

    // --- Scout Line ---
    7: [84, 44, 7.23, 37.2, 19.2, 40], // Scout
    8: [109, 48, 4.4, 31.2, 11.67, 33.3], // Archer
    9: [198, 69, 3.333, 21.95, 3.803, 20.146], // Sniper
    10: [151, 56, 3.111, 22.6, 4.464, 19.7], // Hunter
    11: [109, 48, 4.007, 33.1, 10.63, 35.97], // Provocateur
    12: [149, 53, 2.123, 24.44, 3.922, 20.58], // Assassin
    13: [205, 59, 2.53, 22.6, 3.773, 17.92], // Saboteur

    // --- Acolyte Line ---
    14: [73, 58, 8.16, 18.06, 21.51, 19.48], // Acolyte
    15: [88, 198, 4.475, 14, 11.874, 15.08], // Priest
    16: [199, 235, 2.75, 8.875, 3.745, 9.897], // Cleric
    17: [197, 253, 3.33, 8.24, 3.745, 8.861], // Enchanter
    18: [89, 163, 3.883, 16.72, 10.298, 18], // Ascetic
    19: [299, 189, 1.961, 12.9, 2.681, 14], // Monk
    20: [203, 197, 2.578, 8.5, 3.83, 9.16], // Exorcist

    // --- Mage Line ---
    21: [59, 89, 8.44, 17.6, 22.48, 18.9], // Mage
    22: [73, 253, 5.753, 10.57, 15.28, 11.41], // Wizard
    23: [148, 254, 4.006, 5.915, 5.405, 6.366], // Warlock
    24: [142, 254, 3.756, 7.45, 4.95, 8.016], // Conjurer
    25: [73, 119, 4.86, 12.63, 12.88, 13.63], // Sorcerer
    26: [166, 203, 3.53, 9.4, 4.84, 12.3], // Corruptor
    27: [151, 195, 3.339, 11.23, 5.26, 10.14], // Shadowblade
  },
};
