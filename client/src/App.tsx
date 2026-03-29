import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center shadow-2xl backdrop-blur">
        <p className="mb-2 text-sm uppercase tracking-[0.2em] text-violet-300">React + Vite + TypeScript</p>
        <h1 className="mb-3 text-4xl font-bold text-white">Tailwind is ready</h1>
        <p className="mb-8 text-slate-300">Start building from src/App.tsx.</p>
        <button
          onClick={() => setCount((value) => value + 1)}
          className="rounded-lg bg-violet-600 px-5 py-2.5 font-medium text-white transition hover:bg-violet-500"
        >
          Count is {count}
        </button>
      </section>
    </main>
  )
}

export default App
