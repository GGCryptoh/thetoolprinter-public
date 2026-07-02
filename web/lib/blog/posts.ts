export interface BlogPost {
  slug: string;
  title: string;
  subtitle: string;
  date: string;
  author: string;
  readingTime: string;
  tags: string[];
  image?: string;
  gradient: string;
  content: string;
}

// Each post gets a unique gradient for its hero
const GRADIENTS = [
  'from-amber-900/80 via-neutral-900 to-neutral-950',
  'from-blue-900/80 via-neutral-900 to-neutral-950',
  'from-emerald-900/80 via-neutral-900 to-neutral-950',
  'from-purple-900/80 via-neutral-900 to-neutral-950',
  'from-rose-900/80 via-neutral-900 to-neutral-950',
  'from-cyan-900/80 via-neutral-900 to-neutral-950',
];

const posts: BlogPost[] = [
  {
    slug: 'agency-needs-a-governance-desk',
    title: 'Agency Needs a Governance Desk',
    subtitle: 'Why the next enterprise AI moat is identity, authority, verification, and trust.',
    date: '2026-05-08',
    author: 'Geoff Hopkins',
    readingTime: '8 min',
    tags: ['ai-governance', 'agents', 'identity', 'trust'],
    image: '/blog/governance-desk-control-room.svg',
    gradient: GRADIENTS[0],
    content: `I keep coming back to a simple worry: the AI world still talks like the hard part is getting the machine to produce more.

More drafts. More summaries. More automations. More confident little rectangles of text.

Useful, sure. But that's not where the enterprise problem actually lands.

The hard question starts after the agent acts. Who authorized the work? Which identity did the agent use? What systems did it touch, what evidence backed the output, how do you stop it, and who's accountable once the output turns into a business decision?

Nobody owns that layer yet.

Agency needs a governance desk.

> The harder question is what happens after the agent starts acting.

![A governance desk is the control layer around acting software.](/blog/governance-desk-control-room.svg)

## The desk, not the chatbot

The first wave of enterprise AI was access to models. The second was workflow automation with a new coat of paint. The next one is governed agency: software acting inside real business systems with bounded authority.

That product won't feel like a chatbot forever. It'll feel like a desk.

I don't mean a metaphorical desk with a leather chair and a brass lamp. I mean an operating desk: who is this agent, what may it touch, what did it actually do, and who signed off. The place where a company can watch its agents work and decide whether the work deserves trust.

None of this sounds exciting. Identity, run history, kill switches — it reads like plumbing until the day something breaks. Then it's the whole story.

## The workplace agent changes the stakes

The enterprise agent that matters won't be the demo agent in a sandbox. It'll be the one sitting near email, calendar, documents, CRM, finance — the operating fabric of the company.

Once an agent lives there, identity becomes the center of the design. A human employee has a role, a manager, access rights, a history. An agent needs its own version of that envelope. Companies don't need the extra ceremony for its own sake; they need it because without identity there's no trust boundary to draw.

An agent that drafts a memo is one thing. An agent that sends it, bumps a renewal forecast, and books the client meeting is acting inside the business. Actions like that need a name, a scope, and a record.

## Know Your Agent

We already do this for people. KYC for customers, onboarding for vendors, provisioning for employees, least privilege for service accounts. Nobody calls any of that radical.

Agents need the same seriousness, without turning the whole thing into molasses.

Know Your Agent means the business can answer basic questions as operating facts: what is this agent, who owns it, what may it decide or execute, how does it prove it's legitimate, and how fast can we narrow or revoke it when we change our minds.

![Know Your Agent turns agent identity into an operating map, not a compliance slogan.](/blog/know-your-agent-map.svg)

This is where AI governance stops being a policy PDF and becomes something you can actually operate.

## Authentication is not trust

Authentication proves an actor can get in the door. It says nothing about whether the actor should do the thing it's about to do.

An agent can hold the right token and still be outside its lane. Stale delegation. A tool used for a purpose nobody approved. Two datasets that are harmless apart and radioactive together.

Trust isn't a login event. It has to be continuous, and it has to cover the run itself — not just who started it, but what happened along the way.

## Verification has to become part of the product

A lot of AI systems still treat verification like a polite suggestion. The model emits something; maybe a person checks it, maybe nobody does. Fine for a blog draft. Not fine for software acting in your books.

A governed agent should be able to show its work without making anyone read a giant internal trace. What did it use, which rules applied, where did a human sign off, what got escalated. A leader doesn't need every internal token. They need enough proof to decide whether the result deserves trust.

Underneath all the demos, that's the buyer's real question: can I let this output touch the business?

## The anti-slop layer

AI slop isn't just bad writing. It's output without accountability — a confident answer with no provenance, a summary nobody can trace, a newsletter that publishes because the machine can fill space.

The fix isn't manual review on everything; that just moves the bottleneck. The fix is loops where automation creates leverage and governance creates quality.

That's the shape I'm building toward with The Tool Printer. The system watches the field around the clock — news, YouTube, LinkedIn and X, GitHub, research, operator chatter — scores what it finds, drafts briefs, and learns from performance. But the loop keeps a human in the governance seat: approve, reject, correct, teach.

Human review shouldn't be the bottleneck. It should be the governance function.

## Performance loops need adult supervision

A/B testing is powerful. It's also a very efficient way to teach a machine to chase cheap attention.

If the only signal is engagement, the system will learn engagement. That isn't insight, and it definitely isn't trust. So the loop learns from performance, but a human decides which kind of performance counts — which sources keep producing signal, which claims still hold up after the news cycle moves on, which superficially clever posts are actually empty. Skip that, and the system drifts toward whatever's easiest to measure.

## The moat is trust infrastructure

I don't think the durable moat in enterprise AI is a prompt library, or a wrapper on the latest model, or a prettier chat window. Those matter. They're not enough.

The moat is being able to prove things: which agent acted, under whose authority, on what evidence, with what review, and how to reverse it. That proof will close deals another polished demo can't.

That's the governance desk. Part identity layer, part control plane, part editorial desk, part audit trail.

## Where this goes

The next generation of AI products won't be judged only on how impressive the output is. They'll be judged on how governable it is.

The serious systems will separate signal from slop, show their provenance, respect authority, learn from performance without turning into clickbait, and keep human judgment at the moments it matters. AI as a governed operating system, not a content machine.

The enterprise winner is whoever can prove where judgment, liability, and escalation live after the agent starts acting.

That's why agency needs a governance desk.

---

*Written by Geoff Hopkins for The Tool Printer. This is a working thesis — I expect it to get sharper as the system, the market, and the governance patterns keep moving.*`,
  },
  {
    slug: 'building-the-first-autonomous-business',
    title: 'Building the First Autonomous Hobby Business',
    subtitle: 'What happens when a serious hobby starts behaving like a governed AI business',
    date: '2026-04-08',
    author: 'Geoff Hopkins',
    readingTime: '7 min',
    tags: ['autonomous', 'building-in-public', 'ai-agents'],
    image: '/blog/jarvis-incoming-call.png',
    gradient: GRADIENTS[0],
    content: `This site began as a slightly unreasonable hobby question: could one person build a self-healing, self-learning live system?

Not "AI-assisted" in the polite corporate sense, where a person asks for a paragraph or a helper function and then goes back to doing everything by hand. Something more direct — a human sets direction, agents do big chunks of the work, the system reports what happened, and the human governs the loop when it needs governing.

That's the experiment behind The Tool Printer: a harness that's fit for exactly one purpose (mine), with real machinery, real taste, real governance, and enough automation to find out what one person can actually run.

![small light: Jarvis calls in for an escalated business control loop.](/blog/jarvis-incoming-call.png)

## I'm not trying to cosplay as a software team

I'm not a traditional software engineer. I'm a business operator — years of SaaS, partnerships, go-to-market, client work, and the strange little gap between what buyers say they want and what they actually need.

I know what good product shape feels like. I know when a workflow is clumsy. What I couldn't do, until recently, was build the thing myself. AI agents changed that. Not in a drag-some-boxes-around way — more like: describe the business system at a high enough level, keep pressure on the details, and work with an agent that can actually write the code, read the repo, debug its own errors, and keep going.

The distance between "I have a weird thesis" and "there's a working system in production" got short. That changes who gets to build, at least at hobby scale.

## What The Tool Printer is becoming

The Tool Printer is an intelligence surface for the AI field — the news that matters to me and, I suspect, plenty of others, minus the noise. It wants to be useful before it tries to be big.

Every few hours the workflow wakes up and sweeps the sources: news, YouTube, LinkedIn and X, GitHub, research, operator commentary. It finds candidates, de-dupes, scores, logs everything, hunts for new content producers worth following, and pushes the good material toward review. By now it's practically autonomous — it even raises its own bar for what's worth escalating.

The trail it leaves matters more to me than the output. I don't want an invisible content machine. I want a loop I can inspect: what it fetched, what it ignored, why it scored an item highly, what got rejected, where it might be drifting. That's the difference between an AI toy and an operating process.

## Autonomy doesn't mean absence

The goal was never to disappear. It's leverage.

Nobody should have to read every source, copy every link, chase every duplicate, and remember every operational detail. That's exactly the work agents should absorb. But the human still matters — for deciding what signal means, noticing when the system is optimizing for the wrong thing, and supplying taste, commercial judgment, and the useful kind of skepticism.

The agents gather, score, and draft. I approve, reject, tune, and decide what the system is allowed to become.

## The admin panel is the business

One thing surprised me: for the first three months, the admin area was the most important product surface. The public site is the front page, obviously. But the admin is where the actual business happens — feeds get added, prompts get tuned, scores get inspected, approvals happen, runs get watched.

That's why I keep pushing on unglamorous things like manual approvals, surveillance views, rejected-item logs, and event streams. They aren't "nice admin features." They're the operating model.

If an AI process can't show what it's doing, it isn't autonomous. It's just opaque.

## The real product is the loop

The Tool Printer isn't only a website. It's a test of a business pattern: can one person define a market thesis, build the machinery, automate the work, govern the quality, and keep improving the system — without pretending every useful project needs the old shape of a company?

The stack isn't the story. The loop is. The agents work, the system explains itself, the human corrects course, and it runs again — continuously, until an exception knocks.

## What I'm looking at next

* Better source memory. Memory is the dark side of AI, and I say that with some affection.
* Clearer source classification — AI-created, AI-assisted, or human-written — with the slop scorecard adjusted to match. This site doesn't post AI-generated content; it's AI curating good human content.
* Stronger scoring, so real signal separates from recycled AI noise.
* More transparency about how the machine gathers and filters, so readers can check my homework.
* Performance feedback from the analytics engine — what's working, hover time, movement patterns. It already pulls PostHog heatmaps and restructures the hero and landing page through a headless Claude Code job engine.
* Human governance that feels quick, calm, and decisive — eventually informed by approved agent-to-agent discussions.

The goal isn't a fully automated content farm. Please no.

The goal is a governed machine on a domain of knowledge: one that does a lot of work, shows its reasoning, accepts correction, and keeps moving.

## The open question

What happens when the smallest viable business is no longer a person with a pile of tools, but a person with a governed operating loop?

A single operator can now hold the thesis, shape the product, tune the sources, review the output, read the analytics, and keep the machine honest. That used to take a small team. I don't know where this leads yet — but the old bottleneck is breaking, and when bottlenecks break, new kinds of useful businesses show up.

The Tool Printer is my attempt to find out what one of them looks like.`,
  },
];

export function getAllPosts(): BlogPost[] {
  return posts.sort((a, b) => b.date.localeCompare(a.date));
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return posts.find((p) => p.slug === slug);
}
