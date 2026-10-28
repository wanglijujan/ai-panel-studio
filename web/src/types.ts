export type Participant = {
  id: string;
  role: 'host' | 'expert';
  name: string;
  title: string;
  stance: string;
  color: string;
  seatIndex: number;
};

export type Message = {
  id: string;
  round: number;
  participantId: string;
  act: string;
  content: string;
  name: string;
  title: string;
  color: string;
  createdAt: string;
};

export type ConsensusItem = {
  id: string;
  round: number;
  type: 'consensus' | 'disagreement';
  content: string;
};

export type AgentState = {
  participantId: string;
  status: 'waiting' | 'preparing' | 'speaking';
  focusMemo: string;
};

export type Summary = {
  conclusions: string[];
  disagreements: string[];
  nextSteps: string[];
};

export type DiscussionDetail = {
  id: string;
  topic: string;
  status: 'idle' | 'running' | 'finished';
  createdAt: string;
  participants: Participant[];
  agentStates: AgentState[];
  messages: Message[];
  consensus: ConsensusItem[];
  summary: Summary | null;
};

export type DiscussionListItem = {
  id: string;
  topic: string;
  expertCount: number;
  status: 'idle' | 'running' | 'finished';
  createdAt: string;
  participantCount: number;
};
