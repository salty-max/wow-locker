# WoWLocker

<!-- Project description for curseforge.com (paste as the project's description). -->

<!-- Summary (the project's summary on CurseForge and Wago, and the TOCs' Notes):
Record your WoW characters' gear, levels, loot, dungeon runs, deaths and close calls to view on wow-locker.app. -->

WoWLocker lets you check your characters on your phone. The addon records your progress while you play, then sends it to [wow-locker.app](https://wow-locker.app) through the Ravenpost companion app when you log out or reload.

Browse your gear, bags and bank, look back through a timeline of your sessions, or see where a Hardcore character died or nearly did. The site also shows rested XP and levelling pace, and offers push notifications.

For Classic Era, Hardcore and Season of Discovery. World of Warcraft: Forever is not supported yet.

## What it records

- Gear changes, levels and talent points, with timestamps.
- Deaths and close calls, including the enemy, location and health, with map coordinates.
- Quests, dungeon runs, group members, run duration and deaths.
- Notable loot, professions, skills and reputation.
- Bags, bank, mail, gold, played time and position.
- Hunter pets and the stable.

Bank contents update when you visit the bank. Mail updates when you open a mailbox. The timeline uses the game's chat style, and deaths and close calls can be viewed on a zone map.

## Getting started

1. Install the addon.
2. Get **[Ravenpost](https://ravenpost-site.vercel.app)** from [wow-locker.app/addon](https://wow-locker.app/addon) and link it to your Battle.net account.
3. Play, then log out or use `/reload`. Your character's page updates a few seconds later.

Ravenpost is free, open source and available for Windows and macOS. Addons cannot connect to the internet themselves, so it uploads the saved file for characters belonging to the Battle.net account you linked. It also uploads [Hearthtale](https://hearthtale.app) journals if you use that addon.

Without Ravenpost, you can still browse the event log in game with `/wowlocker`. Your records will not reach the website.

## In game

- `/wowlocker` opens the event log. Filter it by combat, quests, gear, progress, dungeons or sessions.
- `/wowlocker options` lets you choose what to record, the close-call threshold, login messages and chat confirmations.

The addon records events in the background. It supports English, with French text on French clients.

## Privacy

Your bags, bank, mail, gold and position are visible only to you unless you share the character. Read more on the [privacy page](https://wow-locker.app/privacy).

## Support

WoWLocker is free and will stay free. If you find it useful between sessions, you can help support the site and addon with a coffee on [Ko-fi](https://ko-fi.com/salty_max). Thank you.

## Source

MIT licensed: [github.com/salty-max/wow-locker](https://github.com/salty-max/wow-locker). Not affiliated with Blizzard Entertainment.
