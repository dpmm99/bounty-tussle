const mysql = require("mysql");
const util = require('util');

const PERSIST_VERSION = 0; //Incremental versioning for the way data is stored in the database. I made the schema very basic at first, so any new versions would likely add things or reformat existing columns.

/** Open the database connection and run the given query with the given parameters, then return the result. */
async function query(sql, params) {
    var db = mysql.createConnection({ multipleStatements: true, host: "localhost", user: process.env.DBUSER || "localuser", password: process.env.DBPASS || "local", database: process.env.DBNAME || "bountytussle" }); //Hard-coded the password for my local machine's MySQL DB user. ;)
    await util.promisify(db.connect).call(db);
    var result = await util.promisify(db.query).call(db, sql, params);
    await util.promisify(db.end).call(db);
    return result;
}

/**
 * Get all the games that the given player has been a part of.
 * @param {int} player ID of the player. This is a game-specific ID.
 */
exports.findGames = async function (player) {
    return await query("SELECT id FROM bountytussle_games WHERE players LIKE '%," + player + ",%' ORDER BY id DESC");
}

/**
 * Save a new game record for the given players with the given seed.
 * @param {ArrayOfInt} players Array of player IDs for the game. These are game-specific IDs. There should be between 1 and 6 IDs. (Actually have room for up to 23 player IDs if everyone on the planet had an account.)
 * @param {BigInt} seed Seed for the random generator. All events in the game must be in a deterministic sequence based off a single random number generator (of fixed, permanent implementation) with this seed, or else replays won't work.
 * @param {ArrayOfInt} options Can actually be an array of strings as long as none of them contain a comma and the total length, including commas between them, is <=255
 * @returns The ID of the new game in persistent storage
 */
exports.insertGame = async function (players, seed, options) {
    return (await query("INSERT INTO bountytussle_games SET ?", { players: "," + players.join(",") + ",", seed: seed, version: PERSIST_VERSION, options: options.join(",") })).insertId; //Gives the ID of the new game record
    //TODO: This isn't giving the ID despite it working in Burgustar.
}

/**
 * Update the existing game that has the given ID, appending the new decision to the existing decision list.
 * @param {int} id ID of the existing game record in persistent storage
 * @param {int} newDecision A numeric decision value between 0 and 35
 */
exports.updateGame = async function (id, newDecision) {
    return await query("UPDATE bountytussle_games SET decisions = CONCAT(decisions, ?) WHERE id = ?", [newDecision.toString("36"), id]);
}

/**
 * Remove the last <count> decisions from persistent storage
 * @param {int} id ID of the exsiting game record in persistent storage
 * @param {int} count A number between 1 and probably reasonably only 6 or so. Must not exceed the number of stored decisions.
 */
exports.reverseGameDecisions = async function (id, count) {
    return await query("UPDATE bountytussle_games SET decisions = SUBSTRING(decisions, 1, CHAR_LENGTH(decisions) - ?) WHERE id = ?", [count, id]);
}

/**
 * Get the seed, players, decisions, and version of an existing game with the given ID.
 * @param {int} id ID of the existing game record in persistent storage
 */
exports.getGame = async function (id) {
    const response = (await query("SELECT seed, players, decisions, version, options FROM bountytussle_games WHERE id = ?", [id]))[0];

    return { seed: response.seed, players: response.players.split(",").filter(p => p != "").map(p => parseInt(p)), decisions: [...response.decisions].map(p => parseInt(p, 36)), options: response.options.split(",") };
}

/**
 * Get the nicknames of the given players, in the same order as the given IDs.
 * @param {ArrayOfInt} ids IDs of the players (as in the auto-ID primary key of the bountytussle_players table)
 */
exports.getPlayerNicknames = async function (ids) {
    const response = (await query("SELECT id, CONCAT(display_name, '#', discriminator) AS name FROM bountytussle_players WHERE id IN (?)", [ids]));
    return ids.map(p => response.find(q => q.id == p)?.name ?? "Unknown");
}
/**
 * After getting the user info from Discord's API, call this to ensure that their Discord data (including their Discord ID, if they didn't have a record in our DB before) is up-to-date.
 */
exports.upsertDiscordPlayer = async function (discordUserObject) {
    const response = await query(`SET @discord_id = ?;
SET @id = (SELECT id FROM bountytussle_players WHERE discord_id = @discord_id);
INSERT INTO bountytussle_players (id, discord_id, avatar, display_name, discriminator) VALUES (@id, @discord_id, ?, ?, ?)
	ON DUPLICATE KEY UPDATE avatar=VALUES(avatar), display_name=VALUES(display_name), discriminator=VALUES(discriminator);
SELECT COALESCE(@id, LAST_INSERT_ID()) as insertId;`, [discordUserObject.id, discordUserObject.avatar, discordUserObject.username, discordUserObject.discriminator]);
    return response[response.length - 1][0].insertId; //Their bountytussle-specific player ID, brand new or otherwise
}

/**
 * After getting the user info from Discord's API and obtaining a player ID, call this to ensure their session record is persisted in case the server reboots.
 * @param {any} sessionObject
 */
exports.upsertSession = async function (sessionObject) {
    await query(`INSERT INTO bountytussle_sessions (id, expires, player_id) VALUES (?, ?, ?)
	ON DUPLICATE KEY UPDATE expires=VALUES(expires), player_id=VALUES(player_id);`, [sessionObject.sessionId, sessionObject.expires, sessionObject.playerId]);
}

/**
 * Load all non-expired sessions from the database
 */
exports.loadSessions = async function () {
    return await query(`SELECT * FROM bountytussle_sessions WHERE expires > UTC_DATE();`);
}

/**
 *  Search the players list in the database and get {id, name} pairs back for players whose name starts with the given search string
 */
exports.searchPlayers = async function (searchString) {
    searchString = searchString.split("#"); //now [0] is the name and [1] is the discriminator or undefined. The whole string should have already been validated by the server's player search endpoint to only contain alphanumeric characters, so we can safely use them directly in the query string.
    var discriminatorLike = searchString[1] !== undefined && searchString[1].length && searchString[1].length <= 4 ? "AND discriminator LIKE '" + searchString[1] + "%'" : "";
    return (await query("SELECT id, CONCAT(display_name, '#', discriminator) AS name FROM bountytussle_players WHERE display_name LIKE '" + searchString[0] + "%' " + discriminatorLike + " LIMIT 10"));
}
