import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { ComponentProps } from 'react';

// The drawing canvas, split out of the entry bundle (item 18): Excalidraw is
// the app's heaviest dependency, and the home screen, review pages and
// published apps should not pay its download before first paint. App loads
// this module lazily; its stylesheet travels with the chunk.
export default function SketchCanvas(p: ComponentProps<typeof Excalidraw>) {
  return <Excalidraw {...p} />;
}
