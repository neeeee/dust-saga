export enum QuestType {
  KILL = 'kill',
  COLLECT = 'collect',
  TALK = 'talk',
  EXPLORE = 'explore',
  ESCORT = 'escort'
}

export enum QuestStatus {
  AVAILABLE = 'available',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  TURNED_IN = 'turned_in'
}

export interface QuestObjective {
  id: string;
  type: QuestType;
  description: string;
  targetId: string;
  targetName: string;
  requiredCount: number;
  currentCount: number;
}

export interface QuestReward {
  experience: number;
  gold: number;
  items: Array<{ itemId: string; quantity: number }>;
}

export interface QuestDefinition {
  id: string;
  title: string;
  description: string;
  type: QuestType;
  objectives: Array<{
    id: string;
    type: QuestType;
    targetId: string;
    targetName: string;
    requiredCount: number;
  }>;
  rewards: QuestReward;
  requiredLevel: number;
  requiredQuest?: string;
  npcId: string;
}

export interface ActiveQuest {
  questId: string;
  status: QuestStatus;
  objectives: QuestObjective[];
  startedAt: number;
}
