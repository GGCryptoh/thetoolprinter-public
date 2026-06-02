import { FrontPageOption } from '@/components/design-options/front-page-options';
import { getFrontPageHomeData } from '@/lib/front-page/home-data';

export default async function Home() {
  const { controller, topItems, archiveItems, sections } = await getFrontPageHomeData();

  return (
    <FrontPageOption
      topItems={topItems}
      archiveItems={archiveItems}
      showLiveFeed={controller.visible}
      sectionControls={sections}
    />
  );
}
