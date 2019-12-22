import * as eslint from 'eslint'; // Imported for types alone

import {
  IncrementalCheckerInterface,
  IncrementalCheckerParams
} from './IncrementalCheckerInterface';
import { CancellationToken } from './CancellationToken';
import { CompilerHost } from './CompilerHost';
import { createEslinter } from './createEslinter';
import {
  createIssuesFromTsDiagnostics,
  createIssuesFromEsLintReports
} from './issue';

export class ApiIncrementalChecker implements IncrementalCheckerInterface {
  protected readonly tsIncrementalCompiler: CompilerHost;

  private currentEsLintErrors = new Map<string, eslint.CLIEngine.LintReport>();
  private lastUpdatedFiles: string[] = [];
  private lastRemovedFiles: string[] = [];

  private readonly eslinter: ReturnType<typeof createEslinter> | undefined;

  constructor({
    typescript,
    programConfigFile,
    compilerOptions,
    eslinter,
    vue,
    checkSyntacticErrors = false,
    resolveModuleName,
    resolveTypeReferenceDirective
  }: IncrementalCheckerParams) {
    this.eslinter = eslinter;

    this.tsIncrementalCompiler = new CompilerHost(
      typescript,
      vue,
      programConfigFile,
      compilerOptions,
      checkSyntacticErrors,
      resolveModuleName,
      resolveTypeReferenceDirective
    );
  }

  public hasEsLinter(): boolean {
    return this.eslinter !== undefined;
  }

  public isFileExcluded(filePath: string): boolean {
    return filePath.endsWith('.d.ts');
  }

  public nextIteration() {
    // do nothing
  }

  public async getTypeScriptIssues() {
    const tsDiagnostics = await this.tsIncrementalCompiler.processChanges();
    this.lastUpdatedFiles = tsDiagnostics.updatedFiles;
    this.lastRemovedFiles = tsDiagnostics.removedFiles;

    return createIssuesFromTsDiagnostics(tsDiagnostics.results);
  }

  public async getEsLintIssues(cancellationToken: CancellationToken) {
    if (!this.eslinter) {
      throw new Error('EsLint is not enabled in the plugin.');
    }

    for (const removedFile of this.lastRemovedFiles) {
      this.currentEsLintErrors.delete(removedFile);
    }

    for (const updatedFile of this.lastUpdatedFiles) {
      cancellationToken.throwIfCancellationRequested();
      if (this.isFileExcluded(updatedFile)) {
        continue;
      }

      const report = this.eslinter.getReport(updatedFile);

      if (report !== undefined) {
        this.currentEsLintErrors.set(updatedFile, report);
      } else if (this.currentEsLintErrors.has(updatedFile)) {
        this.currentEsLintErrors.delete(updatedFile);
      }
    }

    const reports = Array.from(this.currentEsLintErrors.values());
    return createIssuesFromEsLintReports(reports);
  }
}
