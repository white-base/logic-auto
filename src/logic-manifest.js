import { access, readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const esmRequire = createRequire(import.meta.url);

const KIND_VALUES = new Set(['module', 'bundle']);
const LAYER_VALUES = new Set(['ui', 'db']);
const DB_TYPE_VALUES = new Set(['core', 'addon', 'global']);
const SEMVER_REGEX = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

export class LogicManifestError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'LogicManifestError';
    this.code = options.code ?? 'LOGIC_MANIFEST_ERROR';
    if (options.meta) {
      this.meta = options.meta;
    }
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

export class PropertyCollection extends Map {
  constructor(entries = []) {
    super(entries);
  }

  toJSON() {
    const json = {};
    for (const [key, manifest] of this.entries()) {
      json[key] = typeof manifest?.toJSON === 'function' ? manifest.toJSON() : manifest;
    }
    return json;
  }
}

export class LogicManifest {
  constructor(definition = {}, context = {}) {
    if (!definition || typeof definition !== 'object') {
      throw new LogicManifestError('Manifest definition must be an object.');
    }

    this.packageName = definition.packageName ?? null;
    this.version = definition.version ?? null;
    this.category = definition.category ?? null;
    this.kind = definition.kind ?? null;
    this.layer = definition.layer ?? null;
    this.dbType = definition.dbType ?? null;
    this.tags = normalizeStringArray(definition.tags);
    this.contracts = normalizeContracts(definition.contracts);
    this.businessDomain = definition.businessDomain ?? null;
    this.platform = definition.platform ?? null;
    this.structure = definition.structure ?? null;
    this.implementation = definition.implementation ?? null;
    this.renderMode = definition.renderMode ?? null;
    this.family = definition.family ?? null;
    this.theme = definition.theme ?? null;
    this.entry = definition.entry ?? this.implementation ?? this.structure ?? this.platform ?? null;
    this._uiDepSpecs = normalizeDependencyMap(definition.uiDeps);

    this._definition = definition;
    this._context = freezeContext(context);
    this._validationErrors = [];
    this._entryCache = null;
    this._moduleCache = null;
    this._packageJsonCache = undefined;
    this._packageJsonError = null;
    this._packageJsonPath = path.join(this.baseDir, 'package.json');

    this.uiDepsMap = this._buildDependencyCollection(this._uiDepSpecs, 'ui');
    this.dbDepsMap = this._buildChildCollection(definition.dbDepsMap, 'db');
  }

  get baseDir() {
    return this._context.baseDir;
  }

  get manifestPath() {
    return this._context.manifestPath;
  }

  get parent() {
    return this._context.parent;
  }

  findManifest(packageName) {
    if (!packageName) {
      return null;
    }
    if (this.packageName === packageName) {
      return this;
    }
    for (const child of this._iterateChildren()) {
      const found = child.findManifest(packageName);
      if (found) {
        return found;
      }
    }
    return null;
  }

  async getExports(packageName = this.packageName) {
    const target = this.findManifest(packageName);
    if (!target) {
      throw new LogicManifestError(`Unknown manifest: ${packageName}`, {
        code: 'MANIFEST_NOT_FOUND',
      });
    }
    return target._loadModule();
  }

  async validate() {
    this._validationErrors = this._collectValidationErrors();
    for (const child of this._iterateChildren()) {
      await child.validate();
      const childErrors = child.getValidationErrors();
      if (childErrors.length) {
        this._validationErrors.push(
          ...childErrors.map((msg) => `${child.packageName ?? '<anonymous>'}: ${msg}`),
        );
      }
    }
    return this._validationErrors.length === 0;
  }

  getValidationErrors() {
    return [...this._validationErrors];
  }

  toJSON() {
    return {
      packageName: this.packageName,
      version: this.version,
      category: this.category,
      kind: this.kind,
      layer: this.layer,
      dbType: this.dbType,
      tags: [...this.tags],
      contracts: {
        expects: this.contracts.expects.map((c) => ({ ...c })),
        provides: this.contracts.provides.map((c) => ({ ...c })),
      },
      businessDomain: this.businessDomain,
      platform: this.platform,
      structure: this.structure,
      implementation: this.implementation,
      renderMode: this.renderMode,
      family: this.family,
      theme: this.theme,
      uiDepsMap: this.uiDepsMap.toJSON(),
      dbDepsMap: this.dbDepsMap.toJSON(),
    };
  }

  _collectValidationErrors() {
    const errors = [];
    const label = this.packageName ?? '<unknown>';
    if (!this.packageName) {
      errors.push('packageName is required');
    }
    if (!this.version) {
      errors.push(`${label}: version is required`);
    } else if (!SEMVER_REGEX.test(this.version)) {
      errors.push(`${label}: version is not a valid semver string`);
    } else if (this._context.requestedVersion && this.version !== this._context.requestedVersion) {
      errors.push(
        `${label}: version ${this.version} does not match requested ${this._context.requestedVersion}`,
      );
    }
    if (!this.kind || !KIND_VALUES.has(this.kind)) {
      errors.push(`${label}: kind must be one of ${Array.from(KIND_VALUES).join(', ')}`);
    }
    if (!this.layer || !LAYER_VALUES.has(this.layer)) {
      errors.push(`${label}: layer must be one of ${Array.from(LAYER_VALUES).join(', ')}`);
    }
    if (this.layer === 'db' && this.kind === 'module' && !this.dbType) {
      errors.push(`${label}: dbType is required for database modules`);
    }
    if (this.dbType && !DB_TYPE_VALUES.has(this.dbType)) {
      errors.push(`${label}: dbType must be one of ${Array.from(DB_TYPE_VALUES).join(', ')}`);
    }
    if (this.layer === 'ui' && this.kind === 'module' && !this.entry) {
      errors.push(`${label}: UI modules must declare an implementation entry`);
    }
    return errors;
  }

  _buildDependencyCollection(collection, type) {
    if (!collection || typeof collection !== 'object' || Object.keys(collection).length === 0) {
      return new PropertyCollection();
    }
    const entries = [];
    for (const [packageName, requestedVersion] of Object.entries(collection)) {
      const childManifest = this._instantiateDependencyManifest(packageName, requestedVersion, type);
      entries.push([packageName, childManifest]);
    }
    return new PropertyCollection(entries);
  }

  _instantiateDependencyManifest(packageName, requestedVersion, type) {
    const packageRoot = this._resolvePackageRoot(packageName);
    const manifestPath = path.join(packageRoot, 'logic.json');
    let definition;
    try {
      const contents = readFileSync(manifestPath, 'utf8');
      definition = JSON.parse(contents);
    } catch (error) {
      throw new LogicManifestError(
        `Failed to load dependency manifest for ${packageName} at ${manifestPath}`,
        {
          code: 'DEPENDENCY_MANIFEST_NOT_FOUND',
          cause: error,
        },
      );
    }
    const childContext = {
      baseDir: packageRoot,
      manifestPath,
      parent: this,
      lineage: [...this._context.lineage, { type, key: packageName }],
      requestedVersion: requestedVersion ?? null,
    };
    return new LogicManifest(definition, childContext);
  }

  _resolvePackageRoot(packageName) {
    const spec = this._getPackageDependencySpec(packageName);
    if (typeof spec === 'string') {
      if (isFileReference(spec)) {
        return path.resolve(this.baseDir, stripFileProtocol(spec));
      }
      if (spec.startsWith('.') || spec.startsWith('/')) {
        return path.resolve(this.baseDir, spec);
      }
    }

    try {
      const packageJsonPath = esmRequire.resolve(`${packageName}/package.json`, {
        paths: [this.baseDir],
      });
      return path.dirname(packageJsonPath);
    } catch (error) {
      throw new LogicManifestError(`Cannot resolve dependency ${packageName}`, {
        code: 'DEPENDENCY_RESOLVE_FAILED',
        cause: error,
      });
    }
  }

  _getPackageDependencySpec(packageName) {
    const pkgJson = this._readPackageJson();
    if (!pkgJson) {
      return null;
    }
    const sources = [
      pkgJson.dependencies,
      pkgJson.devDependencies,
      pkgJson.optionalDependencies,
      pkgJson.peerDependencies,
    ];
    for (const source of sources) {
      if (source && Object.prototype.hasOwnProperty.call(source, packageName)) {
        return source[packageName];
      }
    }
    return null;
  }

  _readPackageJson() {
    if (this._packageJsonCache !== undefined) {
      return this._packageJsonCache;
    }
    try {
      const contents = readFileSync(this._packageJsonPath, 'utf8');
      this._packageJsonCache = JSON.parse(contents);
    } catch (error) {
      this._packageJsonCache = null;
      this._packageJsonError = error;
    }
    return this._packageJsonCache;
  }

  _buildChildCollection(collection, type) {
    if (!collection || typeof collection !== 'object') {
      return new PropertyCollection();
    }
    const entries = Object.entries(collection)
      .filter(([, value]) => value)
      .map(([key, value]) => {
        const childContext = {
          ...this._context,
          parent: this,
          lineage: [...this._context.lineage, { type, key }],
        };
        return [key, new LogicManifest(value, childContext)];
      });
    return new PropertyCollection(entries);
  }

  _iterateChildren() {
    return [...this.uiDepsMap.values(), ...this.dbDepsMap.values()];
  }

  async _loadModule() {
    if (!this.entry) {
      throw new LogicManifestError(`No loadable entry declared for ${this.packageName}`, {
        code: 'ENTRY_NOT_DECLARED',
      });
    }
    if (!this._moduleCache) {
      const entryPath = await this._loadEntry();
      const moduleUrl = pathToFileURL(entryPath).href;
      this._moduleCache = import(moduleUrl);
    }
    return this._moduleCache;
  }

  async _loadEntry() {
    if (this._entryCache) {
      return this._entryCache;
    }
    const absolutePath = path.isAbsolute(this.entry)
      ? this.entry
      : path.join(this.baseDir, this.entry);
    try {
      await access(absolutePath);
    } catch (error) {
      throw new LogicManifestError(
        `Unable to resolve manifest implementation for ${this.packageName} at ${absolutePath}`,
        {
          code: 'ENTRY_NOT_FOUND',
          cause: error,
        },
      );
    }
    this._entryCache = absolutePath;
    return absolutePath;
  }
}

export class ManifestLoader {
  constructor(options = {}) {
    this.cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
    this.filename = options.filename ?? 'logic.json';
    this.manifestPath = options.manifestPath
      ? path.resolve(options.manifestPath)
      : path.join(this.cwd, this.filename);
    this._cache = null;
  }

  async load(forceReload = false) {
    if (!forceReload && this._cache) {
      return this._cache;
    }
    const definition = await this._readDefinition();
    const baseDir = path.dirname(this.manifestPath);
    this._cache = new LogicManifest(definition, {
      baseDir,
      manifestPath: this.manifestPath,
      lineage: [],
      parent: null,
    });
    return this._cache;
  }

  clearCache() {
    this._cache = null;
  }

  async reload() {
    this.clearCache();
    return this.load(true);
  }

  async _readDefinition() {
    const contents = await readFile(this.manifestPath, 'utf8');
    return JSON.parse(contents);
  }
}

let sharedLoader = null;

export async function loadManifest(options = {}) {
  const { forceReload = false, ...loaderOptions } = options;
  const hasCustomOptions = Object.keys(loaderOptions).length > 0;

  if (hasCustomOptions) {
    const loader = new ManifestLoader(loaderOptions);
    return loader.load(forceReload);
  }

  if (!sharedLoader) {
    sharedLoader = new ManifestLoader();
  }

  if (forceReload) {
    return sharedLoader.load(true);
  }

  return sharedLoader.load(false);
}

function freezeContext(context = {}) {
  const baseDir = context.baseDir ? path.resolve(context.baseDir) : process.cwd();
  const manifestPath = context.manifestPath
    ? path.resolve(context.manifestPath)
    : path.join(baseDir, 'logic.json');
  const lineage = Array.isArray(context.lineage) ? [...context.lineage] : [];
  return Object.freeze({
    baseDir,
    manifestPath,
    lineage,
    parent: context.parent ?? null,
    requestedVersion: context.requestedVersion ?? null,
  });
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item) => typeof item === 'string').map((item) => item.trim());
}

function normalizeContracts(contracts = {}) {
  const expects = Array.isArray(contracts.expects)
    ? contracts.expects.map(normalizeContract)
    : [];
  const provides = Array.isArray(contracts.provides)
    ? contracts.provides.map(normalizeContract)
    : [];
  return { expects, provides };
}

function normalizeContract(contract = {}) {
  return {
    key: contract.key ?? '',
    channel: contract.channel ?? '',
    description: contract.description ?? '',
  };
}

function normalizeDependencyMap(value) {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return Object.entries(value).reduce((acc, [packageName, version]) => {
    if (typeof packageName === 'string' && typeof version === 'string' && packageName.length) {
      acc[packageName] = version;
    }
    return acc;
  }, {});
}

function isFileReference(spec = '') {
  return typeof spec === 'string' && (spec.startsWith('file:') || spec.startsWith('link:'));
}

function stripFileProtocol(spec = '') {
  if (spec.startsWith('file:') || spec.startsWith('link:')) {
    return spec.replace(/^(file:|link:)/, '');
  }
  return spec;
}
