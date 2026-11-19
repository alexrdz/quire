<script lang="ts">
  import { Stack } from "$lib/components/layout";
  import InfoPage from "$lib/components/site/InfoPage.svelte";
  import { SUPPORT_EMAIL } from "$lib/components/site/footer-links";

  type Faq = Readonly<{ q: string; a: string }>;
  type FaqGroup = Readonly<{ heading: string; items: readonly Faq[] }>;

  const groups: readonly FaqGroup[] = [
    {
      heading: "For fans",
      items: [
        {
          q: "What is a Quire zine?",
          a: "An Issue is a small digital zine for one gig: a cover, a few pages from the artist, a public Wall for notes, and a last page where you can save or stamp it. Scan the QR code at the show and it opens in your browser. There is nothing to install.",
        },
        {
          q: "Do I need an account to read a zine or leave a tip?",
          a: "No. Reading and tipping are anonymous. You only sign in with Google when you want to sign a Wall, save an Issue, or collect a Stamp.",
        },
        {
          q: "What is the difference between Saved and Stamped?",
          a: "Anyone can save an Issue from anywhere. A Stamp is proof you were at the gig: you reached the Issue by scanning its QR code during the Stamp Window. Stamped Issues appear as ticket stubs in My Stubs.",
        },
        {
          q: "What is the Stamp Window?",
          a: "A 48-hour window in the venue's local time, running from 00:00 on the gig date through 23:59:59 the following day. If you scan inside the window you can sign in and claim your Stamp later.",
        },
        {
          q: "What can I post on a Wall?",
          a: "Short public notes for the artist. Links, email addresses and phone numbers are not allowed. Notes can be flagged, hidden or blocked by the artist, and the artist can reply once to a note.",
        },
      ],
    },
    {
      heading: "Tips and payments",
      items: [
        {
          q: "How do tips work?",
          a: "Tap a tip amount and Venmo opens with the amount and a note filled in. You confirm the payment in Venmo. Nothing happens unless you tap, and Quire never sends reminders or follow-ups.",
        },
        {
          q: "What are the tip limits?",
          a: "Tips are in US dollars, with a $2 minimum and a $500 maximum.",
        },
        {
          q: "Where does my money go?",
          a: "Straight to the artist's Venmo. Quire never handles the money and takes no cut. The payment is between you and the artist, under Venmo's terms.",
        },
        {
          q: "Can I get a refund?",
          a: "Tips go straight to the artist in Venmo, so refunds and any problems with a payment are between you and the artist in Venmo. Quire never sees the payment and cannot reverse it.",
        },
        {
          q: "Why do I not see tip buttons on an artist page?",
          a: "Tip buttons appear only after the artist has added their Venmo username.",
        },
      ],
    },
    {
      heading: "For artists",
      items: [
        {
          q: "How do I publish an Issue?",
          a: "Use Quick Issue from your phone. You need only a city, a venue and a date. Add a note, photo or setlist if you have time. Your Master Template adds your recurring pages automatically.",
        },
        {
          q: "What is the difference between an Issue QR and an Artist QR?",
          a: "Each Issue has its own QR that opens that gig's Cover. Your Artist QR is permanent and opens your Back Page with a tip button, your links and every Issue.",
        },
        {
          q: "How do I get paid?",
          a: "Add your Venmo username in Settings. Fans pay you directly in Venmo, so the money arrives in your Venmo account and Quire takes no cut. Your dashboard counts tip taps, but Quire cannot see which payments went through, so check Venmo for what came in.",
        },
        {
          q: "Can I delete an Issue?",
          a: "Issues are archived, never deleted. An archived Issue leaves your Back Page, but fans keep their Stubs.",
        },
        {
          q: "Can bandmates share one login?",
          a: "Yes. Each artist has one login shared by the band. Changing your Venmo username requires your password again plus email confirmation.",
        },
      ],
    },
  ];
</script>

<InfoPage title="Frequently asked questions" eyebrow="Support">
  {#each groups as group (group.heading)}
    <Stack as="section" gap="xs">
      <h2>{group.heading}</h2>
      {#each group.items as item (item.q)}
        <details>
          <summary>{item.q}</summary>
          <p>{item.a}</p>
        </details>
      {/each}
    </Stack>
  {/each}

  <Stack as="section" gap="xs">
    <h2>Still need help?</h2>
    <p>
      Email <a href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a> or visit the
      <a href="/support">support page</a>.
    </p>
  </Stack>
</InfoPage>
