
export type Signature = {
  modifier?: string;
  name: string;
  path?: string;
};

export type ModuleFrontmatter = {
  readonly?: string[];
  "no-new-exports"?: string[];
};

export type ModuleContract = {
  modulePath: string;
  descriptorFileName: string;
  readonly: string[];
  noNewExports: string[];
  prose: string;
};

export type ModuleIndex = {
  contracts: ModuleContract[];
  dirToModule: Map<string, string>;
};

export type Diagnostic = {
  level: "info" | "warning" | "error";
  message: string;
};
