/* Game-specific achievements (cosmetic coin rewards). Shared ones live in achievements.js. */
window.ACH_DEFS = [
  { "id": "nb_first", "name": "First Turn", "desc": "Solve your first level", "metric": "wins", "goal": 1, "reward": 15 },
  { "id": "nb_wins25", "name": "Apprentice", "desc": "Solve 25 levels", "metric": "wins", "goal": 25, "reward": 80 },
  { "id": "nb_wins100", "name": "Master Mechanic", "desc": "Solve 100 levels", "metric": "wins", "goal": 100, "reward": 200 },
  { "id": "nb_lvl20", "name": "Torque Up", "desc": "Reach level 20", "metric": "level", "goal": 20, "reward": 60 },
  { "id": "nb_lvl50", "name": "Heavy Machinery", "desc": "Reach level 50", "metric": "level", "goal": 50, "reward": 150 },
  { "id": "nb_clean10", "name": "Steady Hands", "desc": "Solve 10 levels without undo, hint or extra bolt", "metric": "clean_wins", "goal": 10, "reward": 100 },
  { "id": "nb_records5", "name": "Efficiency Expert", "desc": "Beat your fewest-moves record 5 times", "metric": "records", "goal": 5, "reward": 70 },
  { "id": "nb_moves", "name": "Spinning Wrench", "desc": "Make 1,000 moves in total", "metric": "moves", "goal": 1000, "reward": 60 }
]
;
if (typeof module !== 'undefined') module.exports = window.ACH_DEFS;
