import { createServiceClient } from '@/lib/supabase/server';
import { getFrontPageController } from '@/lib/front-page/controller';

// Soft-archives rejected items older than the configured retention window by
// stamping archived_at. Rows are never deleted — they stay available for
// analytics. A retention of 0 disables archiving.
export async function archiveStaleRejected(): Promise<{ archived: number; retentionDays: number }> {
  const controller = await getFrontPageController();
  const retentionDays = controller.rejectedRetentionDays;
  if (!retentionDays || retentionDays <= 0) return { archived: 0, retentionDays: 0 };

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('aitea_news_items')
    .update({ archived_at: new Date().toISOString() })
    .eq('status', 'rejected')
    .is('archived_at', null)
    .lt('created_at', cutoff.toISOString())
    .select('id');

  if (error) throw new Error(error.message);
  return { archived: data?.length ?? 0, retentionDays };
}
