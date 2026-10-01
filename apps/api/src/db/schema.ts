import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type {
  CharacterStatus,
  ClassKey,
  EquippedItem,
  EventData,
  EventType,
  Faction,
  Flavour,
  Region,
  Stats,
  TalentGroup,
} from "@wow-locker/shared";

/**
 * A tracked character and its latest snapshot. Tracking is shared: any device
 * adding the same character points at the same row; `requestedAt` (last time a
 * device asked for it) decides whether the poller keeps refreshing it.
 */
export const characters = pgTable(
  "characters",
  {
    id: serial("id").primaryKey(),
    region: text("region").$type<Region>().notNull(),
    flavour: text("flavour").$type<Flavour>().notNull(),
    realmSlug: text("realm_slug").notNull(),
    realmName: text("realm_name").notNull(),
    realmCategory: text("realm_category").notNull().default(""),
    nameKey: text("name_key").notNull(), // lower-cased, as the API wants it
    name: text("name").notNull(),
    blizzardId: integer("blizzard_id"),
    level: integer("level").notNull().default(0),
    experience: integer("experience").notNull().default(0),
    race: text("race").notNull().default(""),
    className: text("class_name").notNull().default(""),
    classKey: text("class_key").$type<ClassKey | null>(),
    gender: text("gender").notNull().default(""),
    faction: text("faction").$type<Faction>().notNull().default("neutral"),
    guild: text("guild"),
    isGhost: boolean("is_ghost").notNull().default(false),
    isSelfFound: boolean("is_self_found").notNull().default(false),
    itemLevel: integer("item_level"),
    avatarUrl: text("avatar_url"),
    renderUrl: text("render_url"),
    equipment: jsonb("equipment").$type<EquippedItem[]>().notNull().default(sql`'[]'::jsonb`),
    talents: jsonb("talents").$type<TalentGroup[]>().notNull().default(sql`'[]'::jsonb`),
    stats: jsonb("stats").$type<Stats | null>(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    deadAt: timestamp("dead_at", { withTimezone: true }),
    status: text("status").$type<CharacterStatus>().notNull().default("ok"),
    /** Set once a missing character has been reported (2nd "not found" in a row). */
    missingReportedAt: timestamp("missing_reported_at", { withTimezone: true }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }),
    /** Format of the stored snapshot (see SNAPSHOT_VERSION in tracker.ts). */
    snapshotVersion: integer("snapshot_version").notNull().default(0),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("characters_identity").on(t.region, t.flavour, t.realmSlug, t.nameKey)],
);

/** Something that happened to a character, derived by diffing snapshots. */
export const characterEvents = pgTable(
  "character_events",
  {
    id: serial("id").primaryKey(),
    characterId: integer("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    type: text("type").$type<EventType>().notNull(),
    data: jsonb("data").$type<EventData>().notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
  },
  (t) => [index("events_character").on(t.characterId, t.at)],
);

/** Item icon URLs never change: fetched once per item and flavour. */
export const itemIcons = pgTable(
  "item_icons",
  {
    flavour: text("flavour").$type<Flavour>().notNull(),
    region: text("region").$type<Region>().notNull(),
    itemId: integer("item_id").notNull(),
    url: text("url"),
  },
  (t) => [uniqueIndex("item_icons_key").on(t.region, t.flavour, t.itemId)],
);

export const pushSubscription = pgTable("push_subscription", {
  endpoint: text("endpoint").primaryKey(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  deviceId: text("device_id").notNull(),
  characterIds: integer("character_ids").array().notNull(),
  events: text("events").array().$type<EventType[]>().notNull(),
  lang: text("lang").notNull().default("en"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Tiny key/value store for job state. */
export const state = pgTable("state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type CharacterRow = typeof characters.$inferSelect;
export type EventRow = typeof characterEvents.$inferSelect;
export type SubscriptionRow = typeof pushSubscription.$inferSelect;
