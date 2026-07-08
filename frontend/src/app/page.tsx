import { WelcomeGate } from '@/features/welcome/WelcomeGate';

/**
 * 根路径 / 是注册登录之前的欢迎引导页。
 * 登录页保留在 /login，注册页保留在 /register。
 */
export default function RootPage() {
  return <WelcomeGate />;
}
