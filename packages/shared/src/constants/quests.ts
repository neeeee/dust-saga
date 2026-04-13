import { QuestDefinition, QuestType } from '../types/quests';

export const QUEST_DATABASE: Record<string, QuestDefinition> = {
  'slime_cleanup': {
    id: 'slime_cleanup',
    title: 'Slime Cleanup',
    description: 'Elder Miriam needs help clearing out the slime infestation in the meadow.',
    type: QuestType.KILL,
    objectives: [
      {
        id: 'kill_slimes',
        type: QuestType.KILL,
        targetId: 'green_slime',
        targetName: 'Green Slime',
        requiredCount: 5
      }
    ],
    rewards: {
      experience: 50,
      gold: 20,
      items: [{ itemId: 'health_potion', quantity: 3 }]
    },
    requiredLevel: 1,
    npcId: 'elder_miriam'
  },
  'wolf_threat': {
    id: 'wolf_threat',
    title: 'Wolf Threat',
    description: 'Dire wolves have been attacking travelers. Elder Miriam asks you to thin their numbers.',
    type: QuestType.KILL,
    objectives: [
      {
        id: 'kill_wolves',
        type: QuestType.KILL,
        targetId: 'dire_wolf',
        targetName: 'Dire Wolf',
        requiredCount: 3
      },
      {
        id: 'collect_pelts',
        type: QuestType.COLLECT,
        targetId: 'wolf_pelt',
        targetName: 'Wolf Pelt',
        requiredCount: 3
      }
    ],
    rewards: {
      experience: 100,
      gold: 40,
      items: [{ itemId: 'leather_armor', quantity: 1 }]
    },
    requiredLevel: 2,
    requiredQuest: 'slime_cleanup',
    npcId: 'elder_miriam'
  },
  'goblin_menace': {
    id: 'goblin_menace',
    title: 'Goblin Menace',
    description: 'Goblin scouts have been spotted in the Whispering Woods. Ranger Finn wants them eliminated.',
    type: QuestType.KILL,
    objectives: [
      {
        id: 'kill_goblins',
        type: QuestType.KILL,
        targetId: 'goblin_scout',
        targetName: 'Goblin Scout',
        requiredCount: 5
      },
      {
        id: 'collect_ears',
        type: QuestType.COLLECT,
        targetId: 'goblin_ear',
        targetName: 'Goblin Ear',
        requiredCount: 5
      }
    ],
    rewards: {
      experience: 200,
      gold: 75,
      items: [{ itemId: 'iron_sword', quantity: 1 }]
    },
    requiredLevel: 4,
    npcId: 'ranger_finn'
  },
  'troll_hunt': {
    id: 'troll_hunt',
    title: 'Troll Hunt',
    description: 'Forest trolls have become a menace in the deep woods. Prove your strength by defeating them.',
    type: QuestType.KILL,
    objectives: [
      {
        id: 'kill_trolls',
        type: QuestType.KILL,
        targetId: 'forest_troll',
        targetName: 'Forest Troll',
        requiredCount: 3
      }
    ],
    rewards: {
      experience: 350,
      gold: 120,
      items: [{ itemId: 'chainmail', quantity: 1 }]
    },
    requiredLevel: 7,
    requiredQuest: 'goblin_menace',
    npcId: 'ranger_finn'
  },
  'crypt_purge': {
    id: 'crypt_purge',
    title: 'Crypt Purge',
    description: 'Shadow wraiths have infested the Crypt of Shadows. Clear them out to make the dungeon safe.',
    type: QuestType.KILL,
    objectives: [
      {
        id: 'kill_wraiths',
        type: QuestType.KILL,
        targetId: 'shadow_wraith',
        targetName: 'Shadow Wraith',
        requiredCount: 5
      }
    ],
    rewards: {
      experience: 600,
      gold: 200,
      items: [{ itemId: 'plate_armor', quantity: 1 }]
    },
    requiredLevel: 10,
    npcId: 'ranger_finn'
  }
};

export function getQuest(id: string): QuestDefinition | undefined {
  return QUEST_DATABASE[id];
}
