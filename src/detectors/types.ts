export interface OutdatedPackage {
  name: string;
  current: string;
  latest: string;
  path?: string;
}

export interface InstalledPackage {
  name: string;
  version: string;
}

export interface UpdateResult {
  manager: string;
  success: boolean;
  updated: number;
  output: string;
  error?: string;
}

export interface PackageManager {
  name: string;
  command: string;
  icon: string;
  detect(): Promise<boolean>;
  listOutdated(): Promise<OutdatedPackage[]>;
  listInstalled(): Promise<InstalledPackage[]>;
  update(dryRun?: boolean, packages?: string[]): Promise<UpdateResult>;
  uninstall(dryRun?: boolean, packages?: string[]): Promise<UpdateResult>;
}

export interface CliOptions {
  only?: string;
  dryRun?: boolean;
  noSudo?: boolean;
  verbose?: boolean;
  yes?: boolean;
}
