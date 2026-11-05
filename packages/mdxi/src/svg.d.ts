// SVG files are bundled as text (see tsup.config.ts).
declare module "*.svg" {
  const svg: string;
  export default svg;
}
