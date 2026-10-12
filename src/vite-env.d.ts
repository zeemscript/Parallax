/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ESCROW_CONTRACT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
