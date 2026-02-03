import type { LibraryDep } from './dependency-extractor';

export interface GeneratedScripts {
  npm?: string;
  pnpm?: string;
  yarn?: string;
  pip?: string;
  poetry?: string;
  cargo?: string;
  go?: string;
  dockerfile?: string;
}

/**
 * Install Script Generator Service
 * Generates installation scripts for multiple package managers and Docker
 */
export class InstallScriptGenerator {
  /**
   * Generate all scripts for the given libraries
   */
  generateAll(libraries: LibraryDep[]): GeneratedScripts {
    return {
      npm: this.generateNpm(libraries),
      pnpm: this.generatePnpm(libraries),
      yarn: this.generateYarn(libraries),
      pip: this.generatePip(libraries),
      poetry: this.generatePoetry(libraries),
      cargo: this.generateCargo(libraries),
      go: this.generateGo(libraries),
    };
  }

  /**
   * Generate Dockerfile for a component
   */
  generateDockerfile(libraries: LibraryDep[], componentName: string): string {
    const hasNpm = libraries.some(l => l.manager === 'npm' || l.manager === 'pnpm' || l.manager === 'yarn');
    const hasPip = libraries.some(l => l.manager === 'pip' || l.manager === 'poetry');
    const hasCargo = libraries.some(l => l.manager === 'cargo');
    const hasGo = libraries.some(l => l.manager === 'go');

    // Determine base image
    let baseImage = 'alpine:latest';
    let packageManager = '';
    let installCmd = '';
    let runCmd = '';

    if (hasNpm) {
      baseImage = 'node:20-alpine';
      packageManager = 'npm';
      installCmd = 'npm ci';
      runCmd = 'node index.js';
    } else if (hasPip) {
      baseImage = 'python:3.12-alpine';
      packageManager = 'pip';
      installCmd = 'pip install -r requirements.txt';
      runCmd = 'python main.py';
    } else if (hasGo) {
      baseImage = 'golang:1.21-alpine';
      packageManager = 'go mod';
      installCmd = 'go mod download';
      runCmd = 'go run .';
    } else if (hasCargo) {
      baseImage = 'rust:1.75-alpine';
      packageManager = 'cargo';
      installCmd = 'cargo build --release';
      runCmd = './target/release/app';
    }

    let dockerfile = `FROM ${baseImage}\n\n`;
    dockerfile += `WORKDIR /app\n\n`;

    // Install dependencies
    if (hasNpm) {
      dockerfile += `# Copy package files\n`;
      dockerfile += `COPY package*.json ./\n\n`;
      dockerfile += `# Install dependencies\n`;
      dockerfile += `RUN ${installCmd}\n\n`;
    }

    if (hasPip) {
      dockerfile += `# Copy Python requirements\n`;
      dockerfile += `COPY requirements.txt ./\n\n`;
      dockerfile += `# Install Python dependencies\n`;
      dockerfile += `RUN ${installCmd}\n\n`;
    }

    if (hasGo) {
      dockerfile += `# Copy go.mod\n`;
      dockerfile += `COPY go.mod go.sum* ./\n\n`;
      dockerfile += `# Download Go dependencies\n`;
      dockerfile += `RUN ${installCmd}\n\n`;
    }

    if (hasCargo) {
      dockerfile += `# Copy Cargo.toml\n`;
      dockerfile += `COPY Cargo.toml Cargo.lock* ./\n\n`;
      dockerfile += `# Build Rust project\n`;
      dockerfile += `RUN ${installCmd}\n\n`;
    }

    // Copy source
    dockerfile += `# Copy source code\n`;
    dockerfile += `COPY . .\n\n`;

    // Set command
    if (runCmd) {
      dockerfile += `CMD ["${runCmd.split(' ')[0]}", "${runCmd.split(' ').slice(1).join(' ')}"]\n`;
    }

    return dockerfile;
  }

  /**
   * Generate npm install script
   * Note: npm automatically skips already-installed packages
   */
  private generateNpm(libraries: LibraryDep[]): string {
    const npmLibs = libraries
      .filter(l => l.manager === 'npm')
      .map(l => {
        const name = this.validatePackageName(l.name, 'npm');
        if (!name) return '';
        const version = this.validateVersion(l.version, 'npm');
        return version ? `${name}@${version}` : name;
      })
      .filter(Boolean);

    if (npmLibs.length === 0) return '';

    return `npm install --silent ${npmLibs.join(' ')}`;
  }

  /**
   * Generate pnpm install script
   * Note: pnpm automatically skips already-installed packages
   */
  private generatePnpm(libraries: LibraryDep[]): string {
    const npmLibs = libraries
      .filter(l => l.manager === 'npm' || l.manager === 'pnpm')
      .map(l => {
        const name = this.validatePackageName(l.name, 'npm');
        if (!name) return '';
        const version = this.validateVersion(l.version, 'npm');
        return version ? `${name}@${version}` : name;
      })
      .filter(Boolean);

    if (npmLibs.length === 0) return '';

    return `pnpm add --silent ${npmLibs.join(' ')}`;
  }

  /**
   * Generate yarn add script
   * Note: yarn automatically skips already-installed packages
   */
  private generateYarn(libraries: LibraryDep[]): string {
    const npmLibs = libraries
      .filter(l => l.manager === 'npm' || l.manager === 'yarn')
      .map(l => {
        const name = this.validatePackageName(l.name, 'npm');
        if (!name) return '';
        const version = this.validateVersion(l.version, 'npm');
        return version ? `${name}@${version}` : name;
      })
      .filter(Boolean);

    if (npmLibs.length === 0) return '';

    return `yarn add --silent ${npmLibs.join(' ')}`;
  }

  /**
   * Generate pip install script
   * Note: pip shows "Requirement already satisfied" for installed packages
   */
  private generatePip(libraries: LibraryDep[]): string {
    const pipLibs = libraries
      .filter(l => l.manager === 'pip')
      .map(l => {
        const name = this.validatePackageName(l.name, 'pip');
        if (!name) return '';
        const version = this.validateVersion(l.version, 'pip');
        return version ? `${name}${version}` : name;
      })
      .filter(Boolean);

    if (pipLibs.length === 0) return '';

    return `pip install --quiet --disable-pip-version-check --no-warn-script-location ${pipLibs.join(' ')}`;
  }

  /**
   * Generate Poetry install script
   * Note: poetry automatically skips already-installed packages
   */
  private generatePoetry(libraries: LibraryDep[]): string {
    const pipLibs = libraries
      .filter(l => l.manager === 'pip' || l.manager === 'poetry')
      .map(l => {
        const name = this.validatePackageName(l.name, 'poetry');
        if (!name) return '';
        const version = this.validateVersion(l.version, 'poetry');
        return version ? `${name}="${version}"` : name;
      })
      .filter(Boolean);

    if (pipLibs.length === 0) return '';

    return `poetry add --quiet ${pipLibs.join(' ')}`;
  }

  /**
   * Generate cargo install script
   * Note: cargo automatically skips already-installed packages
   */
  private generateCargo(libraries: LibraryDep[]): string {
    const cargoLibs = libraries
      .filter(l => l.manager === 'cargo')
      .map(l => {
        const name = this.validatePackageName(l.name, 'cargo');
        if (!name) return '';
        const version = this.validateVersion(l.version, 'cargo');
        return version ? `${name} = "${version}"` : name;
      })
      .filter(Boolean);

    if (cargoLibs.length === 0) return '';

    // For Cargo, we typically add to Cargo.toml
    return `# Add to Cargo.toml:\n[dependencies]\n${cargoLibs.join('\n')}\n\n# Then run:\ncargo build --quiet`;
  }

  /**
   * Generate go mod install script
   * Note: go mod automatically handles already-installed packages
   */
  private generateGo(libraries: LibraryDep[]): string {
    const goLibs = libraries
      .filter(l => l.manager === 'go')
      .map(l => {
        const name = this.validatePackageName(l.name, 'go');
        if (!name) return '';
        const version = this.validateVersion(l.version, 'go');
        return version ? `${name}@${version}` : name;
      })
      .filter(Boolean);

    if (goLibs.length === 0) return '';

    return `go get ${goLibs.join(' ')} && go mod tidy`;
  }

  /**
   * Normalize version format for different package managers
   */
  private normalizeVersion(version: string, manager: string): string {
    if (manager === 'npm') {
      // Convert ^, ~ to npm format (keep as is, npm understands them)
      return version;
    }

    if (manager === 'pip') {
      // Convert npm-style versions to pip format
      return version
        .replace('^', '>=')
        .replace('~', '==')
        .replace('>=', '>=')
        .replace('>', '>')
        .replace('==', '==');
    }

    return version;
  }

  /**
   * Validate and sanitize package name to prevent shell injection
   * Returns empty string if invalid
   */
  private validatePackageName(name: string, manager: LibraryDep['manager']): string {
    if (!name || typeof name !== 'string') return '';

    // Remove any shell metacharacters and whitespace
    const sanitized = name.trim().replace(/[;&|`$()<>]/g, '');

    // Validate based on package manager rules
    const patterns: Record<LibraryDep['manager'], RegExp> = {
      npm: /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i,
      pnpm: /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i,
      yarn: /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i,
      pip: /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/i,
      poetry: /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/i,
      cargo: /^[a-z0-9_]+$/i,
      go: /^[a-z0-9._/-]+$/i,
      composer: /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?(\/[a-z0-9]([a-z0-9._-]*[a-z0-9])?)*$/i,
      gem: /^[a-z0-9]([a-z0-9_]*[a-z0-9])?$/i,
    };

    const pattern = patterns[manager];
    if (pattern && pattern.test(sanitized)) {
      return sanitized;
    }

    console.warn(`Invalid package name for ${manager}: ${name}`);
    return '';
  }

  /**
   * Validate and sanitize version string
   * Returns empty string if invalid
   */
  private validateVersion(version: string | undefined, manager: LibraryDep['manager']): string {
    if (!version || typeof version !== 'string') return '';

    // Remove shell metacharacters
    const sanitized = version.trim().replace(/[;&|`$()<>]/g, '');

    // Allow common version formats: semver, python version ranges, etc.
    // This is a permissive check - we let the package manager do final validation
    const allowedPattern = /^[\d.^~>=<!,:@\s"\'-]+$/;

    if (allowedPattern.test(sanitized)) {
      return sanitized;
    }

    console.warn(`Invalid version for ${manager}: ${version}`);
    return '';
  }

  /**
   * Sanitize shell argument by escaping special characters
   */
  private sanitizeShellArg(arg: string): string {
    // Replace single quotes with '\'' and wrap in single quotes
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }

  /**
   * Generate composite install script for multi-language projects
   */
  generateComposite(libraries: LibraryDep[]): string {
    const scripts: string[] = [];

    const npmScript = this.generateNpm(libraries);
    if (npmScript) scripts.push(`  ${npmScript}`);

    const pipScript = this.generatePip(libraries);
    if (pipScript) scripts.push(`  ${pipScript}`);

    const goScript = this.generateGo(libraries);
    if (goScript) scripts.push(`  ${goScript}`);

    if (scripts.length === 0) return '';

    return `#!/bin/bash\nset -e\n\n# Install dependencies\n${scripts.join('\n')}`;
  }
}

export const installScriptGenerator = new InstallScriptGenerator();
