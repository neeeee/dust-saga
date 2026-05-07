import { NPCDefinition, NPCType } from '../types/npc';

export const NPC_DATABASE: Record<string, NPCDefinition> = {
  'elder_miriam': {
    id: 'elder_miriam',
    name: 'Elder Miriam',
    type: NPCType.QUEST_GIVER,
    modelFile: 'Witch.glb',
    position: { x: 5, y: 0, z: 5 },
    rotation: 0,
    zoneId: 'starter_zone',
    dialogs: [
      {
        id: 'greeting',
        text: 'Welcome, young adventurer! The meadow has been troubled by creatures lately. Will you help us?',
        options: [
          { text: 'I will help! What needs to be done?', nextDialogId: 'quest_offer' },
          { text: 'Maybe later.', action: 'close' }
        ]
      },
      {
        id: 'quest_offer',
        text: 'The slimes to the east have been multiplying. Clear some of them out and bring me 3 slime cores as proof.',
        options: [
          { text: 'I accept this quest!', action: 'accept_quest', actionData: { questId: 'slime_cleanup' } },
          { text: 'That sounds dangerous...', action: 'close' }
        ]
      },
      {
        id: 'quest_progress',
        text: 'How goes the slime hunting? I still need those cores.',
        options: [
          { text: 'I am still working on it.', action: 'close' }
        ]
      },
      {
        id: 'quest_complete',
        text: 'Excellent work! The meadow is safer thanks to you. Here is your reward.',
        options: [
          { text: 'Thank you!', action: 'complete_quest', actionData: { questId: 'slime_cleanup' } }
        ]
      }
    ],
    quests: ['slime_cleanup', 'wolf_threat']
  },
  'blacksmith_garn': {
    id: 'blacksmith_garn',
    name: 'Blacksmith Garn',
    type: NPCType.BLACKSMITH,
    modelFile: 'Worker.glb',
    position: { x: -8, y: 0, z: 3 },
    rotation: Math.PI / 4,
    zoneId: 'starter_zone',
    dialogs: [
      {
        id: 'greeting',
        text: 'Ah, another adventurer! I forge the finest weapons and armor. Care to see my wares?',
        options: [
          { text: 'Show me your shop.', action: 'open_shop', actionData: { shopId: 'garn_shop' } },
          { text: 'Just browsing.', action: 'close' }
        ]
      }
    ],
    shopItems: ['wooden_sword', 'leather_armor', 'cloth_helmet', 'leather_boots', 'copper_ring', 'health_potion', 'mana_potion']
  },
  'healer_rosa': {
    id: 'healer_rosa',
    name: 'Healer Rosa',
    type: NPCType.HEALER,
    modelFile: 'Beach Character.glb',
    position: { x: -3, y: 0, z: 8 },
    rotation: -Math.PI / 6,
    zoneId: 'starter_zone',
    dialogs: [
      {
        id: 'greeting',
        text: 'You look weary, adventurer. Let me restore your health and mana.',
        options: [
          { text: 'Please heal me.', action: 'heal' },
          { text: 'I am fine, thank you.', action: 'close' }
        ]
      }
    ]
  },
  'ranger_finn': {
    id: 'ranger_finn',
    name: 'Ranger Finn',
    type: NPCType.QUEST_GIVER,
    modelFile: 'Farmer.glb',
    position: { x: 0, y: 0, z: -50 },
    rotation: Math.PI,
    zoneId: 'forest_zone',
    dialogs: [
      {
        id: 'greeting',
        text: 'The forest grows darker each day. Goblins have been spotted scouting near the path. Can you investigate?',
        options: [
          { text: 'I will deal with the goblins.', nextDialogId: 'quest_offer' },
          { text: 'I need to prepare first.', action: 'close' }
        ]
      },
      {
        id: 'quest_offer',
        text: 'Slay 5 goblin scouts and bring me their ears as proof. Be careful - they travel in packs.',
        options: [
          { text: 'Consider it done!', action: 'accept_quest', actionData: { questId: 'goblin_menace' } },
          { text: 'On second thought...', action: 'close' }
        ]
      },
      {
        id: 'quest_progress',
        text: 'The goblins still lurk in the shadows. Return when you have collected their ears.',
        options: [
          { text: 'I will keep hunting.', action: 'close' }
        ]
      },
      {
        id: 'quest_complete',
        text: 'You are braver than most! The forest paths are safer now. Take this reward, you have earned it.',
        options: [
          { text: 'Glad to help!', action: 'complete_quest', actionData: { questId: 'goblin_menace' } }
        ]
      }
    ],
    quests: ['goblin_menace']
  },
  'merchant_li': {
    id: 'merchant_li',
    name: 'Merchant Li',
    type: NPCType.MERCHANT,
    modelFile: 'Casual Character.glb',
    position: { x: 10, y: 0, z: -30 },
    rotation: -Math.PI / 3,
    zoneId: 'forest_zone',
    dialogs: [
      {
        id: 'greeting',
        text: 'Welcome traveler! I have goods from distant lands. Everything has a price!',
        options: [
          { text: 'Let me see your wares.', action: 'open_shop', actionData: { shopId: 'li_shop' } },
          { text: 'Not right now.', action: 'close' }
        ]
      }
    ],
    shopItems: ['iron_sword', 'chainmail', 'iron_helmet', 'swift_boots', 'health_potion', 'mana_potion']
  },
  'guard_varik': {
    id: 'guard_varik',
    name: 'Varik Border Guard',
    type: NPCType.GENERIC,
    modelFile: 'Witch.glb',
    position: { x: 0, y: 0, z: -60 },
    rotation: 0,
    zoneId: 'mountains_of_jortio',
    dialogs: [
      {
        id: 'greeting',
        text: 'You stand at the border of the Varik Confederation. Only those who pledge their allegiance may pass. Do you wish to join Varik?',
        options: [
          { text: 'I wish to join Varik.', action: 'join_nation', actionData: { nation: 'varik' } },
          { text: 'Not yet.', action: 'close' }
        ]
      }
    ]
  },
  'guard_pfelstein': {
    id: 'guard_pfelstein',
    name: 'Pfelstein Border Guard',
    type: NPCType.GENERIC,
    modelFile: 'Witch.glb',
    position: { x: 0, y: 0, z: -60 },
    rotation: 0,
    zoneId: 'nelstadt_plains',
    dialogs: [
      {
        id: 'greeting',
        text: 'You stand at the border of the Kingdom of St. Pfelstein. Only those who pledge their allegiance may pass. Do you wish to join Pfelstein?',
        options: [
          { text: 'I wish to join Pfelstein.', action: 'join_nation', actionData: { nation: 'pfelstein' } },
          { text: 'Not yet.', action: 'close' }
        ]
      }
    ]
  },
  'guard_latugan': {
    id: 'guard_latugan',
    name: 'Latugan Border Guard',
    type: NPCType.GENERIC,
    modelFile: 'Witch.glb',
    position: { x: 0, y: 0, z: -60 },
    rotation: 0,
    zoneId: 'himurart_desert',
    dialogs: [
      {
        id: 'greeting',
        text: 'You stand at the border of the Latugan Empire. Only those who pledge their allegiance may pass. Do you wish to join Latugan?',
        options: [
          { text: 'I wish to join Latugan.', action: 'join_nation', actionData: { nation: 'latugan' } },
          { text: 'Not yet.', action: 'close' }
        ]
      }
    ]
  },
};

export function getNPC(id: string): NPCDefinition | undefined {
  return NPC_DATABASE[id];
}

export function getNPCsInZone(zoneId: string): NPCDefinition[] {
  return Object.values(NPC_DATABASE).filter(npc => npc.zoneId === zoneId);
}
