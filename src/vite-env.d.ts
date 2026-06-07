// CSS side-effect imports (e.g. import './globals.css')
declare module '*.css';

// SVG raw imports (e.g. import svg from './track.svg?raw')
declare module '*.svg?raw' {
  const content: string;
  export default content;
}
