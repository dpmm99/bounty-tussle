//To use this, a web page must have a dispatchOrder function and a dispatchCharacterSelection function
var g = new GameStarter();
var roundManager;
var nextDecisionToRequest = -1; //For server sync requests
var authenticatedPlayerIdOnServer; //Should come from a cookie
let authenticatedPlayerIdInGame = 0;

function createNewGameOnServer(parameters) {
    fetch(serverUrl + "newgame", { method: "POST", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parameters) })
        .then((response) => response.json())
        .then((data) => {
            if (data.text) { console.error(data.text); return; }
            g.gameId ??= data.gameId;
            roundManager = g.prepareGame(data.tokens.filter(p => p.tokenClass == "Player").length, data.expansion, data.useAggressive, 2, undefined, logGameEventToTextArea);
            syncFromServer(data);
        });
}

function requestFullSyncFromServer(gameId) {
    fetch(serverUrl + "sync", { method: "POST", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: gameId, fromDecision: -1 }) })
        .then((response) => response.json())
        .then((data) => {
            if (data.text) { console.error(data.text); return; }
            g.gameId ??= data.gameId;
            roundManager = g.prepareGame(data.tokens.filter(p => p.tokenClass == "Player").length, data.expansion, data.optionAggressive, 2, undefined, logGameEventToTextArea); //Reset the RoundManager entirely
            syncFromServer(data);
        });
}

function logGameEventToTextArea(text) {
    let textArea = document.querySelector("#game-log");
    if (!textArea) {
        textArea = document.createElement("textarea");
        textArea.id = "game-log";
        textArea.readOnly = true;
        textArea.style.position = "fixed";
        textArea.style.resize = "vertical";
        textArea.style.width = "220px";
        textArea.style.fontSize = "10px"; //Like the canvas defaulted to, so browser zoom works okay
        textArea.style.height = "400px";
        textArea.style.top = "125px";
        document.body.appendChild(textArea);
        if (!text) textArea.style.display = "none"; //Hide it 'til it's needed
    }
    if (text) textArea.style.display = "";
    //Float to either side, preferring the right side. Note there's just a little gap where the text area won't be able to move left/right if your window is between roughly canvas.clientWidth and canvas.clientWidth + textArea.clientWidth wide (plus padding)
    if (document.documentElement.scrollLeft == 0 || document.documentElement.scrollWidth - document.documentElement.clientWidth - document.documentElement.scrollLeft > textArea.clientWidth / 2) {
        textArea.style.right = "5px";
        textArea.style.left = "";
    } else {
        textArea.style.right = "";
        textArea.style.left = "5px";
    }
    //Include the new message if it's not empty (so this function can be used to change the float location when resizing or scrolling)
    if (text) {
        let { selectionStart, selectionEnd, selectionDirection } = textArea;
        let oldLength = textArea.textContent.length; //Because the browser might do weird things...like, for example, Chrome counts \r\n as 1 character in a text area, but obviously not in a string.
        textArea.textContent = text + "\r\n" + textArea.textContent;
        //Maintain the user's selection
        textArea.selectionStart = selectionStart + (textArea.textContent.length - oldLength);
        textArea.selectionEnd = selectionEnd + (textArea.textContent.length - oldLength);
        textArea.selectionDirection = selectionDirection;
    }
}

window.addEventListener("scroll", () => logGameEventToTextArea());
window.addEventListener("resize", () => logGameEventToTextArea());

function requestPartialSyncFromServer() {
    fetch(serverUrl + "sync", { method: "POST", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: g.gameId, fromDecision: nextDecisionToRequest }) })
        .then((response) => response.json())
        .then((data) => {
            if (data.text) { console.error(data.text); return; }
            syncFromServer(data);
        });
}

function sendOrderToServer(command) {
    if (!(command instanceof Object)) command = roundManager.currentOptions[command]; //Allows you to type 0 for the first command or pass in one yourself. The eventual UI would have to send a serializable form of the command.
    command = Object.assign({}, command); //Clone it
    command.forPlayerId = command.forPlayer?.tokenId ?? authenticatedPlayerIdInGame;

    //Transform the command so it doesn't have objects it it, just IDs
    if (command.toNode) command.nodeId = command.toNode.nodeId;
    if (command.forPlayer) command.forPlayerId = command.forPlayer.tokenId;
    delete command.toNode;
    delete command.forPlayer;

    fetch(serverUrl + "act", { method: "POST", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: g.gameId, command: command }) })
        .then((response) => response.json())
        .then((data) => {
            if (data.text) { console.error(data.text); return; }
            syncFromServer(data);
        });
}

function sendCharacterSelectionToServer(character) {
    fetch(serverUrl + "pickcharacter", { method: "POST", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: g.gameId, playerId: authenticatedPlayerIdInGame, character: character }) })
        .then((response) => response.json())
        .then((data) => {
            if (data.text) { console.error(data.text); return; }
            syncFromServer(data);
        });
}

function syncFromServer(data) {
    function classInstanceFromName(name) {
        if (name == "Player") return new Player();
        else if (name == "Enemy") return new Enemy();
        else if (name == "Station") return new Station();
        else return new Token();
    }

    function tokenFromClass(rawData) {
        const token = classInstanceFromName(rawData.tokenClass);
        Object.assign(token, rawData);
        delete token.tokenClass;

        return fixTokenTypeRefs(token);
    }

    function fixTokenTypeRefs(token) { //Swap out any token type or upgrade type strings for proper references (not token or map node references; that's fixTokenLinks)
        //Update the token type if that information was provided
        if (token.typeName && token.typeName != token.type?.name) { //Equality check because players can re-pick their character before the first round starts; otherwise, this would just be an "are both 'type' and 'typeName' truthy?" check
            if (token instanceof Enemy) {
                token.type = g.enemyTokenTypes[token.typeName];
                token.health = token.type.health; //Should really make that a method like Player.setCharacter
            }
            else if (token instanceof Station) token.type = g.stationTokenTypes[token.typeName];
            else if (token instanceof Player) token.setCharacter(g.playerTokenTypes[token.typeName]);
            delete token.typeName;
        }

        //Same for the upgrade if it's an upgrade station
        if (!token.upgrade && token.upgradeName) {
            token.upgrade = g.upgradeTokenTypes[token.upgradeName];
            delete token.upgradeName;
        }
        return token;
    }

    function setTokenNodeReferencesFromIds(token) { //Only needed for the very first sync, when the entire map is retrieved by the client. Changes in position and such will be handled by RoundManager's replay functionality.
        if (typeof token.nodeId == 'number') {
            token.containingNode = roundManager.map[token.nodeId];
            if (!roundManager.map[token.nodeId].containedTokens.includes(token)) roundManager.map[token.nodeId].containedTokens.push(token);
            delete token.nodeId;
        }
        if (typeof token.lastSavedAtNodeId == 'number') {
            token.nodeLastSavedAt = roundManager.map[token.lastSavedAtNodeId];
            delete token.lastSavedAtNodeId;
        }
        //Other token fields don't need to be directly set because the replay will handle them: upgrades, visitedUpgradeStations, accomplishments, inCombatWith, targetedPlayer
    }

    function setAdjacentNodeReferencesFromIds(node) {
        if (node.adjacentNodeIds) {
            node.adjacentNodes = node.adjacentNodeIds.map(p => roundManager.map[p]);
            delete node.adjacentNodeIds;
        }
    }

    if (data.fromDecision < nextDecisionToRequest) return; //we already have that game state reproduced locally

    //If the response has more map nodes than our local RoundManager, it's the first sync, so replace all tokens and map nodes. Otherwise, search for individual tokens/nodes to update.
    if (data.map && data.map.length > roundManager.map.length) {
        roundManager.map = data.map.map(p => Object.assign(new MapNode(), p));
        roundManager.tokens = data.tokens.map(tokenFromClass);
        //TODO: OPTIMIZE: We can exclude tokenId from tokens and nodeId from map nodes when sending the initial sync response and rebuild them here, since they're simply equal to the array index.
        for (let token of roundManager.tokens) setTokenNodeReferencesFromIds(token); //The tokens all know where they are in the map, so this updates MapNode.containedTokens as well.
        for (let node of roundManager.map) setAdjacentNodeReferencesFromIds(node);
        g.optimize(); //Rebuild some needed arrays in the RoundManager
        authenticatedPlayerIdInGame = roundManager.players.findIndex(p => p.playerUserId == authenticatedPlayerIdOnServer);
    } else { //The data should only include partial info about tokens (at most, tokenClass, typeName, and upgradeName)
        for (let resToken of data.tokens || []) {
            //TODO: The server SHOULD send state info from the last irreversible state, which includes the player's spacesToMove. Instead, it's sending spacesToMove *after* deducting from it when I move. In fact, I shouldn't get most token fields--including position, spacesToMove, health, etc.--in the response at all if the move is OK and wasn't an irreversible state.
            fixTokenTypeRefs(Object.assign(roundManager.tokens[resToken.tokenId], resToken));
        }
        for (let resNode of data.map || []) {
            Object.assign(roundManager.map[resNode.nodeId], resNode);
        }
    }

    //Catch up with the server state. Push all the decisions to the RoundManager. Push the rolls to the RoundManager via replacing its rollDie function. (Note: no further sync should be attempted until data.rolls.length == rollReplayed and all decisions were replayed)
    let rollsReplayed = 0;
    roundManager.rollDie = function (sides, purpose) {
        if (rollsReplayed >= data.rolls.length) throw "Attempted rolls exceeded the number of rolls loaded from the server; is your game client out of sync?";
        const roll = data.rolls[rollsReplayed++];
        roundManager.decided({ roll: roll, sides: sides });
        roundManager.logGameEvent("Roll for " + purpose + ": " + roll);
        return roll;
    }
    if (data.started && !roundManager.currentTurnPlayer) roundManager.start();
    for (let commandIndex of data.commandIndexes || []) roundManager.advance(commandIndex);
    if (typeof data.nextDecision == 'number') nextDecisionToRequest = data.nextDecision;

    if (Object.keys(data).length) g.boardGraphics.drawToCanvas(g, canvas, optionsCanvas, playersCanvas);
}

var optionsCanvas;
document.body.appendChild(optionsCanvas = document.createElement("canvas"));
optionsCanvas.style.position = "fixed";
optionsCanvas.style.left = "2px";
optionsCanvas.style.top = "2px";
optionsCanvas.style.display = "none";
var playersCanvas;
document.body.appendChild(playersCanvas = document.createElement("canvas"));
playersCanvas.style.position = "fixed";
playersCanvas.style.left = "2px";
playersCanvas.style.top = "46px";
playersCanvas.style.display = "none";
var canvas;
document.body.appendChild(canvas = document.createElement("canvas"));
canvas.style.position = "absolute";
canvas.style.top = "104px";
canvas.style.display = "none";

function imageLoaded() {
    if (--imagesToLoad == 0 && roundManager) g.boardGraphics.drawToCanvas(g, canvas, optionsCanvas, playersCanvas);
}

let imagesToLoad = 1; //1 more than the number of tokenImages in case they're all cached--then call imageLoaded right after setting all the images' sources to deduct the extra 1.
g.boardGraphics.tokenImages = Object.fromEntries(["BabySheegoth", "ChargeBeam", "EarlyStation", "Enemy", "EnergyTank", "Geemer", "IceBeam", "Kanden", "KandenToken", "LateStation", "MapStation", "Metroid", "MetroidContainment", "MissileTank", "MorphBall", "Noxus", "NoxusToken", "PirateTrooper", "RechargeStation", "Ripper", "Samus", "SamusToken", "SaveStation", "Ship", "Sidehopper", "Spire", "SpireToken", "Sylux", "SyluxToken", "UpgradeStation", "VariaSuit", "WarWasp", "Waver", "Weavel", "WeavelToken", "Zeb", "ZebesianPirate"]
    .map(p => { let i = new Image(); imagesToLoad++; i.onload = imageLoaded; i.src = "img/" + p + ".png"; return [p, i]; }));
imageLoaded();

//Change cursor when it moves over a clickable area of the board
let mouseHoverInfoTimer;
let hoverInfo = document.querySelector("hover-info");
if (!hoverInfo) {
    //Wild, but I'm gonna use a second canvas. :P
    hoverInfo = document.createElement("canvas");
    hoverInfo.style.display = "none";
    hoverInfo.width = 250;
    hoverInfo.height = 150;
    hoverInfo.style.position = "absolute";
    document.body.appendChild(hoverInfo);
}

function getTokenInfo(token, info, isCharacterSelection) {
    if (token instanceof Enemy) {
        if (!token.isRevealed) { info.push("Unidentified enemy"); }
        else {
            info.push(`Enemy: ${token.type.name} (${token.health}/${token.type.health})`);
            info.push(`Players must roll at least ${token.type.hitRollAtLeast} to hit or ${token.type.dodgeRollAtLeast} to dodge`);
            info.push(`Enemy's attack deals ${token.type.damage} damage`);
            if (!token.type.beamCanHarm) info.push(`Takes no damage from beam weaponry`);
            if (token.type.invulnerableIfNotFrozen) info.push(`Only vulnerable while frozen`);
            if (token.type.ranged) info.push(`Ranged`);
        }
    } else if (token instanceof Player) {
        if (token.nickname) info.push("Player: " + token.nickname + (token.acceptedDefeat ? " (defeated)" : ""));
        info.push(`Character: ${token.type.name} (${token.health}/${token.maxHealth})`);
        if (token.maxMissiles && isCharacterSelection) info.push(`Starts with ${token.maxMissiles} missile${token.maxMissiles != 1 ? "s" : ""}`);
        else if (token.maxMissiles) info.push(`Missiles: ${token.missiles}/${token.maxMissiles}`);
        if (token.type.stunConditionRollAtLeast) info.push(`Can stun foe if attack roll is at least ${token.type.stunConditionRollAtLeast}`);
        if (token.type.freezeConditionRollAtLeast) info.push(`Can freeze foe if attack roll is at least ${token.type.freezeConditionRollAtLeast}`);
        if (token.type.damageConditionRollAtLeast) info.push(`Does an additional ${token.type.conditionalBeamDamage} damage if attack roll is at least ${token.type.damageConditionRollAtLeast}`);
        if (token.type.canTraverseTunnels) info.push(`Can traverse tunnels (gray circle)`);
        if (token.type.superheatedRoomHealthRefillRollInsteadOfDamage) info.push(`Heals when in superheated spaces (pink square)`);
        if (token.type.dodgeRollBonus) info.push("All dodge rolls are increased by " + token.type.dodgeRollBonus);
        if (token.type.dodgeRollOutOfCombatBonus) info.push("Bonus to dodge roll if not in combat: " + token.type.dodgeRollOutOfCombatBonus);
        if (token.type.chargeBeamDisallowed) info.push("Cannot obtain Charge Beam");
        if (token.type.morphBallDisallowed) info.push("Cannot obtain Morph Ball");
        if (token.type.iceBeamDisallowed) info.push("Cannot obtain Ice Beam");
        if (token.type.variaSuitDisallowed) info.push("Cannot obtain Varia Suit");
        for (let upgrade of token.upgrades) {
            if (upgrade.enableTunnelTraversal) info.push(`Can traverse tunnels (spaces with a gray circle)`);
            if (upgrade.dodgeRollOutOfCombatBonus) info.push(`Additional dodge roll bonus of ${upgrade.dodgeRollOutOfCombatBonus} if not in combat`);
            if (upgrade.superheatedRoomNoDamage) info.push(`Takes no damage from superheated spaces (pink square)`);
            if (upgrade.firstBeamAttackDamageBonus) info.push(`Does an additional ${upgrade.firstBeamAttackDamageBonus} damage on the first attack of each fight if using a beam weapon`);
            if (upgrade.freezeForRoundsOnHit) info.push(`Has a weapon that always freeze enemies if it hits`);
        }
    } else if (token instanceof Station) {
        if (!token.isRevealed) { info.push("Unidentified station"); }
        else {
            info.push(`Station: ${token.type.name}`);
            if (token.type.saveStation) info.push(`Players can save here`);
            if (token.type.refillHealth) info.push(`Refills health`);
            if (token.type.refillMissiles) info.push(`Refills missiles`);
            if (token.type.haltMovement) info.push(`Player must end turn upon using this station`);
            if (token.upgrade) {
                info.push(`Grants the ${token.upgrade.name} upgrade, which:`);
                if (token.upgrade.enableTunnelTraversal) info.push(`- Makes player able to traverse tunnels (gray circle)`);
                if (token.upgrade.dodgeRollOutOfCombatBonus) info.push(`- Increases dodge roll by ${token.upgrade.dodgeRollOutOfCombatBonus} if not in combat`);
                if (token.upgrade.isBeamAddon) info.push(`- Upgrades existing beam weaponry`);
                if (token.upgrade.superheatedRoomNoDamage) info.push(`- Prevents damage from superheated spaces (pink square)`);
                if (token.upgrade.firstBeamAttackDamageBonus) info.push(`- Does an additional ${token.upgrade.firstBeamAttackDamageBonus} damage on the first attack of each fight if using a beam weapon`);
                if (token.upgrade.freezeForRoundsOnHit) info.push(`- Freezes the enemy for a round if it hits`);
                if (token.upgrade.hitRollBonus < 0) info.push(`- Reduces attack rolls by ${-token.upgrade.hitRollBonus}`);
                if (token.upgrade.optionalActivation) info.push(`- Usage is optional`);
                if (token.upgrade.maxMissiles) info.push(`- Increases max missiles by ${token.upgrade.maxMissiles}`);
                if (token.upgrade.missiles == 1) info.push(`- Grants ${token.upgrade.missiles} missile immediately`);
                if (token.upgrade.missiles > 1) info.push(`- Grants ${token.upgrade.missiles} missiles immediately`);
                if (token.upgrade.maxHealth) info.push(`- Increases max health by ${token.upgrade.maxHealth}`);
                if (token.upgrade.health) info.push(`- Grants ${token.upgrade.health} health immediately`);
            }
        }
    }
}

optionsCanvas.onmousemove = playersCanvas.onmousemove = canvas.onmousemove = function (e) {
    if (g.boardGraphics.canvasClickables.some(clickable => e.offsetX >= clickable.left && e.offsetX <= clickable.right && e.offsetY >= clickable.top && e.offsetY < clickable.bottom && e.target == clickable.canvas)) {
        e.target.style.cursor = "pointer";
    } else e.target.style.cursor = "";

    //Pop up extra info if the player keeps the mouse still (*near* tokens/a space) for a moment
    hoverInfo.style.display = "none";
    if (mouseHoverInfoTimer) clearTimeout(mouseHoverInfoTimer);
    const lastX = e.offsetX, lastY = e.offsetY, target = e.target;
    mouseHoverInfoTimer = setTimeout(() => {
        if (!roundManager?.players?.length) return; //Has to be an active game

        //Get the map node nearest the cursor, but only for the main (game board) canvas
        let closestNode = roundManager.map[0];
        let closestDistSqr = Number.MAX_VALUE;
        if (e.target == canvas) {
            for (var node of roundManager.map) {
                let nodeDistSqr = Math.pow(node.x - lastX, 2) + Math.pow(node.y - lastY, 2);
                if (nodeDistSqr < closestDistSqr) {
                    closestNode = node;
                    closestDistSqr = nodeDistSqr;
                }
            }
        }

        //Gather info for the pop-up
        let info = [];
        let overCanvasClickable = g.boardGraphics.canvasClickables.find(clickable => lastX >= clickable.left && lastX <= clickable.right && lastY >= clickable.top && lastY < clickable.bottom && target == clickable.canvas);
        if (roundManager.players.some(p => !p.type && !p.acceptDefeat) && overCanvasClickable) { //Mouse hovered over a character selection image
            let fakePlayer = new Player();
            fakePlayer.setCharacter(g.playerTokenTypes[overCanvasClickable.character]);
            getTokenInfo(fakePlayer, info, true);

        } else if (closestDistSqr < 30 * 30) { //Mouse hovered over a node
            if (closestNode.isMetroidContainment) info.push("Metroid Containment space");
            if (closestNode.isSuperHeated) info.push("Superheated space");
            if (closestNode.isTunnel) info.push("Tunnel space");
            if (closestNode.isLandingSite) info.push("Landing Site space");
            if (!info.length) info.push("Unremarkable space");
            info[0] = closestNode.nodeId + ". " + info[0];
            if (!closestNode.containedTokens.length) info.push("Empty");
            for (let token of closestNode.containedTokens) {
                getTokenInfo(token, info);
            }
        }

        //Render the pop-up
        if (info.length) {
            hoverInfo.style.display = "";

            //Size out the text first
            var ctx = hoverInfo.getContext("2d");
            ctx.font = '10px sans-serif';
            hoverInfo.height = 10 + 11 * info.length + 7 * info.filter(p => p.startsWith("Enemy:") || p.startsWith("Player:") || p.startsWith("Station:")).length;
            hoverInfo.width = info.map(text => ctx.measureText(text).width).reduce((max, cur) => Math.max(max, cur));

            //Check if it's too far to one side of the existing canvas before positioning it
            hoverInfo.style.left = hoverInfo.style.top = hoverInfo.style.right = hoverInfo.style.bottom = "";
            if (lastX + 20 + hoverInfo.width < target.width) hoverInfo.style.left = lastX + 20 + "px"; //Extra offset because the canvas it's relative to is, itself, offset
            else hoverInfo.style.left = lastX - 20 - hoverInfo.width + "px";
            if (lastY + 20 + hoverInfo.height < target.height) hoverInfo.style.top = lastY + 10 + parseInt(target.style.top) + "px";
            else hoverInfo.style.top = lastY - 10 - hoverInfo.height + parseInt(target.style.top) + "px";

            //Render the background
            ctx.fillStyle = "#ffe";
            ctx.strokeStyle = "#777";
            ctx.fillRect(0, 0, hoverInfo.width, hoverInfo.height); //The info space needs a background to make it readable
            ctx.lineWidth = 5;
            ctx.strokeRect(0, 0, hoverInfo.width, hoverInfo.height);

            //Render the information
            ctx.lineWidth = 2;
            ctx.fillStyle = "#000";
            let nextLineY = 5;
            for (let infoLine of info) {
                if (infoLine.startsWith("Enemy:") || infoLine.startsWith("Player:") || infoLine.startsWith("Station:")) { //Draw a separator line before each identified token
                    ctx.beginPath();
                    ctx.lineTo(15, nextLineY + 4);
                    ctx.lineTo(hoverInfo.width - 15, nextLineY + 4);
                    ctx.stroke();
                    nextLineY += 7;
                }

                ctx.fillText(infoLine, 5, nextLineY + 10, hoverInfo.width - 10); //The +10 is because the Y position is the font baseline... The third parameter will actually shrink the text to fit hoverInfo's width.
                nextLineY += 11;
            }
        }
    }, 800);
}

//Set up a click handler for that canvas rendered by boardGraphics
optionsCanvas.onclick = playersCanvas.onclick = canvas.onclick = function (e) {
    for (var clickable of g.boardGraphics.canvasClickables) {
        if (e.offsetX >= clickable.left && e.offsetX <= clickable.right && e.offsetY >= clickable.top && e.offsetY < clickable.bottom && e.target == clickable.canvas) {
            //Issue command
            if (typeof clickable.commandIndex == "number") dispatchOrder(clickable.commandIndex);
            else if (clickable.character) dispatchCharacterSelection(clickable.character);
            break; //Because the above changes canvasClickables...and I could also have had multiple on top of each other, in theory.
        }
    }
}