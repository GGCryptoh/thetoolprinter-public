import { scrapePeopleStats } from './steps/scrape-people-stats';

export async function peopleStatsWorkflow() {
  "use workflow";

  console.log('[people-stats] Starting people stats workflow');
  const count = await scrapePeopleStats();
  console.log(`[people-stats] Done — scraped ${count} people`);
  return { count };
}
