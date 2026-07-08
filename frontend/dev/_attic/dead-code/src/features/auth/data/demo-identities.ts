export interface DemoIdentity {
  userId: string;
  name: string;
  department: string;
  role: string;
  avatar: string;
}

export const DEMO_IDENTITIES: DemoIdentity[] = [
  {
    userId: 'demo-1',
    name: '王法务',
    department: '法务部',
    role: '法务总监',
    avatar: '⚖️',
  },
  {
    userId: 'demo-2',
    name: '李合规',
    department: '合规部',
    role: '首席合规官',
    avatar: '🛡️',
  },
  {
    userId: 'demo-3',
    name: '张风控',
    department: '风控部',
    role: '风险总监',
    avatar: '🔍',
  },
];
