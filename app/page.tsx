import EnigmaPaintingReactKeyUI from "@/app/components/EnigmaPaintingReactKeyUI";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-100 pb-16">
      <section className="mx-auto flex max-w-6xl flex-col gap-8 px-4 pt-10 sm:px-6 lg:px-8">
        <header className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">Sherlock Initiative</p>
          <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">Enigma Painting React Key Generator</h1>
          <p className="mx-auto max-w-2xl text-base text-slate-600">
            Experiment with procedural Voronoi cells, align them with the key silhouette, and build your deduction ledger in a
            single immersive workspace.
          </p>
        </header>
        <EnigmaPaintingReactKeyUI />
      </section>
    </main>
  );
}
