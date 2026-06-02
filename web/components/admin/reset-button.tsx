'use client';

import { useFormStatus } from 'react-dom';
import { Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ResetButtonProps = {
  label?: string;
  confirmMessage: string;
};

export function ResetButton({ label = 'Reset to defaults', confirmMessage }: ResetButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
      className="text-muted-foreground hover:text-foreground"
    >
      {pending ? (
        <Loader2 className="mr-2 size-3.5 motion-safe:animate-spin" />
      ) : (
        <RotateCcw className="mr-2 size-3.5" />
      )}
      {label}
    </Button>
  );
}
