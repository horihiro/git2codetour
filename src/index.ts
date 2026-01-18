#!/usr/bin/env node

import { Command } from 'commander';
import { simpleGit, SimpleGit } from 'simple-git';
import * as path from 'path';
import * as fs from 'fs';

interface CodeTourStep {
  file?: string;
  directory?: string;
  line?: number;
  description: string;
  title?: string;
  selection?: {
    start: {
      line: number;
      character: number;
    };
    end: {
      line: number;
      character: number;
    };
  };
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
  const diff = await git.diff([fromCommit, toCommit]);

  const steps: CodeTourStep[] = [];

  // Parse diff to extract changes
  const diffLines = diff.split('\n');
  let currentFile = '';
  let currentLine = 0;
  let changeStartLine = 0;
  let addedLines: string[] = [];
  let deletedLines: string[] = [];
  let inHunk = false;
  let isNewFile = false;

  for (let i = 0; i < diffLines.length; i++) {
    const line = diffLines[i];

    // Match file header
    if (line.startsWith('diff --git')) {
      // Save previous file's changes
      if (currentFile && (addedLines.length > 0 || deletedLines.length > 0)) {
        const step = createStep(addedLines, deletedLines, currentFile, changeStartLine, isNewFile);
        steps.push(step);
      }

      // Reset for new file
      const match = line.match(/diff --git a\/(.*) b\/(.*)/);
      if (match) {
        currentFile = match[2];
      }
      addedLines = [];
      deletedLines = [];
      currentLine = 0;
      changeStartLine = 0;
      inHunk = false;
      isNewFile = false;
    }

    // Check if this is a new file
    if (line.startsWith('--- /dev/null')) {
      isNewFile = true;
    }

    // Match hunk header
    if (line.startsWith('@@')) {
      // Save previous hunk's changes if any
      if (addedLines.length > 0 || deletedLines.length > 0) {
        const step = createStep(addedLines, deletedLines, currentFile, changeStartLine, isNewFile);
        steps.push(step);
        addedLines = [];
        deletedLines = [];
      }

      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        currentLine = parseInt(match[2], 10);
      }
      changeStartLine = 0;
      inHunk = true;
      continue;
    }

    // Parse changes in hunk
    if (inHunk) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        if (changeStartLine === 0) {
          changeStartLine = currentLine;
        }
        addedLines.push(line.substring(1));
        currentLine++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        if (changeStartLine === 0) {
          changeStartLine = currentLine;
        }
        deletedLines.push(line.substring(1));
        // Don't increment currentLine for deletions
      } else if (!line.startsWith('\\')) {
        // Context line, save current changes if any
        if (addedLines.length > 0 || deletedLines.length > 0) {
          const step = createStep(addedLines, deletedLines, currentFile, changeStartLine > 0 ? changeStartLine : currentLine, isNewFile);
          steps.push(step);
          addedLines = [];
          deletedLines = [];
          changeStartLine = 0;
        }
        currentLine++;
      }
    }
  }

  // Save last file's changes
  if (currentFile && (addedLines.length > 0 || deletedLines.length > 0)) {
    const step = createStep(addedLines, deletedLines, currentFile, changeStartLine > 0 ? changeStartLine : 1, isNewFile);
    steps.push(step);
  }

  // Get commit messages for context
  const fromCommitLog = await git.log([fromCommit, '-1']);
  const toCommitLog = await git.log([toCommit, '-1']);

  const fromHash = fromCommitLog.latest?.hash?.substring(0, 7) || fromCommit;
  const toHash = toCommitLog.latest?.hash?.substring(0, 7) || toCommit;

  const tour: CodeTour = {
    title: `Changes from ${fromHash} to ${toHash}`,
    description: `Diff between commits:\n- From: ${fromHash} - ${fromCommitLog.latest?.message}\n- To: ${toHash} - ${toCommitLog.latest?.message}`,
    steps,
  };

  return tour;
}

function createStep(
  addedLines: string[],
  deletedLines: string[],
  fileName: string,
  lineNumber: number,
  isNewFile: boolean
): CodeTourStep {
  const description = generateStepDescription(addedLines, deletedLines, fileName, isNewFile);
  const step: CodeTourStep = {
    description,
  };

  // For new files, don't set file/line, let the description guide the user
  if (isNewFile) {
    // Don't set file or line for new files - user will create it via shell command
    step.title = `Create ${fileName}`;
  } else {
    step.file = fileName;

    // Add selection for code replacements (when there are deletions)
    if (deletedLines.length > 0) {
      const endLine = lineNumber + deletedLines.length - 1;
      step.selection = {
        start: {
          line: lineNumber,
          character: 0,
        },
        end: {
          line: endLine,
          character: deletedLines[deletedLines.length - 1].length,
        },
      };
      // When using selection, line should not be set
    } else {
      // Only set line when there's no selection
      step.line = lineNumber;
    }
  }

  return step;
}

function generateStepDescription(
  addedLines: string[],
  deletedLines: string[],
  fileName: string,
  isNewFile: boolean
): string {
  let description = '';
  const language = getLanguageFromFileName(fileName);

  // For new files, use shell command to create and code block to insert
  if (isNewFile) {
    description += `Create a new file:\n\n`;
    description += `>> touch ${fileName}\n\n`;
    if (addedLines.length > 0) {
      description += `Then add the following content:\n\n`;
      description += `\`\`\`${language}\n` + addedLines.join('\n') + '\n```';
    }
    return description.trim();
  }

  // For code replacements with selection, only show the new code
  // (the selection will highlight the old code)
  if (deletedLines.length > 0 && addedLines.length > 0) {
    description += `Replace with:\n\n`;
    description += `\`\`\`${language}\n` + addedLines.join('\n') + '\n```';
  } else if (deletedLines.length > 0) {
    // Only deletions (no additions) - show what's being removed
    description += `Remove this code (selected above)`;
  } else if (addedLines.length > 0) {
    // Only additions
    description += `Add:\n\n`;
    description += `\`\`\`${language}\n` + addedLines.join('\n') + '\n```';
  }

  return description.trim();
}

function getLanguageFromFileName(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const languageMap: { [key: string]: string } = {
    '.js': 'javascript',
    '.jsx': 'jsx',
    '.ts': 'typescript',
    '.tsx': 'tsx',
    '.py': 'python',
    '.rb': 'ruby',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.cc': 'cpp',
    '.cxx': 'cpp',
    '.cs': 'csharp',
    '.php': 'php',
    '.go': 'go',
    '.rs': 'rust',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.scala': 'scala',
    '.sh': 'bash',
    '.bash': 'bash',
    '.zsh': 'bash',
    '.fish': 'fish',
    '.ps1': 'powershell',
    '.r': 'r',
    '.R': 'r',
    '.sql': 'sql',
    '.html': 'html',
    '.htm': 'html',
    '.xml': 'xml',
    '.css': 'css',
    '.scss': 'scss',
    '.sass': 'sass',
    '.less': 'less',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.toml': 'toml',
    '.md': 'markdown',
    '.txt': 'text',
  };
  
  return languageMap[ext] || '';
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
