import './style.css';
import { initApp } from './app/ui';

initApp();
// Señal para la guardia de index.html (ver el <script> inline del body)
(window as unknown as Record<string, unknown>).__fmBooted = true;
