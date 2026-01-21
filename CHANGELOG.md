# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.5] - 2026-01-21

### Added
- Implement `--filter` option to process only files matching specified glob patterns

### Fixed
- Fix formatting in generateStepDescription: add newline before closing code block

## [0.0.4] - 2026-01-20

### Fixed
- Fix formatting of Windows command in empty file creation description

## [0.0.3] - 2026-01-19

### Added
- NPM version and download badges to README

### Changed
- Enhanced `generateStepDescription` function: add separator for replacement descriptions and default to 'text' for unknown file extensions
- Enhanced `createSteps` function: improve description for creating an empty file with OS-specific commands (Windows/Unix)

## [0.0.2] - Unreleased

### Features
- Initial development release with core functionality

## [0.0.1] - 2026-01-18

### Added
- Initial release of git2codetour
- Command-line tool to generate CodeTour from git commit diffs
- Support for analyzing Git local repositories and extracting commit differences
- Output generation in CodeTour format
- CLI options for filtering tours by file patterns
- Support for multiple file changes in a single tour
- File deletion tracking in diffs

### Features
- Parses Git commit logs and diffs between two commits
- Generates CodeTour compatible JSON output
- Handles simple file additions, modifications, and deletions
- Command-line interface using Commander.js
- Built with TypeScript for type safety
- Git integration for commit analysis
- Support for Windows and Unix line endings

### Dependencies
- `commander`: ^14.0.2 - Command-line interface framework
- `simple-git`: ^3.30.0 - Git operations library
- `@types/node`: ^25.0.9 - TypeScript Node.js types
- `typescript`: ^5.9.3 - TypeScript compiler

### Documentation
- README with installation and usage instructions
- Both English and Japanese documentation
- MIT License
