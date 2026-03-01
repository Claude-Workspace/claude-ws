/**
 * Lightweight CLI argument parser.
 * Zero dependencies - Node.js built-ins only.
 *
 * Supports:
 *   --port 3000, --port=3000
 *   --no-open (boolean negation)
 *   -f (short flags)
 *   -n 50 (short flags with values)
 */

/**
 * @param {string[]} argv - process.argv.slice(N) after subcommand
 * @param {{ flags: Record<string, { type: 'string'|'boolean', alias?: string, default?: any }> }} schema
 * @returns {{ flags: Record<string, any>, args: string[] }}
 */
function parse(argv, schema) {
  const flags = {};
  const args = [];
  const defs = schema.flags || {};

  // Set defaults
  for (const [key, def] of Object.entries(defs)) {
    if (def.default !== undefined) {
      flags[key] = def.default;
    } else {
      flags[key] = def.type === 'boolean' ? false : undefined;
    }
  }

  // Build alias map: alias -> canonical name
  const aliasMap = {};
  for (const [key, def] of Object.entries(defs)) {
    if (def.alias) {
      aliasMap[def.alias] = key;
    }
  }

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg === '--') {
      args.push(...argv.slice(i + 1));
      break;
    }

    // --no-<flag> boolean negation
    if (arg.startsWith('--no-')) {
      const name = arg.slice(5);
      if (defs[name] && defs[name].type === 'boolean') {
        flags[name] = false;
        i++;
        continue;
      }
    }

    // --flag=value
    if (arg.startsWith('--') && arg.includes('=')) {
      const eqIdx = arg.indexOf('=');
      const name = arg.slice(2, eqIdx);
      const value = arg.slice(eqIdx + 1);
      if (defs[name]) {
        flags[name] = defs[name].type === 'boolean' ? value !== 'false' : value;
      }
      i++;
      continue;
    }

    // --flag [value]
    if (arg.startsWith('--')) {
      const name = arg.slice(2);
      if (defs[name]) {
        if (defs[name].type === 'boolean') {
          flags[name] = true;
          i++;
        } else {
          flags[name] = argv[i + 1];
          i += 2;
        }
        continue;
      }
    }

    // -f or -f value (short alias)
    if (arg.startsWith('-') && !arg.startsWith('--') && arg.length === 2) {
      const alias = arg.slice(1);
      const canonical = aliasMap[alias];
      if (canonical && defs[canonical]) {
        if (defs[canonical].type === 'boolean') {
          flags[canonical] = true;
          i++;
        } else {
          flags[canonical] = argv[i + 1];
          i += 2;
        }
        continue;
      }
    }

    // Positional argument
    args.push(arg);
    i++;
  }

  return { flags, args };
}

module.exports = { parse };
