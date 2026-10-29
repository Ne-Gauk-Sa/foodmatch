// FoodMatch threshold logic (same rules as the tested prototype). Works in Node and the browser.
(function (root) {
  function meets(yes, size, rule) {
    if (size <= 0) return false;
    switch (rule.mode) {
      case 'majority': return yes * 2 > size;          // strictly more than half
      case 'twoThirds': return yes * 3 >= size * 2;    // exact 2/3
      case 'unanimous': return yes === size;
      default: return yes * 100 >= rule.pct * size - 1e-9; // custom: yes/size >= pct%
    }
  }
  function yesNeeded(size, rule) { for (let k = 0; k <= size; k++) if (meets(k, size, rule)) return k; return size; }
  // options: array of ids; members: array of ids; votes: {memberId:{optionId:bool}}
  function winner(options, members, votes, rule) {
    const size = members.length; let best = null;
    options.forEach((o, i) => {
      const yes = members.filter(m => votes[m] && votes[m][o] === true).length;
      if (meets(yes, size, rule)) { const s = yes / size; if (!best || s > best.share) best = { id: o, share: s, yes, i }; }
    });
    return best;
  }
  const api = { meets, yesNeeded, winner };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FoodLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
