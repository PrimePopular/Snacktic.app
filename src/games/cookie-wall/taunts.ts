/**
 * What the opponent says when the player loses a Cookie War game. Each level has its own opponent, and the teasing gets
 * sharper as the levels go up: friendly at level 1, properly cheeky at level 5. Playful, never genuinely unkind. Several lines
 * per level, rotated so the same one does not come up twice in a row.
 */
const TAUNTS: Record<number, string[]> = {
  1: [
    'Crumb got there first! Good news: Crumb is very small, so it is not too embarrassing.',
    'Crumb barely moved and still won. Shake it off and go again!',
    'Oops! Crumb is doing a happy wiggle right now.',
    'So close! Crumb says thanks for letting it win. (You did not let it win.)',
  ],
  2: [
    'Nibbler nibbled your lead away. Your cookies are a little disappointed!',
    'Nibbler barely broke a sweat. You will get it next time.',
    'You lost to Nibbler! Want to try that again?',
    'Nibbler is already telling the other cookies about this. Go and fix the story.',
  ],
  3: [
    'Snacker snacked on that win. Your walls were more of a suggestion.',
    'You lost to Snacker. Even the crumbs are shaking their heads.',
    'Snacker did not even need a second helping. Ouch.',
    'That was a lovely warm-up. Snacker is still hungry, though.',
  ],
  4: [
    'Gourmet found that loss delicious. Fine taste, terrible result for you.',
    'Gourmet has seen more convincing walls on a biscuit. Go again!',
    'Your cookies have asked for a transfer. Gourmet is very pleased.',
    'Gourmet is calling that a light snack. Your pride is the dessert.',
  ],
  5: [
    'Cookie Monster ate your plan, your walls and your pride. Seconds?',
    'That was not a loss, that was a buffet. Cookie Monster says thank you.',
    'Your cookies have filed a complaint. Cookie Monster has filed it in the bin.',
    'Cookie Monster did not just beat you, it took notes. Come back with a better plan!',
    'Even your own cookies are pretending they do not know you. Try again, champion.',
  ],
};

let lastLine = '';

/** A defeat line for the level (1 to 5). Never the same line twice in a row. */
export function pickTaunt(level: number): string {
  const key = Math.min(5, Math.max(1, Math.round(level) || 1));
  const lines = TAUNTS[key];
  const options = lines.filter((line) => line !== lastLine);
  const line = options[Math.floor(Math.random() * options.length)] ?? lines[0];
  lastLine = line;
  return line;
}
