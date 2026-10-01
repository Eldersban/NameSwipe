'use strict';
// ---------------------------------------------------------------------------
// Static game data: floors, monsters, weapons, loot, achievements, dialogue.
// ---------------------------------------------------------------------------

const FLOORS = [
  {
    name: 'The Stone Maze', theme: 'stone', time: 720,
    pool: ['rat', 'rat', 'goblin'], count: 26, boss: 'ratking',
    fog: [6, 5, 8], amb: [0.2, 0.19, 0.24],
    intro: 'Welcome to Floor One. It is made of rocks and regret. Find the stairwell before the floor collapses. There is a boss. There is always a boss.',
  },
  {
    name: 'The Goblin Warrens', theme: 'moss', time: 720,
    pool: ['rat', 'goblin', 'goblin', 'slinger'], count: 32, boss: 'matriarch',
    fog: [4, 9, 5], amb: [0.16, 0.22, 0.15],
    intro: 'Floor Two. The goblins here have formed a union. Their demands are your organs.',
  },
  {
    name: 'The Ossuary', theme: 'bone', time: 660,
    pool: ['goblin', 'slinger', 'skeleton', 'skeleton'], count: 36, boss: 'bonewright',
    fog: [8, 8, 12], amb: [0.17, 0.19, 0.27],
    intro: 'Floor Three. Everything down here used to be a crawler. Try not to join the decor.',
  },
  {
    name: 'The Furnace', theme: 'furnace', time: 660,
    pool: ['skeleton', 'slinger', 'brute', 'wisp', 'wisp'], count: 40, boss: 'hellhound',
    fog: [22, 5, 2], amb: [0.3, 0.13, 0.08],
    intro: 'Floor Four. It is hot. The sponsors requested it be hotter. It has been made hotter.',
  },
  {
    name: 'The Studio', theme: 'studio', time: 600,
    pool: ['brute', 'wisp', 'skeleton', 'goblin', 'slinger'], count: 44, boss: 'showrunner',
    fog: [10, 3, 16], amb: [0.22, 0.14, 0.28],
    intro: 'Floor Five. You have reached the production floor. The Showrunner would like a word. Several, actually. All of them violent.',
  },
];

// hp/dmg are floor-one values; they scale with depth.
const MOBS = {
  rat: {
    name: 'Dungeon Rat', hp: 11, speed: 2.7, dmg: 4, range: 0.75, cd: 0.8,
    xp: 6, gold: [0, 2], h: 0.42, radius: 0.22, sprite: 'rat',
  },
  goblin: {
    name: 'Goblin Scrapper', hp: 24, speed: 2.05, dmg: 7, range: 0.9, cd: 1.0,
    xp: 12, gold: [1, 5], h: 0.72, radius: 0.28, sprite: 'goblin',
  },
  slinger: {
    name: 'Goblin Slinger', hp: 18, speed: 1.8, dmg: 7, cd: 2.1,
    ranged: { speed: 7, proj: 'rock', keep: 4.5 },
    xp: 15, gold: [1, 6], h: 0.7, radius: 0.28, sprite: 'slinger',
  },
  skeleton: {
    name: 'Rattling Skeleton', hp: 46, speed: 1.65, dmg: 11, range: 1.0, cd: 1.2,
    xp: 22, gold: [2, 8], h: 0.86, radius: 0.3, sprite: 'skeleton',
  },
  brute: {
    name: 'Troglodyte Brute', hp: 95, speed: 1.4, dmg: 18, range: 1.2, cd: 1.7,
    xp: 40, gold: [5, 14], h: 1.05, radius: 0.42, sprite: 'brute',
  },
  wisp: {
    name: 'Hellspark', hp: 26, speed: 2.3, dmg: 9, cd: 1.9,
    ranged: { speed: 6, proj: 'fireball', keep: 5 },
    xp: 25, gold: [2, 9], h: 0.5, z: 0.3, fly: true, radius: 0.25, sprite: 'wisp', bright: true,
  },

  // ---- floor bosses ----
  ratking: {
    boss: true, name: 'Squeakers, the Rat King', hp: 280, speed: 2.1, dmg: 10, range: 1.2, cd: 1.0,
    xp: 160, gold: [40, 60], h: 1.1, radius: 0.5, sprite: 'ratking',
    abilities: [{ kind: 'summon', mob: 'rat', n: 3, every: 7 }],
    taunt: 'SQUEEEEK. (Translation: "You are standing in my kitchen.")',
  },
  matriarch: {
    boss: true, name: 'Matriarch Gobsmack', hp: 430, speed: 1.9, dmg: 14, range: 1.2, cd: 1.1,
    xp: 260, gold: [60, 90], h: 1.35, radius: 0.5, sprite: 'matriarch',
    abilities: [
      { kind: 'spread', n: 5, arc: 0.7, proj: 'rock', speed: 8, every: 3.2 },
      { kind: 'summon', mob: 'goblin', n: 2, every: 11 },
    ],
    taunt: 'Who let the pantsless one into my warren? Children! Dinner has arrived!',
  },
  bonewright: {
    boss: true, name: 'The Bonewright', hp: 620, speed: 1.6, dmg: 18, range: 1.3, cd: 1.3,
    xp: 380, gold: [80, 120], h: 1.45, radius: 0.5, sprite: 'bonewright',
    abilities: [
      { kind: 'radial', n: 12, proj: 'bone', speed: 6.5, every: 4.0 },
      { kind: 'summon', mob: 'skeleton', n: 2, every: 13 },
    ],
    taunt: 'Ah, fresh materials. I shall make a lovely chair out of you.',
  },
  hellhound: {
    boss: true, name: 'Gerald, the Hellhound', hp: 780, speed: 2.3, dmg: 22, range: 1.3, cd: 1.0,
    xp: 520, gold: [110, 160], h: 1.25, radius: 0.55, sprite: 'hellhound', bright: true,
    abilities: [
      { kind: 'charge', every: 5.0 },
      { kind: 'spread', n: 3, arc: 0.4, proj: 'fireball', speed: 7.5, every: 2.7 },
    ],
    taunt: 'Gerald is a good boy. Gerald has been told to eat you. Gerald is VERY good.',
  },
  showrunner: {
    boss: true, name: 'The Showrunner', hp: 1300, speed: 1.9, dmg: 24, range: 1.3, cd: 1.1,
    xp: 900, gold: [200, 300], h: 1.5, radius: 0.5, sprite: 'showrunner', bright: true,
    abilities: [
      { kind: 'radial', n: 14, proj: 'static', speed: 6, every: 4.5 },
      { kind: 'spread', n: 5, arc: 0.6, proj: 'static', speed: 8.5, every: 2.6 },
      { kind: 'summon', mob: 'wisp', n: 2, every: 12 },
      { kind: 'teleport', every: 9 },
    ],
    taunt: 'Ratings are down, Carl. Do you know what boosts ratings? A really gruesome season finale.',
  },
};

const WEAPONS = [
  { id: 'fists', key: '1', name: 'Fists', desc: 'Carl\'s knuckles. Surprisingly effective. Scales with STR and your gauntlet.' },
  { id: 'club', key: '2', name: 'Nail-Studded Club', desc: 'Slow, heavy, deeply satisfying. Scales with STR.' },
  { id: 'crossbow', key: '3', name: 'Rusty Crossbow', desc: 'Fires bolts. Scales with DEX.', ammo: 'bolts' },
  { id: 'lobber', key: '4', name: 'Hob-Lobber', desc: 'A jug of alchemical nonsense with a fuse. Throw. Run. Also hurts you.', ammo: 'lobbers' },
];

const GAUNTLETS = [
  { name: 'Bare Knuckles', mult: 1.0 },
  { name: 'Enchanted Knuckle Wraps', mult: 1.35 },
  { name: 'Brawler\'s Gauntlet', mult: 1.75 },
  { name: 'Gauntlet of the Unhinged', mult: 2.3 },
];

const BOX_TYPES = {
  bronze: { name: 'Bronze Adventurer Box', color: '#c07a3a' },
  silver: { name: 'Silver Adventurer Box', color: '#b9c3cf' },
  gold: { name: 'Gold Adventurer Box', color: '#ffcc33' },
  boss: { name: 'Gold Boss Box', color: '#ff6a3d' },
  fan: { name: 'Fan Box', color: '#ff66cc' },
};

const SHOP = [
  { id: 'potion', name: 'Healing Potion', desc: 'Restores half your health. [Q] to drink.', price: 25 },
  { id: 'bolts', name: 'Crossbow Bolts ×12', desc: 'Pointy. Reusable exactly zero times.', price: 20, needs: 'crossbow' },
  { id: 'lobbers', name: 'Hob-Lobbers ×2', desc: 'Carl\'s signature crafting project.', price: 35 },
  { id: 'gauntlet', name: 'Gauntlet Upgrade', desc: 'Punch harder. Much harder.', price: 140, scale: 180 },
  { id: 'club', name: 'Nail-Studded Club', desc: 'A plank with nails. Artisanal.', price: 110, once: 'club' },
  { id: 'crossbow', name: 'Rusty Crossbow', desc: 'Includes 12 bolts. Rust is free.', price: 150, once: 'crossbow' },
  { id: 'tonic', name: 'Stat Tonic', desc: '+1 stat point. Tastes like pennies.', price: 260, scale: 120 },
];

// Achievements: the System AI hands these out with commentary and a prize.
const ACHIEVEMENTS = {
  pantsless: { title: 'Pantsless in Public', box: 'bronze', text: 'You entered the World Dungeon in boxer shorts and a leather jacket. Millions of viewers have questions. None of them are about your survival odds.' },
  firstblood: { title: 'First Blood', box: 'silver', text: 'You killed something! Its family will be notified never.' },
  knuckles: { title: 'Knuckle Sandwich Artisan', box: 'silver', text: 'Fifteen kills with your bare hands. Your knuckles would like to file a complaint.' },
  bonk: { title: 'Bonk', box: 'bronze', text: 'Ten kills with a plank of wood that has nails in it. Civilization peaked here.' },
  pewpew: { title: 'Pew Pew', box: 'bronze', text: 'Ten crossbow kills. You are basically a sniper now. A rusty, pantsless sniper.' },
  kaboom: { title: 'Hob-Lobber Enthusiast', box: 'gold', text: 'Three or more kills with a single explosion. The insurance adjusters are weeping.' },
  selfown: { title: 'Friendly Fire, Emphasis on Fire', box: 'bronze', text: 'You blew yourself up. Here is a prize, because the audience laughed so hard.' },
  kicker: { title: 'Door-to-Door Salesman', box: 'silver', text: 'Five kills with a kick. Your feet are now registered weapons in eleven systems.' },
  catkill: { title: 'The Cat Did It', box: 'silver', text: 'Donut has ten kills. She would like it noted that she is carrying this team.' },
  firstboss: { title: 'Floor Boss Slayer', box: 'gold', text: 'You killed a floor boss. Management is thrilled. Management is also sending more.' },
  flesh: { title: 'Just a Flesh Wound', box: 'bronze', text: 'You survived with less than ten percent health. Dramatic. We love dramatic.' },
  speedrun: { title: 'Places to Be', box: 'silver', text: 'You descended with more than half the timer left. Somewhere, a producer is annoyed at the lost ad time.' },
  shopper: { title: 'Consumer Culture', box: 'bronze', text: 'You spent 300 gold. The economy thanks you for your sacrifice.' },
  hoarder: { title: 'Box Hoarder', box: 'bronze', text: 'You are holding five unopened boxes. Please see a professional. Here is another box.' },
  lvl5: { title: 'Getting the Hang of Murder', box: 'silver', text: 'Level five! The monsters are noticing. That is bad for them, mostly.' },
  lvl10: { title: 'Professional Crawler', box: 'gold', text: 'Level ten. You may now list "dungeon crawler" on your resume. Your resume has been incinerated.' },
  trending: { title: 'Trending', box: 'fan', text: 'Over a million viewers are watching you. Wave! No, not with that hand.' },
  tough: { title: 'Tough as Toenails', box: 'silver', text: 'You cleared a floor without drinking a single potion. Stubborn. Possibly concussed.' },
  finale: { title: 'Series Finale', box: null, text: 'You cancelled the Showrunner. Permanently. The network is reviewing its options.' },
};

const SYSTEM_LINES = {
  levelup: [
    'LEVEL UP! You have become marginally more dangerous.',
    'LEVEL UP! Your mother would be proud. Your mother cannot see this. Probably.',
    'LEVEL UP! Spend your stat points before something eats you. [TAB]',
  ],
  death: [
    'You have died. The audience gave it a 7 out of 10.',
    'You have died. Your cat has already listed your belongings for auction.',
    'You have died. Don\'t worry, the replay is trending.',
  ],
  collapse: 'The floor collapsed. You were not on the stairs. This is what we call a teachable moment, except you can no longer be taught.',
  stairsLocked: 'The stairwell is sealed by the floor boss\'s barrier. Kill the boss. Or stare at it. Staring is not recommended.',
  stairsOpen: 'The floor boss is dead! The stairwell barrier has dropped. Descend when ready.',
  safeRoom: 'You are in a Safe Room. Monsters cannot enter. You heal quickly here. Talk to Mordecai to shop and open boxes.',
  boxNotSafe: 'Loot boxes can only be opened in a Safe Room. Rules are rules. We made them up, but still.',
  timeWarn: 'One minute until the floor collapses. Hurry, or don\'t. Your funeral is good content either way.',
};

const DONUT_LINES = {
  start: [
    'Carl. Carl! We are on TELEVISION. Fix your hair. Actually, fix everything.',
    'I have been informed that I am a Princess. I always knew. Now it is official.',
  ],
  kill: [
    'Magic Missile! Did everyone see that? Somebody tell me they saw that.',
    'That one looked at me funny.',
    'I am a PRINCESS and also a MURDERER. Both can be true.',
    'Mongo would have been proud. Mongo is not here. Mongo is a dinosaur. Never mind.',
    'Another one for the highlight reel!',
  ],
  hurt: [
    'Carl, you are bleeding on my fur. Stop that.',
    'Carl! Drink a potion! Press Q! Why am I always the responsible one?',
    'If you die, who is going to carry my snacks?',
  ],
  level: [
    'You leveled up! I leveled up too, spiritually.',
    'Put points into Charisma, Carl. Look at me. Charisma works.',
  ],
  boss: [
    'Carl, that one is big. Punch it until it is small.',
    'A boss! Okay, I will do the magic, you do the screaming.',
  ],
  idle: [
    'Do you think the audience likes my tiara? They must. Look at it.',
    'Why do you not wear pants, Carl? I am asking for the viewers.',
    'I am bored. Let us go murder something.',
    'My fan count is higher than yours. I checked.',
  ],
  descend: [
    'Next floor! Try to keep up, Carl.',
    'Onward! Down is the only direction that pays.',
  ],
  ult: [
    'MAGIC MISSILE BARRAGE! Bow before your Princess!',
    'Everybody DIES! Except Carl. Mostly.',
  ],
};

const MORDECAI_LINES = [
  'Welcome to the Safe Room, kid. Sit. Buy things. Don\'t get blood on the rug.',
  'Hob-lobbers are your friend. Throw them far. Farther than that.',
  'The boss sits on the stairwell. Always does. Showbiz.',
  'Open your boxes. Loot doesn\'t help you from inside a box.',
  'Stat points in Constitution keep you alive. Stat points in Charisma keep you famous. Your call.',
  'If the timer hits zero, the floor goes and you go with it. Don\'t dawdle.',
  'Your cat is terrifying. I mean that as a compliment.',
];
