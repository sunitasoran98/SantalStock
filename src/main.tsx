import {createRoot} from 'react-dom/client';
import App from './App.tsx';
// Self-hosted fonts (no Google Fonts request): each file loads only when its script appears on the page.
import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/noto-sans-devanagari/wght.css';
import '@fontsource-variable/noto-sans-ol-chiki/wght.css';
import '@fontsource/dm-serif-display/latin-400.css';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
