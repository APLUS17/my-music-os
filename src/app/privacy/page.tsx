export const metadata = {
  title: "Privacy Policy | Lyriq Lab",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-black text-white/80 px-6 py-16">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Privacy Policy</h1>
          <p className="mt-2 text-xs text-white/40">Last updated: July 26, 2026</p>
        </div>

        <p className="text-sm leading-relaxed text-white/60">
          Lyriq Lab (&quot;we&quot;, &quot;us&quot;) is currently in a closed alpha with a
          small group of invited testers. This policy explains what we collect and how
          it&apos;s used during this alpha period. It&apos;s a plain-language draft, not a
          final legal document — we&apos;ll publish a fuller policy before any public launch.
        </p>

        <Section title="What we collect">
          <ul className="list-disc list-inside space-y-1.5">
            <li><strong>Email address</strong> — used only to sign you in via a one-time code. We don&apos;t use it for marketing without asking first.</li>
            <li><strong>Lyrics, notes, and project metadata</strong> (titles, genre, mood, tags) you create — stored in our Supabase database, associated with your account.</li>
            <li><strong>Voice recordings and uploaded beats</strong> — during this alpha, these stay on your device (browser storage) and are not uploaded to our servers. See the in-app notice for details.</li>
            <li><strong>Content you send to AI features</strong> — voice recordings you choose to transcribe or analyze, and text you send to the AI songwriting coach, are sent to our AI processors (below) to generate a response.</li>
            <li><strong>Basic crash/error reports</strong> — if the app errors out, we log the error message, a stack trace, the page URL, and your browser&apos;s user agent so we can fix bugs. We do not log your lyrics or audio content as part of error reports.</li>
          </ul>
        </Section>

        <Section title="Third parties we share data with">
          <ul className="list-disc list-inside space-y-1.5">
            <li><strong>Supabase</strong> — hosts our database and handles authentication.</li>
            <li><strong>Groq</strong> — transcribes voice recordings you submit (Whisper model), only when you use the transcription feature.</li>
            <li><strong>Google Gemini</strong> — powers AI audio structure analysis and the Studio Facilitator chat coach. Audio/text you submit to these features is sent to Google&apos;s API.</li>
            <li><strong>Datamuse &amp; LRCLIB</strong> — power the rhyme/synonym and lyric-search tools. Only the word or phrase you search is sent; no account data.</li>
          </ul>
          <p className="mt-2">
            We don&apos;t sell your data, and we don&apos;t run third-party ads or tracking
            analytics in the app today.
          </p>
        </Section>

        <Section title="Access control">
          <p>
            Your projects, lyrics, and notes are protected by database-level access rules
            (row-level security) — only your signed-in account can read or edit them.
            We (the Lyriq Lab team) can access the underlying database for debugging and
            support, but the app itself never shows one user&apos;s content to another.
          </p>
        </Section>

        <Section title="Data retention & deletion">
          <p>
            We keep your account data for as long as you use the alpha. If you want your
            account and data deleted, email us at{" "}
            <a href="mailto:omolojaa8287@gmail.com" className="underline text-white/70 hover:text-white">
              omolojaa8287@gmail.com
            </a>{" "}
            and we&apos;ll remove it within a reasonable timeframe.
          </p>
        </Section>

        <Section title="Alpha disclaimer">
          <p>
            This is early alpha software. Features, data handling, and this policy may
            change as we build. Please don&apos;t treat the app as your only backup for
            important work.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy or your data?{" "}
            <a href="mailto:omolojaa8287@gmail.com" className="underline text-white/70 hover:text-white">
              omolojaa8287@gmail.com
            </a>
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <div className="text-sm leading-relaxed text-white/60">{children}</div>
    </section>
  );
}
