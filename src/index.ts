#!/usr/bin/env node

import { Command } from 'commander';
import { simpleGit, SimpleGit } from 'simple-git';
import * as path from 'path';
import * as fs from 'fs';

interface CodeTourStep {
  file: string;
  line: number;
  description: string;
  title?: string;
}

interface CodeTour {
  title: string;
  description: string;
  steps: CodeTourStep[];
}

async function generateCodeTour(
  repoPath: string,
  fromCommit: string,
  toCommit: string
): Promise<CodeTour> {
  const git: SimpleGit = simpleGit(repoPath);

  // Verify commits exist
  try {
    await git.revparse([fromCommit]);
    await git.revparse([toCommit]);
  } catch (error) {
    throw new Error(`Invalid commit reference: ${error}`);
  }

  // Get the diff between commits
  const diffSummary = await git.diffSummary([fromCommit, toCommit]);
  const diff = await git.diff([fromCommit, toCommit]);

  const steps: CodeTourStep[] = [];

  // Parse diff to extract changes
  const diffLines = diff.split('\n');
  let currentFile = '';
  let currentLine = 0;
  let addedLines: string[] = [];
  let deletedLines: string[] = [];
  let inHunk = false;

  for (let i = 0; i < diffLines.length; i++) {
    const line = diffLines[i];

    // Match file header
    if (line.startsWith('diff --git')) {
      // Save previous file's changes
      if (currentFile && (addedLines.length > 0 || deletedLines.length > 0)) {
        const description = generateStepDescription(addedLines, deletedLines);
        steps.push({
          file: currentFile,
          line: currentLine > 0 ? currentLine : 1,
          description,
        });
      }

      // Reset for new file
      const match = line.match(/diff --git a\/(.*) b\/(.*)/);
      if (match) {
        currentFile = match[2];
      }
      addedLines = [];
      deletedLines = [];
      currentLine = 0;
      inHunk = false;
    }

    // Match hunk header
    if (line.startsWith('@@')) {
      // Save previous hunk's changes if any
      if (addedLines.length > 0 || deletedLines.length > 0) {
        const description = generateStepDescription(addedLines, deletedLines);
        steps.push({
          file: currentFile,
          line: currentLine > 0 ? currentLine : 1,
          description,
        });
        addedLines = [];
        deletedLines = [];
      }

      const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
      if (match) {
        currentLine = parseInt(match[2], 10);
      }
      inHunk = true;
      continue;
    }

    // Parse changes in hunk
    if (inHunk) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        addedLines.push(line.substring(1));
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletedLines.push(line.substring(1));
      } else if (!line.startsWith('\\')) {
        // Context line, save current changes if any
        if (addedLines.length > 0 || deletedLines.length > 0) {
          const description = generateStepDescription(addedLines, deletedLines);
          steps.push({
            file: currentFile,
            line: currentLine,
            description,
          });
          addedLines = [];
          deletedLines = [];
        }
        currentLine++;
      }
    }
  }

  // Save last file's changes
  if (currentFile && (addedLines.length > 0 || deletedLines.length > 0)) {
    const description = generateStepDescription(addedLines, deletedLines);
    steps.push({
      file: currentFile,
      line: currentLine > 0 ? currentLine : 1,
      description,
    });
  }

  // Get commit messages for context
  const fromCommitLog = await git.log([fromCommit, '-1']);
  const toCommitLog = await git.log([toCommit, '-1']);

  const tour: CodeTour = {
    title: `Changes from ${fromCommit.substring(0, 7)} to ${toCommit.substring(0, 7)}`,
    description: `Diff between commits:\n- From: ${fromCommitLog.latest?.hash.substring(0, 7)} - ${fromCommitLog.latest?.message}\n- To: ${toCommitLog.latest?.hash.substring(0, 7)} - ${toCommitLog.latest?.message}`,
    steps,
  };

  return tour;
}

function generateStepDescription(addedLines: string[], deletedLines: string[]): string {
  let description = '';

  if (deletedLines.length > 0) {
    description += '**Removed:**\n```\n' + deletedLines.join('\n') + '\n```\n\n';
  }

  if (addedLines.length > 0) {
    description += '**Added:**\n```\n' + addedLines.join('\n') + '\n```\n';
  }

  return description.trim();
}

async function main() {
  const program = new Command();

  program
    .name('git2codetour')
    .description('Generate CodeTour from git commit diff')
    .version('1.0.0')
    .argument('<from-commit>', 'Starting commit reference')
    .argument('<to-commit>', 'Ending commit reference')
    .option('-r, --repo <path>', 'Path to git repository', process.cwd())
    .option('-o, --output <file>', 'Output file path (default: stdout)')
    .action(async (fromCommit: string, toCommit: string, options) => {
      try {
        const repoPath = path.resolve(options.repo);

        // Verify repository exists
        if (!fs.existsSync(path.join(repoPath, '.git'))) {
          console.error(`Error: Not a git repository: ${repoPath}`);
          process.exit(1);
        }

        const tour = await generateCodeTour(repoPath, fromCommit, toCommit);
        const output = JSON.stringify(tour, null, 2);

        if (options.output) {
          const outputPath = path.resolve(options.output);
          fs.writeFileSync(outputPath, output, 'utf-8');
          console.log(`CodeTour written to: ${outputPath}`);
        } else {
          console.log(output);
        }
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
