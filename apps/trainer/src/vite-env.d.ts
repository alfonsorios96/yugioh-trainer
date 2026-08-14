/// <reference types="vite/client" />

declare module "*.ydk?raw" {
  const src: string;
  export default src;
}
