import dynamic from 'next/dynamic';

const Scene = dynamic(() => import('@/components/Scene'), { ssr: false });

export default function Page() {
  return (
    <main className="container">
      <div className="overlay">
        <h1 className="title">AI Reality Check Official</h1>
        <p className="subtitle">Cinematic ? Futuristic ? Ultra-real ? 8K</p>
        <div className="controls">
          <button id="render-8k" className="button">Render 8K Frame</button>
        </div>
      </div>
      <Scene />
    </main>
  );
}
