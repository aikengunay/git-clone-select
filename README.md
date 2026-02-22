# git-clone

A CLI tool for cloning git repositories into organized project folders with interactive directory selection.

## Install

```bash
git clone <repository-url>
cd git-clone
npm install -g .
```

The `-g` flag installs the package globally, making `git-clone` available from any directory in your terminal.

## Usage

```bash
git-clone <git-url>
```

Run `git-clone` from any directory. On first run, you'll be prompted to set up your projects directory. The tool will then prompt you to select or create a destination folder.

**Examples:**

```bash
git-clone https://github.com/user/repo.git
git-clone git@github.com:user/repo.git
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

On first run, `git-clone` will prompt you to set up your projects directory. You can choose any location within your home directory.

### Config Commands

```bash
# Show current configuration
git-clone --config

# Set projects directory
git-clone --set-config ~/MyProjects

# Reset configuration
git-clone --reset-config

# Show version
git-clone --version

# Show help
git-clone --help
```

### Environment Variable

You can also set the projects directory using an environment variable:

```bash
export GIT_CLONE_PROJECTS_DIR=~/MyProjects
git-clone https://github.com/user/repo.git
```

### Default Paths

- **Windows**: `C:\Users\Username\Projects`
- **macOS**: `~/Developer/Projects` (or `~/Projects`)
- **Linux**: `~/Projects` or `~/Developer/Projects`

Config file location: `~/.config/git-clone/config.json`

## Uninstall

```bash
npm uninstall -g git-clone
```

## Requirements

- Node.js
- Git
- npm

## License

MIT
