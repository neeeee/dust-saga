export enum NPCType {
  MERCHANT = 'merchant',
  QUEST_GIVER = 'quest_giver',
  BLACKSMITH = 'blacksmith',
  HEALER = 'healer',
  BANKER = 'banker',
  GENERIC = 'generic'
}

export interface NPCDialog {
  id: string;
  text: string;
  options: Array<{
    text: string;
    nextDialogId?: string;
    action?: string;
    actionData?: any;
  }>;
}

export interface NPCDefinition {
  id: string;
  name: string;
  type: NPCType;
  modelFile: string;
  position: { x: number; y: number; z: number };
  rotation: number;
  zoneId: string;
  dialogs: NPCDialog[];
  shopItems?: string[];
  quests?: string[];
}
