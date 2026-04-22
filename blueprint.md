# Browser MMO-lite Blueprint

## Core fantasy

A lightweight browser-first online RPG with the old Kongregate feel:

- menu-heavy but satisfying
- strong progression loop
- global chat, guilds, parties, dungeons, PvE-first
- simple PvP as a side mode
- mobile portability kept in mind from day one

Use placeholder emojis, simple icons, and flat UI first. Build the fun loop before art.

---

## Product goal

Ship a tiny but real multiplayer prototype where players can:

1. create an account
2. equip gear
3. fight enemies
4. get drops
5. chat globally
6. add friends
7. join a party
8. run a dungeon together
9. join a guild
10. feel meaningful progression after 10 to 20 minutes

---

## Design pillars

### 1) Fast dopamine

Every session should give at least one of these:

- level up
- item drop
- equipment upgrade
- dungeon clear
- social interaction
- guild contribution

### 2) Low art dependency

- emoji items
- colored rarity borders
- simple enemy portraits
- text-first combat logs
- static combat screen

### 3) Multiplayer without movement complexity

No overworld movement needed at first.
The game can be menu-based with screens for:

- town
- inventory
- character
- dungeon
- party
- guild
- chat
- arena

### 4) Browser first, mobile safe

- responsive UI
- large tap targets
- no hover-only interactions
- avoid right-click dependencies
- keep layout simple and vertical-friendly

---

## Core loop

1. player enters a fight or dungeon
2. combat resolves in turn-based or timer-based rounds
3. player earns XP, gold, and drops
4. player equips upgrades or salvages loot
5. player gets stronger
6. stronger player unlocks harder dungeons and bosses
7. social systems multiply retention

---

## V1 gameplay loop

### Character basics

- class selection: Warrior, Mage, Rogue
- level
- HP
- Attack
- Defense
- Speed
- Crit chance

### Equipment slots

- weapon
- helmet
- chest
- gloves
- boots
- ring
- amulet

### Item rarities

- Common
- Uncommon
- Rare
- Epic
- Legendary

### Placeholder item examples

- 🗡️ Rusty Sword
- 🪖 Tin Helm
- 🧥 Worn Chestpiece
- 💍 Copper Ring
- 🔮 Mana Charm
- 🐉 Dragon Fang

### Enemy examples

- 🐀 Sewer Rat
- 🐺 Dire Wolf
- 👺 Cave Imp
- 🧌 Goblin Brute
- 🐉 Whelp
- 👼 Fallen Seraph

---

## Combat direction

### Best first version

Use semi-automatic turn-based combat.

Why:

- easy to build
- works great on web and mobile
- easy to synchronize in multiplayer
- keeps old-school browser RPG vibe

### Player actions

- Attack
- Skill 1
- Skill 2
- Defend
- Auto
- Use Potion

### Combat presentation

- enemy portrait at top
- party panel on left
- combat log in center
- action buttons at bottom
- damage numbers as floating text later

### Party dungeon combat

For co-op, all players join the same encounter room.
Each player submits actions per round or uses auto.
Server resolves the round and broadcasts the result.

---

## Multiplayer systems

### Make the world feel alive

Even without free movement, the game should constantly suggest that other players exist.

Use lightweight online signals like:

- global chat always visible
- recent rare drop feed
- area population counts like "4 players in Forest Edge"
- guild activity feed
- party finder board
- online friends list
- inspect player profile and gear
- system announcements like "Aelric defeated Mossy Cellar"
- boss ranking boards

These features create a living online feel without needing a true explorable MMO world.

### Global chat

- one world chat channel
- profanity filter later
- rate limiting required

### Friends

- add friend
- accept request
- see online status
- invite to party
- whisper / DM later

### Party system

- create party
- invite player
- up to 4 players
- queue dungeon together
- shared combat instance
- personal loot drops

### Guild system

- create guild
- join guild
- guild chat
- guild roster
- guild contribution score
- guild bank later
- guild boss later

### PvP

Keep it simple in V1.5, not V1.

- async ladder or simple arena matchmaking
- no real-time movement
- server-resolved combat

---

## Overworld structure

The overworld should not be a freely explorable map in V1.
Instead, use a region-based menu world.

### Example regions

- Town
- Forest Edge
- Sewers
- Ruined Chapel
- Ancient Cavern
- Abyss Gate

Each area has:

- level recommendation
- power recommendation
- enemy pool
- loot table
- dungeon access
- maybe a boss encounter

This lets the player feel like they are traveling through a larger world while keeping implementation simple.

### Difficulty philosophy

Players should be allowed to enter harder areas early and get stomped.
That is part of the fun of this kind of progression game.

Always show:

- recommended level
- recommended power
- possible drops
- enemy type

This makes the progression loop clear: grind, gear up, come back stronger.

## Dungeons

### V1 dungeon structure

- dungeon contains 3 to 5 encounters
- final boss at the end
- party can continue together
- each room is just a combat scene
- no map movement needed at first
- dungeon lives inside a server-side instance
- the same party progresses through rooms together

### Example V1 dungeons

- Mossy Cellar
- Bandit Hideout
- Old Chapel

### Recommended first dungeon flow

1. party leader selects dungeon
2. invited friends join party lobby
3. all members hit ready
4. server creates dungeon instance
5. party enters room 1
6. combat resolves
7. rewards shown
8. party continues to next room until boss clear or wipe

### Dungeon rewards

- XP
- gold
- gear drops
- crafting fragments later

---

## Party system and co-op dungeons

### Party basics

- party size of 2 to 4 players
- one leader
- invite friends to party
- ready status for each member
- connection status shown
- leader selects dungeon
- shared dungeon run

### Best implementation approach

Use instance-based co-op dungeons.

When a party starts a run, the server creates a dungeon instance that tracks:

- party members
- current room
- enemy group
- round state
- completion state
- rewards
- seed for deterministic generation if needed

This is much simpler than trying to synchronize a movement-based world.

### Best first combat model for co-op

Use round-based shared combat.

Each round, each player chooses:

- Attack
- Skill 1
- Skill 2
- Defend
- Use Potion
- Auto

If a player does not respond in time, the server auto-submits a basic action.
Once all actions are ready, the server resolves the round and sends the result to everyone.

Why this is good:

- works well in browser and mobile
- avoids latency headaches of action combat
- easy to synchronize
- still feels cooperative and tactical

### Solo versus party structure

- normal farming zones should be solo-friendly and fast
- dungeons should feel more special and support party play
- once a dungeon is cleared, auto-run options can come later

### Loot rules

Use personal loot, not shared loot.
Each player receives their own reward roll from the encounter.
This avoids loot drama and simplifies implementation.

### Example starter party roles

- Warrior: durable, protect allies, balanced damage
- Mage: burst and area damage
- Rogue: high speed, crit, priority target finisher

Even simple class identity will make co-op feel much better.

### Dungeon architecture concepts

- Party
- Dungeon Template
- Dungeon Instance
- Combat Resolver

Suggested responsibility split:

- Party manages invites, leader, ready states
- Dungeon Template defines rooms, enemies, rewards, requirements
- Dungeon Instance tracks the live run
- Combat Resolver processes actions and enemy AI each round

### Best build order for party dungeons

1. solo dungeon instance
2. party creation and invites
3. party lobby and ready checks
4. shared dungeon instance for 2 players
5. timeout auto-action handling
6. reward screen
7. reconnect handling
8. scale to 4 players

## Retention systems

These matter a lot for this kind of game.

### Good early retention features

- daily reward
- first dungeon bonus
- guild contribution bonus
- boss reset timer
- streak rewards later

### Do not overbuild early

Skip these until core loop is fun:

- auction house
- player trading
- huge crafting system
- pets
- world map
- complex story
- talent trees

---

## Recommended stack

### Phase 1 stack: build the core game in Next.js first

Start with a single Next.js application so the first version is easy to build and reason about.

Use Next.js for:

- frontend UI
- auth
- normal CRUD and game endpoints
- server-side game logic for solo systems
- inventory and equipment management
- region and dungeon selection
- persistence

Recommended tools for Phase 1:

- Next.js
- TypeScript
- Tailwind CSS
- Zustand for local UI state
- PostgreSQL
- Prisma ORM

### Local database first

Use a local PostgreSQL instance during development.
That gives you a real relational database from day one while keeping iteration fast.

Recommended local workflow:

- run PostgreSQL locally with Docker or a local install
- use Prisma migrations
- create a Prisma seed script
- seed starter enemies, items, dungeons, and test users

This makes it easy to reset the game state and test progression quickly.

### Hosting transition plan

Once the Next.js app is working locally:

- move the database to a hosted PostgreSQL provider later
- keep Prisma as the abstraction layer
- point environment variables to the hosted database
- run migrations in the hosted environment
- run the seed script if needed for initial game content

Good hosted database options later:

- Neon
- Supabase Postgres
- Railway Postgres

### Phase 2 stack: add a separate realtime backend

Once the solo game and data model are working, add a separate Express server for realtime multiplayer systems.

Use the Express plus Socket.IO server for:

- global chat
- party invites
- online presence
- ready checks
- dungeon instance events
- combat round broadcasts
- guild chat and guild boss events later

Why split it this way:

- Next.js is excellent for the app shell and normal data operations
- realtime systems are easier to manage in a persistent Node server
- this keeps the first build simple while preserving a good long-term architecture

### Final architecture direction

Phase 1:

- Next.js app
- PostgreSQL
- Prisma
- local development with seeds

Phase 2:

- keep the Next.js app
- add Express server
- add Socket.IO
- both services share the same PostgreSQL database

### Suggested hosting direction

For an early production-style setup later:

- host the Next.js app on Vercel or another Node-friendly platform
- host the Express plus Socket.IO server on Railway, Render, Fly.io, or a VPS
- host PostgreSQL on Neon, Supabase, Railway, or another managed Postgres provider

## Data model starter

### Users

- id
- username
- email
- password_hash
- created_at
- last_seen_at

### Characters

- id
- user_id
- class
- level
- xp
- hp
- attack
- defense
- speed
- gold

### Items

- id
- name
- emoji
- slot
- rarity
- required_level
- stat_modifiers

### InventoryItems

- id
- character_id
- item_id
- quantity
- is_equipped

### Friends

- id
- requester_id
- addressee_id
- status

### Parties

- id
- leader_character_id
- created_at

### PartyMembers

- id
- party_id
- character_id

### Guilds

- id
- name
- owner_character_id
- created_at

### GuildMembers

- id
- guild_id
- character_id
- role
- contribution_points

### Dungeons

- id
- name
- min_level
- boss_enemy_id

### Enemies

- id
- name
- emoji
- hp
- attack
- defense
- speed
- loot_table_id

### LootTables

- id
- name

### LootTableEntries

- id
- loot_table_id
- item_id
- drop_rate

### ChatMessages

- id
- channel_type
- channel_id
- sender_character_id
- body
- created_at

---

## First milestone plan

### Milestone 1: Next.js single-player vertical slice

Build first inside the Next.js app only:

- auth
- character creation
- local PostgreSQL connection
- Prisma schema and migrations
- Prisma seed script
- inventory
- equipment slots
- one enemy fight screen
- XP and loot
- level up
- region selection
- persistence

Definition of done:
A player can log in, fight a rat, get a sword, equip it, move between a few region screens, and feel stronger.

### Milestone 2: harden the Next.js foundation

Add:

- more enemies
- more drops
- more regions
- one solo dungeon
- better save and load flow
- cleaner combat resolver
- hosted Postgres migration path

Definition of done:
The Next.js app feels like a real solo browser RPG and can transition cleanly from local Postgres to a hosted database.

### Milestone 3: add the separate realtime backend

Create a separate Express server and connect it to the same PostgreSQL database.
Then add Socket.IO for:

- global chat
- online presence
- friend requests and friend status
- party invites
- party lobby updates

Definition of done:
Two accounts can log in through the Next.js app, see each other online, chat, add each other, and form a party through the separate realtime server.

### Milestone 4: co-op dungeon instances

Add:

- party-ready flow
- dungeon instance creation
- shared room progression
- round-based combat broadcast
- reconnect handling
- reward screens

Definition of done:
Two to four players can create a party, start a dungeon, and clear it together.

### Milestone 5: guilds

Add:

- guild creation
- guild join flow
- guild chat
- contribution points

Definition of done:
Players can create a guild and contribute to shared progress.

### Milestone 6: guild boss

Add:

- recurring guild boss event
- shared guild damage total
- reward tiers

Definition of done:
Guild members can fight a shared boss and receive rewards based on participation.

## Best UI screens for V1

- Login / Register
- Character
- Inventory
- Combat
- Dungeon Lobby
- Party Panel
- Global Chat
- Guild

---

## Rules to keep scope sane

- no movement system
- no real-time action combat
- no custom art requirement
- no open trading at launch
- no giant content library
- no dozens of classes

---

## Monetization philosophy

Start with cosmetic-only monetization.
Do not sell power.
Do not sell convenience that feels mandatory.
The early trust of the playerbase matters a lot for this type of game.

### Good first paid features

- name colors
- chat name flair
- profile badges
- title display next to username
- cosmetic borders around profile or character card
- cosmetic guild emblem customization later
- seasonal supporter badge

### Principles

- no pay-to-win stats
- no paid dungeon power boosts
- no paid exclusive combat advantage
- no lootboxes at the start
- cosmetics should be visible in chat, profile, party lobby, and rankings

This makes cosmetic purchases feel socially meaningful without damaging game integrity.

## Suggested next build step

Start with a playable combat and inventory prototype inside the Next.js app, not the full MMO.

Build in this exact order:

1. local PostgreSQL setup
2. Prisma schema
3. Prisma migrations
4. Prisma seed script
5. character stats
6. items and equipment slots
7. enemy data
8. combat resolver
9. rewards and drops
10. save progress
11. region selection
12. one solo dungeon
13. then move to hosted Postgres
14. then add the Express and Socket.IO realtime server
15. then add chat
16. then friends and parties
17. then dungeon instances

### Cursor implementation route

When using Cursor, treat the project as two phases.

#### Phase 1 prompt direction

Build the Next.js app first.
Ask for:

- folder structure
- Prisma schema
- local Postgres setup instructions
- Docker option for Postgres if desired
- seed script
- route handlers or API endpoints
- solo combat prototype
- inventory and equipment systems

#### Phase 2 prompt direction

After the solo Next.js app works, add a separate Express server.
Ask for:

- Express project structure
- Socket.IO event list
- shared auth strategy with the Next.js app
- shared database access strategy
- party and chat event flow
- dungeon instance lifecycle

This will keep the implementation manageable and much easier to debug.

## Tiny example content pack

### Starter classes

- Warrior: high HP, balanced damage
- Mage: lower HP, high burst
- Rogue: high speed, crit focus

### Starter enemies

- 🐀 Rat
- 🕷️ Spider
- 👺 Imp

### Starter items

- 🗡️ Rusty Sword +2 Attack
- 🪄 Crooked Wand +3 Attack
- 🥾 Leather Boots +1 Speed
- 💍 Copper Ring +10 HP

### Starter dungeon

**Mossy Cellar**

- Room 1: 2x Rats
- Room 2: Spider
- Room 3: Imp Boss

Reward examples:

- 120 XP
- 35 gold
- 20 percent chance for uncommon drop

---

## What to do next

Turn this into:

1. database schema
2. API route list
3. websocket event list
4. UI wireframes
5. milestone-by-milestone build tickets
