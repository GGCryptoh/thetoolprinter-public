'use client';

import { useFormStatus } from 'react-dom';
import { Loader2, Play, RotateCw, StopCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

type SubmitActionButtonProps = {
  idleLabel: string;
  pendingLabel: string;
  icon?: 'play' | 'refresh' | 'stop';
  variant?: React.ComponentProps<typeof Button>['variant'];
  size?: React.ComponentProps<typeof Button>['size'];
};

export function SubmitActionButton({
  idleLabel,
  pendingLabel,
  icon = 'play',
  variant,
  size = 'sm',
}: SubmitActionButtonProps) {
  const { pending } = useFormStatus();
  const Icon = icon === 'refresh' ? RotateCw : icon === 'stop' ? StopCircle : Play;

  return (
    <Button type="submit" size={size} variant={variant} disabled={pending} aria-live="polite">
      {pending ? (
        <Loader2 className="mr-2 size-3.5 motion-safe:animate-spin" />
      ) : (
        <Icon className="mr-2 size-3.5" />
      )}
      {pending ? pendingLabel : idleLabel}
    </Button>
  );
}
