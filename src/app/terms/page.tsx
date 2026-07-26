export const metadata = {
  title: "Terms of Service | Lyriq Lab",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-black text-white/80 px-6 py-16">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Terms of Service</h1>
          <p className="mt-2 text-xs text-white/40">Last updated: July 26, 2026</p>
        </div>

        <p className="text-sm leading-relaxed text-white/60">
          These terms cover your use of Lyriq Lab during its closed alpha. By checking
          &quot;I agree&quot; and signing in, you accept them. This is a plain-language
          draft appropriate for a small, invited testing group — we&apos;ll formalize it
          with legal review before any public release.
        </p>

        <Section title="1. Alpha software">
          <p>
            Lyriq Lab is unfinished, in-development software. Things may break, change
            without notice, or occasionally lose data. It&apos;s provided &quot;as is&quot;
            with no warranty of any kind, express or implied.
          </p>
        </Section>

        <Section title="2. Your content">
          <p>
            You own the lyrics, recordings, and other creative material you create in
            Lyriq Lab. We don&apos;t claim any ownership over it, and we don&apos;t use it
            to train AI models. We only process it (locally, or via the third-party AI
            services described in our{" "}
            <a href="/privacy" className="underline text-white/70 hover:text-white">Privacy Policy</a>
            ) to provide the features you use.
          </p>
        </Section>

        <Section title="3. Acceptable use">
          <ul className="list-disc list-inside space-y-1.5">
            <li>Don&apos;t upload content you don&apos;t have the rights to use.</li>
            <li>Don&apos;t attempt to access another tester&apos;s account or data.</li>
            <li>Don&apos;t use the app to generate illegal, hateful, or abusive content.</li>
            <li>Don&apos;t attempt to disrupt, overload, or reverse-engineer the service.</li>
          </ul>
        </Section>

        <Section title="4. Microphone & file access">
          <p>
            Recording features request microphone access, and beat uploads request file
            access, only when you actively use those features. You can revoke these
            permissions at any time in your browser settings, though doing so will
            disable recording/upload.
          </p>
        </Section>

        <Section title="5. No guarantee of availability">
          <p>
            As alpha software, we may take the app offline, reset test data, or change
            features at any time without notice. During this phase, audio you record or
            upload is stored locally on your device and is not backed up to our servers —
            see the in-app notice and Privacy Policy for details.
          </p>
        </Section>

        <Section title="6. Termination">
          <p>
            We may suspend or end your access to the alpha at any time, for any reason,
            particularly for violating the acceptable use terms above. You can stop using
            the app at any time.
          </p>
        </Section>

        <Section title="7. Limitation of liability">
          <p>
            To the fullest extent permitted by law, Lyriq Lab and its team aren&apos;t
            liable for any indirect, incidental, or consequential damages — including
            lost creative work — arising from your use of this alpha software.
          </p>
        </Section>

        <Section title="8. Changes">
          <p>
            We may update these terms as the app evolves. Material changes will be
            announced to testers (e.g. via our Discord).
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about these terms?{" "}
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
