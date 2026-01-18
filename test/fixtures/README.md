# Test Fixtures

This directory contains test data for the git2codetour tool.

## Diff Files

Sample git diff outputs that can be used for testing:

- **simple-addition.diff**: A new file being added with basic JavaScript code
- **simple-modification.diff**: A single line modification in an existing file
- **multiple-changes.diff**: Multiple hunks with changes in a Python file
- **file-deletion.diff**: A file being deleted
- **multi-file.diff**: Changes across multiple files (README.md and main.js)

## Expected Output Files

For each diff file (except file-deletion.diff), there is a corresponding `.expected.json` file that shows what the CodeTour output should look like when processing that diff.

## Usage

These fixtures can be used to:
1. Manually test the tool by piping diff content
2. Create automated tests
3. Validate that changes to the parser don't break existing functionality

### Example Manual Test

```bash
# Build the project
npm run build

# Create a test repository
cd /tmp
mkdir test-repo && cd test-repo
git init
git config user.email "test@example.com"
git config user.name "Test User"

# Create initial commit
echo "old content" > file.txt
git add file.txt
git commit -m "Initial commit"

# Make changes
echo "new content" > file.txt
git add file.txt
git commit -m "Update content"

# Test the tool
node /path/to/git2codetour/dist/index.js HEAD~1 HEAD
```

## Test Scenarios Covered

1. **File Creation**: New files being added to repository
2. **Line Modifications**: Single and multiple line changes
3. **Function Refactoring**: Changes to function signatures and implementations
4. **Multi-file Changes**: Diffs that span multiple files
5. **Documentation Changes**: Markdown file modifications
6. **Code Comments**: Addition of comments to source code

## Syntax Highlighting Coverage

The test fixtures cover multiple languages to verify syntax highlighting:
- JavaScript (.js)
- Python (.py)
- Markdown (.md)
- Text (.txt)
