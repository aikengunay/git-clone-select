# git-clone-select

A CLI tool for cloning git repositories into organized project folders with interactive directory selection.

## Install

### From npm (Recommended)

```bash
npm install -g git-clone-select
```

### From source

```bash
git clone https://github.com/aikengunay/git-clone-select.git
cd git-clone-select
npm install -g .
```

The `-g` flag installs the package globally, making `git-clone-select` available from any directory in your terminal.

## Usage

```bash
git-clone-select <git-url>
```

Run `git-clone-select` from any directory. On first run, you'll be prompted to set up your projects directory. The tool will then prompt you to select or create a destination folder.

**Examples:**

```bash
git-clone-select https://github.com/user/repo.git
git-clone-select git@github.com:user/repo.git
```

## Features

- Interactive folder selection
- Create folders in root or nested locations
- Automatic repository name extraction
- URL validation and overwrite protection
- Option to open cloned repository in Cursor editor
- Cross-platform support (Windows, macOS, Linux)
- Configurable projects directory

## Configuration

### First-time Setup

On first run, `git-clone-select` will prompt you to set up your projects directory. You can choose any location within your home directory.

### Config Commands

```bash
# Show current configuration
git-clone-select --config

# Set projects directory
git-clone-select --set-config ~/MyProjects

# Reset configuration
git-clone-select --reset-config

# Show version
git-clone-select --version

# Show help
git-clone-select --help
```

### Environment Variable

You can also set the projects directory using an environment variable:

```bash
export GIT_CLONE_PROJECTS_DIR=~/MyProjects
git-clone-select https://github.com/user/repo.git
```

### Default Paths

- **Windows**: `C:\Users\Username\Projects`
- **macOS**: `~/Developer/Projects` (or `~/Projects`)
- **Linux**: `~/Projects` or `~/Developer/Projects`

Config file location: `~/.config/git-clone-select/config.json`

## Uninstall

```bash
npm uninstall -g git-clone-select
```

## Requirements

- Node.js
- Git
- npm

## License

MIT
