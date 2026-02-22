#!/usr/bin/env node

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const inquirer = require('inquirer');
const chalk = require('chalk');
const readline = require('readline');

// Configuration management
function getConfigPath() {
  const homeDir = os.homedir();
  const configDir = path.join(homeDir, '.config', 'git-clone');
  const configFile = path.join(configDir, 'config.json');
  return { configDir, configFile };
}

function getDefaultProjectsDir() {
  const homeDir = os.homedir();
  // Platform-specific defaults
  if (process.platform === 'win32') {
    return path.join(homeDir, 'Projects');
  }
  // macOS/Linux: Try Developer/Projects first, fallback to Projects
  const developerProjects = path.join(homeDir, 'Developer', 'Projects');
  if (fs.existsSync(path.join(homeDir, 'Developer'))) {
    return developerProjects;
  }
  return path.join(homeDir, 'Projects');
}

function loadConfig() {
  // Check environment variable first
  if (process.env.GIT_CLONE_PROJECTS_DIR) {
    return process.env.GIT_CLONE_PROJECTS_DIR;
  }
  
  const { configFile } = getConfigPath();
  
  if (fs.existsSync(configFile)) {
    try {
      const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      if (config.projectsDir) {
        return config.projectsDir;
      }
    } catch (err) {
      log(`Warning: Could not read config file: ${err.message}`, 'warning');
      return null;
    }
  }
  
  return null; // No config found, needs setup
}

function saveConfig(projectsDir) {
  const { configDir, configFile } = getConfigPath();
  
  try {
    // Create config directory if it doesn't exist
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    const config = {
      projectsDir: projectsDir,
      createdAt: new Date().toISOString(),
    };
    
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (err) {
    log(`Error saving config: ${err.message}`, 'error');
    return false;
  }
}

async function setupConfig() {
  const defaultDir = getDefaultProjectsDir();
  
  log('\nWelcome to git-clone!', 'info');
  log('Let\'s set up your projects directory.', 'info');
  
  const { projectsDir } = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectsDir',
      message: 'Where would you like to store your cloned repositories?',
      default: defaultDir,
      validate: (input) => {
        if (!input || input.trim() === '') {
          return 'Projects directory cannot be empty';
        }
        
        const resolved = path.resolve(input.trim());
        const homeDir = os.homedir();
        
        // Security: ensure it's within user's home directory
        if (!resolved.startsWith(homeDir)) {
          return 'Projects directory must be within your home directory';
        }
        
        return true;
      },
    },
  ]);
  
  const resolvedDir = path.resolve(projectsDir.trim());
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(resolvedDir)) {
    const { create } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'create',
        message: `Directory "${resolvedDir}" doesn't exist. Create it?`,
        default: true,
      },
    ]);
    
    if (create) {
      try {
        fs.mkdirSync(resolvedDir, { recursive: true });
        success(`Created directory: ${resolvedDir}`);
      } catch (err) {
        error(`Failed to create directory: ${err.message}`);
      }
    } else {
      error('Cannot proceed without a valid projects directory.');
    }
  }
  
  if (saveConfig(resolvedDir)) {
    success(`Configuration saved! Projects directory: ${resolvedDir}`);
    return resolvedDir;
  } else {
    error('Failed to save configuration.');
  }
}

function getProjectsDir() {
  return loadConfig();
}

// Ensure the script has execute permissions
process.on('exit', () => {
  const scriptPath = __filename;
  try {
    fs.chmodSync(scriptPath, '755');
  } catch (err) {
    // Ignore chmod errors
  }
});

function log(message, type = 'info') {
  const colors = {
    info: chalk.blue,
    success: chalk.green,
    error: chalk.red,
    warning: chalk.yellow,
  };
  console.log(colors[type](message));
}

function error(message) {
  log(message, 'error');
  process.exit(1);
}

function success(message) {
  log(message, 'success');
}

function getExistingFolders(projectsDir) {
  try {
    if (!fs.existsSync(projectsDir)) {
      fs.mkdirSync(projectsDir, { recursive: true });
      return [];
    }
    
    const items = fs.readdirSync(projectsDir, { withFileTypes: true });
    return items
      .filter(item => item.isDirectory())
      .map(item => item.name)
      .filter(name => !name.startsWith('.'))
      .sort();
  } catch (err) {
    log(`Warning: Could not read projects directory: ${err.message}`, 'warning');
    return [];
  }
}

function validateGitUrl(url) {
  // Basic validation for git URLs
  const patterns = [
    /^https?:\/\/.*\.git$/,
    /^git@.*:.*\.git$/,
    /^https?:\/\/github\.com\/[\w\-\.]+\/[\w\-\.]+/,
    /^https?:\/\/gitlab\.com\/[\w\-\.]+\/[\w\-\.]+/,
    /^https?:\/\/bitbucket\.org\/[\w\-\.]+\/[\w\-\.]+/,
  ];
  
  return patterns.some(pattern => pattern.test(url));
}

function extractRepoName(url) {
  // Extract repository name from URL
  const match = url.match(/\/([^\/]+?)(?:\.git)?\/?$/);
  return match ? match[1] : null;
}

function checkGitInstalled() {
  try {
    execSync('git --version', { stdio: 'ignore' });
    return true;
  } catch (err) {
    return false;
  }
}

function validatePathWithinProjectsDir(targetPath, projectsDir) {
  // Normalize and resolve to absolute path
  const resolved = path.resolve(targetPath);
  const projectsResolved = path.resolve(projectsDir);
  
  // Normalize paths for comparison (handle trailing slashes)
  const normalizedTarget = resolved + path.sep;
  const normalizedProjects = projectsResolved + path.sep;
  
  // Check if resolved path is within projects directory
  if (!normalizedTarget.startsWith(normalizedProjects) && resolved !== projectsResolved) {
    return false;
  }
  
  return resolved;
}

function cloneRepository(url, targetDir, projectsDir) {
  try {
    // Ensure parent directory exists
    const parentDir = path.dirname(targetDir);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    
    log(`Cloning ${url}...`, 'info');
    
    // Use spawnSync with array arguments to prevent command injection
    const result = spawnSync('git', ['clone', url, targetDir], {
      stdio: 'inherit',
      cwd: projectsDir,
    });
    
    if (result.error) {
      throw result.error;
    }
    
    if (result.status !== 0) {
      throw new Error(`Git clone failed with exit code ${result.status}`);
    }
    
    success(`\n✓ Successfully cloned to ${targetDir}`);
    return targetDir; // Return targetDir on success
  } catch (err) {
    error(`\n✗ Failed to clone repository: ${err.message}`);
    return null; // Return null on failure
  }
}

async function openInCursor(targetDir) {
  try {
    // Try to open with cursor command
    spawnSync('cursor', [targetDir], {
      stdio: 'ignore',
      detached: true,
    });
    success('Opening in Cursor...');
  } catch (err) {
    // If cursor command fails, try alternative methods
    try {
      // Try with 'code' command (VS Code, sometimes works for Cursor)
      spawnSync('code', [targetDir], {
        stdio: 'ignore',
        detached: true,
      });
      success('Opening in editor...');
    } catch (err2) {
      log('Could not open in Cursor automatically. Please open manually.', 'warning');
    }
  }
}

function promptOpenInCursor(targetDir) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Extract just the project folder name instead of full path
    const projectName = path.basename(targetDir);
    process.stdout.write(`Open "${projectName}" in Cursor? (Press Enter to open, Q to skip): `);

    // Set raw mode to capture single keypresses
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    const onKeypress = (str, key) => {
      if (key && key.ctrl && key.name === 'c') {
        process.exit(0);
      }

      const input = str.toLowerCase();
      
      if (input === 'y' || input === '\r' || input === '\n' || key.name === 'return') {
        // Yes - open in Cursor
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        rl.close();
        process.stdout.write('\n');
        resolve(true);
      } else if (input === 'n' || input === 'q') {
        // No - skip
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        rl.close();
        process.stdout.write('\n');
        resolve(false);
      }
    };

    process.stdin.once('keypress', onKeypress);
  });
}

function showConfig() {
  const projectsDir = getProjectsDir();
  const { configFile } = getConfigPath();
  
  if (projectsDir) {
    log('\nCurrent Configuration:', 'info');
    log(`Projects Directory: ${projectsDir}`, 'success');
    log(`Config File: ${configFile}`, 'info');
    
    if (process.env.GIT_CLONE_PROJECTS_DIR) {
      log('Note: Using GIT_CLONE_PROJECTS_DIR environment variable', 'warning');
    }
  } else {
    log('No configuration found. Run git-clone to set up.', 'warning');
  }
}

async function setConfig(newPath) {
  const resolved = path.resolve(newPath);
  const homeDir = os.homedir();
  
  // Validate path
  if (!resolved.startsWith(homeDir)) {
    error('Projects directory must be within your home directory');
  }
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(resolved)) {
    const { create } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'create',
        message: `Directory "${resolved}" doesn't exist. Create it?`,
        default: true,
      },
    ]);
    
    if (create) {
      try {
        fs.mkdirSync(resolved, { recursive: true });
        success(`Created directory: ${resolved}`);
      } catch (err) {
        error(`Failed to create directory: ${err.message}`);
      }
    } else {
      error('Cannot proceed without a valid projects directory.');
    }
  }
  
  if (saveConfig(resolved)) {
    success(`Configuration updated! Projects directory: ${resolved}`);
  } else {
    error('Failed to save configuration.');
  }
}

function showVersion() {
  try {
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    log(`git-clone v${packageJson.version}`, 'info');
  } catch (err) {
    log('git-clone (version unknown)', 'info');
  }
}

function showHelp() {
  log('\nUsage: git-clone [options] <git-url>', 'info');
  log('\nOptions:', 'info');
  log('  -c, --config              Show current configuration', 'info');
  log('  --set-config <path>       Set projects directory', 'info');
  log('  --reset-config            Reset configuration and run setup', 'info');
  log('  -v, --version             Show version number', 'info');
  log('  -h, --help                Show this help message', 'info');
  log('\nExamples:', 'info');
  log('  git-clone https://github.com/user/repo.git', 'info');
  log('  git-clone --config', 'info');
  log('  git-clone --set-config ~/MyProjects', 'info');
}

async function main() {
  // Parse command-line arguments
  const args = process.argv.slice(2);
  
  // Handle config commands
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    process.exit(0);
  }
  
  if (args[0] === '--version' || args[0] === '-v') {
    showVersion();
    process.exit(0);
  }
  
  if (args[0] === '--config' || args[0] === '-c') {
    showConfig();
    process.exit(0);
  }
  
  if (args[0] === '--set-config') {
    if (!args[1]) {
      error('Usage: git-clone --set-config <path>');
    }
    await setConfig(args[1]);
    process.exit(0);
  }
  
  if (args[0] === '--reset-config') {
    const { configFile } = getConfigPath();
    if (fs.existsSync(configFile)) {
      try {
        fs.unlinkSync(configFile);
        success('Configuration reset.');
      } catch (err) {
        error(`Failed to reset config: ${err.message}`);
      }
    }
    log('Run git-clone to set up configuration.', 'info');
    process.exit(0);
  }
  
  // Check if git is installed
  if (!checkGitInstalled()) {
    error('Git is not installed or not found in PATH. Please install Git first.');
  }

  // Load or setup configuration
  let PROJECTS_DIR = getProjectsDir();
  
  if (!PROJECTS_DIR) {
    PROJECTS_DIR = await setupConfig();
  }
  
  // Validate projects directory exists
  if (!fs.existsSync(PROJECTS_DIR)) {
    const { create } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'create',
        message: `Projects directory "${PROJECTS_DIR}" doesn't exist. Create it?`,
        default: true,
      },
    ]);
    
    if (create) {
      try {
        fs.mkdirSync(PROJECTS_DIR, { recursive: true });
        success(`Created directory: ${PROJECTS_DIR}`);
      } catch (err) {
        error(`Failed to create directory: ${err.message}`);
      }
    } else {
      error('Cannot proceed without a valid projects directory.');
    }
  }

  // Get git URL from command line arguments
  const gitUrl = args[0];

  if (!gitUrl) {
    error('Usage: git-clone <git-url>\nExample: git-clone https://github.com/user/repo.git');
  }

  if (!validateGitUrl(gitUrl)) {
    log(`Warning: "${gitUrl}" doesn't look like a valid git URL`, 'warning');
    const { proceed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: 'Do you want to proceed anyway?',
        default: false,
      },
    ]);
    if (!proceed) {
      process.exit(0);
    }
  }

  // Get existing folders
  const existingFolders = getExistingFolders(PROJECTS_DIR);
  const defaultRepoName = extractRepoName(gitUrl) || 'repository';

  // Determine target folder
  let targetFolder;
  let isExistingFolder = false;
  
  if (existingFolders.length === 0) {
    // No existing folders, just ask for folder name
    const { folderName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'folderName',
        message: 'Enter folder name for the cloned repository:',
        default: defaultRepoName,
        validate: (input) => {
          if (!input || input.trim() === '') {
            return 'Folder name cannot be empty';
          }
          if (input.includes('/') || input.includes('\\')) {
            return 'Folder name cannot contain slashes';
          }
          return true;
        },
      },
    ]);
    targetFolder = folderName.trim();
  } else {
    // Ask if user wants to use existing folder or create new one
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Choose an option:',
        choices: [
          { name: 'Create a new folder', value: 'new' },
          { name: 'Use an existing folder', value: 'existing' },
        ],
      },
    ]);

    if (action === 'existing') {
      const { folderName } = await inquirer.prompt([
        {
          type: 'list',
          name: 'folderName',
          message: 'Select an existing folder:',
          choices: existingFolders,
        },
      ]);
      targetFolder = folderName;
      isExistingFolder = true;
    } else {
      // Ask where to create the new folder
      const { parentLocation } = await inquirer.prompt([
        {
          type: 'list',
          name: 'parentLocation',
          message: 'Where would you like to create the new folder?',
          choices: [
            { name: '📁 Projects root directory', value: 'root' },
            ...existingFolders.map(folder => ({ 
              name: `📂 ${folder}/`, 
              value: folder,
              short: `Inside ${folder}`
            })),
          ],
        },
      ]);

      // Ask for the folder name
      const { folderName } = await inquirer.prompt([
        {
          type: 'input',
          name: 'folderName',
          message: 'Enter folder name for the cloned repository:',
          default: defaultRepoName,
          validate: (input) => {
            if (!input || input.trim() === '') {
              return 'Folder name cannot be empty';
            }
            if (input.includes('/') || input.includes('\\')) {
              return 'Folder name cannot contain slashes';
            }
            
            // Check if folder already exists in the chosen location
            let checkPath;
            if (parentLocation === 'root') {
              checkPath = path.join(PROJECTS_DIR, input.trim());
            } else {
              checkPath = path.join(PROJECTS_DIR, parentLocation, input.trim());
            }
            
            if (fs.existsSync(checkPath)) {
              const locationText = parentLocation === 'root' ? 'Projects root' : `"${parentLocation}"`;
              return `Folder "${input.trim()}" already exists in ${locationText}. Choose a different name.`;
            }
            
            return true;
          },
        },
      ]);
      
      if (parentLocation === 'root') {
        targetFolder = folderName.trim();
      } else {
        // Store parent folder and new folder name separately
        targetFolder = path.join(parentLocation, folderName.trim());
        isExistingFolder = true; // Treat as nested folder
      }
    }
  }

  // Determine target directory based on the scenario
  let targetDir;
  
  if (isExistingFolder) {
    // Check if targetFolder contains a path separator (nested new folder)
    if (targetFolder.includes(path.sep)) {
      // Creating a new folder inside an existing folder
      // targetFolder format: "parent/newfolder"
      targetDir = path.join(PROJECTS_DIR, targetFolder);
      
      // Check if folder already exists and has content
      if (fs.existsSync(targetDir)) {
        const contents = fs.readdirSync(targetDir);
        if (contents.length > 0) {
          const { overwrite } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'overwrite',
              message: `Folder "${targetFolder}" already exists and is not empty. Continue anyway?`,
              default: false,
            },
          ]);
          if (!overwrite) {
            log('Operation cancelled.', 'info');
            process.exit(0);
          }
        }
      }
    } else {
      // Using an existing folder - clone repo into a subfolder with repo name
      const parentDir = path.join(PROJECTS_DIR, targetFolder);
      const repoSubfolder = path.join(parentDir, defaultRepoName);
      
      // Check if the subfolder already exists
      if (fs.existsSync(repoSubfolder)) {
        const contents = fs.readdirSync(repoSubfolder);
        if (contents.length > 0) {
          const { overwrite } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'overwrite',
              message: `Repository folder "${defaultRepoName}" already exists in "${targetFolder}". Continue anyway?`,
              default: false,
            },
          ]);
          if (!overwrite) {
            log('Operation cancelled.', 'info');
            process.exit(0);
          }
        }
      }
      targetDir = repoSubfolder;
    }
  } else {
    // Create new folder in root - clone directly into it
    targetDir = path.join(PROJECTS_DIR, targetFolder);
    
    // Check if folder already exists and has content
    if (fs.existsSync(targetDir)) {
      const contents = fs.readdirSync(targetDir);
      if (contents.length > 0) {
        const { overwrite } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'overwrite',
            message: `Folder "${targetFolder}" already exists and is not empty. Continue anyway?`,
            default: false,
          },
        ]);
        if (!overwrite) {
          log('Operation cancelled.', 'info');
          process.exit(0);
        }
      }
    }
  }

  // Validate path is within PROJECTS_DIR (path traversal protection)
  const validatedPath = validatePathWithinProjectsDir(targetDir, PROJECTS_DIR);
  if (!validatedPath) {
    error('Invalid path: target directory is outside Projects folder. This is not allowed.');
  }
  targetDir = validatedPath;

  // Final check if folder already exists and has content (race condition protection)
  if (fs.existsSync(targetDir)) {
    const contents = fs.readdirSync(targetDir);
    if (contents.length > 0) {
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: `Folder "${path.relative(PROJECTS_DIR, targetDir)}" already exists and is not empty. Continue anyway?`,
          default: false,
        },
      ]);
      if (!overwrite) {
        log('Operation cancelled.', 'info');
        process.exit(0);
      }
    }
  }

  // Clone the repository
  const clonedPath = cloneRepository(gitUrl, targetDir, PROJECTS_DIR);
  
  // If clone was successful, ask if user wants to open in Cursor
  if (clonedPath) {
    const shouldOpen = await promptOpenInCursor(clonedPath);
    
    if (shouldOpen) {
      await openInCursor(clonedPath);
    } else {
      const projectName = path.basename(clonedPath);
      log(`You can open it later with: cursor "${clonedPath}"`, 'info');
    }
  }
}

// Run the main function
main().catch((err) => {
  error(`Unexpected error: ${err.message}`);
});
