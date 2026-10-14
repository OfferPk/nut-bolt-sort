/* Weekly challenge goal pool (stats are Achievements.bump keys). 3 are picked per week, same for everyone. */
(function (root) { var POOL = [
  { stat: 'wins', text: 'Solve {n} levels', targets: [5, 8, 12] },
  { stat: 'moves', text: 'Make {n} moves', targets: [150, 250, 400] },
  { stat: 'clean_wins', text: 'Solve {n} levels with no undo, hint or extra bolt', targets: [2, 3, 5] },
  { stat: 'challenges', text: 'Finish {n} Daily Bolts', targets: [2, 3, 4] },
  { stat: 'daily_claims', text: 'Claim the daily reward {n} times', targets: [3, 4, 5] }
]; root.WEEKLY_GOALS = POOL; if (typeof module !== 'undefined') module.exports = POOL; })(typeof window !== 'undefined' ? window : globalThis);
