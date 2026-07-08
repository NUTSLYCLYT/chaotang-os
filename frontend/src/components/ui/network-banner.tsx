'use client';

import { useEffect, useRef, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { useOnlineStatus } from '@/lib/network/use-online-status';

export function NetworkBanner() {
  const online = useOnlineStatus();
  const prevOnline = useRef(online);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (prevOnline.current !== online) {
      if (online) {
        toast.success('网络已恢复，可以继续使用');
      }
      prevOnline.current = online;
    }
  }, [online, mounted]);

  if (!mounted || online) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 px-4 py-2 text-[12px] font-medium"
      style={{ background: '#F43F5E', color: '#fff' }}
      role="alert"
      aria-live="assertive"
    >
      <WifiOff size={13} />
      网络已断开，部分功能不可用。请检查网络连接后重试。
    </div>
  );
}
