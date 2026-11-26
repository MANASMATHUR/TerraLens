'use client';

import React, { useEffect, useState } from 'react';

interface TimerProps {
  initialSeconds?: number;
  onExpire?: () => void;
}

export default function Timer({ initialSeconds = 120, onExpire }: TimerProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(initialSeconds);

  useEffect(() => {
    if (secondsRemaining <= 0) {
      if (onExpire) onExpire();
      return;
    }

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (onExpire) onExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [secondsRemaining, onExpire]);

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  let statusColor = 'text-emerald-400 border-emerald-900/50 bg-emerald-950/20';
  if (secondsRemaining <= 15) {
    statusColor = 'text-rose-500 border-rose-800 bg-rose-950/30 animate-pulse';
  } else if (secondsRemaining <= 45) {
    statusColor = 'text-amber-400 border-amber-900/50 bg-amber-950/20';
  }

  return (
    <div className={`px-2 py-0.5 rounded-[2px] border font-mono text-[11px] flex items-center space-x-2 ${statusColor}`}>
      <span className="text-slate-500 uppercase text-[9px] tracking-wider">WINDOW:</span>
      <span className="font-bold tracking-widest text-xs">{formatted}</span>
    </div>
  );
}
