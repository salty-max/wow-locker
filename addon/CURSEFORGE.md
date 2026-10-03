# WoWLocker

<!-- Project description for curseforge.com (paste as the project's description). -->

**Your characters' journey, on your phone.** WoWLocker records what happens while you play and shows it on [wow-locker.app](https://wow-locker.app): a timeline in the game's own chat style, Hardcore deaths and close calls on the zone map, bags and bank, mail, rested XP, levelling pace, session summaries, and push notifications.

For Classic Era, Hardcore, Season of Discovery and TBC Anniversary.

## What it records

- Every gear swap, level-up and talent point, timestamped
- Hardcore deaths and close calls: who, where, at what health, with map coordinates
- Quests, dungeon runs (group, duration, deaths), notable loot, skills, reputation
- Bags, bank (when you visit it), mail (when you open a mailbox), gold, /played, position
- Hunter pets and the stable

## How it works

Addons can't use the network, so the addon only writes the game's saved variables, when you log out or `/reload`. The free **WoWLocker companion** app (Windows and macOS, open source) picks the file up and uploads it, only for the characters of the Battle.net account you link it with.

1. Install this addon.
2. Install the companion from [wow-locker.app/addon](https://wow-locker.app/addon) and link it with your Battle.net account.
3. Play. Log out or `/reload`, and your page on wow-locker.app updates seconds later.

Without the companion the addon still works (`/wowlocker` shows the event log in game), but nothing reaches the site.

## In game

- `/wowlocker`: the event log
- `/wowlocker options`: what to record, chat confirmations, close-call threshold

The addon doesn't touch combat or the interface: it listens, and writes down.

## Privacy

Bags, bank, mail, gold and position are visible only to you unless you share a character. Details: [wow-locker.app/privacy](https://wow-locker.app/privacy).

## Source

MIT licensed: [github.com/salty-max/wow-locker](https://github.com/salty-max/wow-locker). Not affiliated with Blizzard Entertainment.
