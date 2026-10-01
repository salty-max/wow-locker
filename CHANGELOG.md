# Changelog

## 0.1.0 — unreleased

- Character tracking for WoW Classic (Era / Hardcore / SoD, TBC Anniversary,
  MoP Classic) through the Battle.net API.
- Per-device locker; add by region, realm and name, Hardcore realms first.
- Character page: render, XP bar (Era), gear with icons and enchants, talent
  trees, stats, alive / fallen and Self-Found status.
- Timeline + push notifications: level-ups, deaths, gear changes, respecs,
  guild changes, Self-Found lost.
- Real talent trees for Classic Era / Hardcore / SoD and TBC Anniversary
  (positions, ranks, prerequisite arrows, details on tap), generated from the
  game data since the API has none for Classic.
- Log in with Battle.net to import the account's characters (filter by game
  version, dead/alive checked live); BattleTag status in the top bar.
- "Missing" / "found again" events when a tracked character disappears.
- Classic (1.x) UI: character select screen, Character frame with paper doll,
  timeline as a WoW chat window, WoW-style item and talent tooltips.
- In-game addon (Classic Era / Hardcore, TBC Anniversary) recording the live
  timeline, Hardcore deaths, rested XP, gold, /played and location.
- Installable PWA, EN/FR, update prompt, iOS install guide.
