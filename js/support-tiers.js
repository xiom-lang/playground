/*
Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
SPDX-License-Identifier: MIT OR Apache-2.0

Live Open Collective support tiers for the contributing page.

The section carrying [data-support-tiers] is filled from the collective's
public API: tier names, amounts and intervals come from the anonymous
GraphQL endpoint at api.opencollective.com (verified: no token required,
Access-Control-Allow-Origin: *), and the financial-contributor count comes
from https://opencollective.com/xiom.json (Access-Control-Allow-Origin: *,
cached for an hour). No token may ever be added here; a token in a static
site is a leaked token.

Each card links to the collective's donate flow with the amount and
interval pre-filled, so the contribution itself happens on Open Collective
under its own policies. On any failure the authored fallback stands and the
containers stay hidden, so the page never shows a guessed number or tier.
*/
(function () {
  "use strict";

  var TIERS_URL = "https://api.opencollective.com/graphql/v2";
  var TIERS_QUERY = "query { account(slug: \"xiom\") { ... on Collective { tiers(limit: 20) { nodes { name slug interval amount { value currency } } } } } }";
  var SUMMARY_URL = "https://opencollective.com/xiom.json";
  var SYMBOL = { EUR: "\u20AC", USD: "$", GBP: "\u00A3" };

  function el(tag, text) {
    var node = document.createElement(tag);
    if (text) node.textContent = text;
    return node;
  }

  function amountText(tier) {
    var value = tier.amount ? tier.amount.value : null;
    if (value === null || value === undefined) return "";
    var symbol = SYMBOL[tier.amount.currency] || tier.amount.currency + " ";
    var amount = symbol + (Math.round(value * 100) / 100);
    if (tier.interval === "month") return amount + " / month";
    if (tier.interval === "year") return amount + " / year";
    return "From " + amount;
  }

  function donateUrl(tier) {
    var url = "https://opencollective.com/xiom/donate/profile?amount=" + encodeURIComponent(tier.amount.value);
    if (tier.interval === "month" || tier.interval === "year") {
      url += "&interval=" + encodeURIComponent(tier.interval);
    }
    return url;
  }

  function renderTiers(grid, tiers) {
    for (var i = 0; i < tiers.length; i++) {
      var tier = tiers[i];
      var card = el("div");
      card.className = "eco-card";
      card.appendChild(el("h4", tier.name));
      card.appendChild(el("p", amountText(tier)));
      var link = el("a", "contribute");
      link.href = donateUrl(tier);
      link.setAttribute("style", "color:var(--signal);font-size:13px;margin-top:auto;");
      card.appendChild(link);
      grid.appendChild(card);
    }
    grid.hidden = false;
  }

  function renderBackers(node, count) {
    if (!count || count < 1) return;
    node.textContent = count === 1
      ? "Backed by 1 financial contributor on Open Collective."
      : "Backed by " + count + " financial contributors on Open Collective.";
    node.hidden = false;
  }

  function load() {
    var grid = document.querySelector("[data-support-tiers]");
    if (!grid) return;
    var backers = document.querySelector("[data-support-backers]");

    fetch(TIERS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: TIERS_QUERY }),
      cache: "no-store"
    })
      .then(function (res) {
        if (!res.ok) throw new Error("tiers HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        var tiers = data && data.data && data.data.account &&
          data.data.account.tiers && data.data.account.tiers.nodes;
        if (!tiers || !tiers.length) throw new Error("no tiers in response");
        renderTiers(grid, tiers);
      })
      .catch(function () {
        // The authored fallback stands; the grid stays hidden.
      });

    if (backers) {
      fetch(SUMMARY_URL, { cache: "no-store" })
        .then(function (res) {
          if (!res.ok) throw new Error("summary HTTP " + res.status);
          return res.json();
        })
        .then(function (data) {
          renderBackers(backers, data && data.backersCount);
        })
        .catch(function () {
          // The backers line stays hidden.
        });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();
