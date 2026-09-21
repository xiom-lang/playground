// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
// SPDX-License-Identifier: MIT OR Apache-2.0
// Registry browser (C1): read-only search over the public XIOM package
// registry. The read API is public with open CORS:
//   GET /index.json        full index (browse)
//   GET /search?q=         search results
//   GET /packages/:name    per-version metadata
// Package code is never downloaded or executed here; links open the registry.
var REGISTRY_BASE = 'https://registry.xiom-lang.org';
var REGISTRY_CACHE_MS = 60000; // matches the server's index max-age

var registryIndex = null;
var registryIndexAt = 0;
var registrySearchCache = {};   // query -> results (rate-limit friendly)
var registryDetailCache = {};   // name -> metadata
var registrySearchTimer = null;

function registryFetchJson(path) {
  return fetch(REGISTRY_BASE + path, { headers: { Accept: 'application/json' } })
    .then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    });
}

function registryPanelVisible() {
  var panel = document.getElementById('registryPanel');
  return !!panel && !panel.classList.contains('hidden');
}

function registryCloseOtherPanels() {
  if (window.closeStdlibPanel) window.closeStdlibPanel();
  var syntax = document.getElementById('syntaxPanel');
  if (syntax) syntax.classList.add('hidden');
  var compilerRef = document.getElementById('compilerRefPanel');
  if (compilerRef) compilerRef.classList.add('hidden');
}

function openRegistryPanel() {
  var panel = document.getElementById('registryPanel');
  if (!panel) return;
  registryCloseOtherPanels();
  panel.classList.remove('hidden');
  var input = document.getElementById('registrySearch');
  if (input) input.focus();
  registryLoadIndex();
}

function closeRegistryPanel() {
  var panel = document.getElementById('registryPanel');
  if (panel) panel.classList.add('hidden');
}

window.toggleRegistryPanel = function () {
  if (registryPanelVisible()) closeRegistryPanel();
  else openRegistryPanel();
};

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

function registryLoadIndex(force) {
  var fresh = registryIndex && (Date.now() - registryIndexAt) < REGISTRY_CACHE_MS;
  if (fresh && !force) {
    registryRenderBrowse();
    return;
  }
  registryRenderStatus('Loading packages...');
  registryFetchJson('/index.json').then(function (data) {
    registryIndex = (data && data.packages) || {};
    registryIndexAt = Date.now();
    registryRenderBrowse();
  }).catch(function () {
    registryRenderError('Could not load the package index.', function () { registryLoadIndex(true); });
  });
}

window.searchRegistry = function (query) {
  var q = String(query == null ? '' : query).trim();
  if (registrySearchTimer) clearTimeout(registrySearchTimer);
  registrySearchTimer = setTimeout(function () { registryRunSearch(q); }, 320);
};

function registryRunSearch(q) {
  if (!q) { registryRenderBrowse(); return; }
  if (registrySearchCache[q]) { registryRenderSearch(q, registrySearchCache[q]); return; }
  registryRenderStatus('Searching...');
  registryFetchJson('/search?q=' + encodeURIComponent(q)).then(function (data) {
    var results = (data && data.results) || [];
    registrySearchCache[q] = results;
    registryRenderSearch(q, results);
  }).catch(function () {
    registryRenderError('Search failed. The registry may be unreachable.', function () { registryRunSearch(q); });
  });
}

function registryPackagesFromIndex() {
  var names = Object.keys(registryIndex || {});
  names.sort(function (a, b) { return a.localeCompare(b); });
  return names.map(function (name) {
    var entry = registryIndex[name] || {};
    return {
      name: name,
      description: entry.description || '',
      repository: entry.repository || '',
      latest: entry.latest || '',
      versions: entry.versions ? Object.keys(entry.versions).length : 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Rendering (all registry strings go through textContent)
// ---------------------------------------------------------------------------

function registryResultsHost() {
  return document.getElementById('registryResults');
}

function registryRenderStatus(text) {
  var host = registryResultsHost();
  if (!host) return;
  host.textContent = '';
  var status = document.createElement('div');
  status.className = 'registry-status';
  status.textContent = text;
  host.appendChild(status);
}

function registryRenderError(text, onRetry) {
  var host = registryResultsHost();
  if (!host) return;
  host.textContent = '';
  var box = document.createElement('div');
  box.className = 'registry-error';
  var message = document.createElement('div');
  message.textContent = text;
  box.appendChild(message);
  var retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'btn-ghost';
  retry.textContent = 'Retry';
  retry.onclick = onRetry;
  box.appendChild(retry);
  host.appendChild(box);
}

function registryRenderEmpty(text) {
  var host = registryResultsHost();
  if (!host) return;
  host.textContent = '';
  var empty = document.createElement('div');
  empty.className = 'registry-empty';
  empty.textContent = text;
  host.appendChild(empty);
}

function registryDetailsButton(name) {
  var button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn-ghost registry-action';
  button.textContent = 'Details';
  button.setAttribute('aria-expanded', 'false');
  var detail = document.createElement('div');
  detail.className = 'registry-detail hidden';
  button.onclick = function () {
    var open = !detail.classList.contains('hidden');
    if (open) {
      detail.classList.add('hidden');
      button.textContent = 'Details';
      button.setAttribute('aria-expanded', 'false');
      return;
    }
    detail.classList.remove('hidden');
    button.textContent = 'Hide details';
    button.setAttribute('aria-expanded', 'true');
    registryRenderDetail(detail, name);
  };
  return { button: button, detail: detail };
}

function registryRenderCard(pkg) {
  var card = document.createElement('div');
  card.className = 'registry-card';

  var head = document.createElement('div');
  head.className = 'registry-card-head';

  var name = document.createElement('span');
  name.className = 'registry-name';
  name.textContent = pkg.name;
  head.appendChild(name);

  if (pkg.latest) {
    var latest = document.createElement('span');
    latest.className = 'registry-latest';
    latest.textContent = 'latest ' + pkg.latest;
    head.appendChild(latest);
  }

  var count = document.createElement('span');
  count.className = 'registry-versions';
  count.textContent = pkg.versions === 1 ? '1 version' : pkg.versions + ' versions';
  head.appendChild(count);
  card.appendChild(head);

  if (pkg.description) {
    var description = document.createElement('p');
    description.className = 'registry-desc';
    description.textContent = pkg.description;
    card.appendChild(description);
  }

  var actions = document.createElement('div');
  actions.className = 'registry-card-actions';

  var details = registryDetailsButton(pkg.name);
  actions.appendChild(details.button);

  var page = document.createElement('a');
  page.className = 'btn-ghost registry-action';
  page.href = REGISTRY_BASE + '/packages/' + encodeURIComponent(pkg.name);
  page.target = '_blank';
  page.rel = 'noopener noreferrer';
  page.textContent = 'Registry page';
  actions.appendChild(page);

  if (pkg.repository) {
    var repo = document.createElement('a');
    repo.className = 'btn-ghost registry-action';
    repo.href = pkg.repository;
    repo.target = '_blank';
    repo.rel = 'noopener noreferrer';
    repo.textContent = 'Repository';
    actions.appendChild(repo);
  }

  card.appendChild(actions);
  card.appendChild(details.detail);
  return card;
}

function registryRenderList(packages) {
  var host = registryResultsHost();
  if (!host) return;
  host.textContent = '';
  var list = document.createElement('div');
  list.className = 'registry-list';
  for (var i = 0; i < packages.length; i++) list.appendChild(registryRenderCard(packages[i]));
  host.appendChild(list);
}

function registryRenderBrowse() {
  if (!registryIndex) {
    registryLoadIndex();
    return;
  }
  var packages = registryPackagesFromIndex();
  if (packages.length === 0) {
    registryRenderEmpty('No packages published yet.');
    return;
  }
  registryRenderList(packages);
}

function registryRenderSearch(query, results) {
  if (results.length === 0) {
    registryRenderEmpty('No packages match "' + query + '".');
    return;
  }
  registryRenderList(results.map(function (entry) {
    return {
      name: entry.name || '',
      description: entry.description || '',
      repository: entry.repository || '',
      latest: entry.latest || '',
      versions: entry.versions || 0,
    };
  }));
}

function registryCopyButton(text, label) {
  var button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn-ghost registry-copy';
  button.textContent = label;
  button.onclick = function () {
    var done = function (ok) {
      button.textContent = ok ? 'Copied' : 'Copy failed';
      setTimeout(function () { button.textContent = label; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } else {
      done(false);
    }
  };
  return button;
}

function registryRenderDetail(host, name) {
  if (registryDetailCache[name]) { registryRenderDetailBody(host, registryDetailCache[name]); return; }
  host.textContent = '';
  var status = document.createElement('div');
  status.className = 'registry-status';
  status.textContent = 'Loading version metadata...';
  host.appendChild(status);
  registryFetchJson('/packages/' + encodeURIComponent(name)).then(function (data) {
    registryDetailCache[name] = data;
    registryRenderDetailBody(host, data);
  }).catch(function () {
    host.textContent = '';
    var error = document.createElement('div');
    error.className = 'registry-status';
    error.textContent = 'Could not load version metadata.';
    host.appendChild(error);
  });
}

function registryFormatBytes(size) {
  if (typeof size !== 'number' || size < 0) return '';
  if (size < 1024) return size + ' B';
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
  return (size / (1024 * 1024)).toFixed(1) + ' MB';
}

function registryRenderDetailBody(host, data) {
  host.textContent = '';
  var versions = (data && data.versions) || {};
  var names = Object.keys(versions).sort(function (a, b) {
    return String(b).localeCompare(String(a), undefined, { numeric: true });
  });
  if (names.length === 0) {
    var none = document.createElement('div');
    none.className = 'registry-status';
    none.textContent = 'No published versions.';
    host.appendChild(none);
    return;
  }
  for (var i = 0; i < names.length; i++) {
    var version = versions[names[i]] || {};
    var row = document.createElement('div');
    row.className = 'registry-version-row' + (version.yanked ? ' yanked' : '');

    var label = document.createElement('span');
    label.className = 'registry-version';
    label.textContent = version.version || names[i];
    row.appendChild(label);

    if (version.published) {
      var published = document.createElement('span');
      published.className = 'registry-published';
      published.textContent = String(version.published).slice(0, 10);
      row.appendChild(published);
    }

    var size = registryFormatBytes(version.size);
    if (size) {
      var sizeEl = document.createElement('span');
      sizeEl.className = 'registry-size';
      sizeEl.textContent = size;
      row.appendChild(sizeEl);
    }

    if (version.yanked) {
      var yanked = document.createElement('span');
      yanked.className = 'registry-yanked';
      yanked.textContent = 'yanked';
      row.appendChild(yanked);
    }

    if (version.sha256) {
      var digest = document.createElement('code');
      digest.className = 'registry-digest';
      digest.title = version.sha256;
      digest.textContent = version.sha256.slice(0, 12) + '...';
      row.appendChild(digest);
      row.appendChild(registryCopyButton(version.sha256, 'Copy SHA'));
    }

    host.appendChild(row);

    var deps = version.dependencies || {};
    var depNames = Object.keys(deps);
    if (depNames.length > 0) {
      var depLine = document.createElement('div');
      depLine.className = 'registry-deps';
      depLine.textContent = 'dependencies: ' + depNames.map(function (dep) {
        return dep + '@' + deps[dep];
      }).join(', ');
      host.appendChild(depLine);
    }
  }
}
