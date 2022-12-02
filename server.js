const main = require('./main.js');
const db = require('./db.js');
const seedrandom = require("seedrandom");
const crypto = require('crypto'); //Only used for the auth
const fetch = require('node-fetch'); //Only used for the auth

const cachedGames = [];

/**
 * Start a new game and return the state data that the player needs in order to pick their character or whatever.
 * @param {ArrayOfInt} players List of bountytussle-specific player IDs
 * @param {boolean} useExpansion
 * @param {boolean} useAggressive
 * @param {int} mapGenId
 */
async function newGame(players = [0], useExpansion = 0, useAggressive = 0, mapGenId = 0) {
	console.log("Making game for player IDs: " + players.join());
	const seed = (new seedrandom())(); //Using a string as the seed just so I don't lose precision in the DB or anything
	const gameId = await db.insertGame(players, "" + seed, [useExpansion ? 1 : 0, useAggressive ? 1 : 0, mapGenId]); //Startup options are passed as an array of ints to keep the persistent storage interface simple
	console.log("Started game " + gameId + " successfully with seed " + seed + ".");

	//Build the new game board with that seed
	const game = await cacheExistingGame(gameId);

	const response = await catchUp(game, -1);
	response.gameId = gameId;
	return response;
}

/**
 * A player picks a character.
 * @param {Game} game The game to pick the character in
 * @param {int} player tokenId of the player in this game
 * @param {string} character The name of the character to pick (must match the PlayerTokenType pseudo-enum field name, which also has to match the PlayerTokenType.name)
 */
async function pickCharacter(game, player, character) {
	if (game.roundManager.stepHistory.length) throw "The game has already started. Your character is: " + game.roundManager.players.filter(p => p.tokenId == player)[0]?.type?.name;

	const chosen = game.roundManager.players.filter(p => p.type && p.tokenId != player).map(p => p.type.name);
	if (chosen.includes(character)) throw "Another player got to that character before you."; //Could be turn-based, though.

	const playerTokenType = game.gameStarter.playerTokenTypes[character];
	if (!playerTokenType) throw "That character does not exist or is unavailable in the current game configuration.";
	game.roundManager.players[player].setCharacter(playerTokenType);

	//If all players have chosen, begin the game.
	const undecidedPlayerCount = game.roundManager.players.filter(p => !p.type).length;
	if (!undecidedPlayerCount) {
		//Have to do this to keep the minimal persistent storage interface... and then subtract the player count from every call that references a decision number (in DB) and a step number (in RoundManager)...or integrate character selection as part of the game.
		for (let token of game.roundManager.players) db.updateGame(game.id, Object.keys(game.gameStarter.playerTokenTypes).indexOf(token.type.name));
		game.roundManager.start();
	}

	const response = await catchUp(game, 0);
	response.started = undecidedPlayerCount == 0;
	return response;
}

/**
 * Load an existing game from persistent storage and replay it to the point where it seems as if it had never left the server's memory.
 * @param {int} id Game instance persistent ID
 */
async function cacheExistingGame(gameId) {
	const { seed, players, decisions, options } = await db.getGame(gameId); //decisions is an array of integers from 0 to 35. players is an array of their bountytussle-specific IDs.
	const useExpansion = parseInt(options[0]), useAggressive = parseInt(options[1]), mapGenId = parseInt(options[2]);

	//Rebuild the game board with that seed
	const g = new main.GameStarter();
	const roundManager = g.prepareGame(players.length, useExpansion, useAggressive, mapGenId, new seedrandom(parseFloat(seed)));
	const game = { id: gameId, seed: parseFloat(seed), players: players, gameStarter: g, roundManager: roundManager, useExpansion, useAggressive, mapGenId };

	//Get the players' nicknames and non-game-specific IDs and put them into the player tokens
	game.playerNicknames = await db.getPlayerNicknames(players);
	for (let x = 0; x < players.length; x++) {
		roundManager.players[x].nickname = game.playerNicknames[x];
		roundManager.players[x].playerUserId = game.players[x];
	}

	//Rebuild the current state. First, set the players' characters again.
	const characterTypesByIndex = Object.values(game.gameStarter.playerTokenTypes);
	for (let x = 0; x < players.length && x < decisions.length; x++) {
		roundManager.players[x].setCharacter(characterTypesByIndex[decisions[x]]); //The first [players.length] entries refer to their chosen characters by the order they appeared in GameStarter.playerTokenTypes originally.
	}
	if (decisions.length >= players.length) {
		//Now go through all the remaining decisions by passing them to the RoundManager.
		for (let x = players.length; x < decisions.length; x++) { //Start after the character selection decisions
			//const previousStep = roundManager.currentStep;
			if (x == players.length) roundManager.start(); //Could roll a die and cause x to advance more, so it's got to be in the loop //TODO: nope, I didn't save the rolls in the DB so it doesn't have to.

			if (false) { //TODO: a leaver

			} else if (false) { //TODO: a state reversal
				roundManager.revert();
			} else {
				console.log(`Decision ${x}: chose ${decisions[x]}`);
				roundManager.advance(decisions[x]);
				//I didn't save the rolls in the database at all...none of this: x += roundManager.currentStep - previousStep - 1; //We can skip over die rolls that were stored in the DB since the seeded random generator guarantees the same roll was calculated by roundManager this time. The -1 is because our loop has x++ already.
			}
		}
	}

	//For concurrency safety, add it to the cache after it's fully prepared
	cachedGames.push(game);
	return game;
}

async function getGame(id) {
	if (typeof id != 'number') throw "Game ID required";
	return cachedGames.find(p => p.id == id) ?? await cacheExistingGame(id); //TODO: maybe use an object for the cache instead of a list, so it can be keyed by game ID regardless of how big the IDs get
}

async function listGames(playerId) {
	return (await db.findGames(playerId)).map(p => ({ gameId: p.id })); //TODO: Would be nice to list the players, their characters, and their most recent scores as well so the list can be a bit more descriptive.
}

/**
 * The player performs an action. Validate and pass it off to RoundManager and persistent storage.
 * @param {Game} game Game the command is issued for
 * @param {int} player tokenId of the player in that game.
 * @param {any} command A command similar to what goes in roundManager.currentOptions
 */
async function act(game, player, command) {
	if ((command.forPlayerId ?? game.roundManager.currentTurnPlayer.tokenId) != player) throw "You cannot issue that command at this time.";

	//Convert any IDs back to objects for the RoundManager.
	if (typeof command.nodeId == 'number') command.toNode = game.roundManager.map[command.nodeId];
	if (typeof command.forPlayerId == 'number') command.forPlayer = game.roundManager.tokens[command.forPlayerId];

	var choiceId = game.roundManager.getOptionIndex(command);
	if (choiceId < 0) throw "Invalid command; is your game out of sync with the server?"; //The sole reason that I'm passing command objects back to the server and not just an ID. I could pass state ID and command ID, though.

	const lastDecisionIndex = game.roundManager.players.filter(p => p.type).length + game.roundManager.currentStep; //The "decisions" in persistent storage start with the players' character selections.
	await db.updateGame(game.id, choiceId);
	game.roundManager.order(command); //Issue the command to the RoundManager

	return await catchUp(game, lastDecisionIndex);
}

/**
 * Get the data needed to catch up a player from the given fromDecision (in terms of persistent storage, where the first playercount decisions are character selections and the rest equate to the RoundManager.stepHistory array) to the most recent game state
 * @param {Game} game Game to catch the player up on
 * @param {int} fromDecision The first decision that the player hasn't seen yet (= number of players that they've seen pick characters + their RoundManager.currentStep). In other words, the player knows what happened up to DB decisions[fromDecision - 1]
 * @returns An object with a list of player commands ('commands'), a list of random rolls ('rolls'), and the value they should pass to catchUp next time they want to sync ('nextDecision'). If needed (fromDecision == 0), the map and tokens will also be sent, and the same goes for the players' character selections (fromDecision < number of players who have picked a character).
 */
function catchUp(game, fromDecision = 0) {
	const chosenCharacterCount = game.roundManager.players.filter(p => p.type).length;
	if (fromDecision >= chosenCharacterCount + game.roundManager.currentStep) return {}; //Nothing to update them on yet
	const fromStep = Math.max(0, fromDecision - game.players.length); //RoundManager steps don't match up with "decisions" since I included character selection in 'decisions' but not in RoundManager. It was a bad choice, haha.

	const newerDecisions = game.roundManager.stepHistory.slice(fromStep); //The client can replay the decisions itself, as long as it has all the recently-revealed-to-players information.
	const response = {
		commandIndexes: newerDecisions.filter(p => typeof p.roll != 'number').map(p => p.chosenOptionIndex), rolls: newerDecisions.filter(p => typeof p.roll == 'number').map(p => p.roll), nextDecision: chosenCharacterCount + game.roundManager.currentStep,
		started: chosenCharacterCount == game.roundManager.players.length,
		gameId: game.gameId, expansion: game.gameStarter.expansion, optionAggressive: game.gameStarter.optionAggressive //Client needs to know these inputs for running the rules correctly
	};

	if (fromDecision == -1) { //Player has no idea what the game looks like yet (and nobody has picked a character). Give them the map on top of everything else.
		response.map = game.roundManager.map.map(p => Object.assign({}, p));
		for (let node of response.map) {
			node.adjacentNodeIds = node.adjacentNodes.map(p => p.nodeId);
			delete node.adjacentNodes;
			delete node.containedTokens; //it's less data if we just assign each token one containingNode rather than sending containedTokens with every map node
		}
		for (let node of response.map) delete node.nodeId; //Can be rebuilt by the client easily enough, but was needed for the entire duration of the previous loop

		//Figure out what the initial token types/placements were using the game seed so we can send just the initial token info--but also including the CURRENTLY revealed fields--to the players. The client will do the rest of the work.
		//Optimize network traffic by setting falsey boolean fields to undefined before serializing the response.
		let tempGame = new main.GameStarter();
		let tempRoundManager = tempGame.prepareGame(game.players.length, game.useExpansion, game.useAggressive, game.mapGenId, new seedrandom(game.seed));
		response.tokens = tempRoundManager.tokens.map(p => ({ tokenClass: p.__proto__.constructor.name, nodeId: p.containingNode?.nodeId, isEarlyStation: p.isEarlyStation || undefined, isRevealed: p.isRevealed || undefined })); //Use constructor name instead of this code: p instanceof main.Player ? "Player" : p instanceof main.Enemy ? "Enemy" : p instanceof main.Station ? "Station" : "Token"
		for (let token of game.roundManager.tokens.filter(p => p.isRevealed || !p.containingNode)) { //Include all the token info that has been revealed since the game started. Just like the 'else' block but on the assumption that all nodes were included already.
			response.tokens[token.tokenId].typeName = token.type?.name;
			response.tokens[token.tokenId].upgradeName = token.upgrade?.name;
			response.tokens[token.tokenId].nickname = token.nickname;
			response.tokens[token.tokenId].playerUserId = token.playerUserId;
		}
	} else {
		//Client needs a partial update. *Do* include the tokenId because they don't need every token. Don't include isRevealed because the client will handle that via replay, but *do* indicate any information we hid from the player at startup (e.g., the token type) that has since been revealed.
		response.tokens = game.roundManager.tokens.filter(p => p.isRevealed || !p.containingNode).map(p => ({ tokenId: p.tokenId, typeName: p.type?.name, upgradeName: p.upgrade?.name }));
		//TODO: OPTIMIZE: Only include changes since the board was generated.
		//TODO: OPTIMIZE: If we store *during what step* each node was revealed, then we can send minimal data across the wire for every catchUp request. The only reason to keep a copy of a previous game state at all, in that case, is for quick reversion to the last irreversible step. (vs. replaying the whole game)
    }

	return response;
}

//Authentication functions
var activeSessions = {};
const { AuthorizationCode } = require('simple-oauth2');

async function discordLogin(req, res, cookies, offline) {
	const oauthClient = new AuthorizationCode(oauthConfig);
	const authorizationUri = oauthClient.authorizeURL({
		redirect_uri: offline ? `http://${req.headers.host}/loginresponse` : `https://${req.headers.host}/bountytussle/server/loginresponse`, //These URLs have to be whitelisted in the Discord app settings
		scope: 'identify',
		state: await stringHash(cookies.session)
	});

	res.statusCode = 307;
	res.setHeader('Location', authorizationUri);
	res.end();
}

/** Get a hexadecimal string representation of the (secure) hash of the given string */
async function stringHash(text) { //Was async when I was using the Web standard crypto module, but the version of Node on my web host doesn't have that.
	return crypto.createHash("sha256").update(text).digest('base64');
}

/** Check for a valid, unexpired session in memory with the given ID. Returns the player's in-memory session object if valid. */
async function getSessionIfValid(sessionId) {
	let session = activeSessions[sessionId];
	return (session?.expires > new Date()) ? session : null;
}

/** Create a new client session in memory and return the (cryptographically-secure) session ID. */
async function newSession() {
	var newSessionID = crypto.randomBytes(15).toString('base64');
	activeSessions[newSessionID] = { expires: new Date().setDate(new Date().getDate() + 7) }; //Expire in a week
	return newSessionID;
}

/**
 * Make sure the user has a session cookie, has a *valid* session cookie, and is fully logged in, and return their ID (undefined if not logged in). The first parameter causes a 307 redirect if true, but the second parameter changes it to a JSON response containing only a redirectTo string if true.
 */
async function redirectIfNotLoggedIn(cookies, urlObject, res, player, redirectToLoginIfNot, redirectAsJson) {
	if (!cookies?.session?.length || !player?.playerId) { //playerId starts at 1
		if (!cookies?.session || cookies?.session?.expires < new Date()) cookies.session = await newSession(); //Will need to log in
		const cookiesToSet = ["session=" + encodeURI(cookies.session)]; //Set the session cookie regardless of whether we actually want to redirect (this case would be used for /login)
		if (!player?.playerId) cookiesToSet.push(["player="]); //Empty the player cookie if they were logged out because the server rebooted (until/unless I persist the sessions)
		res.setHeader('Set-Cookie', cookiesToSet);

		if (redirectToLoginIfNot) { //Not logged in--possibly because they had no cookie, but possibly not. Either way, no full response!
			const loginUrl = urlObject.pathname.substr(0, urlObject.pathname.lastIndexOf("/")) + "/login";
			if (redirectAsJson) {
				res.statusCode = 200;
				res.end(JSON.stringify({ redirectTo: loginUrl }));
			} else {
				res.statusCode = 307;
				res.setHeader('Location', loginUrl);
				res.end();
			}
		}
		if (!player?.playerId) return false;
	}
	return player;
}

const oauthConfig = {
	client: {
		id: process.env.BOUNTYTUSSLE_DISCORD_ID,
		secret: process.env.BOUNTYTUSSLE_DISCORD_SECRET //also _PUBKEY
	},
	auth: {
		tokenHost: 'https://discord.com/api/',
		authorizePath: 'oauth2/authorize',
		tokenPath: 'oauth2/token',
		revokePath: 'oauth2/token/revoke'
	},
	options: {
		authorizationMethod: 'body'
	}
};

async function discordLoginCallback(req, res, cookies, urlParent, urlObject, offline) {
	//Query string parameter "code" is received from Discord, along with state (which is just repeating a string we sent them)
	if (!cookies?.session?.length || urlObject.searchParams.get("state") != await stringHash(cookies.session)) throw "Invalid state response from Discord for this user session.";

	const tokenParams = {
		code: urlObject.searchParams.get("code"),
		redirect_uri: offline ? `http://${req.headers.host}/loginresponse` : `https://${req.headers.host}/bountytussle/server/loginresponse`, //These URLs have to be whitelisted in the Discord app settings
		scope: 'identify'
	};

	const oauthClient = new AuthorizationCode(oauthConfig);
	oauthClient.getToken(tokenParams).then(accessToken => { //accessToken.token is the Discord-defined token object, but accessToken has its own methods: https://github.com/lelylan/simple-oauth2/blob/HEAD/API.md#accesstoken
		//I only wanted to know the user's identity, so make one more web request to get their ID.
		fetch(oauthConfig.auth.tokenHost + '/oauth2/@me', { headers: { Authorization: `${accessToken.token.token_type} ${accessToken.token.access_token}` } }).then(p => p.json()).then(async response => {
			//Find the right player record in the DB for this user. If there isn't one, make one.
			const playerId = await db.upsertDiscordPlayer(response.user);
			const updatedSession = { playerId: playerId, nick: response.user.username, discriminator: "#" + response.user.discriminator, expires: new Date(response.expires), sessionId: cookies.session };
			await db.upsertSession(updatedSession);
			console.log("Logged in as user ID: " + response.user.id + " with username: " + response.user.username + "#" + response.user.discriminator + " and identified as player " + playerId); //Can also use .avatar to display their avatar in the game: https://discord.com/api/avatars/{user_id}/{user_avatar}.png
			activeSessions[updatedSession.sessionId] = updatedSession;
			res.statusCode = 307;
			const cookieExpirer = "; Max-Age=" + Math.trunc((new Date(response.expires) - new Date()) / 1000 - 60); //Set the session and player cookies to expire right before the OAuth token does
			res.setHeader('Set-Cookie', ["session=" + encodeURI(cookies.session) + cookieExpirer, "player=" + playerId + cookieExpirer]); //Also let them know who they're logged in as
			res.setHeader('Location', urlParent + "home");
			res.end();
		}).catch(err => { throw err; });
	}).catch(err => { throw err; });

}

function parseCookies(request) {
	const list = {}, rc = request.headers.cookie;
	rc && rc.split(';').forEach(function (cookie) {
		const parts = cookie.split('=');
		list[parts.shift().trim()] = decodeURI(parts.join('='));
	});
	return list;
}

async function playerSearch(urlObject) {
	let name = urlObject.searchParams.get("name");
	if (name) name = name.replace(/[^a-z#]/gi, "").substr(0, 37); //Drop disallowed characters before checking if we should avoid searching. The 37 is the 32 max Discord username length + "#" + discriminator length (4, all digits)
	if (!name) return [];

	//Respond with [{name,id}, ...] where name includes the Discord username plus # plus discriminator
	return await db.searchPlayers(name);
}

function startServer() {
	const http = require('http');
	const url = require('url');

	const server = http.createServer(async (req, res) => {
		const offline = req.headers.host.includes("127.0.0.1");
		const cookies = parseCookies(req);
		const player = await getSessionIfValid(cookies?.session);
		const urlObject = new URL(req.url, `https://${req.headers.host}`);
		const urlParent = urlObject.pathname.replace(/\/[^/]*?$/i, "/"); //e.g. "127.0.0.1:3000//a/b.html" would become "127.0.0.1:3000//a/" and "aureuscode.com/a/b.html" would become "aureuscode.com/a/"
		const lowercasePath = urlObject.pathname.toLowerCase();

		//TODO: Check cached games every few minutes. Remove any games that haven't been touched in a long time, so they don't stay in memory the entire time until the server shuts down.
		//TODO: For games that are no longer cached, we need to be able to reload them and get their roundManager up to the last irreversible state (also kept in the cache) + the current state
		//TODO: We naturally need to lock the cache when checking it/adding to it. What's the nodejs mutex usage?

		function onError(err) {
			res.statusCode = 500;
			res.setHeader('Access-Control-Allow-Origin', '*'); //No longer needed for most requests since my local debugging can be done solely with http://127.0.0.1/ addresses now
			res.setHeader('Content-Type', 'application/javascript');
			res.end(err.text ? JSON.stringify(err) : (err instanceof TypeError) ? JSON.stringify({ text: err.toString() }) : JSON.stringify({ text: err })); //so you can return a plain string or multiple strings for multiple languages
		}
		function forbid(text = "You're not logged in as the right person for that action.") {
			res.statusCode = 403;
			res.setHeader('Content-Type', 'text/plain');
			res.end(text);
		}
		function json(obj) {
			return res.end(JSON.stringify(obj));
        }

		let requestBody = "";
		req.on("data", chunk => requestBody += chunk);
		req.on("end", async () => {
			try {
				const requestBodyObj = JSON.parse(requestBody || "{}");

				function loginRedirect() { return redirectIfNotLoggedIn(cookies, urlObject, res, player, true, true); }

				//Hosting basics
				if (lowercasePath.endsWith("/info")) {
					res.statusCode = 200;
					res.setHeader('Content-Type', 'text/plain');
					res.end('Bounty Tussle server. Running on NodeJS ' + process.versions.node + ". Cached games: " + cachedGames.length);
				} else if (lowercasePath.endsWith("/login")) { //If they're not logged in, send 'em to Discord to do so.
					if (player?.playerId) return json({ text: "Already logged in" });
					else if (!cookies?.session) { //No session cookie? Go home first!
						res.statusCode = 307;
						res.setHeader('Location', urlParent + "index.html");
						return res.end();
					}
					else return await discordLogin(req, res, cookies, offline);

				} else if (lowercasePath.endsWith("/loginresponse")) { //Callback for Discord SSO
					return await discordLoginCallback(req, res, cookies, urlParent, urlObject, offline);

				//Out-of-game browsing
				} else if (lowercasePath.endsWith("/home") || lowercasePath.endsWith("/bountytussle/") || lowercasePath.endsWith("/index")) {
					res.statusCode = 307;
					res.setHeader('Location', urlParent + "index.html");
					return res.end();

				} else if (lowercasePath.endsWith("/search")) {
					return json(await playerSearch(urlObject));

				} else if (lowercasePath.endsWith("/mygames")) {
					if (!loginRedirect()) return; //Must be logged in to see your own games
					return json(await listGames(player.playerId));

				//Game functions; these require the player to be authenticated already
				} else if (lowercasePath.endsWith("/newgame")) { //Start a new game for the given players
					if (!loginRedirect()) return;
					if (!requestBodyObj.players.includes(player.playerId)) requestBodyObj.players.push(player.playerId); //Game must include the person starting it ;)
					const players = [...new Set(requestBodyObj.players.map(p => parseInt(p)))]; //Make sure they're not strings, and distinctify them
					if (requestBodyObj.useExpansion && players.length > 6) throw "Cannot start an expansion game with more than 6 players.";
					else if (!requestBodyObj.useExpansion && players.length > 4) throw "Cannot start a non-expansion game with more than 4 players.";

					return json(await newGame(players, requestBodyObj.useExpansion, requestBodyObj.useAggressive, requestBodyObj.mapGenId));

				} else if (lowercasePath.endsWith("/pickcharacter")) { //A player wants to pick a specific character
					if (!loginRedirect()) return;

					const game = await getGame(requestBodyObj.gameId);
					const inGamePlayerId = game.players.indexOf(player.playerId);
					if (inGamePlayerId != requestBodyObj.playerId) return forbid(JSON.stringify({ btPlayerId: player.playerId, gameId: game.gameId, inGamePlayerId: inGamePlayerId, players: game.players }));
					return json(await pickCharacter(game, requestBodyObj.playerId, requestBodyObj.character));

				} else if (lowercasePath.endsWith("/sync")) { //Catch the client up with the current game state
					if (!loginRedirect()) return;

					const game = await getGame(requestBodyObj.gameId);
					if (game.players.indexOf(player.playerId) == -1) return forbid(); //Can't view others' games
					return json(catchUp(game, requestBodyObj.fromDecision));

				} else if (lowercasePath.endsWith("/act")) { //The player performs an action
					if (!loginRedirect()) return;

					const game = await getGame(requestBodyObj.gameId);

					const inGamePlayerId = game.players.indexOf(player.playerId); //game.players is the bountytussle player IDs, but the indexes of that array are the in-game-instance player IDs. I should really rename the out-of-game ones user IDs or something.
					if ((requestBodyObj.command.forPlayerId ?? game.roundManager.currentTurnPlayer?.tokenId) != inGamePlayerId) return forbid(); //Wrong player!
					return json(await act(game, inGamePlayerId, requestBodyObj.command));
				} //TODO: logout, leave, view end results, list past games...

				//Static file delivery
				else if (lowercasePath.endsWith(".html") || lowercasePath.endsWith(".js") || lowercasePath.endsWith(".png") || lowercasePath.endsWith(".ttf") || lowercasePath.endsWith(".ico")) { //This is especially for local testing because it can't redirect to a file:// path, but it also works okay on the server (aside from losing features like compression).
					if (lowercasePath.endsWith("/index.html") && !cookies?.sessionID) redirectIfNotLoggedIn(cookies, urlObject, res, player, false, false); //Also create a session and set a session cookie if they're going to the landing page and don't have one

					//Just send the file (but only files in the exact same directory as the server files, no subdirectories or anything--except .png comes from /img)
					const filename = urlObject.pathname.substr(urlObject.pathname.lastIndexOf("/") + 1);
					res.statusCode = 200;
					res.setHeader("Content-Type", lowercasePath.endsWith(".html") ? "text/html" : lowercasePath.endsWith(".js") ? "application/javascript" : lowercasePath.endsWith(".png") ? "image/png" : lowercasePath.endsWith(".ico") ? "image/x-icon" : "application/octet-stream");
					const fs = require('fs');
					const readStream = fs.createReadStream((lowercasePath.endsWith(".png") ? "img/" : "") + filename);
					readStream.on('open', () => readStream.pipe(res));
					readStream.on('error', onError);
				}
			} catch (err) {
				onError(err);
				throw err; //Dump the stack trace on my server, but don't freeze the client. :)
            }
		}).on('error', onError);
	});

	server.listen(3001, '127.0.0.1', async () => {
		console.log(`Bounty Tussle server restarted at ${new Date()}`);

		console.log("Loading persisted user sessions...");
		for (let session of await db.loadSessions()) activeSessions[session.id] = { sessionId: session.id, playerId: session.player_id, expires: session.expires }; //Note: I'm not loading the 'nick' or 'discriminator' fields in the sessions. I did in one place, but not sure I need to use them.
		console.log(Object.keys(activeSessions).length + " persisted user sessions loaded.");
	});
}

startServer();