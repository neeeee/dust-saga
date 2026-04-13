import { PlayerSession } from '@dust-saga/shared';
import { QUEST_DATABASE, getQuest, QuestStatus, QuestType } from '@dust-saga/shared';

export class QuestSystem {
  getAvailableQuests(session: PlayerSession): string[] {
    return Object.values(QUEST_DATABASE)
      .filter(q => {
        if (q.requiredLevel > session.stats.level) return false;
        if (q.requiredQuest) {
          const completed = session.quests.find(
            sq => sq.questId === q.requiredQuest && sq.status === QuestStatus.COMPLETED
          );
          if (!completed) return false;
        }
        const active = session.quests.find(sq => sq.questId === q.id);
        return !active;
      })
      .map(q => q.id);
  }

  acceptQuest(session: PlayerSession, questId: string): boolean {
    const questDef = getQuest(questId);
    if (!questDef) return false;
    if (questDef.requiredLevel > session.stats.level) return false;

    const existing = session.quests.find(q => q.questId === questId);
    if (existing) return false;

    session.quests.push({
      questId,
      status: QuestStatus.IN_PROGRESS,
      objectives: questDef.objectives.map(obj => ({
        id: obj.id,
        type: obj.type,
        targetId: obj.targetId,
        targetName: obj.targetName,
        requiredCount: obj.requiredCount,
        currentCount: 0
      })),
      startedAt: Date.now()
    });

    return true;
  }

  onEnemyKill(session: PlayerSession, enemyType: string): string[] {
    const completedQuests: string[] = [];

    session.quests
      .filter(q => q.status === QuestStatus.IN_PROGRESS)
      .forEach(quest => {
        quest.objectives
          .filter(obj => obj.type === QuestType.KILL && obj.targetId === enemyType && obj.currentCount < obj.requiredCount)
          .forEach(obj => {
            obj.currentCount++;
          });

        if (this.isQuestComplete(quest)) {
          quest.status = QuestStatus.COMPLETED;
          completedQuests.push(quest.questId);
        }
      });

    return completedQuests;
  }

  onItemCollect(session: PlayerSession, itemId: string): string[] {
    const completedQuests: string[] = [];

    session.quests
      .filter(q => q.status === QuestStatus.IN_PROGRESS)
      .forEach(quest => {
        quest.objectives
          .filter(obj => obj.type === QuestType.COLLECT && obj.targetId === itemId)
          .forEach(obj => {
            const count = session.inventory.filter(inv => inv.itemId === itemId)
              .reduce((sum, inv) => sum + inv.quantity, 0);
            obj.currentCount = Math.min(count, obj.requiredCount);
          });

        if (this.isQuestComplete(quest)) {
          quest.status = QuestStatus.COMPLETED;
          completedQuests.push(quest.questId);
        }
      });

    return completedQuests;
  }

  completeQuest(session: PlayerSession, questId: string): { experience: number; gold: number; items: Array<{ itemId: string; quantity: number }> } | null {
    const quest = session.quests.find(q => q.questId === questId);
    if (!quest || quest.status !== QuestStatus.COMPLETED) return null;

    const questDef = getQuest(questId);
    if (!questDef) return null;

    quest.status = QuestStatus.TURNED_IN;

    return {
      experience: questDef.rewards.experience,
      gold: questDef.rewards.gold,
      items: questDef.rewards.items
    };
  }

  abandonQuest(session: PlayerSession, questId: string): boolean {
    const index = session.quests.findIndex(q => q.questId === questId);
    if (index === -1) return false;

    session.quests.splice(index, 1);
    return true;
  }

  private isQuestComplete(quest: PlayerSession['quests'][0]): boolean {
    return quest.objectives.every(obj => obj.currentCount >= obj.requiredCount);
  }
}
