// Tells the screens to reload when new data is saved (e.g. a live SMS arrives while the app is open).

type Listener = () => void;
const listeners = new Set<Listener>();

export function onDataChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitDataChanged(): void {
  listeners.forEach(l => l());
}
