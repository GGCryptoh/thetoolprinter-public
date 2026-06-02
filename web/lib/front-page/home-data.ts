import { cacheLife, cacheTag } from 'next/cache';
import {
  getFrontPageController,
  getFrontPageItems,
  getFrontPageSections,
  partitionFrontPageItems,
} from '@/lib/front-page/controller';

const ARCHIVE_FETCH_LIMIT = 500;

export async function getFrontPageHomeData() {
  'use cache';
  cacheLife('minutes');
  cacheTag('front-page');

  const controller = await getFrontPageController();
  const sections = await getFrontPageSections();
  const fetchLimit = Math.max(ARCHIVE_FETCH_LIMIT, controller.articleCount);
  const items = controller.visible ? await getFrontPageItems(fetchLimit) : [];
  const { top: topItems, rest: archiveItems } = partitionFrontPageItems(items);

  return { controller, topItems, archiveItems, sections };
}
