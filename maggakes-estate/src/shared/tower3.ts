import type { TaskDef, TaskKind } from './floors';

/**
 * Floors 25–100: one themed floor each. Every theme sets the look (mood, floor, colours, a
 * centrepiece, corner props and two side rooms) and 5 tasks, written in a short form:
 *   seq|Label|🧁 Step,🍓 Step,…   mem|Label|🍦 🍨 🍧 🍰 🧁 🍩   catch|Label|good|bad
 *   spot|Label|a/b c/d e/f   word|Label|WORD,WORD,WORD,WORD   maze|Label|me|goal
 *   hold|Label   rhythm|Label   timing|Label   simon|Label   collect|Label|item
 * The client builds the floor plan from the same theme (src/client/world/layouts5.ts).
 */

export interface TowerTheme {
  n: number;
  name: string;
  emoji: string;
  blurb: string;
  mood: 'day' | 'golden' | 'moody' | 'garage';
  floor: 'wood' | 'darkwood' | 'marble' | 'tile' | 'carpet' | 'pinkcarpet' | 'concrete' | 'grass' | 'deck' | 'rubber' | 'sand' | 'terrazzo' | 'stone';
  tint?: string;
  wall: string;
  accent: string;
  /** Open-air rooftop with a railing instead of glass. */
  open?: boolean;
  /** Prop specs: "name" or "name#colour". */
  centre: string;
  corners: string[];
  extra: string[];
  s1: { name: string; props: string[] };
  s2: { name: string; props: string[] };
  tasks: string[];
}

type Look = [TowerTheme['mood'], TowerTheme['floor'], string, string, string, boolean?];
const t = (name: string, emoji: string, blurb: string, look: Look, centre: string, corners: string, extra: string, s1: string, s2: string, tasks: string[]): Omit<TowerTheme, 'n'> => {
  const [mood, floor, tint, wall, accent, open] = look;
  const [s1n, ...s1p] = s1.split('|');
  const [s2n, ...s2p] = s2.split('|');
  return { name, emoji, blurb, mood, floor, tint: tint || undefined, wall, accent, open, centre, corners: corners.split(' '), extra: extra ? extra.split(' ') : [], s1: { name: s1n, props: s1p }, s2: { name: s2n, props: s2p }, tasks };
};

const LIST: Omit<TowerTheme, 'n'>[] = [
  t('Ice Cream Parlour', '🍦', 'Fifty flavours, sprinkle walls and a giant sundae fountain.', ['day', 'tile', '#ffe3ef', '#fff4f9', '#ff6fb5'],
    'fountain', 'cafetable#ff9fc4 cafetable#7fd8ff cafetable#ffd23f cafetable#b388ff', 'kiosk cupcake', 'Waffle Cones|stall|cakestand', 'Freezer Room|minifridge',
    ['seq|Build a giant sundae|🍨 Bowl,🍦 Three scoops,🍫 Hot fudge,🌈 Sprinkles,🍒 Cherry on top', 'mem|Flavour memory|🍦 🍨 🍧 🍓 🍫 🍌', 'catch|Catch the falling scoops|🍦|🔥', 'word|Spell the flavours|VANILLA,MANGO,CHERRY,FUDGE', 'hold|Scrub the freezer']),
  t('Dinosaur Museum', '🦖', 'Giant fossils, a T-Rex skeleton and a dig pit.', ['day', 'stone', '#e8dcc8', '#f3ece0', '#c47a2c'],
    'statue', 'displaycase displaycase plant bigtree', 'podium books', 'Dig Pit|sandcastle|sandcastle', 'Gift Shop|prizes',
    ['maze|Lead the baby dino home|🦕|🥚', 'mem|Fossil memory|🦖 🦕 🦴 🥚 🌋 🌿', 'spot|Spot the odd dinosaur|🦖/🦕 🦴/🥩 🌋/⛰️', 'collect|Dig up fossils|🦴', 'word|Spell the dinosaurs|TREX,RAPTOR,FOSSIL,JURASSIC']),
  t('Rainforest', '🌴', 'Steamy jungle with a waterfall, parrots and hanging vines.', ['golden', 'grass', '#3f8a45', '#d9eed0', '#33c47a'],
    'waterfall', 'palm palm bigtree planttree', 'perch hammock', 'Tree Hut|hammock|plant', 'Frog Pond|planter',
    ['catch|Catch the mangoes|🥭|🐍', 'maze|Guide the frog to the pond|🐸|💧', 'mem|Jungle memory|🦜 🐒 🐸 🦋 🐍 🌺', 'hold|Water the giant ferns', 'rhythm|Jungle drum beat']),
  t('Space Station', '🚀', 'Zero-gravity labs, a rocket launch pad and Earth out the window.', ['moody', 'concrete', '#2a2f45', '#141826', '#33e1ff'],
    'rocket', 'controldesk controldesk telescope bigscope', 'orrery spotlight', 'Mission Control|controldesk|tv', 'Airlock|storage',
    ['seq|Launch the rocket|🧑‍🚀 Suit up,🔒 Close the hatch,⛽ Fuel up,🔢 Countdown,🚀 Blast off', 'simon|Repeat the control panel lights', 'catch|Catch the stars|⭐|☄️', 'word|Spell the planets|MARS,SATURN,JUPITER,NEPTUNE', 'mem|Space memory|🚀 🪐 🌙 ⭐ 👽 🛰️']),
  t('Pirate Ship Deck', '☠️', 'A pirate ship on the roof, with a treasure chest and a lookout.', ['golden', 'deck', '#b98552', '#f5efe6', '#e63946', true],
    'stage#7a4a2e', 'trident lantern lantern tikitorch', 'surfboard#7a4a2e firepit', 'Captain’s Cabin|desk|books', 'Galley|counter',
    ['maze|Find the buried treasure|🏴‍☠️|💰', 'catch|Catch the gold coins|🪙|💣', 'spot|Spot the odd parrot|🦜/🐦 ⚓/🪝 🗺️/📜', 'hold|Swab the deck', 'word|Talk like a pirate|AHOY,TREASURE,ANCHOR,PARROT']),
  t('Chocolate Factory', '🍫', 'Chocolate rivers, candy machines and a golden ticket.', ['golden', 'tile', '#7a4a2e', '#f8e8d4', '#7a4a2e'],
    'chocfountain', 'oven oven candycane candycane', 'cakestand lollipop', 'Golden Tickets|displaycase|prizes', 'Taste Room|cafetable#7a4a2e',
    ['seq|Make a chocolate bar|🫘 Cocoa beans,🔥 Roast,🥛 Add milk,🍫 Mould,🎀 Wrap', 'catch|Catch the chocolates|🍫|🥦', 'mem|Sweet memory|🍫 🍬 🍭 🍩 🧁 🍪', 'timing|Fill the moulds perfectly', 'word|Spell the sweets|TRUFFLE,CARAMEL,FUDGE,NOUGAT']),
  t('Library of Secrets', '📚', 'Towering shelves, rolling ladders and a hidden reading nook.', ['moody', 'darkwood', '#5a3b28', '#2f2230', '#d4af37'],
    'bookshelf', 'bookshelf bookshelf armchair floorlamp', 'books candelabra', 'Reading Nook|beanbag|books', 'Map Room|desk',
    ['collect|Return the lost books|📕', 'word|Unscramble the book titles|STORY,MAGIC,DRAGON,CASTLE', 'spot|Find the odd book|📕/📗 📘/📙 📜/📃', 'mem|Library memory|📚 📖 🔖 🕯️ 🗝️ 🦉', 'hold|Dust the shelves']),
  t('Roller Disco', '🛼', 'A shiny rink, disco balls and a skate hire counter.', ['moody', 'terrazzo', '#3a2a55', '#1f1630', '#ff3df0'],
    'discoball', 'speaker speaker dancepad dancepad', 'djbooth spotlight', 'Skate Hire|rack|bench', 'Milkshake Bar|cafetable#ff3df0',
    ['rhythm|Skate to the beat', 'simon|Copy the disco lights', 'catch|Catch the glow sticks|🪩|🍌', 'seq|Lace up your skates|🧦 Socks on,🛼 Skates on,🎀 Lace up,🪖 Helmet,🕺 Roll out', 'mem|Disco memory|🛼 🪩 🎵 💜 ⭐ 🕺']),
  t('Pet Hotel', '🐾', 'Five-star suites for cats, dogs, bunnies and one very fancy goldfish.', ['day', 'pinkcarpet', '#ffe0ec', '#fff8fb', '#ff7a1a'],
    'cattree', 'petbed petbed petbowls petbath', 'toys cattree', 'Grooming|petbath|mirror', 'Treat Bar|petbowls',
    ['collect|Fetch the toys|🎾', 'hold|Brush the fluffy cat', 'mem|Pet memory|🐶 🐱 🐰 🐹 🐠 🐦', 'seq|Check in a puppy|📋 Sign in,🦴 Treat,🛁 Bath,🎀 Bow,🛏️ Bed', 'catch|Catch the treats|🦴|🧅']),
  t('Ski Lodge', '⛷️', 'Cosy fireplace, hot chocolate and snowy slopes outside.', ['day', 'darkwood', '#8a5a3a', '#f7efe4', '#33a8ff'],
    'fireplace', 'pine pine snowman sofa', 'hotchoc rug#d9e8f5', 'Ski Hire|rack|bench', 'Hot Choc Bar|hotchoc',
    ['seq|Get ready to ski|🧦 Thermals,🧥 Jacket,🧤 Gloves,🥽 Goggles,🎿 Skis', 'maze|Ski down the slope|⛷️|🏁', 'catch|Catch the snowflakes|❄️|🪨', 'hold|Warm up by the fire', 'word|Spell the winter words|SNOW,SLOPE,MITTENS,COCOA']),
  t('Science Lab', '🧪', 'Bubbling potions, a giant microscope and a volcano experiment.', ['day', 'tile', '#e6f3f7', '#ffffff', '#33c47a'],
    'cauldron#33c47a', 'desk desk bigscope storage', 'telescope books', 'Experiment Room|desk|cauldron', 'Supply Closet|storage',
    ['seq|Do the volcano experiment|🧪 Baking soda,🥤 Vinegar,🔴 Food colouring,🥄 Stir,🌋 Eruption',
      'simon|Repeat the beaker colours', 'spot|Find the odd chemical|🧪/⚗️ 🔬/🔭 🧫/🧬', 'mem|Lab memory|🧪 🔬 🧬 🧲 ⚗️ 💡', 'timing|Measure exactly']),
  t('Fairy Forest', '🧚', 'Glowing mushrooms, fairy lights and a wishing tree.', ['golden', 'grass', '#6fbf73', '#f4fff0', '#b388ff'],
    'bigtree', 'gummytree gummytree butterflies butterflies', 'fairylights lantern', 'Fairy Houses|toys|plant', 'Wishing Well|fountain',
    ['collect|Catch the fireflies|✨', 'mem|Fairy memory|🧚 🍄 🌸 🦋 🌙 ✨', 'maze|Fly the fairy home|🧚|🍄', 'word|Spell the magic words|SPARKLE,WINGS,WISH,GLITTER', 'rhythm|The fairy dance']),
  t('Movie Studio', '🎬', 'Lights, camera, action! A film set with a giant screen.', ['moody', 'concrete', '#2a2a2a', '#1b1b1f', '#ffd23f'],
    'cinemascreen', 'camera spotlight spotlight popcorn', 'viprope cinemaseats', 'Make-up Room|vanity|mirror', 'Snack Bar|popcorn',
    ['seq|Film a scene|📝 Script,💄 Make-up,💡 Lights,🎥 Camera,🎬 Action!', 'spot|Spot the blooper|🎬/🎞️ 🎥/📷 🍿/🥤', 'timing|Clap the clapperboard on time', 'mem|Movie memory|🎬 🍿 🎥 ⭐ 🎟️ 🏆', 'catch|Catch the popcorn|🍿|🧱']),
  t('Pizza Kitchen', '🍕', 'Wood-fired ovens, flying dough and the cheesiest pizza ever.', ['golden', 'tile', '#f3dcc3', '#fff6ea', '#e63946'],
    'oven', 'counter counter diningtable cafetable#e63946', 'espresso plant', 'Dough Room|counter|oven', 'Dining|cafetable#ffd23f',
    ['seq|Make a pizza|🫓 Dough,🍅 Sauce,🧀 Cheese,🍄 Toppings,🔥 Bake', 'catch|Catch the toppings|🍄|🧦', 'timing|Toss the dough', 'mem|Topping memory|🍕 🧀 🍅 🍄 🫒 🌶️', 'word|Spell the toppings|CHEESE,OLIVE,BASIL,PEPPERONI']),
  t('Tropical Lagoon', '🏝️', 'An open-air rooftop lagoon with palms, cabanas and a waterfall.', ['golden', 'sand', '#e9d6a8', '#f5efe6', '#33c4c4', true],
    'koipond', 'palm palm cabana sunbed', 'tikitorch umbrella', 'Cabana|daybed|plant', 'Juice Bar|bar',
    ['catch|Catch the coconuts|🥥|🦀', 'hold|Rub on the sunscreen', 'mem|Island memory|🏝️ 🐠 🌺 🥥 🐢 🌊', 'maze|Paddle to the island|🛶|🏝️', 'rhythm|Ukulele jam']),
  t('Castle Throne Room', '👑', 'Golden thrones, banners and a royal red carpet.', ['golden', 'marble', '#f3e6c8', '#fbf3e4', '#d4af37'],
    'podium', 'pillar pillar candelabra candelabra', 'chandelier rug#c62a3a', 'Royal Bedroom|canopybed|vanity', 'Treasury|displaycase',
    ['seq|Get ready for the coronation|👗 Gown,💍 Jewels,👑 Crown,🎺 Trumpets,🏰 Wave to the crowd', 'spot|Spot the fake crown|👑/🎩 💍/💎 🗡️/🔪', 'mem|Royal memory|👑 🏰 💎 🦄 🐉 🗡️', 'hold|Polish the crown jewels', 'word|Spell the royal words|QUEEN,CASTLE,KNIGHT,THRONE']),
  t('Robot Workshop', '🤖', 'Build-a-bot benches, sparks and a dancing robot.', ['garage', 'concrete', '#5a6470', '#d9dee4', '#33a8ff'],
    'controldesk', 'storage storage desk desk', 'gantry tv', 'Parts Store|shelf|storage', 'Charging Bay|tv',
    ['seq|Build a robot|🦿 Legs,🦾 Arms,🔋 Battery,🧠 Brain chip,🤖 Switch on', 'simon|Program the robot', 'collect|Collect the bolts|🔩', 'spot|Find the broken part|⚙️/🔩 🔋/🪫 💡/🕯️', 'mem|Robot memory|🤖 ⚙️ 🔋 🔧 💡 🛰️']),
  t('Butterfly House', '🦋', 'A warm glasshouse full of butterflies and flowers.', ['day', 'grass', '#7fc47f', '#f5fff2', '#ff9fc4'],
    'butterflies', 'planter planter cherry cherry', 'butterflies plant', 'Caterpillar Corner|plant|planter', 'Flower Stall|planter',
    ['catch|Catch the nectar|🌼|🐝', 'mem|Wing memory|🦋 🐛 🌸 🌼 🌷 🐞', 'maze|Help the caterpillar|🐛|🍃', 'hold|Mist the flowers', 'word|Spell the life cycle|EGG,CATERPILLAR,COCOON,BUTTERFLY']),
  t('Ballet Studio', '🩰', 'Mirrors, barres and a spotlight stage.', ['day', 'wood', '#e8d6c4', '#fff7f9', '#ff9fc4'],
    'stage#ffc0d9', 'mirror mirror bench yogamat', 'piano plant', 'Dressing Room|vanity|rack', 'Shoe Room|shelf',
    ['rhythm|Dance the routine', 'seq|Get ready for the show|🩰 Ballet shoes,👗 Tutu,💇 Bun,💄 Make-up,🌟 Curtain up', 'timing|Land the pirouettes', 'mem|Ballet memory|🩰 🎀 🦢 🎶 🌸 👑', 'simon|Copy the dance moves']),
  t('Detective Agency', '🕵️', 'Clues, magnifying glasses and a big mystery to solve.', ['moody', 'darkwood', '#4a3a30', '#2a2420', '#ffd23f'],
    'desk', 'bookshelf floorlamp armchair storage', 'books tv', 'Evidence Room|displaycase|shelf', 'Interview Room|chair',
    ['collect|Find the clues|🔍', 'spot|Spot the fake footprint|👣/🐾 🔑/🗝️ 🕵️/👮', 'word|Crack the code words|CLUE,SUSPECT,MYSTERY,ALIBI', 'mem|Evidence memory|🔍 🗝️ 👣 🕯️ 📜 🧤', 'maze|Follow the footprints|🕵️|🗝️']),
  t('Volcano Lab', '🌋', 'Glowing lava, rock samples and a safe viewing deck.', ['moody', 'stone', '#5a2a1a', '#2a1610', '#ff7a1a'],
    'firepit', 'statue statue controldesk storage', 'spotlight#ff7a1a lantern', 'Rock Samples|displaycase|shelf', 'Safety Room|storage',
    ['catch|Catch the rock samples|🪨|🔥', 'maze|Escape the lava|🏃|🚪', 'timing|Measure the eruption', 'mem|Volcano memory|🌋 🔥 🪨 💎 🧯 🌡️', 'seq|Take a lava sample|🧤 Heat gloves,🪖 Helmet,🥄 Scoop,🧪 Jar,🧊 Cool down']),
  t('Farm & Barn', '🐄', 'A real farm up in the sky: cows, chickens and a hay barn.', ['day', 'grass', '#8fc46f', '#fbf3e4', '#e63946', true],
    'tent#e63946', 'hedge hedge planter planter', 'cone stand', 'Chicken Coop|petbed|petbowls', 'Farm Shop|stall',
    ['collect|Collect the eggs|🥚', 'seq|Milk the cow|🪣 Bucket,🧼 Wash hands,🐄 Milk,🥛 Bottle,🧊 Fridge', 'catch|Catch the apples|🍎|🐛', 'mem|Farm memory|🐄 🐔 🐷 🐑 🐴 🌽', 'hold|Brush the pony']),
  t('Underwater Palace', '🧜', 'A mermaid palace with coral thrones and pearl walls.', ['moody', 'sand', '#1f6b8a', '#0f3a55', '#7fe7f5'],
    'bigtank', 'jellytube jellytube touchpool shark', 'trident aquarium', 'Pearl Room|displaycase|vanity', 'Coral Garden|plant',
    ['collect|Collect the pearls|🫧', 'mem|Mermaid memory|🧜 🐚 🐠 🐙 🦀 🪸', 'maze|Swim to the castle|🧜|🏰', 'catch|Catch the shells|🐚|🦈', 'word|Spell the sea words|CORAL,PEARL,MERMAID,OCEAN']),
  t('Gaming Lounge', '🎮', 'Gaming chairs, a giant screen and every console ever.', ['moody', 'rubber', '#2a2340', '#141022', '#b388ff'],
    'cinemascreen', 'gamingchair gamingchair arcade arcade', 'beanbag beanbag', 'Retro Room|arcade|claw', 'Snack Station|minifridge',
    ['simon|Beat the combo', 'rhythm|Rhythm game', 'catch|Catch the power-ups|🍄|💀', 'mem|Gamer memory|🎮 👾 🕹️ 🏆 ⭐ 🎧', 'maze|Clear the level|👾|🏁']),
  t('Flower Shop', '💐', 'Buckets of roses, tulips and sunflowers everywhere.', ['day', 'tile', '#f5e8ec', '#fffafc', '#ff6fb5'],
    'planter', 'planter planter plant plant', 'stall cherry', 'Workroom|counter|planter', 'Cool Room|minifridge',
    ['seq|Make a bouquet|🌹 Roses,🌷 Tulips,🌿 Greenery,🎀 Ribbon,💌 Card', 'mem|Flower memory|🌹 🌷 🌻 🌼 🌸 💐', 'catch|Catch the petals|🌸|🐌', 'hold|Water the plants', 'word|Spell the flowers|ROSE,TULIP,DAISY,ORCHID']),
  t('Grand Ballroom', '💃', 'Halfway up! Crystal chandeliers, a dance floor and an orchestra.', ['golden', 'marble', '#f6ecd8', '#fdf6e8', '#d4af37'],
    'chandelier', 'grandpiano champagne pillar pillar', 'candelabra viprope', 'Powder Room|vanity|mirror', 'Coat Check|rack',
    ['rhythm|Waltz to the music', 'seq|Get ready for the ball|👗 Gown,👠 Heels,💎 Necklace,🎭 Mask,💃 Dance', 'mem|Ballroom memory|💃 🕺 🎻 🥂 💎 🌹', 'timing|Spin at the right moment', 'spot|Spot the odd mask|🎭/😷 🎻/🎸 🥂/🍺']),
  t('Desert Oasis', '🐪', 'Golden dunes, camels and a cool palm-shaded pool.', ['golden', 'sand', '#e8c88a', '#f5e6c8', '#ff9f1c', true],
    'koipond', 'palm palm tent planter', 'lantern tikitorch', 'Bazaar|stall|rug#c47a2c', 'Rest Tent|daybed',
    ['maze|Find the oasis|🐪|🌴', 'catch|Catch the dates|🌴|🦂', 'mem|Desert memory|🐪 🌵 ☀️ 🏜️ 🦎 💧', 'hold|Fill the water jugs', 'word|Spell the desert words|CAMEL,DUNE,CACTUS,OASIS']),
  t('Toy Store', '🧸', 'Teddies taller than you, train sets and a giant dollhouse.', ['day', 'pinkcarpet', '#ffe6f0', '#fffaf3', '#33a8ff'],
    'teddy', 'toys toys shelf shelf', 'balloons kidslide', 'Doll House|toys|teddy', 'Wrapping Desk|counter',
    ['collect|Put the toys away|🧸', 'mem|Toy memory|🧸 🪀 🚂 🎲 🪁 🎈', 'seq|Wrap a present|📦 Box,🧸 Toy,📄 Paper,🎀 Bow,🏷️ Tag', 'spot|Spot the broken toy|🧸/🐻 🪀/🔵 🎲/🎯', 'catch|Catch the balloons|🎈|📌']),
  t('Art Gallery', '🖼️', 'Masterpieces, sculptures and your own painting corner.', ['day', 'terrazzo', '#eee9e2', '#ffffff', '#e63946'],
    'sculpture', 'easel easel bench bench', 'poster poster', 'Paint Studio|easel|pottery', 'Gallery Shop|displaycase',
    ['seq|Paint a masterpiece|🖼️ Canvas,✏️ Sketch,🎨 Mix colours,🖌️ Paint,✍️ Sign it', 'spot|Spot the fake painting|🖼️/🪞 🎨/🥏 🗿/🪨', 'mem|Art memory|🎨 🖌️ 🖼️ 🗿 ✏️ 🖍️', 'hold|Dust the sculptures', 'word|Spell the colours|CRIMSON,TURQUOISE,VIOLET,AMBER']),
  t('Camping Ground', '🏕️', 'Tents, a campfire, marshmallows and starry skies.', ['moody', 'grass', '#4f7a3f', '#f5efe6', '#ff9f1c', true],
    'firepit', 'tent tent bigtree bigtree', 'lantern bench', 'Ranger Hut|desk|books', 'Canoe Hire|surfboard',
    ['seq|Toast a marshmallow|🪵 Firewood,🔥 Light it,🍡 Skewer,🔄 Turn slowly,😋 Eat', 'catch|Catch the marshmallows|🍡|🦟', 'maze|Hike to the lookout|🥾|⛰️', 'mem|Camping memory|🏕️ 🔥 🌲 🦉 🔦 ⛺', 'hold|Pump up the air mattress']),
  t('Magic School', '🪄', 'Floating candles, spell books and a sorting hat.', ['moody', 'stone', '#5a4a6a', '#2a2238', '#b388ff'],
    'cauldron', 'bookshelf bookshelf candelabra candelabra', 'orrery books', 'Potions Class|cauldron|shelf', 'Owl Tower|perch',
    ['simon|Cast the spell pattern', 'seq|Brew a potion|🐸 Frog spawn,🌿 Herbs,⭐ Stardust,🔥 Bubble,✨ Sparkle', 'word|Spell the spells|ABRACADABRA,POTION,WAND,WIZARD', 'mem|Magic memory|🪄 🧙 🦉 📜 🔮 🧹', 'catch|Catch the golden snitch|✨|🦇']),
  t('Sushi Bar', '🍣', 'A conveyor belt, a sushi chef and a koi pond.', ['golden', 'wood', '#d9c4a8', '#fbf3e8', '#e63946'],
    'sushibar', 'cafetable#e63946 cafetable#e63946 bonsai bonsai', 'lantern koipond', 'Kitchen|counter|oven', 'Tea Room|cafetable#7a4a2e',
    ['seq|Roll some sushi|🟩 Nori,🍚 Rice,🐟 Salmon,🥒 Cucumber,🍣 Slice', 'catch|Catch the sushi|🍣|🌶️', 'mem|Sushi memory|🍣 🍙 🍤 🥢 🍵 🐟', 'timing|Slice it perfectly', 'word|Spell the Japanese food|SUSHI,RAMEN,MOCHI,TEMPURA']),
  t('Northern Lights Igloo', '🌌', 'Ice igloos, snow and glowing green skies.', ['moody', 'tile', '#d9ecf5', '#eaf6fb', '#4fe8a8', true],
    'igloo', 'snowman snowman pine pine', 'firepit hotchoc', 'Ice Hotel|bed|rug#d9e8f5', 'Sled Shed|storage',
    ['hold|Build an igloo wall', 'catch|Catch the snowflakes|❄️|🧊', 'mem|Arctic memory|🐧 🐻‍❄️ ❄️ 🌌 🦭 🛷', 'maze|Sled to the igloo|🛷|🏠', 'word|Spell the snowy words|AURORA,IGLOO,BLIZZARD,FROST']),
  t('Fire Station', '🚒', 'A shiny fire truck, a fireman’s pole and hoses.', ['day', 'concrete', '#c8c2b8', '#f5efe6', '#e63946'],
    'parkedcar#e63946', 'storage storage bench cone', 'gantry rack', 'Bunk Room|bed|nightstand', 'Kitchen|counter',
    ['seq|Get ready for a callout|🧑‍🚒 Uniform,🪖 Helmet,🧤 Gloves,🚒 Into the truck,🚨 Sirens on', 'catch|Catch the water drops|💧|🔥', 'maze|Rescue the kitten|🧑‍🚒|🐱', 'hold|Wash the fire truck', 'mem|Rescue memory|🚒 🧯 🪖 🚨 🐕 💧']),
  t('Vet Clinic', '🐶', 'Look after poorly puppies, kittens and a cheeky parrot.', ['day', 'tile', '#e6f3f0', '#ffffff', '#33c4a8'],
    'reception', 'petbed petbed cattree petbowls', 'plant bench', 'Exam Room|spabed|storage', 'Recovery|petbed',
    ['seq|Check up a puppy|⚖️ Weigh,🌡️ Temperature,👂 Ears,🦷 Teeth,🦴 Treat', 'hold|Bandage a paw', 'mem|Patient memory|🐶 🐱 🐰 🐦 🐢 🐹', 'collect|Find the lost hamsters|🐹', 'spot|Spot the sick bunny|🐰/🐇 🐶/🐕 🐱/🐈']),
  t('Rock Concert', '🎸', 'A huge stage, guitars, pyro and a screaming crowd.', ['moody', 'concrete', '#2a2a2a', '#141414', '#ff3d3d'],
    'fstage', 'speaker speaker drums guitar', 'spotlight spotlight', 'Backstage|vanity|sofa', 'Merch Stand|stall',
    ['rhythm|Shred the guitar solo', 'simon|Copy the drum fill', 'seq|Set up the show|🎸 Tune guitars,🥁 Set up drums,🔌 Plug in,🎤 Mic check,🤘 Rock out', 'mem|Rock memory|🎸 🥁 🎤 🤘 🔊 ⚡', 'catch|Catch the guitar picks|🎸|🥚']),
  t('Bubble Tea Café', '🧋', 'Pearls, popping boba and pastel chairs.', ['day', 'terrazzo', '#f1e3ef', '#fff8fc', '#b388ff'],
    'kiosk', 'cafetable#b388ff cafetable#ffd6e7 cafetable#bfe3f2 plant', 'espresso cupcake', 'Kitchen|counter|minifridge', 'Window Seats|beanbag',
    ['seq|Make a bubble tea|🧊 Ice,🍵 Tea,🥛 Milk,⚫ Pearls,🧋 Shake', 'catch|Catch the boba pearls|⚫|🧄', 'mem|Café memory|🧋 🍓 🥭 🍵 🍰 🍡', 'timing|Seal the cup', 'word|Spell the flavours|TARO,MATCHA,LYCHEE,PEACH']),
  t('Circus Big Top', '🎪', 'Acrobats, clowns, a trapeze and candy floss.', ['golden', 'sand', '#e8c88a', '#fbe8e8', '#e63946'],
    'tent#e63946', 'popcorn balloons balloons stand', 'podium bunting', 'Clown Room|vanity|mirror', 'Ticket Booth|kiosk',
    ['timing|Walk the tightrope', 'catch|Juggle the balls|🔴|🍌', 'seq|Put on the show|🎟️ Tickets,🎪 Big top,🤡 Clowns,🤸 Acrobats,🎉 Grand finale', 'mem|Circus memory|🎪 🤡 🦁 🎩 🐘 🎈', 'spot|Spot the real clown nose|🔴/🟠 🎩/👒 🎈/🎏']),
  t('Bee Farm', '🐝', 'Buzzing hives, honey jars and sunflowers.', ['golden', 'grass', '#a8c46f', '#fff8e0', '#ffc21f', true],
    'gazebo', 'planter planter hedge hedge', 'stall bench', 'Honey Kitchen|counter|shelf', 'Bee Suits|rack',
    ['catch|Catch the honey drops|🍯|🐦', 'hold|Calm the bees with smoke', 'seq|Collect honey|🧑‍🌾 Bee suit,💨 Smoke,🪵 Open hive,🍯 Honeycomb,🫙 Jar it', 'mem|Garden memory|🐝 🌻 🍯 🌼 🐞 🌸', 'maze|Fly the bee to the flower|🐝|🌻']),
  t('Egyptian Tomb', '🏺', 'Pyramids, hieroglyphs and a golden sarcophagus.', ['golden', 'sand', '#d9b77a', '#e8d0a0', '#d4af37'],
    'statue', 'pillar pillar displaycase displaycase', 'lantern lantern', 'Treasure Chamber|displaycase|prizes', 'Scroll Room|shelf',
    ['maze|Escape the pyramid|🧭|🚪', 'spot|Find the real treasure|🏺/⚱️ 👑/🎩 💎/🔷', 'word|Spell the Egypt words|PYRAMID,MUMMY,PHARAOH,SPHINX', 'mem|Tomb memory|🏺 🐫 👑 🐍 🗝️ 📜', 'collect|Collect the scarabs|🪲']),
  t('Nail & Beauty Bar', '💅', 'Nail polish walls, pamper chairs and face masks.', ['day', 'marble', '#fce8f0', '#fff5fa', '#ff6fb5'],
    'nailbar', 'salonchair salonchair vanity vanity', 'mirror plant', 'Face Mask Room|spabed|candles', 'Polish Wall|shelf',
    ['seq|Do a manicure|💧 Soak,🗂️ File,💅 Base coat,🌈 Colour,✨ Top coat', 'hold|Wait for the face mask', 'mem|Pamper memory|💅 💄 🧴 🪞 🌸 💖', 'spot|Spot the odd polish|💅/🖌️ 💄/🖍️ 🧴/🧃', 'timing|Paint without smudging']),
  t('Train Station', '🚂', 'Steam trains, ticket barriers and a station clock.', ['day', 'stone', '#c8bfb2', '#f5efe6', '#33c47a'],
    'reception', 'bench bench streetlamp streetlamp', 'kiosk busstop', 'Ticket Office|counter|kiosk', 'Waiting Room|bench',
    ['seq|Catch the train|🎟️ Buy ticket,🚪 Barrier,⏰ Check the time,🚉 Platform,🚂 All aboard', 'timing|Stamp the tickets', 'maze|Find platform 9|🧳|🚂', 'mem|Station memory|🚂 🎟️ 🧳 ⏰ 🚉 ☕', 'catch|Catch the luggage|🧳|🕳️']),
  t('Candy Floss Clouds', '☁️', 'Fluffy pink clouds you can (almost) bounce on.', ['golden', 'pinkcarpet', '#ffd6ea', '#fff0f7', '#ff9fc4', true],
    'cakestand', 'lollipop lollipop candycane candycane', 'balloons gummytree', 'Candy Floss Machine|stall|cupcake', 'Cloud Couch|beanbag',
    ['catch|Catch the candy floss|🍭|🌧️', 'hold|Spin the candy floss', 'mem|Sweet cloud memory|☁️ 🍭 🌈 🦄 🍬 💖', 'maze|Hop across the clouds|🦄|🌈', 'rhythm|Cloud bounce beat']),
  t('Ninja Dojo', '🥋', 'Bamboo, paper walls and a training mat.', ['day', 'wood', '#d9c49a', '#f7f0e0', '#e63946'],
    'yogamat', 'bonsai bonsai lantern lantern', 'dumbbells mirror', 'Sword Room|displaycase|rack', 'Tea Room|cafetable#7a4a2e',
    ['timing|Break the board', 'simon|Copy the sensei’s moves', 'catch|Catch the throwing stars|⭐|🍅', 'mem|Dojo memory|🥋 🐉 🎋 🏮 🍵 🌸', 'maze|Sneak through the dojo|🥷|🏯']),
  t('Recording Studio', '🎙️', 'Soundproof booth, mixing desk and a gold record wall.', ['moody', 'carpet', '#3a3240', '#1f1a24', '#33e1ff'],
    'mixer', 'speaker speaker mic piano', 'vinylwall recordplayer', 'Vocal Booth|mic|stool', 'Lounge|sofa',
    ['rhythm|Lay down the beat', 'seq|Record a hit song|✍️ Write lyrics,🎹 Melody,🎤 Sing,🎚️ Mix,💿 Release', 'simon|Repeat the melody', 'mem|Music memory|🎙️ 🎧 🎹 🎸 💿 🎼', 'timing|Hit the high note']),
  t('Zoo Safari', '🦁', 'Lions, giraffes, a safari jeep and a viewing deck.', ['golden', 'grass', '#b8a860', '#f5efe0', '#ff9f1c', true],
    'parkedcar#5a7a3a', 'bigtree bigtree hedge hedge', 'tent bench', 'Keeper Hut|desk|storage', 'Snack Shack|kiosk',
    ['maze|Drive the safari jeep|🚙|🦒', 'catch|Feed the hippos|🍉|🪨', 'mem|Safari memory|🦁 🦒 🐘 🦓 🦛 🐒', 'spot|Spot the odd animal|🦁/🐯 🦓/🐴 🐘/🦣', 'word|Spell the animals|GIRAFFE,ZEBRA,LION,ELEPHANT']),
  t('Crystal Cave', '💎', 'Glowing crystals, an underground lake and echoes.', ['moody', 'stone', '#3a3a5a', '#1f1f33', '#b388ff'],
    'koipond', 'statue statue lantern lantern', 'displaycase spotlight#b388ff', 'Gem Shop|displaycase|shelf', 'Miner’s Hut|storage',
    ['collect|Collect the crystals|💎', 'maze|Find the way out|🔦|🚪', 'mem|Gem memory|💎 💍 🔮 ✨ 🪨 🦇', 'hold|Polish the giant gem', 'spot|Spot the real diamond|💎/🔷 💍/⭕ 🔮/🟣']),
  t('Surf Shack', '🏄', 'Surfboards, waves and a beach bar on the roof.', ['day', 'deck', '#b98552', '#f5efe6', '#33a8ff', true],
    'waterslide', 'surfboard surfboard sunbed sunbed', 'umbrella palm', 'Board Hire|rack|surfboard', 'Smoothie Bar|bar',
    ['timing|Catch the perfect wave', 'catch|Catch the seashells|🐚|🦈', 'seq|Go surfing|🩱 Wetsuit,🧴 Sunscreen,🏄 Board,🌊 Paddle out,🤙 Stand up', 'mem|Surf memory|🏄 🌊 🐚 🌴 🕶️ 🐬', 'hold|Wax the surfboard']),
  t('Pyjama Party', '🛌', 'Pillow forts, face masks, fairy lights and movies.', ['moody', 'pinkcarpet', '#e9d6f5', '#f6ecff', '#ff6fb5'],
    'tv', 'beanbag beanbag bed bed', 'fairylights teddy', 'Snack Corner|minifridge|popcorn', 'Pillow Fort|cushions',
    ['seq|Build a pillow fort|🛏️ Mattress,🪑 Chairs,🧣 Blankets,🧸 Teddies,✨ Fairy lights', 'catch|Catch the popcorn|🍿|🧦', 'mem|Sleepover memory|🛌 🧸 🍿 🎬 💅 🌙', 'hold|Pillow fight!', 'rhythm|Karaoke time']),
  t('Royal Tea Party', '🫖', 'Fancy cakes, tiny sandwiches and tea in a garden.', ['day', 'grass', '#a8d48a', '#fff8f0', '#ff9fc4', true],
    'cakestand', 'cafetable#ffd6e7 cafetable#ffd6e7 hedge hedge', 'gazebo bench', 'Kitchen|counter|oven', 'Hat Stand|rack',
    ['seq|Pour the perfect tea|🫖 Teapot,🍵 Cup,🥛 Milk,🍬 Sugar,🥄 Stir', 'catch|Catch the scones|🧁|🐝', 'mem|Tea party memory|🫖 🧁 🍰 🍓 🌹 👒', 'timing|Balance the teacups', 'spot|Spot the odd cake|🧁/🍰 🍪/🍘 🍓/🍒']),
  t('Gold Vault', '💰', 'Three quarters of the way! Gold bars, laser alarms and a giant safe.', ['golden', 'marble', '#d9c38a', '#f6ecd0', '#d4af37'],
    'displaycase', 'pillar pillar storage storage', 'spotlight spotlight', 'Coin Counting|counter|shelf', 'Security Desk|controldesk',
    ['maze|Dodge the lasers|🕵️|💰', 'simon|Crack the safe code', 'catch|Catch the gold coins|🪙|🚨', 'mem|Treasure memory|💰 🪙 💎 👑 🗝️ 💳', 'collect|Count the gold bars|🪙']),
  t('Mini Golf', '⛳', 'Windmills, ramps and a tricky 18 holes on the roof.', ['day', 'grass', '#5fbf5f', '#f5efe6', '#33c47a', true],
    'koipond', 'hedge hedge planter planter', 'bench cone', 'Club House|bar|sofa', 'Club Hire|rack',
    ['timing|Sink the putt', 'maze|Get the ball in the hole|⚪|⛳', 'mem|Golf memory|⛳ 🏌️ 🏆 🌳 🦆 ⚪', 'catch|Catch the golf balls|⚪|🦆', 'hold|Rake the sand trap']),
  t('Fortune Teller', '🔮', 'Crystal balls, tarot cards and starry curtains.', ['moody', 'carpet', '#4a2a5a', '#2a1838', '#b388ff'],
    'tent#5c1a5e', 'candles candles lavalamp lavalamp', 'bigscope rug#5c1a5e', 'Tarot Room|cafetable#5c1a5e|candles', 'Star Charts|shelf',
    ['simon|Read the crystal ball', 'mem|Fortune memory|🔮 🌙 ⭐ 🃏 🪬 🕯️', 'spot|Spot the lucky charm|🍀/☘️ 🌙/🌛 ⭐/🌟', 'word|Spell the mystic words|DESTINY,FORTUNE,CRYSTAL,ZODIAC', 'hold|Gaze into the crystal']),
  t('Snow Globe Village', '❄️', 'A tiny Christmas village inside a giant snow globe.', ['day', 'tile', '#e6f2fa', '#f5fbff', '#e63946'],
    'pine', 'snowman snowman candycane candycane', 'hotchoc festoon', 'Toy Workshop|toys|desk', 'Post Office|kiosk',
    ['seq|Decorate the tree|🎄 Tree,💡 Lights,🔴 Baubles,🎀 Tinsel,⭐ Star', 'catch|Catch the presents|🎁|🪨', 'mem|Festive memory|🎄 🎅 ⛄ 🎁 🦌 🔔', 'hold|Shake the snow globe', 'word|Spell the festive words|SLEIGH,REINDEER,TINSEL,SNOWMAN']),
  t('Cooking Show', '👩‍🍳', 'Bright lights, a live audience and a cook-off.', ['day', 'tile', '#f5e8d8', '#ffffff', '#ff7a1a'],
    'island', 'oven oven counter counter', 'camera spotlight', 'Pantry|shelf|minifridge', 'Green Room|sofa',
    ['seq|Cook pasta live|💧 Boil water,🍝 Pasta,🍅 Sauce,🧀 Parmesan,🌿 Basil', 'timing|Flip the pancake', 'catch|Catch the ingredients|🥕|🪳', 'mem|Kitchen memory|🍳 🥘 🧂 🥕 🧄 🍋', 'word|Spell the dishes|LASAGNE,RISOTTO,CURRY,TACOS']),
  t('Planetarium', '🪐', 'A dome full of stars and a giant model of the solar system.', ['moody', 'carpet', '#1a1f3a', '#0f1226', '#ffd23f'],
    'orrery', 'telescope telescope bigscope cinemaseats', 'spotlight beanbag', 'Star Shop|displaycase|prizes', 'Rocket Room|rocket',
    ['seq|Line up the planets|☿ Mercury,♀ Venus,🌍 Earth,🔴 Mars,🪐 Saturn', 'mem|Star memory|🪐 🌍 🌙 ☀️ ⭐ ☄️', 'catch|Catch the shooting stars|🌠|☄️', 'spot|Spot the odd planet|🪐/🟤 🌍/🌎 🌙/🍌', 'word|Spell the space words|GALAXY,COMET,ORBIT,ECLIPSE']),
  t('Lighthouse Lookout', '🗼', 'A lighthouse lamp, ships at sea and a seagull nest.', ['day', 'deck', '#c8b8a0', '#f5efe6', '#e63946', true],
    'bigscope', 'lifeguard trident lantern lantern', 'surfboard bench', 'Keeper’s Cottage|bed|desk', 'Fish & Chips|kiosk',
    ['timing|Flash the light at the ship', 'maze|Guide the ship safely|⛵|⚓', 'catch|Catch the fish|🐟|🪝', 'mem|Seaside memory|🗼 ⛵ 🐟 🦀 🌊 🐦', 'hold|Polish the lighthouse lamp']),
  t('Waterpark', '💦', 'Slides, splash pads and a lazy river on the roof.', ['day', 'tile', '#bfe9f5', '#f5fbff', '#33a8ff', true],
    'waterslide', 'sunbed sunbed umbrella umbrella', 'lifeguard palm', 'Changing Rooms|shower|bench', 'Snack Hut|kiosk',
    ['catch|Catch the beach balls|🏐|💧', 'timing|Jump off the board', 'maze|Float down the lazy river|🛟|🏁', 'mem|Splash memory|💦 🏊 🛟 🩱 🌞 🍉', 'hold|Pump up the floaties']),
  t('Dragon’s Lair', '🐉', 'A sleeping dragon, mountains of gold and glowing eggs.', ['moody', 'stone', '#3a2a2a', '#1f1414', '#ff3d3d'],
    'firepit', 'statue statue displaycase displaycase', 'candelabra lantern', 'Egg Nest|petbed|petbed', 'Armoury|rack',
    ['maze|Sneak past the dragon|🧝|💰', 'catch|Catch the dragon eggs|🥚|🔥', 'mem|Dragon memory|🐉 🔥 🥚 💰 🗡️ 🛡️', 'hold|Keep the eggs warm', 'word|Spell the dragon words|DRAGON,SCALES,TREASURE,FLAME']),
  t('Doughnut Shop', '🍩', 'Glazed, sprinkled and filled: a doughnut wall to the ceiling.', ['day', 'tile', '#ffe8d6', '#fff8f0', '#ff6fb5'],
    'cakestand', 'cafetable#ff6fb5 cafetable#ffd23f displaycase displaycase', 'espresso cupcake', 'Fryer Room|oven|counter', 'Coffee Bar|espresso',
    ['seq|Decorate a doughnut|🍩 Doughnut,🍫 Glaze,🌈 Sprinkles,🍓 Drizzle,📦 Box it', 'catch|Catch the doughnuts|🍩|🥬', 'mem|Doughnut memory|🍩 🍪 🧁 ☕ 🍫 🍓', 'timing|Flip them in the fryer', 'spot|Spot the odd doughnut|🍩/🥯 🍪/🍘 🧁/🍰']),
  t('Talent Show', '🎤', 'A spotlight stage, judges’ table and a golden buzzer.', ['moody', 'carpet', '#3a1f3a', '#1f1022', '#ffd23f'],
    'stage#ffd23f', 'spotlight spotlight cinemaseats cinemaseats', 'mic podium', 'Dressing Room|vanity|rack', 'Judges’ Room|diningtable',
    ['rhythm|Sing your heart out', 'simon|Copy the dance routine', 'timing|Hit the golden buzzer', 'mem|Talent memory|🎤 🎭 🎹 🤹 💃 🌟', 'seq|Get on stage|💄 Make-up,👗 Costume,🎵 Warm up,🙏 Deep breath,🌟 Perform']),
  t('Jungle Treehouse', '🌳', 'Rope bridges, a treehouse and swinging vines.', ['golden', 'deck', '#8a6a4a', '#f5efe6', '#33c47a', true],
    'bigtree', 'palm palm hammock planttree', 'swings lantern', 'Treehouse Den|beanbag|books', 'Lookout|telescope',
    ['maze|Cross the rope bridges|🧗|🏠', 'catch|Catch the bananas|🍌|🐍', 'hold|Climb the rope', 'mem|Treetop memory|🌳 🐒 🦜 🍌 🪢 🦥', 'rhythm|Swing on the vines']),
  t('Spy HQ', '🕶️', 'Gadgets, secret codes and laser beams.', ['moody', 'concrete', '#22262e', '#0f1218', '#33e1ff'],
    'controldesk', 'tv tv storage storage', 'spotlight#33e1ff desk', 'Gadget Lab|desk|displaycase', 'Disguise Room|rack',
    ['simon|Crack the code', 'maze|Sneak past the lasers|🕵️|📁', 'spot|Spot the double agent|🕵️/👮 🕶️/👓 📁/📂', 'word|Decode the message|AGENT,SECRET,GADGET,MISSION', 'mem|Gadget memory|🕶️ 📡 🔦 💼 🗝️ 📸']),
  t('Garden Picnic', '🧺', 'Picnic rugs, strawberries and a bubbling stream.', ['day', 'grass', '#7fc46f', '#f5efe6', '#ff6fb5', true],
    'koipond', 'cherry cherry planttree planttree', 'rug#ff9fc4 bench', 'Picnic Hut|counter|minifridge', 'Kite Shop|stall',
    ['seq|Pack the picnic|🧺 Basket,🥪 Sandwiches,🍓 Strawberries,🧃 Juice,🧻 Napkins', 'catch|Catch the strawberries|🍓|🐜', 'mem|Picnic memory|🧺 🥪 🍓 🦆 🌼 🪁', 'hold|Fly the kite', 'spot|Spot the odd sandwich|🥪/🌮 🍓/🍒 🧃/🥤']),
  t('Book Café', '☕', 'Coffee, cake and a book for every reader.', ['golden', 'darkwood', '#7a5a40', '#f5ece0', '#c47a2c'],
    'espresso', 'bookshelf bookshelf armchair armchair', 'cafetable#7a4a2e floorlamp', 'Kids’ Corner|beanbag|books', 'Bakery Case|displaycase',
    ['seq|Make a latte|☕ Espresso,🥛 Steam milk,🫗 Pour,🤍 Latte art,🍪 Biscuit', 'collect|Shelve the books|📗', 'mem|Café memory|☕ 📚 🍰 🥐 🫖 🍪', 'word|Spell the stories|FAIRYTALE,ADVENTURE,POEM,LEGEND', 'timing|Pour the latte art']),
  t('Rainbow Land', '🌈', 'Every colour at once: rainbow slides and unicorns.', ['day', 'pinkcarpet', '#ffe0f0', '#fff6fb', '#ff6fb5', true],
    'carousel', 'balloons balloons lollipop lollipop', 'gummytree cupcake', 'Unicorn Stable|petbed|hedge', 'Colour Shop|stall',
    ['seq|Paint the rainbow|🔴 Red,🟠 Orange,🟡 Yellow,🟢 Green,🔵 Blue', 'catch|Catch the rainbow drops|🌈|🌧️', 'mem|Rainbow memory|🌈 🦄 ⭐ 💖 🌸 🍭', 'maze|Ride the unicorn home|🦄|🏰', 'rhythm|Rainbow dance']),
  t('Time Machine', '⏳', 'Clocks everywhere and a machine that visits the past.', ['moody', 'terrazzo', '#3a3040', '#1f1a24', '#ffd23f'],
    'controldesk', 'statue displaycase displaycase pillar', 'orrery spotlight', 'Dino Era|bigtree|plant', 'Future Era|tv',
    ['seq|Travel back in time|📅 Pick a year,🔋 Charge up,🔒 Seatbelt,⚡ Lightning,⏳ Whoosh', 'simon|Set the dials', 'mem|History memory|🦖 🏰 🗿 🚀 ⏳ 👑', 'spot|Spot what doesn’t belong|🦖/📱 🏰/🛸 🗿/🎮', 'timing|Jump at the right second']),
  t('Glow Party', '🪩', 'Black lights, glow paint and a neon dance floor.', ['moody', 'rubber', '#1f1430', '#0f0a1a', '#4fe8a8'],
    'discoball', 'dancepad dancepad speaker speaker', 'djbooth lavalamp', 'Glow Paint Room|easel|lavalamp', 'Neon Bar|bar',
    ['rhythm|Glow dance battle', 'simon|Copy the neon lights', 'catch|Catch the glow sticks|🟢|⚫', 'mem|Neon memory|🪩 💚 💜 💛 🎶 ⚡', 'hold|Shake the glow sticks']),
  t('Polar Bear Rescue', '🐻‍❄️', 'Help cubs, penguins and seals at the arctic rescue centre.', ['day', 'tile', '#e0f0f8', '#f5fbff', '#33a8ff'],
    'igloo', 'snowman pine pine petbed', 'hotchoc storage', 'Cub Nursery|petbed|petbowls', 'Fish Store|minifridge',
    ['catch|Feed the polar bears|🐟|🧊', 'maze|Guide the cub to its mum|🐻‍❄️|🏔️', 'mem|Arctic memory|🐻‍❄️ 🐧 🦭 🐋 ❄️ 🐟', 'hold|Warm up the baby seal', 'collect|Round up the penguins|🐧']),
  t('Fruit Smoothie Bar', '🍓', 'Blenders, fruit towers and rainbow smoothies.', ['day', 'tile', '#e8f6e0', '#fbfff6', '#ff7a1a'],
    'stall', 'cafetable#ff7a1a cafetable#ffd23f planter planter', 'minifridge espresso', 'Prep Kitchen|counter|minifridge', 'Juice Lab|counter',
    ['seq|Blend a smoothie|🍌 Banana,🍓 Strawberries,🥭 Mango,🥛 Yoghurt,🌀 Blend', 'catch|Catch the fruit|🍉|🧅', 'mem|Fruit memory|🍓 🍌 🥭 🍍 🫐 🥝', 'word|Spell the fruits|PAPAYA,BLUEBERRY,KIWI,PINEAPPLE', 'timing|Stop the blender just right']),
  t('Superhero Training', '🦸', 'An obstacle course, capes and a hero HQ.', ['day', 'rubber', '#3a5a8a', '#e8eef8', '#e63946'],
    'gantry', 'dumbbells dumbbells reformer treadmill', 'podium cone', 'Costume Room|rack|mirror', 'Hero HQ|controldesk',
    ['timing|Leap over the buildings', 'catch|Catch the falling kittens|🐱|🧱', 'maze|Fly to the rescue|🦸|🆘', 'mem|Hero memory|🦸 🦹 ⚡ 🛡️ 🏙️ 💥', 'hold|Lift the giant weight']),
  t('Wedding Chapel', '💒', 'Flower arches, a long aisle and a five-tier cake.', ['golden', 'marble', '#f8f0f0', '#fffaf8', '#ff9fc4'],
    'arch', 'bench bench bench bench', 'cakestand candelabra', 'Bridal Suite|vanity|mirror', 'Florist|planter',
    ['seq|Set up the wedding|🌸 Flower arch,🪑 Chairs,🎂 Cake,💍 Rings,🎵 Music', 'catch|Catch the bouquet|💐|🍅', 'mem|Wedding memory|💒 💍 🎂 💐 🕊️ 👰', 'hold|Ice the giant cake', 'rhythm|First dance']),
  t('Stargazing Deck', '🔭', 'Telescopes, beanbags and the whole sky above you.', ['moody', 'deck', '#2a2a40', '#f5efe6', '#ffd23f', true],
    'bigscope', 'telescope telescope beanbag beanbag', 'lantern firepit', 'Star Hut|bookshelf|desk', 'Cocoa Stand|hotchoc',
    ['catch|Catch the shooting stars|🌠|☁️', 'mem|Constellation memory|⭐ 🌙 🪐 ☄️ 🌌 🔭', 'maze|Connect the constellation|⭐|🌟', 'word|Spell the star names|ORION,SIRIUS,POLARIS,VEGA', 'hold|Focus the telescope']),
  t('Diamond Showroom', '💍', 'Glittering cases of jewels and a diamond the size of your head.', ['golden', 'marble', '#f0ecf5', '#fbf8ff', '#7fd8ff'],
    'displaycase', 'displaycase displaycase mirror mirror', 'chandelier viprope', 'Private Viewing|sofa|vanity', 'Vault|storage',
    ['spot|Spot the real diamond|💎/🔷 💍/⭕ 👑/🎩', 'seq|Make a necklace|⛓️ Chain,💎 Diamonds,🪙 Gold clasp,✨ Polish,🎁 Box', 'mem|Jewel memory|💍 💎 👑 📿 💠 ✨', 'hold|Polish the giant diamond', 'catch|Catch the gems|💎|🪨']),
  t('Hall of Fame', '🏆', 'Trophies, gold stars and statues of the estate legends.', ['golden', 'marble', '#f3e6c8', '#fbf3e4', '#d4af37'],
    'podium', 'statue statue displaycase displaycase', 'goldsign spotlight', 'Trophy Room|prizes|displaycase', 'Press Room|camera',
    ['collect|Polish the trophies|🏆', 'mem|Champion memory|🏆 🥇 🥈 🥉 ⭐ 🎖️', 'seq|Accept your award|🚶 Walk up,🤝 Shake hands,🏆 Take the trophy,🎤 Speech,📸 Photo', 'timing|Strike a pose for the cameras', 'word|Spell the winning words|CHAMPION,LEGEND,VICTORY,GLORY']),
  t('Cloud Palace', '☁️', 'The 100th floor! A golden palace above the clouds. You made it to the top!', ['golden', 'marble', '#fff4d6', '#fffaf0', '#d4af37', true],
    'fountain', 'pillar pillar chandelier chandelier', 'goldsign podium', 'Throne Room|statue|candelabra', 'Sky Lounge|sofa',
    ['seq|Climb to the top|🪜 Climb,☁️ Clouds,🌈 Rainbow,🏰 Palace gates,👑 You made it!', 'mem|Sky palace memory|☁️ 👑 🌈 🕊️ ⭐ 🏰', 'catch|Catch the golden stars|🌟|⛈️', 'timing|Ring the golden bell', 'word|Spell the top words|SKY,CLOUDS,PALACE,LEGEND']),
];

export const TOWER3: TowerTheme[] = LIST.map((th, i) => ({ ...th, n: 25 + i }));

const HINT: Partial<Record<TaskKind, string>> = {
  sequence: 'Tap the steps in the right order.', memory: 'Flip the cards to find all the pairs.', catch: 'Move the basket to catch the good ones and dodge the bad ones!',
  spot: 'One of these is different. Find it!', unscramble: 'Unscramble the letters to spell the words.', maze: 'Find the way through the maze!',
  hold: 'Hold the button until the bar is full.', rhythm: 'Tap the lanes as the notes hit the line!', timing: 'Stop the moving marker in the sweet spot, 3 times.',
  simon: 'Watch the pattern, then repeat it.', collect: 'Walk around the floor and pick them all up.',
};
const KIND: Record<string, TaskKind> = { seq: 'sequence', mem: 'memory', catch: 'catch', spot: 'spot', word: 'unscramble', maze: 'maze', hold: 'hold', rhythm: 'rhythm', timing: 'timing', simon: 'simon', collect: 'collect' };

/** Turns a theme's short task strings into real tasks. */
export function towerTasks(th: TowerTheme): TaskDef[] {
  return th.tasks.map((spec, i) => {
    const [k, label, a = '', b = ''] = spec.split('|');
    const kind = KIND[k];
    const task: TaskDef = { id: `${k}${i}`, label, kind, hint: HINT[kind] ?? '' };
    if (kind === 'sequence') task.steps = a.split(',');
    if (kind === 'memory') task.symbols = a.split(' ');
    if (kind === 'catch') { task.item = a; task.bad = b; task.count = 10; }
    if (kind === 'spot') task.odd = a.split(' ').map((p) => p.split('/') as [string, string]);
    if (kind === 'unscramble') task.words = a.split(',');
    if (kind === 'maze') { task.item = a; task.goal = b; }
    if (kind === 'collect') { task.item = a || '⭐'; task.count = 5; task.hint = `Pick up the 5 ${a} scattered around the floor.`; }
    return task;
  });
}
