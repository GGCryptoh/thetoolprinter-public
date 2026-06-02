import { createServiceClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { CollapsibleSection } from '@/components/admin/collapsible-section';
import { createPerson, togglePerson, deletePerson } from '../actions';


export default async function PeoplePage() {
  const supabase = createServiceClient();

  const { data: people } = await supabase
    .from('aitea_people')
    .select('id, name, handle, avatar_url, description, tags, sources, url, active, sort_order')
    .order('sort_order', { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">People to Follow</h1>
        <CollapsibleSection title="Add Person" buttonLabel="+ Add Person">
          <form action={createPerson} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="Full name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="handle">Handle</Label>
              <Input id="handle" name="handle" placeholder="karpathy" required />
              <p className="text-[10px] text-muted-foreground">Avatar auto-fetched from this handle</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">Profile URL (optional)</Label>
              <Input id="url" name="url" placeholder="https://x.com/..." />
              <p className="text-[10px] text-muted-foreground">Auto-set to x.com/handle if blank</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Why follow</Label>
              <Input id="description" name="description" placeholder="Brief description" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input id="tags" name="tags" placeholder="agents, infra, models" />
            </div>
            <div className="space-y-2">
              <Label>Sources to scrape</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" name="sources" value="twitter" defaultChecked className="rounded" />
                  X / Twitter
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" name="sources" value="youtube" className="rounded" />
                  YouTube
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" name="sources" value="github" className="rounded" />
                  GitHub
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" name="sources" value="blog" className="rounded" />
                  Blog / RSS
                </label>
              </div>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Add Person</Button>
            </div>
          </form>
        </CollapsibleSection>
      </div>

      <div className="grid gap-2">
        {people?.map((person) => {
          const sources = (person.sources as string[]) ?? [];
          return (
            <Card key={person.id} className="py-2">
              <CardContent className="flex items-center gap-4">
                {/* Avatar */}
                {person.avatar_url ? (
                  <img
                    src={person.avatar_url}
                    alt={person.name}
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm font-medium shrink-0">
                    {person.name?.charAt(0)}
                  </div>
                )}
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {person.url ? (
                      <a href={person.url} target="_blank" rel="noopener noreferrer" className="font-medium text-sm hover:underline">
                        {person.name}
                      </a>
                    ) : (
                      <span className="font-medium text-sm">{person.name}</span>
                    )}
                    <span className="text-sm text-muted-foreground">@{person.handle}</span>
                    {!person.active && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Inactive</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    {person.description && (
                      <span className="text-[11px] text-muted-foreground truncate">{person.description}</span>
                    )}
                  </div>
                  <div className="flex gap-1 mt-1">
                    {sources.map((src: string) => (
                      <Badge key={src} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {src === 'twitter' ? 'X' : src}
                      </Badge>
                    ))}
                    {person.tags?.map((tag: string) => (
                      <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                    ))}
                  </div>
                </div>
                {/* Actions */}
                <div className="flex gap-1.5 shrink-0">
                  <form action={togglePerson.bind(null, person.id, !person.active)}>
                    <Button size="sm" variant="outline" type="submit" className="h-7 px-3 text-xs">
                      {person.active ? 'Disable' : 'Enable'}
                    </Button>
                  </form>
                  <form action={deletePerson.bind(null, person.id)}>
                    <Button size="sm" variant="destructive" type="submit" className="h-7 px-3 text-xs">Delete</Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
