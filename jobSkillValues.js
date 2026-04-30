export const skills = {
  0: {
    name: "Warrior",
    // Melee Category (ID 0)
    0: {
      name: "Melee",
      skills: [
        { id: 1, name: "Slas", minAdeptness: 5, maxPotential: 25 },
        { id: 2, name: "Thru", minAdeptness: 2, maxPotential: 25 },
        { id: 3, name: "Clea", minAdeptness: 5, maxPotential: 25 },
        { id: 4, name: "Bash", minAdeptness: 2, maxPotential: 20 },
        { id: 5, name: "Defe", minAdeptness: 4, maxPotential: 25 },
      ],
    },
    // Technique Category (ID 6)
    6: {
      name: "Technique",
      skills: [
        { id: 7, name: "Shot", minAdeptness: 0, maxPotential: 0 },
        { id: 8, name: "Alch", minAdeptness: 0, maxPotential: 0 },
        { id: 9, name: "Assa", minAdeptness: 0, maxPotential: 0 },
        { id: 10, name: "Trap", minAdeptness: 0, maxPotential: 0 },
        { id: 11, name: "Dodg", minAdeptness: 0, maxPotential: 5 },
      ],
    },
    // Grace Category (ID 12)
    12: {
      name: "Prayer",
      skills: [
        { id: 13, name: "Bane", minAdeptness: 0, maxPotential: 0 },
        { id: 14, name: "Bles", minAdeptness: 0, maxPotential: 0 },
        { id: 15, name: "Exor", minAdeptness: 0, maxPotential: 0 },
        { id: 16, name: "Hymn", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Magic Category (ID 17)
    17: {
      name: "Magic",
      skills: [
        { id: 18, name: "Elem", minAdeptness: 0, maxPotential: 0 },
        { id: 19, name: "Invo", minAdeptness: 0, maxPotential: 0 },
        { id: 20, name: "Dark", minAdeptness: 0, maxPotential: 0 },
        { id: 21, name: "Conf", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Special Category (ID 22)
    22: {
      name: "Special",
      skills: [
        { id: 23, name: "Raci", minAdeptness: 0, maxPotential: 0 },
        { id: 24, name: "Hors", minAdeptness: 0, maxPotential: 0 },
      ],
    },
  },
  1: {
    // Melee Category (ID 0)
    name: "Gladiator",
    0: {
      name: "Melee",
      skills: [
        { id: 1, name: "Slas", minAdeptness: 5, maxPotential: 55 },
        { id: 2, name: "Thru", minAdeptness: 2, maxPotential: 45 },
        { id: 3, name: "Clea", minAdeptness: 5, maxPotential: 55 },
        { id: 4, name: "Bash", minAdeptness: 2, maxPotential: 45 },
        { id: 5, name: "Defe", minAdeptness: 4, maxPotential: 25 },
      ],
    },
    // Technique Category (ID 6)
    6: {
      name: "Technique",
      skills: [
        { id: 7, name: "Shot", minAdeptness: 1, maxPotential: 15 },
        { id: 8, name: "Alch", minAdeptness: 0, maxPotential: 20 },
        { id: 9, name: "Assa", minAdeptness: 0, maxPotential: 25 },
        { id: 10, name: "Trap", minAdeptness: 0, maxPotential: 20 },
        { id: 11, name: "Dodg", minAdeptness: 0, maxPotential: 10 },
      ],
    },
    // Grace Category (ID 12)
    12: {
      name: "Prayer",
      skills: [
        { id: 13, name: "Bane", minAdeptness: 0, maxPotential: 0 },
        { id: 14, name: "Bles", minAdeptness: 0, maxPotential: 0 },
        { id: 15, name: "Exor", minAdeptness: 0, maxPotential: 0 },
        { id: 16, name: "Hymn", minAdeptness: 0, maxPotential: 0 }, // Hymn is unique, often starts at 0/0 and is increased by job/racial skills
      ],
    },
    // Magic Category (ID 17)
    17: {
      name: "Magic",
      skills: [
        { id: 18, name: "Elem", minAdeptness: 0, maxPotential: 0 },
        { id: 19, name: "Invo", minAdeptness: 0, maxPotential: 0 },
        { id: 20, name: "Dark", minAdeptness: 0, maxPotential: 0 },
        { id: 21, name: "Conf", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Special Category (ID 22)
    22: {
      name: "Special",
      skills: [
        { id: 23, name: "Raci", minAdeptness: 0, maxPotential: 0 },
        { id: 24, name: "Hors", minAdeptness: 0, maxPotential: 0 },
      ],
    },
  },
  2: {
    name: "Juggernaut",
    // Melee Category (ID 0)
    0: {
      name: "Melee",
      skills: [
        { id: 1, name: "Slas", minAdeptness: 5, maxPotential: 90 },
        { id: 2, name: "Thru", minAdeptness: 2, maxPotential: 90 },
        { id: 3, name: "Clea", minAdeptness: 5, maxPotential: 90 },
        { id: 4, name: "Bash", minAdeptness: 2, maxPotential: 45 },
        { id: 5, name: "Defe", minAdeptness: 4, maxPotential: 35 },
      ],
    },
    // Technique Category (ID 6)
    6: {
      name: "Technique",
      skills: [
        { id: 7, name: "Shot", minAdeptness: 1, maxPotential: 20 },
        { id: 8, name: "Alch", minAdeptness: 0, maxPotential: 0 },
        { id: 9, name: "Assa", minAdeptness: 0, maxPotential: 0 },
        { id: 10, name: "Trap", minAdeptness: 0, maxPotential: 0 },
        { id: 11, name: "Dodg", minAdeptness: 0, maxPotential: 20 },
      ],
    },
    // Grace Category (ID 12)
    12: {
      name: "Prayer",
      skills: [
        { id: 13, name: "Bane", minAdeptness: 0, maxPotential: 0 },
        { id: 14, name: "Bles", minAdeptness: 0, maxPotential: 0 },
        { id: 15, name: "Exor", minAdeptness: 0, maxPotential: 0 },
        { id: 16, name: "Hymn", minAdeptness: 0, maxPotential: 0 }, // Hymn is unique, often starts at 0/0 and is increased by job/racial skills
      ],
    },
    // Magic Category (ID 17)
    17: {
      name: "Magic",
      skills: [
        { id: 18, name: "Elem", minAdeptness: 0, maxPotential: 0 },
        { id: 19, name: "Invo", minAdeptness: 0, maxPotential: 0 },
        { id: 20, name: "Dark", minAdeptness: 0, maxPotential: 0 },
        { id: 21, name: "Conf", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Special Category (ID 22)
    22: {
      name: "Special",
      skills: [
        { id: 23, name: "Raci", minAdeptness: 0, maxPotential: 0 },
        { id: 24, name: "Hors", minAdeptness: 0, maxPotential: 10 },
      ],
    },
  },
  3: {
    name: "Dragoon",
    // Melee Category (ID 0)
    0: {
      name: "Melee",
      skills: [
        { id: 1, name: "Slas", minAdeptness: 5, maxPotential: 60 },
        { id: 2, name: "Thru", minAdeptness: 2, maxPotential: 90 },
        { id: 3, name: "Clea", minAdeptness: 5, maxPotential: 60 },
        { id: 4, name: "Bash", minAdeptness: 2, maxPotential: 30 },
        { id: 5, name: "Defe", minAdeptness: 4, maxPotential: 50 },
      ],
    },
    // Technique Category (ID 6)
    6: {
      name: "Technique",
      skills: [
        { id: 7, name: "Shot", minAdeptness: 1, maxPotential: 20 },
        { id: 8, name: "Alch", minAdeptness: 0, maxPotential: 0 },
        { id: 9, name: "Assa", minAdeptness: 0, maxPotential: 0 },
        { id: 10, name: "Trap", minAdeptness: 0, maxPotential: 0 },
        { id: 11, name: "Dodg", minAdeptness: 0, maxPotential: 20 },
      ],
    },
    // Grace Category (ID 12)
    12: {
      name: "Prayer",
      skills: [
        { id: 13, name: "Bane", minAdeptness: 0, maxPotential: 0 },
        { id: 14, name: "Bles", minAdeptness: 0, maxPotential: 0 },
        { id: 15, name: "Exor", minAdeptness: 0, maxPotential: 0 },
        { id: 16, name: "Hymn", minAdeptness: 0, maxPotential: 0 }, // Hymn is unique, often starts at 0/0 and is increased by job/racial skills
      ],
    },
    // Magic Category (ID 17)
    17: {
      name: "Magic",
      skills: [
        { id: 18, name: "Elem", minAdeptness: 0, maxPotential: 0 },
        { id: 19, name: "Invo", minAdeptness: 0, maxPotential: 0 },
        { id: 20, name: "Dark", minAdeptness: 0, maxPotential: 0 },
        { id: 21, name: "Conf", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Special Category (ID 22)
    22: {
      name: "Special",
      skills: [
        { id: 23, name: "Raci", minAdeptness: 0, maxPotential: 0 },
        { id: 24, name: "Hors", minAdeptness: 0, maxPotential: 70 },
      ],
    },
  },
  4: {
    name: "Knight",
    // Melee Category (ID 0)
    0: {
      name: "Melee",
      skills: [
        { id: 1, name: "Slas", minAdeptness: 5, maxPotential: 35 },
        { id: 2, name: "Thru", minAdeptness: 2, maxPotential: 55 },
        { id: 3, name: "Clea", minAdeptness: 5, maxPotential: 25 },
        { id: 4, name: "Bash", minAdeptness: 2, maxPotential: 35 },
        { id: 5, name: "Defe", minAdeptness: 4, maxPotential: 55 },
      ],
    },
    // Technique Category (ID 6)
    6: {
      name: "Technique",
      skills: [
        { id: 7, name: "Shot", minAdeptness: 1, maxPotential: 5 },
        { id: 8, name: "Alch", minAdeptness: 0, maxPotential: 0 },
        { id: 9, name: "Assa", minAdeptness: 0, maxPotential: 0 },
        { id: 10, name: "Trap", minAdeptness: 0, maxPotential: 0 },
        { id: 11, name: "Dodg", minAdeptness: 0, maxPotential: 15 },
      ],
    },
    // Grace Category (ID 12)
    12: {
      name: "Prayer",
      skills: [
        { id: 13, name: "Bane", minAdeptness: 0, maxPotential: 15 },
        { id: 14, name: "Bles", minAdeptness: 0, maxPotential: 0 },
        { id: 15, name: "Exor", minAdeptness: 0, maxPotential: 0 },
        { id: 16, name: "Hymn", minAdeptness: 0, maxPotential: 0 }, // Hymn is unique, often starts at 0/0 and is increased by job/racial skills
      ],
    },
    // Magic Category (ID 17)
    17: {
      name: "Magic",
      skills: [
        { id: 18, name: "Elem", minAdeptness: 0, maxPotential: 0 },
        { id: 19, name: "Invo", minAdeptness: 0, maxPotential: 0 },
        { id: 20, name: "Dark", minAdeptness: 0, maxPotential: 0 },
        { id: 21, name: "Conf", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Special Category (ID 22)
    22: {
      name: "Special",
      skills: [
        { id: 23, name: "Raci", minAdeptness: 0, maxPotential: 0 },
        { id: 24, name: "Hors", minAdeptness: 0, maxPotential: 0 },
      ],
    },
  },
  5: {
    name: "Warlord",
    // Melee Category (ID 0)
    0: {
      name: "Melee",
      skills: [
        { id: 1, name: "Slas", minAdeptness: 5, maxPotential: 50 },
        { id: 2, name: "Thru", minAdeptness: 2, maxPotential: 80 },
        { id: 3, name: "Clea", minAdeptness: 5, maxPotential: 60 },
        { id: 4, name: "Bash", minAdeptness: 2, maxPotential: 60 },
        { id: 5, name: "Defe", minAdeptness: 4, maxPotential: 90 },
      ],
    },
    // Technique Category (ID 6)
    6: {
      name: "Technique",
      skills: [
        { id: 7, name: "Shot", minAdeptness: 1, maxPotential: 20 },
        { id: 8, name: "Alch", minAdeptness: 0, maxPotential: 0 },
        { id: 9, name: "Assa", minAdeptness: 0, maxPotential: 0 },
        { id: 10, name: "Trap", minAdeptness: 0, maxPotential: 0 },
        { id: 11, name: "Dodg", minAdeptness: 0, maxPotential: 10 },
      ],
    },
    // Grace Category (ID 12)
    12: {
      name: "Prayer",
      skills: [
        { id: 13, name: "Bane", minAdeptness: 0, maxPotential: 15 },
        { id: 14, name: "Bles", minAdeptness: 0, maxPotential: 0 },
        { id: 15, name: "Exor", minAdeptness: 0, maxPotential: 0 },
        { id: 16, name: "Hymn", minAdeptness: 0, maxPotential: 0 }, // Hymn is unique, often starts at 0/0 and is increased by job/racial skills
      ],
    },
    // Magic Category (ID 17)
    17: {
      name: "Magic",
      skills: [
        { id: 18, name: "Elem", minAdeptness: 0, maxPotential: 0 },
        { id: 19, name: "Invo", minAdeptness: 0, maxPotential: 0 },
        { id: 20, name: "Dark", minAdeptness: 0, maxPotential: 0 },
        { id: 21, name: "Conf", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Special Category (ID 22)
    22: {
      name: "Special",
      skills: [
        { id: 23, name: "Raci", minAdeptness: 0, maxPotential: 0 },
        { id: 24, name: "Hors", minAdeptness: 0, maxPotential: 15 },
      ],
    },
  },
  6: {
    name: "Paladin",
    // Melee Category (ID 0)
    0: {
      name: "Melee",
      skills: [
        { id: 1, name: "Slas", minAdeptness: 5, maxPotential: 80 },
        { id: 2, name: "Thru", minAdeptness: 2, maxPotential: 55 },
        { id: 3, name: "Clea", minAdeptness: 5, maxPotential: 25 },
        { id: 4, name: "Bash", minAdeptness: 2, maxPotential: 45 },
        { id: 5, name: "Defe", minAdeptness: 4, maxPotential: 60 },
      ],
    },
    // Technique Category (ID 6)
    6: {
      name: "Technique",
      skills: [
        { id: 7, name: "Shot", minAdeptness: 1, maxPotential: 5 },
        { id: 8, name: "Alch", minAdeptness: 0, maxPotential: 0 },
        { id: 9, name: "Assa", minAdeptness: 0, maxPotential: 0 },
        { id: 10, name: "Trap", minAdeptness: 0, maxPotential: 0 },
        { id: 11, name: "Dodg", minAdeptness: 0, maxPotential: 10 },
      ],
    },
    // Grace Category (ID 12)
    12: {
      name: "Prayer",
      skills: [
        { id: 13, name: "Bane", minAdeptness: 0, maxPotential: 55 },
        { id: 14, name: "Bles", minAdeptness: 0, maxPotential: 0 },
        { id: 15, name: "Exor", minAdeptness: 0, maxPotential: 25 },
        { id: 16, name: "Hymn", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Magic Category (ID 17)
    17: {
      name: "Magic",
      skills: [
        { id: 18, name: "Elem", minAdeptness: 0, maxPotential: 0 },
        { id: 19, name: "Invo", minAdeptness: 0, maxPotential: 0 },
        { id: 20, name: "Dark", minAdeptness: 0, maxPotential: 0 },
        { id: 21, name: "Conf", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Special Category (ID 22)
    22: {
      name: "Special",
      skills: [
        { id: 23, name: "Raci", minAdeptness: 0, maxPotential: 0 },
        { id: 24, name: "Hors", minAdeptness: 0, maxPotential: 40 },
      ],
    },
  },
  7: {
    name: "Scout",
    // Melee Category (ID 0)
    0: {
      name: "Melee",
      skills: [
        { id: 1, name: "Slas", minAdeptness: 4, maxPotential: 10 },
        { id: 2, name: "Thru", minAdeptness: 0, maxPotential: 0 },
        { id: 3, name: "Clea", minAdeptness: 0, maxPotential: 0 },
        { id: 4, name: "Bash", minAdeptness: 0, maxPotential: 0 },
        { id: 5, name: "Defe", minAdeptness: 0, maxPotential: 10 },
      ],
    },
    // Technique Category (ID 6)
    6: {
      name: "Technique",
      skills: [
        { id: 7, name: "Shot", minAdeptness: 5, maxPotential: 25 },
        { id: 8, name: "Alch", minAdeptness: 4, maxPotential: 20 },
        { id: 9, name: "Assa", minAdeptness: 3, maxPotential: 25 },
        { id: 10, name: "Trap", minAdeptness: 0, maxPotential: 20 },
        { id: 11, name: "Dodg", minAdeptness: 3, maxPotential: 20 },
      ],
    },
    // Grace Category (ID 12)
    12: {
      name: "Prayer",
      skills: [
        { id: 13, name: "Bane", minAdeptness: 0, maxPotential: 0 },
        { id: 14, name: "Bles", minAdeptness: 0, maxPotential: 0 },
        { id: 15, name: "Exor", minAdeptness: 0, maxPotential: 0 },
        { id: 16, name: "Hymn", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Magic Category (ID 17)
    17: {
      name: "Magic",
      skills: [
        { id: 18, name: "Elem", minAdeptness: 0, maxPotential: 0 },
        { id: 19, name: "Invo", minAdeptness: 0, maxPotential: 0 },
        { id: 20, name: "Dark", minAdeptness: 0, maxPotential: 0 },
        { id: 21, name: "Conf", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Special Category (ID 22)
    22: {
      name: "Special",
      skills: [
        { id: 23, name: "Raci", minAdeptness: 0, maxPotential: 0 },
        { id: 24, name: "Hors", minAdeptness: 0, maxPotential: 0 },
      ],
    },
  },
  8: {
    name: "Archer",
    // Melee Category (ID 0)
    0: {
      name: "Melee",
      skills: [
        { id: 1, name: "Slas", minAdeptness: 4, maxPotential: 30 },
        { id: 2, name: "Thru", minAdeptness: 0, maxPotential: 0 },
        { id: 3, name: "Clea", minAdeptness: 0, maxPotential: 0 },
        { id: 4, name: "Bash", minAdeptness: 0, maxPotential: 0 },
        { id: 5, name: "Defe", minAdeptness: 0, maxPotential: 10 },
      ],
    },
    // Technique Category (ID 6)
    6: {
      name: "Technique",
      skills: [
        { id: 7, name: "Shot", minAdeptness: 5, maxPotential: 55 },
        { id: 8, name: "Alch", minAdeptness: 4, maxPotential: 20 },
        { id: 9, name: "Assa", minAdeptness: 3, maxPotential: 30 },
        { id: 10, name: "Trap", minAdeptness: 0, maxPotential: 25 },
        { id: 11, name: "Dodg", minAdeptness: 3, maxPotential: 50 },
      ],
    },
    // Grace Category (ID 12)
    12: {
      name: "Prayer",
      skills: [
        { id: 13, name: "Bane", minAdeptness: 0, maxPotential: 0 },
        { id: 14, name: "Bles", minAdeptness: 0, maxPotential: 0 },
        { id: 15, name: "Exor", minAdeptness: 0, maxPotential: 0 },
        { id: 16, name: "Hymn", minAdeptness: 0, maxPotential: 0 }, // Hymn is unique, often starts at 0/0 and is increased by job/racial skills
      ],
    },
    // Magic Category (ID 17)
    17: {
      name: "Magic",
      skills: [
        { id: 18, name: "Elem", minAdeptness: 0, maxPotential: 0 },
        { id: 19, name: "Invo", minAdeptness: 0, maxPotential: 0 },
        { id: 20, name: "Dark", minAdeptness: 0, maxPotential: 0 },
        { id: 21, name: "Conf", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Special Category (ID 22)
    22: {
      name: "Special",
      skills: [
        { id: 23, name: "Raci", minAdeptness: 0, maxPotential: 0 },
        { id: 24, name: "Hors", minAdeptness: 0, maxPotential: 0 },
      ],
    },
  },
  9: {
    name: "Sniper",
    // Melee Category (ID 0)
    0: {
      name: "Melee",
      skills: [
        { id: 1, name: "Slas", minAdeptness: 4, maxPotential: 25 },
        { id: 2, name: "Thru", minAdeptness: 0, maxPotential: 0 },
        { id: 3, name: "Clea", minAdeptness: 0, maxPotential: 0 },
        { id: 4, name: "Bash", minAdeptness: 0, maxPotential: 0 },
        { id: 5, name: "Defe", minAdeptness: 0, maxPotential: 10 },
      ],
    },
    // Technique Category (ID 6)
    6: {
      name: "Technique",
      skills: [
        { id: 7, name: "Shot", minAdeptness: 5, maxPotential: 90 },
        { id: 8, name: "Alch", minAdeptness: 4, maxPotential: 50 },
        { id: 9, name: "Assa", minAdeptness: 3, maxPotential: 30 },
        { id: 10, name: "Trap", minAdeptness: 0, maxPotential: 40 },
        { id: 11, name: "Dodg", minAdeptness: 3, maxPotential: 90 },
      ],
    },
    // Grace Category (ID 12)
    12: {
      name: "Prayer",
      skills: [
        { id: 13, name: "Bane", minAdeptness: 0, maxPotential: 0 },
        { id: 14, name: "Bles", minAdeptness: 0, maxPotential: 0 },
        { id: 15, name: "Exor", minAdeptness: 0, maxPotential: 0 },
        { id: 16, name: "Hymn", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Magic Category (ID 17)
    17: {
      name: "Magic",
      skills: [
        { id: 18, name: "Elem", minAdeptness: 0, maxPotential: 0 },
        { id: 19, name: "Invo", minAdeptness: 0, maxPotential: 0 },
        { id: 20, name: "Dark", minAdeptness: 5, maxPotential: 30 },
        { id: 21, name: "Conf", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Special Category (ID 22)
    22: {
      name: "Special",
      skills: [
        { id: 23, name: "Raci", minAdeptness: 0, maxPotential: 0 },
        { id: 24, name: "Hors", minAdeptness: 0, maxPotential: 20 },
      ],
    },
  },
  10: {
    name: "Hunter",
    // Melee Category (ID 0)
    0: {
      name: "Melee",
      skills: [
        { id: 1, name: "Slas", minAdeptness: 4, maxPotential: 30 },
        { id: 2, name: "Thru", minAdeptness: 0, maxPotential: 0 },
        { id: 3, name: "Clea", minAdeptness: 0, maxPotential: 0 },
        { id: 4, name: "Bash", minAdeptness: 0, maxPotential: 0 },
        { id: 5, name: "Defe", minAdeptness: 0, maxPotential: 10 },
      ],
    },
    // Technique Category (ID 6)
    6: {
      name: "Technique",
      skills: [
        { id: 7, name: "Shot", minAdeptness: 5, maxPotential: 70 },
        { id: 8, name: "Alch", minAdeptness: 4, maxPotential: 90 },
        { id: 9, name: "Assa", minAdeptness: 3, maxPotential: 30 },
        { id: 10, name: "Trap", minAdeptness: 0, maxPotential: 70 },
        { id: 11, name: "Dodg", minAdeptness: 3, maxPotential: 50 },
      ],
    },
    // Grace Category (ID 12)
    12: {
      name: "Prayer",
      skills: [
        { id: 13, name: "Bane", minAdeptness: 0, maxPotential: 0 },
        { id: 14, name: "Bles", minAdeptness: 0, maxPotential: 0 },
        { id: 15, name: "Exor", minAdeptness: 0, maxPotential: 0 },
        { id: 16, name: "Hymn", minAdeptness: 0, maxPotential: 0 }, // Hymn is unique, often starts at 0/0 and is increased by job/racial skills
      ],
    },
    // Magic Category (ID 17)
    17: {
      name: "Magic",
      skills: [
        { id: 18, name: "Elem", minAdeptness: 0, maxPotential: 0 },
        { id: 19, name: "Invo", minAdeptness: 0, maxPotential: 0 },
        { id: 20, name: "Dark", minAdeptness: 0, maxPotential: 0 },
        { id: 21, name: "Conf", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Special Category (ID 22)
    22: {
      name: "Special",
      skills: [
        { id: 23, name: "Raci", minAdeptness: 0, maxPotential: 0 },
        { id: 24, name: "Hors", minAdeptness: 0, maxPotential: 50 },
      ],
    },
  },
  11: {
    name: "Provocateur",
    // Melee Category (ID 0)
    0: {
      name: "Melee",
      skills: [
        { id: 1, name: "Slas", minAdeptness: 4, maxPotential: 30 },
        { id: 2, name: "Thru", minAdeptness: 0, maxPotential: 0 },
        { id: 3, name: "Clea", minAdeptness: 0, maxPotential: 0 },
        { id: 4, name: "Bash", minAdeptness: 0, maxPotential: 0 },
        { id: 5, name: "Defe", minAdeptness: 0, maxPotential: 20 },
      ],
    },
    // Technique Category (ID 6)
    6: {
      name: "Technique",
      skills: [
        { id: 7, name: "Shot", minAdeptness: 5, maxPotential: 30 },
        { id: 8, name: "Alch", minAdeptness: 4, maxPotential: 25 },
        { id: 9, name: "Assa", minAdeptness: 3, maxPotential: 55 },
        { id: 10, name: "Trap", minAdeptness: 0, maxPotential: 50 },
        { id: 11, name: "Dodg", minAdeptness: 3, maxPotential: 40 },
      ],
    },
    // Grace Category (ID 12)
    12: {
      name: "Prayer",
      skills: [
        { id: 13, name: "Bane", minAdeptness: 0, maxPotential: 0 },
        { id: 14, name: "Bles", minAdeptness: 0, maxPotential: 0 },
        { id: 15, name: "Exor", minAdeptness: 0, maxPotential: 0 },
        { id: 16, name: "Hymn", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Magic Category (ID 17)
    17: {
      name: "Magic",
      skills: [
        { id: 18, name: "Elem", minAdeptness: 0, maxPotential: 0 },
        { id: 19, name: "Invo", minAdeptness: 0, maxPotential: 0 },
        { id: 20, name: "Dark", minAdeptness: 0, maxPotential: 0 },
        { id: 21, name: "Conf", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Special Category (ID 22)
    22: {
      name: "Special",
      skills: [
        { id: 23, name: "Raci", minAdeptness: 0, maxPotential: 0 },
        { id: 24, name: "Hors", minAdeptness: 0, maxPotential: 0 },
      ],
    },
  },
  12: {
    name: "Assassin",
    // Melee Category (ID 0)
    0: {
      name: "Melee",
      skills: [
        { id: 1, name: "Slas", minAdeptness: 4, maxPotential: 65 },
        { id: 2, name: "Thru", minAdeptness: 0, maxPotential: 0 },
        { id: 3, name: "Clea", minAdeptness: 0, maxPotential: 0 },
        { id: 4, name: "Bash", minAdeptness: 0, maxPotential: 0 },
        { id: 5, name: "Defe", minAdeptness: 0, maxPotential: 20 },
      ],
    },
    // Technique Category (ID 6)
    6: {
      name: "Technique",
      skills: [
        { id: 7, name: "Shot", minAdeptness: 5, maxPotential: 30 },
        { id: 8, name: "Alch", minAdeptness: 4, maxPotential: 50 },
        { id: 9, name: "Assa", minAdeptness: 3, maxPotential: 90 },
        { id: 10, name: "Trap", minAdeptness: 0, maxPotential: 50 },
        { id: 11, name: "Dodg", minAdeptness: 3, maxPotential: 65 },
      ],
    },
    // Grace Category (ID 12)
    12: {
      name: "Prayer",
      skills: [
        { id: 13, name: "Bane", minAdeptness: 0, maxPotential: 0 },
        { id: 14, name: "Bles", minAdeptness: 0, maxPotential: 0 },
        { id: 15, name: "Exor", minAdeptness: 0, maxPotential: 0 },
        { id: 16, name: "Hymn", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Magic Category (ID 17)
    17: {
      name: "Magic",
      skills: [
        { id: 18, name: "Elem", minAdeptness: 0, maxPotential: 0 },
        { id: 19, name: "Invo", minAdeptness: 0, maxPotential: 0 },
        { id: 20, name: "Dark", minAdeptness: 0, maxPotential: 0 },
        { id: 21, name: "Conf", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Special Category (ID 22)
    22: {
      name: "Special",
      skills: [
        { id: 23, name: "Raci", minAdeptness: 0, maxPotential: 0 },
        { id: 24, name: "Hors", minAdeptness: 0, maxPotential: 20 },
      ],
    },
  },
  13: {
    name: "Saboteur",
    // Melee Category (ID 0)
    0: {
      name: "Melee",
      skills: [
        { id: 1, name: "Slas", minAdeptness: 4, maxPotential: 45 },
        { id: 2, name: "Thru", minAdeptness: 0, maxPotential: 0 },
        { id: 3, name: "Clea", minAdeptness: 0, maxPotential: 0 },
        { id: 4, name: "Bash", minAdeptness: 0, maxPotential: 0 },
        { id: 5, name: "Defe", minAdeptness: 0, maxPotential: 25 },
      ],
    },
    // Technique Category (ID 6)
    6: {
      name: "Technique",
      skills: [
        { id: 7, name: "Shot", minAdeptness: 5, maxPotential: 45 },
        { id: 8, name: "Alch", minAdeptness: 4, maxPotential: 60 },
        { id: 9, name: "Assa", minAdeptness: 3, maxPotential: 55 },
        { id: 10, name: "Trap", minAdeptness: 0, maxPotential: 90 },
        { id: 11, name: "Dodg", minAdeptness: 3, maxPotential: 55 },
      ],
    },
    // Grace Category (ID 12)
    12: {
      name: "Prayer",
      skills: [
        { id: 13, name: "Bane", minAdeptness: 0, maxPotential: 0 },
        { id: 14, name: "Bles", minAdeptness: 0, maxPotential: 0 },
        { id: 15, name: "Exor", minAdeptness: 0, maxPotential: 0 },
        { id: 16, name: "Hymn", minAdeptness: 0, maxPotential: 0 }, // Hymn is unique, often starts at 0/0 and is increased by job/racial skills
      ],
    },
    // Magic Category (ID 17)
    17: {
      name: "Magic",
      skills: [
        { id: 18, name: "Elem", minAdeptness: 0, maxPotential: 0 },
        { id: 19, name: "Invo", minAdeptness: 0, maxPotential: 0 },
        { id: 20, name: "Dark", minAdeptness: 0, maxPotential: 0 },
        { id: 21, name: "Conf", minAdeptness: 0, maxPotential: 15 },
      ],
    },
    // Special Category (ID 22)
    22: {
      name: "Special",
      skills: [
        { id: 23, name: "Raci", minAdeptness: 0, maxPotential: 0 },
        { id: 24, name: "Hors", minAdeptness: 0, maxPotential: 10 },
      ],
    },
  },
  14: {
    name: "Acolyte",
    // Melee Category (ID 0)
    0: {
      name: "Melee",
      skills: [
        { id: 1, name: "Slas", minAdeptness: 0, maxPotential: 0 },
        { id: 2, name: "Thru", minAdeptness: 0, maxPotential: 0 },
        { id: 3, name: "Clea", minAdeptness: 0, maxPotential: 0 },
        { id: 4, name: "Bash", minAdeptness: 2, maxPotential: 20 },
        { id: 5, name: "Defe", minAdeptness: 2, maxPotential: 20 },
      ],
    },
    // Technique Category (ID 6)
    6: {
      name: "Technique",
      skills: [
        { id: 7, name: "Shot", minAdeptness: 0, maxPotential: 0 },
        { id: 8, name: "Alch", minAdeptness: 0, maxPotential: 0 },
        { id: 9, name: "Assa", minAdeptness: 0, maxPotential: 0 },
        { id: 10, name: "Trap", minAdeptness: 0, maxPotential: 0 },
        { id: 11, name: "Dodg", minAdeptness: 0, maxPotential: 5 },
      ],
    },
    // Grace Category (ID 12)
    12: {
      name: "Prayer",
      skills: [
        { id: 13, name: "Bane", minAdeptness: 5, maxPotential: 25 },
        { id: 14, name: "Bles", minAdeptness: 5, maxPotential: 25 },
        { id: 15, name: "Exor", minAdeptness: 5, maxPotential: 25 },
        { id: 16, name: "Hymn", minAdeptness: 0, maxPotential: 0 }, // Hymn is unique, often starts at 0/0 and is increased by job/racial skills
      ],
    },
    // Magic Category (ID 17)
    17: {
      name: "Magic",
      skills: [
        { id: 18, name: "Elem", minAdeptness: 0, maxPotential: 0 },
        { id: 19, name: "Invo", minAdeptness: 0, maxPotential: 0 },
        { id: 20, name: "Dark", minAdeptness: 0, maxPotential: 0 },
        { id: 21, name: "Conf", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Special Category (ID 22)
    22: {
      name: "Special",
      skills: [
        { id: 23, name: "Raci", minAdeptness: 0, maxPotential: 0 },
        { id: 24, name: "Hors", minAdeptness: 0, maxPotential: 0 },
      ],
    },
  },
  15: {
    name: "Priest",
    // Melee Category (ID 0)
    0: {
      name: "Melee",
      skills: [
        { id: 1, name: "Slas", minAdeptness: 0, maxPotential: 0 },
        { id: 2, name: "Thru", minAdeptness: 0, maxPotential: 0 },
        { id: 3, name: "Clea", minAdeptness: 0, maxPotential: 0 },
        { id: 4, name: "Bash", minAdeptness: 2, maxPotential: 35 },
        { id: 5, name: "Defe", minAdeptness: 2, maxPotential: 30 },
      ],
    },
    // Technique Category (ID 6)
    6: {
      name: "Technique",
      skills: [
        { id: 7, name: "Shot", minAdeptness: 0, maxPotential: 0 },
        { id: 8, name: "Alch", minAdeptness: 0, maxPotential: 0 },
        { id: 9, name: "Assa", minAdeptness: 0, maxPotential: 0 },
        { id: 10, name: "Trap", minAdeptness: 0, maxPotential: 0 },
        { id: 11, name: "Dodg", minAdeptness: 0, maxPotential: 5 },
      ],
    },
    // Grace Category (ID 12)
    12: {
      name: "Prayer",
      skills: [
        { id: 13, name: "Bane", minAdeptness: 5, maxPotential: 55 },
        { id: 14, name: "Bles", minAdeptness: 5, maxPotential: 55 },
        { id: 15, name: "Exor", minAdeptness: 5, maxPotential: 30 },
        { id: 16, name: "Hymn", minAdeptness: 0, maxPotential: 0 }, // Hymn is unique, often starts at 0/0 and is increased by job/racial skills
      ],
    },
    // Magic Category (ID 17)
    17: {
      name: "Magic",
      skills: [
        { id: 18, name: "Elem", minAdeptness: 0, maxPotential: 0 },
        { id: 19, name: "Invo", minAdeptness: 0, maxPotential: 0 },
        { id: 20, name: "Dark", minAdeptness: 0, maxPotential: 0 },
        { id: 21, name: "Conf", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Special Category (ID 22)
    22: {
      name: "Special",
      skills: [
        { id: 23, name: "Raci", minAdeptness: 0, maxPotential: 0 },
        { id: 24, name: "Hors", minAdeptness: 0, maxPotential: 0 },
      ],
    },
  },
  16: {
    name: "Cleric",
    // Melee Category (ID 0)
    0: {
      name: "Melee",
      skills: [
        { id: 1, name: "Slas", minAdeptness: 0, maxPotential: 0 },
        { id: 2, name: "Thru", minAdeptness: 0, maxPotential: 0 },
        { id: 3, name: "Clea", minAdeptness: 0, maxPotential: 15 },
        { id: 4, name: "Bash", minAdeptness: 2, maxPotential: 50 },
        { id: 5, name: "Defe", minAdeptness: 2, maxPotential: 40 },
      ],
    },
    // Technique Category (ID 6)
    6: {
      name: "Technique",
      skills: [
        { id: 7, name: "Shot", minAdeptness: 0, maxPotential: 0 },
        { id: 8, name: "Alch", minAdeptness: 0, maxPotential: 0 },
        { id: 9, name: "Assa", minAdeptness: 0, maxPotential: 0 },
        { id: 10, name: "Trap", minAdeptness: 0, maxPotential: 0 },
        { id: 11, name: "Dodg", minAdeptness: 0, maxPotential: 5 },
      ],
    },
    // Grace Category (ID 12)
    12: {
      name: "Prayer",
      skills: [
        { id: 13, name: "Bane", minAdeptness: 5, maxPotential: 90 },
        { id: 14, name: "Bles", minAdeptness: 5, maxPotential: 55 },
        { id: 15, name: "Exor", minAdeptness: 5, maxPotential: 40 },
        { id: 16, name: "Hymn", minAdeptness: 0, maxPotential: 45 },
      ],
    },
    // Magic Category (ID 17)
    17: {
      name: "Magic",
      skills: [
        { id: 18, name: "Elem", minAdeptness: 0, maxPotential: 0 },
        { id: 19, name: "Invo", minAdeptness: 0, maxPotential: 10 },
        { id: 20, name: "Dark", minAdeptness: 0, maxPotential: 0 },
        { id: 21, name: "Conf", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Special Category (ID 22)
    22: {
      name: "Special",
      skills: [
        { id: 23, name: "Raci", minAdeptness: 0, maxPotential: 0 },
        { id: 24, name: "Hors", minAdeptness: 0, maxPotential: 15 },
      ],
    },
  },
  17: {
    name: "Enchanter",
    // Melee Category (ID 0)
    0: {
      name: "Melee",
      skills: [
        { id: 1, name: "Slas", minAdeptness: 0, maxPotential: 0 },
        { id: 2, name: "Thru", minAdeptness: 0, maxPotential: 0 },
        { id: 3, name: "Clea", minAdeptness: 0, maxPotential: 0 },
        { id: 4, name: "Bash", minAdeptness: 2, maxPotential: 45 },
        { id: 5, name: "Defe", minAdeptness: 2, maxPotential: 35 },
      ],
    },
    // Technique Category (ID 6)
    6: {
      name: "Technique",
      skills: [
        { id: 7, name: "Shot", minAdeptness: 0, maxPotential: 0 },
        { id: 8, name: "Alch", minAdeptness: 0, maxPotential: 0 },
        { id: 9, name: "Assa", minAdeptness: 0, maxPotential: 0 },
        { id: 10, name: "Trap", minAdeptness: 0, maxPotential: 0 },
        { id: 11, name: "Dodg", minAdeptness: 0, maxPotential: 5 },
      ],
    },
    // Grace Category (ID 12)
    12: {
      name: "Prayer",
      skills: [
        { id: 13, name: "Bane", minAdeptness: 5, maxPotential: 55 },
        { id: 14, name: "Bles", minAdeptness: 5, maxPotential: 90 },
        { id: 15, name: "Exor", minAdeptness: 5, maxPotential: 30 },
        { id: 16, name: "Hymn", minAdeptness: 0, maxPotential: 65 },
      ],
    },
    // Magic Category (ID 17)
    17: {
      name: "Magic",
      skills: [
        { id: 18, name: "Elem", minAdeptness: 0, maxPotential: 0 },
        { id: 19, name: "Invo", minAdeptness: 0, maxPotential: 30 },
        { id: 20, name: "Dark", minAdeptness: 0, maxPotential: 0 },
        { id: 21, name: "Conf", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Special Category (ID 22)
    22: {
      name: "Special",
      skills: [
        { id: 23, name: "Raci", minAdeptness: 0, maxPotential: 0 },
        { id: 24, name: "Hors", minAdeptness: 0, maxPotential: 20 },
      ],
    },
  },
  18: {
    name: "Ascetic",
    // Melee Category (ID 0)
    0: {
      name: "Melee",
      skills: [
        { id: 1, name: "Slas", minAdeptness: 0, maxPotential: 0 },
        { id: 2, name: "Thru", minAdeptness: 0, maxPotential: 0 },
        { id: 3, name: "Clea", minAdeptness: 0, maxPotential: 15 },
        { id: 4, name: "Bash", minAdeptness: 2, maxPotential: 50 },
        { id: 5, name: "Defe", minAdeptness: 2, maxPotential: 20 },
      ],
    },
    // Technique Category (ID 6)
    6: {
      name: "Technique",
      skills: [
        { id: 7, name: "Shot", minAdeptness: 0, maxPotential: 0 },
        { id: 8, name: "Alch", minAdeptness: 0, maxPotential: 0 },
        { id: 9, name: "Assa", minAdeptness: 0, maxPotential: 0 },
        { id: 10, name: "Trap", minAdeptness: 0, maxPotential: 0 },
        { id: 11, name: "Dodg", minAdeptness: 0, maxPotential: 5 },
      ],
    },
    // Grace Category (ID 12)
    12: {
      name: "Prayer",
      skills: [
        { id: 13, name: "Bane", minAdeptness: 5, maxPotential: 25 },
        { id: 14, name: "Bles", minAdeptness: 5, maxPotential: 25 },
        { id: 15, name: "Exor", minAdeptness: 5, maxPotential: 55 },
        { id: 16, name: "Hymn", minAdeptness: 0, maxPotential: 0 }, // Hymn is unique, often starts at 0/0 and is increased by job/racial skills
      ],
    },
    // Magic Category (ID 17)
    17: {
      name: "Magic",
      skills: [
        { id: 18, name: "Elem", minAdeptness: 0, maxPotential: 0 },
        { id: 19, name: "Invo", minAdeptness: 0, maxPotential: 0 },
        { id: 20, name: "Dark", minAdeptness: 0, maxPotential: 0 },
        { id: 21, name: "Conf", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Special Category (ID 22)
    22: {
      name: "Special",
      skills: [
        { id: 23, name: "Raci", minAdeptness: 0, maxPotential: 0 },
        { id: 24, name: "Hors", minAdeptness: 0, maxPotential: 0 },
      ],
    },
  },
  19: {
    name: "Monk",
    // Melee Category (ID 0)
    0: {
      name: "Melee",
      skills: [
        { id: 1, name: "Slas", minAdeptness: 0, maxPotential: 0 },
        { id: 2, name: "Thru", minAdeptness: 0, maxPotential: 0 },
        { id: 3, name: "Clea", minAdeptness: 0, maxPotential: 15 },
        { id: 4, name: "Bash", minAdeptness: 2, maxPotential: 90 },
        { id: 5, name: "Defe", minAdeptness: 2, maxPotential: 25 },
      ],
    },
    // Technique Category (ID 6)
    6: {
      name: "Technique",
      skills: [
        { id: 7, name: "Shot", minAdeptness: 0, maxPotential: 0 },
        { id: 8, name: "Alch", minAdeptness: 0, maxPotential: 0 },
        { id: 9, name: "Assa", minAdeptness: 0, maxPotential: 0 },
        { id: 10, name: "Trap", minAdeptness: 0, maxPotential: 0 },
        { id: 11, name: "Dodg", minAdeptness: 0, maxPotential: 55 },
      ],
    },
    // Grace Category (ID 12)
    12: {
      name: "Prayer",
      skills: [
        { id: 13, name: "Bane", minAdeptness: 5, maxPotential: 30 },
        { id: 14, name: "Bles", minAdeptness: 5, maxPotential: 25 },
        { id: 15, name: "Exor", minAdeptness: 5, maxPotential: 60 },
        { id: 16, name: "Hymn", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Magic Category (ID 17)
    17: {
      name: "Magic",
      skills: [
        { id: 18, name: "Elem", minAdeptness: 0, maxPotential: 0 },
        { id: 19, name: "Invo", minAdeptness: 0, maxPotential: 0 },
        { id: 20, name: "Dark", minAdeptness: 0, maxPotential: 0 },
        { id: 21, name: "Conf", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Special Category (ID 22)
    22: {
      name: "Special",
      skills: [
        { id: 23, name: "Raci", minAdeptness: 0, maxPotential: 0 },
        { id: 24, name: "Hors", minAdeptness: 0, maxPotential: 10 },
      ],
    },
  },
  20: {
    name: "Exorcist",
    // Melee Category (ID 0)
    0: {
      name: "Melee",
      skills: [
        { id: 1, name: "Slas", minAdeptness: 0, maxPotential: 0 },
        { id: 2, name: "Thru", minAdeptness: 0, maxPotential: 0 },
        { id: 3, name: "Clea", minAdeptness: 0, maxPotential: 15 },
        { id: 4, name: "Bash", minAdeptness: 2, maxPotential: 70 },
        { id: 5, name: "Defe", minAdeptness: 2, maxPotential: 30 },
      ],
    },
    // Technique Category (ID 6)
    6: {
      name: "Technique",
      skills: [
        { id: 7, name: "Shot", minAdeptness: 0, maxPotential: 0 },
        { id: 8, name: "Alch", minAdeptness: 0, maxPotential: 0 },
        { id: 9, name: "Assa", minAdeptness: 0, maxPotential: 0 },
        { id: 10, name: "Trap", minAdeptness: 0, maxPotential: 0 },
        { id: 11, name: "Dodg", minAdeptness: 0, maxPotential: 10 },
      ],
    },
    // Grace Category (ID 12)
    12: {
      name: "Prayer",
      skills: [
        { id: 13, name: "Bane", minAdeptness: 5, maxPotential: 45 },
        { id: 14, name: "Bles", minAdeptness: 5, maxPotential: 30 },
        { id: 15, name: "Exor", minAdeptness: 5, maxPotential: 90 },
        { id: 16, name: "Hymn", minAdeptness: 0, maxPotential: 10 },
      ],
    },
    // Magic Category (ID 17)
    17: {
      name: "Magic",
      skills: [
        { id: 18, name: "Elem", minAdeptness: 0, maxPotential: 0 },
        { id: 19, name: "Invo", minAdeptness: 0, maxPotential: 40 },
        { id: 20, name: "Dark", minAdeptness: 0, maxPotential: 0 },
        { id: 21, name: "Conf", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Special Category (ID 22)
    22: {
      name: "Special",
      skills: [
        { id: 23, name: "Raci", minAdeptness: 0, maxPotential: 0 },
        { id: 24, name: "Hors", minAdeptness: 0, maxPotential: 10 },
      ],
    },
  },
  21: {
    name: "Mage",
    // Melee Category (ID 0)
    0: {
      name: "Melee",
      skills: [
        { id: 1, name: "Slas", minAdeptness: 2, maxPotential: 15 },
        { id: 2, name: "Thru", minAdeptness: 0, maxPotential: 0 },
        { id: 3, name: "Clea", minAdeptness: 0, maxPotential: 0 },
        { id: 4, name: "Bash", minAdeptness: 0, maxPotential: 0 },
        { id: 5, name: "Defe", minAdeptness: 2, maxPotential: 15 },
      ],
    },
    // Technique Category (ID 6)
    6: {
      name: "Technique",
      skills: [
        { id: 7, name: "Shot", minAdeptness: 0, maxPotential: 0 },
        { id: 8, name: "Alch", minAdeptness: 0, maxPotential: 0 },
        { id: 9, name: "Assa", minAdeptness: 0, maxPotential: 0 },
        { id: 10, name: "Trap", minAdeptness: 0, maxPotential: 0 },
        { id: 11, name: "Dodg", minAdeptness: 0, maxPotential: 5 },
      ],
    },
    // Grace Category (ID 12)
    12: {
      name: "Prayer",
      skills: [
        { id: 13, name: "Bane", minAdeptness: 0, maxPotential: 0 },
        { id: 14, name: "Bles", minAdeptness: 0, maxPotential: 0 },
        { id: 15, name: "Exor", minAdeptness: 0, maxPotential: 0 },
        { id: 16, name: "Hymn", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Magic Category (ID 17)
    17: {
      name: "Magic",
      skills: [
        { id: 18, name: "Elem", minAdeptness: 5, maxPotential: 25 },
        { id: 19, name: "Invo", minAdeptness: 5, maxPotential: 40 },
        { id: 20, name: "Dark", minAdeptness: 0, maxPotential: 20 },
        { id: 21, name: "Conf", minAdeptness: 0, maxPotential: 25 },
      ],
    },
    // Special Category (ID 22)
    22: {
      name: "Special",
      skills: [
        { id: 23, name: "Raci", minAdeptness: 0, maxPotential: 0 },
        { id: 24, name: "Hors", minAdeptness: 0, maxPotential: 0 },
      ],
    },
  },
  22: {
    name: "Wizard",
    // Melee Category (ID 0)
    0: {
      name: "Melee",
      skills: [
        { id: 1, name: "Slas", minAdeptness: 2, maxPotential: 20 },
        { id: 2, name: "Thru", minAdeptness: 0, maxPotential: 0 },
        { id: 3, name: "Clea", minAdeptness: 0, maxPotential: 0 },
        { id: 4, name: "Bash", minAdeptness: 0, maxPotential: 0 },
        { id: 5, name: "Defe", minAdeptness: 2, maxPotential: 30 },
      ],
    },
    // Technique Category (ID 6)
    6: {
      name: "Technique",
      skills: [
        { id: 7, name: "Shot", minAdeptness: 0, maxPotential: 0 },
        { id: 8, name: "Alch", minAdeptness: 0, maxPotential: 0 },
        { id: 9, name: "Assa", minAdeptness: 0, maxPotential: 0 },
        { id: 10, name: "Trap", minAdeptness: 0, maxPotential: 0 },
        { id: 11, name: "Dodg", minAdeptness: 0, maxPotential: 5 },
      ],
    },
    // Grace Category (ID 12)
    12: {
      name: "Prayer",
      skills: [
        { id: 13, name: "Bane", minAdeptness: 0, maxPotential: 10 },
        { id: 14, name: "Bles", minAdeptness: 0, maxPotential: 10 },
        { id: 15, name: "Exor", minAdeptness: 0, maxPotential: 20 },
        { id: 16, name: "Hymn", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Magic Category (ID 17)
    17: {
      name: "Magic",
      skills: [
        { id: 18, name: "Elem", minAdeptness: 5, maxPotential: 55 },
        { id: 19, name: "Invo", minAdeptness: 5, maxPotential: 50 },
        { id: 20, name: "Dark", minAdeptness: 0, maxPotential: 20 },
        { id: 21, name: "Conf", minAdeptness: 5, maxPotential: 30 },
      ],
    },
    // Special Category (ID 22)
    22: {
      name: "Special",
      skills: [
        { id: 23, name: "Raci", minAdeptness: 0, maxPotential: 0 },
        { id: 24, name: "Hors", minAdeptness: 0, maxPotential: 0 },
      ],
    },
  },
  23: {
    name: "Warlock",
    // Melee Category (ID 0)
    0: {
      name: "Melee",
      skills: [
        { id: 1, name: "Slas", minAdeptness: 2, maxPotential: 30 },
        { id: 2, name: "Thru", minAdeptness: 0, maxPotential: 0 },
        { id: 3, name: "Clea", minAdeptness: 0, maxPotential: 0 },
        { id: 4, name: "Bash", minAdeptness: 2, maxPotential: 30 },
        { id: 5, name: "Defe", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Technique Category (ID 6)
    6: {
      name: "Technique",
      skills: [
        { id: 7, name: "Shot", minAdeptness: 0, maxPotential: 0 },
        { id: 8, name: "Alch", minAdeptness: 0, maxPotential: 40 },
        { id: 9, name: "Assa", minAdeptness: 0, maxPotential: 0 },
        { id: 10, name: "Trap", minAdeptness: 0, maxPotential: 0 },
        { id: 11, name: "Dodg", minAdeptness: 0, maxPotential: 5 },
      ],
    },
    // Grace Category (ID 12)
    12: {
      name: "Prayer",
      skills: [
        { id: 13, name: "Bane", minAdeptness: 0, maxPotential: 25 },
        { id: 14, name: "Bles", minAdeptness: 0, maxPotential: 10 },
        { id: 15, name: "Exor", minAdeptness: 0, maxPotential: 40 },
        { id: 16, name: "Hymn", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Magic Category (ID 17)
    17: {
      name: "Magic",
      skills: [
        { id: 18, name: "Elem", minAdeptness: 5, maxPotential: 90 },
        { id: 19, name: "Invo", minAdeptness: 5, maxPotential: 50 },
        { id: 20, name: "Dark", minAdeptness: 0, maxPotential: 30 },
        { id: 21, name: "Conf", minAdeptness: 5, maxPotential: 40 },
      ],
    },
    // Special Category (ID 22)
    22: {
      name: "Special",
      skills: [
        { id: 23, name: "Raci", minAdeptness: 0, maxPotential: 0 },
        { id: 24, name: "Hors", minAdeptness: 0, maxPotential: 10 },
      ],
    },
  },
  24: {
    name: "Conjurer",
    // Melee Category (ID 0)
    0: {
      name: "Melee",
      skills: [
        { id: 1, name: "Slas", minAdeptness: 2, maxPotential: 25 },
        { id: 2, name: "Thru", minAdeptness: 0, maxPotential: 0 },
        { id: 3, name: "Clea", minAdeptness: 0, maxPotential: 0 },
        { id: 4, name: "Bash", minAdeptness: 2, maxPotential: 30 },
        { id: 5, name: "Defe", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Technique Category (ID 6)
    6: {
      name: "Technique",
      skills: [
        { id: 7, name: "Shot", minAdeptness: 0, maxPotential: 0 },
        { id: 8, name: "Alch", minAdeptness: 0, maxPotential: 0 },
        { id: 9, name: "Assa", minAdeptness: 0, maxPotential: 0 },
        { id: 10, name: "Trap", minAdeptness: 0, maxPotential: 20 },
        { id: 11, name: "Dodg", minAdeptness: 0, maxPotential: 5 },
      ],
    },
    // Grace Category (ID 12)
    12: {
      name: "Prayer",
      skills: [
        { id: 13, name: "Bane", minAdeptness: 0, maxPotential: 10 },
        { id: 14, name: "Bles", minAdeptness: 0, maxPotential: 20 },
        { id: 15, name: "Exor", minAdeptness: 0, maxPotential: 20 },
        { id: 16, name: "Hymn", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Magic Category (ID 17)
    17: {
      name: "Magic",
      skills: [
        { id: 18, name: "Elem", minAdeptness: 5, maxPotential: 60 },
        { id: 19, name: "Invo", minAdeptness: 5, maxPotential: 90 },
        { id: 20, name: "Dark", minAdeptness: 0, maxPotential: 40 },
        { id: 21, name: "Conf", minAdeptness: 5, maxPotential: 50 },
      ],
    },
    // Special Category (ID 22)
    22: {
      name: "Special",
      skills: [
        { id: 23, name: "Raci", minAdeptness: 0, maxPotential: 0 },
        { id: 24, name: "Hors", minAdeptness: 0, maxPotential: 10 },
      ],
    },
  },
  25: {
    name: "Sorcerer",
    // Melee Category (ID 0)
    0: {
      name: "Melee",
      skills: [
        { id: 1, name: "Slas", minAdeptness: 2, maxPotential: 25 },
        { id: 2, name: "Thru", minAdeptness: 0, maxPotential: 0 },
        { id: 3, name: "Clea", minAdeptness: 0, maxPotential: 0 },
        { id: 4, name: "Bash", minAdeptness: 0, maxPotential: 0 },
        { id: 5, name: "Defe", minAdeptness: 2, maxPotential: 15 },
      ],
    },
    // Technique Category (ID 6)
    6: {
      name: "Technique",
      skills: [
        { id: 7, name: "Shot", minAdeptness: 0, maxPotential: 0 },
        { id: 8, name: "Alch", minAdeptness: 0, maxPotential: 15 },
        { id: 9, name: "Assa", minAdeptness: 0, maxPotential: 20 },
        { id: 10, name: "Trap", minAdeptness: 0, maxPotential: 0 },
        { id: 11, name: "Dodg", minAdeptness: 0, maxPotential: 10 },
      ],
    },
    // Grace Category (ID 12)
    12: {
      name: "Prayer",
      skills: [
        { id: 13, name: "Bane", minAdeptness: 0, maxPotential: 0 },
        { id: 14, name: "Bles", minAdeptness: 0, maxPotential: 0 },
        { id: 15, name: "Exor", minAdeptness: 0, maxPotential: 0 },
        { id: 16, name: "Hymn", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Magic Category (ID 17)
    17: {
      name: "Magic",
      skills: [
        { id: 18, name: "Elem", minAdeptness: 5, maxPotential: 30 },
        { id: 19, name: "Invo", minAdeptness: 5, maxPotential: 25 },
        { id: 20, name: "Dark", minAdeptness: 0, maxPotential: 55 },
        { id: 21, name: "Conf", minAdeptness: 5, maxPotential: 55 },
      ],
    },
    // Special Category (ID 22)
    22: {
      name: "Special",
      skills: [
        { id: 23, name: "Raci", minAdeptness: 0, maxPotential: 0 },
        { id: 24, name: "Hors", minAdeptness: 0, maxPotential: 0 },
      ],
    },
  },
  26: {
    name: "Corruptor",
    // Melee Category (ID 0)
    0: {
      name: "Melee",
      skills: [
        { id: 1, name: "Slas", minAdeptness: 2, maxPotential: 30 },
        { id: 2, name: "Thru", minAdeptness: 0, maxPotential: 0 },
        { id: 3, name: "Clea", minAdeptness: 0, maxPotential: 0 },
        { id: 4, name: "Bash", minAdeptness: 2, maxPotential: 15 },
        { id: 5, name: "Defe", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Technique Category (ID 6)
    6: {
      name: "Technique",
      skills: [
        { id: 7, name: "Shot", minAdeptness: 0, maxPotential: 0 },
        { id: 8, name: "Alch", minAdeptness: 0, maxPotential: 45 },
        { id: 9, name: "Assa", minAdeptness: 0, maxPotential: 20 },
        { id: 10, name: "Trap", minAdeptness: 0, maxPotential: 0 },
        { id: 11, name: "Dodg", minAdeptness: 0, maxPotential: 40 },
      ],
    },
    // Grace Category (ID 12)
    12: {
      name: "Prayer",
      skills: [
        { id: 13, name: "Bane", minAdeptness: 0, maxPotential: 0 },
        { id: 14, name: "Bles", minAdeptness: 0, maxPotential: 0 },
        { id: 15, name: "Exor", minAdeptness: 0, maxPotential: 0 },
        { id: 16, name: "Hymn", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Magic Category (ID 17)
    17: {
      name: "Magic",
      skills: [
        { id: 18, name: "Elem", minAdeptness: 5, maxPotential: 30 },
        { id: 19, name: "Invo", minAdeptness: 5, maxPotential: 50 },
        { id: 20, name: "Dark", minAdeptness: 0, maxPotential: 70 },
        { id: 21, name: "Conf", minAdeptness: 5, maxPotential: 90 },
      ],
    },
    // Special Category (ID 22)
    22: {
      name: "Special",
      skills: [
        { id: 23, name: "Raci", minAdeptness: 0, maxPotential: 0 },
        { id: 24, name: "Hors", minAdeptness: 0, maxPotential: 10 },
      ],
    },
  },
  27: {
    name: "Shadowblade",
    // Melee Category (ID 0)
    0: {
      name: "Melee",
      skills: [
        { id: 1, name: "Slas", minAdeptness: 2, maxPotential: 65 },
        { id: 2, name: "Thru", minAdeptness: 0, maxPotential: 0 },
        { id: 3, name: "Clea", minAdeptness: 0, maxPotential: 0 },
        { id: 4, name: "Bash", minAdeptness: 2, maxPotential: 15 },
        { id: 5, name: "Defe", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Technique Category (ID 6)
    6: {
      name: "Technique",
      skills: [
        { id: 7, name: "Shot", minAdeptness: 0, maxPotential: 0 },
        { id: 8, name: "Alch", minAdeptness: 0, maxPotential: 15 },
        { id: 9, name: "Assa", minAdeptness: 0, maxPotential: 30 },
        { id: 10, name: "Trap", minAdeptness: 0, maxPotential: 0 },
        { id: 11, name: "Dodg", minAdeptness: 0, maxPotential: 25 },
      ],
    },
    // Grace Category (ID 12)
    12: {
      name: "Prayer",
      skills: [
        { id: 13, name: "Bane", minAdeptness: 0, maxPotential: 0 },
        { id: 14, name: "Bles", minAdeptness: 0, maxPotential: 0 },
        { id: 15, name: "Exor", minAdeptness: 0, maxPotential: 0 },
        { id: 16, name: "Hymn", minAdeptness: 0, maxPotential: 0 },
      ],
    },
    // Magic Category (ID 17)
    17: {
      name: "Magic",
      skills: [
        { id: 18, name: "Elem", minAdeptness: 5, maxPotential: 30 },
        { id: 19, name: "Invo", minAdeptness: 5, maxPotential: 25 },
        { id: 20, name: "Dark", minAdeptness: 0, maxPotential: 90 },
        { id: 21, name: "Conf", minAdeptness: 5, maxPotential: 55 },
      ],
    },
    // Special Category (ID 22)
    22: {
      name: "Special",
      skills: [
        { id: 23, name: "Raci", minAdeptness: 0, maxPotential: 0 },
        { id: 24, name: "Hors", minAdeptness: 0, maxPotential: 50 },
      ],
    },
  },
};
