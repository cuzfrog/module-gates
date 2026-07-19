
export type Signature = {
  modifier?: string;
  name: string;
  path?: string;
};

export type ModuleContract = {
  modulePath: string;
  descriptorFileName: string;
  visible: Signature[] | null;
  readonly: string[];
  noNewExports: string[];
  prose: string;
};

export type ModuleIndex = {
  contracts: ModuleContract[];
  dirToModule: Map<string, string>;
};
