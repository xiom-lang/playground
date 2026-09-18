// Copyright (c) 2026 Eleftherios Notas and XIOM Foundation
// SPDX-License-Identifier: MIT OR Apache-2.0
// XIOM editor completions for Monaco, built from js/stdlib-ref.json.
// Data-driven: regenerate the reference and completions follow the toolchain.
// No language server required for the browser playground.
(function () {
  'use strict';

  var dataPromise = null;
  var index = null;
  var registered = false;

  var KEYWORDS = [
    'fn', 'let', 'var', 'return', 'if', 'elif', 'else', 'match', 'while', 'for', 'in',
    'type', 'enum', 'interface', 'module', 'use', 'pub', 'derive', 'unsafe', 'extern',
    'comptime', 'as', 'is', 'and', 'or', 'not', 'true', 'false', 'Some', 'None',
    'Ok', 'Err', 'result', 'self', 'range',
  ];
  var TYPES = [
    'Int', 'Int8', 'Int16', 'Int32', 'Int64', 'UInt', 'UInt8', 'UInt16', 'UInt32',
    'UInt64', 'Float32', 'Float64', 'Bool', 'Str', 'Char', 'Unit', 'Option',
    'Result', 'Vec', 'Map', 'HashSet', 'Slice',
  ];
  var TIER_BOOST = { playground: '0', docs: '1', local: '2' };

  function loadData() {
    if (window.stdlibData) return Promise.resolve(window.stdlibData);
    if (!dataPromise) {
      dataPromise = fetch('js/stdlib-ref.json')
        .then(function (response) { return response.json(); })
        .then(function (data) { window.stdlibData = data; return data; })
        .catch(function (err) { dataPromise = null; throw err; });
    }
    return dataPromise;
  }

  function splitTopLevel(text) {
    var parts = [];
    var depth = 0;
    var current = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      else if (ch === ')' || ch === ']' || ch === '}') depth--;
      if (ch === ',' && depth === 0) { parts.push(current); current = ''; continue; }
      current += ch;
    }
    if (current.trim()) parts.push(current);
    return parts;
  }

  function parseSignature(sig) {
    var open = sig.indexOf('(');
    var namePath = open >= 0 ? sig.slice(0, open).trim() : sig.trim();
    var params = [];
    var returns = '';
    if (open >= 0) {
      var depth = 0;
      var close = -1;
      for (var i = open; i < sig.length; i++) {
        if (sig[i] === '(') depth++;
        else if (sig[i] === ')') { depth--; if (depth === 0) { close = i; break; } }
      }
      var paramsText = close >= 0 ? sig.slice(open + 1, close) : '';
      params = splitTopLevel(paramsText).map(function (raw) {
        var piece = raw.trim();
        var colon = piece.indexOf(':');
        var name = (colon >= 0 ? piece.slice(0, colon) : piece).trim();
        return name.replace(/^mut\s+/, '').replace(/^&/, '');
      }).filter(function (name) { return name && name !== 'self'; });
      returns = close >= 0 ? sig.slice(close + 1).replace(/^\s*->\s*/, '').trim() : '';
    }
    return {
      namePath: namePath,
      name: namePath.split('.').pop(),
      isMethod: namePath.indexOf('.') >= 0,
      params: params,
      returns: returns,
    };
  }

  function buildIndex(data) {
    var modules = [];
    var byAlias = {};
    var methodsByName = {};
    var freeFunctions = [];

    data.modules.forEach(function (mod) {
      var alias = mod.name.split('.').pop();
      var entry = { name: mod.name, alias: alias, tier: mod.tier || 'local', docs: mod.docs || '', items: [] };
      (mod.functions || []).forEach(function (fn) {
        var parsed = parseSignature(fn.sig);
        var item = {
          moduleName: mod.name,
          alias: alias,
          tier: entry.tier,
          docs: mod.docs || '',
          sig: fn.sig,
          desc: fn.desc || '',
          parsed: parsed,
        };
        entry.items.push(item);
        if (parsed.isMethod) {
          if (!methodsByName[parsed.name]) methodsByName[parsed.name] = [];
          methodsByName[parsed.name].push(item);
        } else {
          freeFunctions.push(item);
        }
      });
      modules.push(entry);
      if (!byAlias[alias]) byAlias[alias] = [];
      byAlias[alias].push(entry);
    });

    return {
      modules: modules,
      byAlias: byAlias,
      methodsByName: methodsByName,
      freeFunctions: freeFunctions,
      version: data.version,
    };
  }

  function ensureIndex() {
    return loadData().then(function (data) {
      if (!index) index = buildIndex(data);
      return index;
    });
  }

  function importedModules(model) {
    var text = model.getValue();
    var found = {};
    var re = /^\s*use\s+xiom\.([\w.]+)\s*;/gm;
    var match;
    while ((match = re.exec(text))) {
      var path = match[1];
      found[path.split('.').pop()] = path;
    }
    return found;
  }

  function functionItem(item, kind) {
    var snippet = item.parsed.name + '(';
    snippet += item.parsed.params.map(function (param, i) { return '${' + (i + 1) + ':' + param + '}'; }).join(', ');
    snippet += ')';
    var docs = item.docs ? '\n\n[docs](' + item.docs + ')' : '';
    return {
      label: { label: item.parsed.name, detail: item.parsed.isMethod ? ' method' : '', description: item.moduleName },
      kind: kind,
      insertText: snippet,
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      detail: item.sig,
      documentation: { value: (item.desc || '') + '\n\n`' + item.sig + '` in `' + item.moduleName + '`' + docs },
      sortText: (TIER_BOOST[item.tier] || '3') + '_' + item.parsed.name,
    };
  }

  function moduleItem(moduleEntry) {
    return {
      label: { label: 'xiom.' + moduleEntry.name, description: moduleEntry.tier },
      kind: monaco.languages.CompletionItemKind.Module,
      insertText: 'xiom.' + moduleEntry.name + ';',
      detail: 'use xiom.' + moduleEntry.name + ';',
      sortText: (TIER_BOOST[moduleEntry.tier] || '3') + '_' + moduleEntry.name,
    };
  }

  function provideCompletions(model, position) {
    return ensureIndex().then(function (idx) {
      var line = model.getValueInRange({
        startLineNumber: position.lineNumber, startColumn: 1,
        endLineNumber: position.lineNumber, endColumn: position.column,
      });
      var word = model.getWordUntilPosition(position);
      var prefix = (word && word.word || '').toLowerCase();
      var suggestions = [];

      // `use xiom.<modules>`
      var useMatch = line.match(/use\s+xiom\.([\w.]*)$/);
      if (useMatch) {
        var partial = useMatch[1].toLowerCase();
        idx.modules.filter(function (m) { return m.name.toLowerCase().indexOf(partial) === 0; })
          .slice(0, 200)
          .forEach(function (m) { suggestions.push(moduleItem(m)); });
        return { suggestions: suggestions };
      }

      // `alias.` where alias is an imported module, or `Type.` for methods.
      var dotMatch = line.match(/([A-Za-z_]\w*)\.\w*$/);
      if (dotMatch) {
        var qualifier = dotMatch[1];
        var imported = importedModules(model);
        var targets = [];
        if (imported[qualifier] && idx.byAlias[qualifier]) {
          idx.byAlias[qualifier].forEach(function (m) { targets = targets.concat(m.items); });
        }
        if (targets.length === 0) {
          Object.keys(idx.methodsByName).forEach(function (name) {
            if (name.toLowerCase().indexOf(prefix) === 0) targets.push.apply(targets, idx.methodsByName[name]);
          });
        }
        targets.filter(function (item) {
          return !prefix || item.parsed.name.toLowerCase().indexOf(prefix) === 0;
        }).slice(0, 200).forEach(function (item) {
          suggestions.push(functionItem(item, monaco.languages.CompletionItemKind.Method));
        });
        return { suggestions: suggestions };
      }

      // Bare word: keywords, types, imported module functions, then free functions.
      KEYWORDS.concat(TYPES).forEach(function (wordText) {
        if (!prefix || wordText.toLowerCase().indexOf(prefix) === 0) {
          suggestions.push({
            label: wordText,
            kind: TYPES.indexOf(wordText) >= 0 ? monaco.languages.CompletionItemKind.TypeParameter : monaco.languages.CompletionItemKind.Keyword,
            insertText: wordText,
            sortText: '0_kw_' + wordText,
          });
        }
      });

      var imported = importedModules(model);
      var seen = {};
      function push(item, kind) {
        var key = (item.parsed.isMethod ? item.moduleName + '.' : '') + item.parsed.name;
        if (seen[key]) return;
        seen[key] = true;
        suggestions.push(functionItem(item, kind));
      }
      Object.keys(imported).forEach(function (alias) {
        (idx.byAlias[alias] || []).forEach(function (mod) {
          mod.items.forEach(function (item) {
            if (!item.parsed.isMethod && (!prefix || item.parsed.name.toLowerCase().indexOf(prefix) === 0)) {
              push(item, monaco.languages.CompletionItemKind.Function);
            }
          });
        });
      });
      idx.freeFunctions.forEach(function (item) {
        if (suggestions.length > 600) return;
        if (item.tier !== 'playground') return;
        if (prefix && item.parsed.name.toLowerCase().indexOf(prefix) !== 0) return;
        push(item, monaco.languages.CompletionItemKind.Function);
      });

      return { suggestions: suggestions.slice(0, 800) };
    });
  }

  window.registerXiomCompletions = function (monacoInstance) {
    if (registered) return;
    registered = true;
    monacoInstance.languages.registerCompletionItemProvider('xiom', {
      triggerCharacters: ['.'],
      provideCompletionItems: provideCompletions,
    });
  };

  // Shared with js/stdlib-ref.js for insert-into-editor snippets.
  window.xiomParseSignature = parseSignature;
})();
