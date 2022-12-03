"use strict";
//TODO: Instruction manual. ;)

class GameStarter {
    expansion = false;
    optionAggressive = false;
    roundManager = new RoundManager(this);
    boardGraphics = new BoardGraphics();
    setupParameters = new SetupParameters();
    playerTokenTypes = new PlayerTokenTypes();
    enemyTokenTypes = new EnemyTokenTypes();
    upgradeTokenTypes = new UpgradeTokenTypes();
    stationTokenTypes = new StationTokenTypes();
    rnd; //Math.random or seeded random function

    getMetroidContainmentSpaces(map) {
        return map.filter(node => node.isMetroidContainment);
    }

    getLandingSites(map) {
        return map.filter(node => node.isLandingSite);
    }

    /**
     * Modify the given baseData by changing all fields that are in the patchData (goes one level deep, so expansionData can contain simple objects)
     */
    patch(baseData, patchData) {
        for (let dataKey in patchData) {
            if (baseData[dataKey]) Object.assign(baseData[dataKey], patchData[dataKey]);
            else baseData[dataKey] = patchData[dataKey];
        }
    }

    enableExpansion() {
        this.expansion = true;
        this.roundManager.playersCanRevive = true;
        this.patch(this.playerTokenTypes, new ExpansionPlayerTokenTypes());
        this.patch(this.enemyTokenTypes, new ExpansionEnemyTokenTypes());
        this.patch(this.upgradeTokenTypes, new ExpansionUpgradeTokenTypes());
        this.patch(this.stationTokenTypes, new ExpansionStationTokenTypes());
        this.patch(this.setupParameters, new ExpansionSetupParameters());
    }

    enableOptionAggressive() {
        this.optionAggressive = true;
        this.roundManager.playersCanInhabitSameSpace = false;
        this.roundManager.canKillStealOnAdjacentSpaces = true;
        this.roundManager.destroyUpgradeRoomAfterUse = true; //Upgrade rooms can only be used once (unless the upgrade being offered can't be obtained elsewhere, is marked as 'guaranteed'=true, and someone still needs it)
        this.patch(this.upgradeTokenTypes, new OptionAggressiveUpgradeTokenTypes());
    }

    /**
     * Get the game state ready for players to pick their characters and begin the game.
     * Returns the RoundManager that you can use to start the game.
     */
    prepareGame(playerCount, useExpansion, useOptionAggressive, mapNumber, randomFunction = Math.random, eventLogFunction = console.log) { //TODO: The client would be given a fake random function that just returns the next not-yet-pulled roll from the server.
        if (useExpansion) this.enableExpansion();
        if (useOptionAggressive) this.enableOptionAggressive();

        const tokens = []; //list of Token. The array itself must never be replaced. Includes the players. Players are included in this list in the order that they'll be playing.
        for (let x = 0; x < playerCount; x++) tokens.push(new Player()); //Player tokens must be guaranteed to be the first tokens, so that tokenId == the index in the players list
        this.roundManager.rnd = this.rnd = randomFunction;

        const mapGenerators = [this.generateMap, this.generateExpansionTestMap, this.generateEditorMap, this.generateExpansionDraftMap];
        const map = mapGenerators[mapNumber].apply(this, [tokens, playerCount]); //list of MapNode
        this.roundManager.map = map;
        this.roundManager.tokens = tokens;
        this.roundManager.logGameEvent = eventLogFunction;
        this.optimize();
        return this.roundManager;
    }

    /**
     * Apply optimizations to the RoundManager--set nodeId for every node and tokenId for every token, plus set the metroidContainers and availableLandingSites arrays.
     */
    optimize() {
        for (let x = 0; x < this.roundManager.map.length; x++) this.roundManager.map[x].nodeId = x; //Give every map node a nodeId here once so that we don't have to search map[] to get the node's index.
        for (let x = 0; x < this.roundManager.tokens.length; x++) this.roundManager.tokens[x].tokenId = x; //Same for tokens, but this isn't used in this file; this is just for convenience if saving the game state.
        this.roundManager.metroidContainers = this.getMetroidContainmentSpaces(this.roundManager.map);
        this.roundManager.availableLandingSites = this.getLandingSites(this.roundManager.map);
        this.roundManager.players = this.roundManager.tokens.filter(token => token instanceof Player);
    }

    generateEditorMap(tokens, playerCount) {
        return []; //Empty map for use in a map creation mode
    }

    generateExpansionDraftMap(tokens, playerCount) {
        const map = [];
        let n1, n2, n3, n4; //Last node, second from last, third from last, fourth from last

        function link(a, b, c) {
            if (a == b) return;
            if (!a.adjacentNodes.includes(b)) a.adjacentNodes.push(b);
            if (!b.adjacentNodes.includes(a)) b.adjacentNodes.push(a);
        }
        function add(values) {
            map.push(Object.assign(new MapNode(), values));
            n4 = n3;
            n3 = n2;
            n2 = n1;
            n1 = map[map.length - 1];
            return n1;
        }

        //Generated map code from last time goes here
        add(); //0
        link(add(), n2); //1-0
        link(add(), n2); //2-1
        link(n1, n3); //2-0
        link(add(), n3); //3-1
        link(add(), n2); //4-3
        link(n1, n3); //4-2
        link(add(), n2); //5-4
        link(add(), n2); //6-5
        link(add(), n2); //7-6
        link(n1, n4); //7-4
        link(add(), map[3]); //8-3
        link(n1, n2); //8-7
        link(add(), n3); //9-7
        link(add(), n2); //10-9
        link(n1, map[6]); //10-6
        link(add(), n2); //11-10
        link(add(), n2); //12-11
        link(n1, n4); //12-9
        link(add(), map[9]); //13-9
        link(n1, map[8]); //13-8
        link(add(), n2); //14-13
        link(n1, n3); //14-12
        link(add(), n4); //15-12
        link(add(), n2); //16-15
        link(n1, map[11]); //16-11
        link(add(), n2); //17-16
        link(add(), n2); //18-17
        link(n1, n4); //18-15
        link(add(), n2); //19-18
        link(add(), n2); //20-19
        link(n1, n4); //20-17
        link(add(), n2); //21-20
        link(add(), n2); //22-21
        link(n1, n4); //22-19
        link(add(), n2); //23-22
        link(n1, n3); //23-21
        link(add(), n4); //24-21
        link(add(), n2); //25-24
        link(n1, n3); //25-23
        link(add(), n2); //26-25
        link(add(), n2); //27-26
        link(n1, n4); //27-24
        link(add(), n2); //28-27
        link(add(), n2); //29-28
        link(n1, n4); //29-26
        link(add(), n2); //30-29
        link(add(), n2); //31-30
        link(n1, n4); //31-28
        link(add(), n2); //32-31
        link(add(), n2); //33-32
        link(n1, n4); //33-30
        link(add(), n2); //34-33
        link(add(), n2); //35-34
        link(n1, n4); //35-32
        link(add(), n2); //36-35
        link(add(), n2); //37-36
        link(n1, n4); //37-34
        link(add(), map[22]); //38-22
        link(add(), n2); //39-38
        link(n1, map[19]); //39-19
        link(add(), n2); //40-39
        link(n1, map[18]); //40-18
        link(add(), n2); //41-40
        link(n1, map[15]); //41-15
        link(n1, map[14]); //41-14
        link(add(), map[14]); //42-14
        link(add(), n2); //43-42
        link(n1, n3); //43-41
        link(add(), n2); //44-43
        link(add(), n2); //45-44
        link(n1, n4); //45-42
        link(add(), map[42]); //46-42
        link(add(), n2); //47-46
        link(n1, n3); //47-45
        link(add(), n4); //48-45
        link(n1, n2); //48-47
        link(add(), n3); //49-47
        link(add(), n2); //50-49
        link(n1, map[46]); //50-46
        link(add(), n2); //51-50
        link(n1, n3); //51-49
        link(add(), n2); //52-51
        link(add(), map[44]); //53-44
        link(n1, map[48]); //53-48
        link(add(), map[48]); //54-48
        link(add(), n2); //55-54
        link(n1, n3); //55-53
        link(add(), n2); //56-55
        link(add(), n2); //57-56
        link(n1, n4); //57-54
        link(add(), n2); //58-57
        link(add(), n2); //59-58
        link(n1, n4); //59-56
        link(add(), n2); //60-59
        link(add(), n2); //61-60
        link(n1, n4); //61-58
        link(add(), map[58]); //62-58
        link(add(), n2); //63-62
        link(add(), n2); //64-63
        link(add(), n2); //65-64
        link(add(), n2); //66-65
        link(add(), n2); //67-66
        link(add(), map[60]); //68-60
        link(add(), n2); //69-68
        link(add(), n2); //70-69
        link(add(), n4); //71-68
        link(n1, map[61]); //71-61
        link(add(), n2); //72-71
        link(add(), n2); //73-72
        link(add(), n2); //74-73
        link(n1, n3); //74-72
        link(add(), n2); //75-74
        link(add(), n2); //76-75
        link(add(), n2); //77-76
        link(add(), n2); //78-77
        link(add(), map[73]); //79-73
        link(add(), n2); //80-79
        link(add(), n2); //81-80
        link(add(), n2); //82-81
        link(n1, n4); //82-79
        link(add(), n4); //83-80
        link(add(), n2); //84-83
        link(add(), n4); //85-82
        link(add(), n2); //86-85
        link(add(), n2); //87-86
        link(add(), n2); //88-87
        link(add(), map[81]); //89-81
        link(add(), n2); //90-89
        link(add(), n2); //91-90
        link(n1, n3); //91-89
        link(add(), n2); //92-91
        link(add(), n2); //93-92
        link(n1, n3); //93-91
        link(add(), n2); //94-93
        link(add(), n2); //95-94
        link(n1, n4); //95-92
        link(add(), n4); //96-93
        link(add(), n2); //97-96
        link(n1, n4); //97-94
        link(add(), n2); //98-97
        link(add(), n2); //99-98
        link(add(), n2); //100-99
        link(add(), n2); //101-100
        link(n1, n4); //101-98
        link(add(), n2); //102-101
        link(add(), n2); //103-102
        link(n1, n4); //103-100
        link(add(), n2); //104-103
        link(n1, n3); //104-102
        link(add(), n4); //105-102
        link(n1, n2); //105-104
        link(add(), n3); //106-104
        link(add(), n2); //107-106
        link(add(), n2); //108-107
        link(n1, n3); //108-106
        link(add(), n2); //109-108
        link(add(), n2); //110-109
        link(n1, n4); //110-107
        link(add(), n2); //111-110
        link(add(), n2); //112-111
        link(n1, n4); //112-109
        link(add(), n2); //113-112
        link(n1, n3); //113-111
        link(add(), n2); //114-113
        link(add(), n2); //115-114
        link(add(), n2); //116-115
        link(add(), n2); //117-116
        link(n1, n3); //117-115
        link(add(), n2); //118-117
        link(add(), n2); //119-118
        link(n1, n4); //119-116
        link(add(), map[99]); //120-99
        link(n1, map[97]); //120-97
        link(add(), map[96]); //121-96
        link(n1, n2); //121-120
        link(add(), n2); //122-121
        link(n1, map[96]); //122-96
        link(add(), n2); //123-122
        link(add(), n2); //124-123
        link(add(), n2); //125-124
        link(add(), n2); //126-125
        link(add(), n2); //127-126
        link(add(), map[105]); //128-105
        link(add(), n2); //129-128
        link(add(), n2); //130-129
        link(n1, n3); //130-128
        link(add(), n2); //131-130
        link(add(), n2); //132-131
        link(add(), n2); //133-132
        link(add(), n2); //134-133
        link(add(), n2); //135-134
        link(n1, n4); //135-132
        link(add(), n2); //136-135
        link(add(), n2); //137-136
        link(n1, n4); //137-134
        link(add(), n2); //138-137
        link(add(), n2); //139-138
        link(n1, n4); //139-136
        link(add(), n2); //140-139
        link(add(), n2); //141-140
        link(n1, n4); //141-138
        link(add(), map[131]); //142-131
        link(n1, map[130]); //142-130
        link(n1, map[129]); //142-129
        link(add(), map[129]); //143-129
        link(n1, n2); //143-142
        link(add(), n2); //144-143
        link(add(), n2); //145-144
        link(add(), n2); //146-145
        link(add(), n2); //147-146
        link(add(), map[143]); //148-143
        link(add(), n2); //149-148
        link(n1, map[142]); //149-142
        link(add(), n2); //150-149
        link(n1, map[131]); //150-131
        link(add(), n3); //151-149
        link(add(), n2); //152-151
        link(n1, n3); //152-150
        link(add(), n3); //153-151
        link(n1, map[148]); //153-148
        link(add(), n2); //154-153
        link(n1, n4); //154-151
        link(n1, map[70]); //154-70
        link(add(), map[151]); //155-151
        link(n1, n4); //155-152
        link(n1, n2); //155-154
        link(add(), n2); //156-155
        link(add(), n2); //157-156
        link(add(), n2); //158-157
        link(add(), n2); //159-158
        link(add(), n2); //160-159
        link(n1, n4); //160-157
        link(add(), n2); //161-160
        link(add(), n2); //162-161
        link(n1, n4); //162-159
        link(add(), n2); //163-162
        link(add(), n2); //164-163
        link(n1, n4); //164-161
        link(add(), n2); //165-164
        link(add(), n2); //166-165
        link(n1, n4); //166-163
        link(add(), n2); //167-166
        link(add(), n2); //168-167
        link(n1, n4); //168-165
        link(add(), n2); //169-168
        link(add(), n2); //170-169
        link(n1, n4); //170-167
        link(add(), n2); //171-170
        link(add(), n2); //172-171
        link(n1, n4); //172-169
        link(add(), n2); //173-172
        link(add(), n2); //174-173
        link(n1, n4); //174-171
        link(add(), n2); //175-174
        link(n1, n3); //175-173
        link(add(), n4); //176-173
        link(add(), n2); //177-176
        link(n1, n3); //177-175
        link(add(), n2); //178-177
        link(add(), n2); //179-178
        link(n1, n4); //179-176
        link(add(), n2); //180-179
        link(n1, map[176]); //180-176
        add(); //181
        link(add(), n3); //182-180
        link(add(), n2); //183-182
        link(add(), n2); //184-183
        link(n1, map[180]); //184-180
        link(n1, map[179]); //184-179
        link(add(), n2); //185-184
        link(n1, map[178]); //185-178
        link(add(), n2); //186-185
        link(n1, n3); //186-184
        link(add(), n2); //187-186
        link(add(), map[183]); //188-183
        link(n1, n3); //188-186
        link(add(), n3); //189-187
        link(add(), n2); //190-189
        link(add(), n2); //191-190
        link(n1, map[181]); //191-181
        link(add(), n2); //192-191
        link(n1, map[70]); //192-70
        link(add(), n2); //193-192
        link(n1, n4); //193-190
        link(n1, map[70]); //193-70
        link(add(), n2); //194-193
        link(n1, map[189]); //194-189
        link(add(), n2); //195-194
        link(n1, map[155]); //195-155
        link(n1, map[70]); //195-70
        link(n1, n3); //195-193
        link(add(), map[90]); //196-90
        link(add(), n2); //197-196
        link(n1, map[90]); //197-90
        link(add(), n2); //198-197
        link(add(), n2); //199-198
        link(n1, n4); //199-196
        link(add(), n2); //200-199
        link(n1, n3); //200-198
        link(add(), map[38]); //201-38
        link(add(), n2); //202-201
        link(n1, map[38]); //202-38
        link(n1, map[39]); //202-39
        link(add(), n2); //203-202
        link(n1, map[39]); //203-39
        link(add(), n2); //204-203
        link(n1, map[181]); //204-181
        link(add(), n2); //205-204
        link(n1, n4); //205-202
        link(add(), map[201]); //206-201
        link(n1, n2); //206-205
        link(add(), n3); //207-205
        link(n1, map[190]); //207-190
        link(n1, map[181]); //207-181
        link(add(), n2); //208-207
        link(n1, n3); //208-206
        link(n1, map[189]); //208-189

        const coords = [53,116, 76,159, 136,123, 151,175, 193,128, 224,58, 286,71, 262,139, 230,191, 319,147, 327,82, 390,92, 370,163, 293,198, 355,208, 440,172, 460,111, 525,131, 505,188, 571,208, 592,161, 647,169, 627,224, 676,232, 708,178, 715,231, 773,226, 760,170, 820,157, 831,207, 899,199, 891,142, 935,121, 952,184, 1003,181, 1003,116, 1079,112, 1068,167, 631,282, 562,258, 493,241, 424,223, 364,274, 428,270, 442,311, 379,314, 305,290, 322,346, 382,362, 252,350, 250,301, 184,327, 97,328, 445,360, 382,412, 447,419, 454,477, 381,467, 373,541, 435,544, 424,601, 367,604, 305,534, 247,534, 200,534, 161,523, 105,520, 43,508, 415,656, 498,631, 578,611, 352,660, 287,673, 251,721, 242,673, 196,659, 146,652, 92,640, 37,617, 253,760, 305,780, 254,801, 191,773, 342,780, 397,781, 154,757, 109,751, 75,740, 29,732, 277,841, 254,877, 308,882, 368,863, 370,916, 421,921, 423,874, 362,972, 416,978, 463,978, 453,1044, 528,1051, 529,980, 586,987, 602,1042, 655,1012, 626,939, 700,1009, 747,982, 747,1033, 783,1042, 798,991, 848,1018, 818,1064, 878,1072, 927,1099, 986,1078, 1016,1016, 1056,1042, 1088,990, 1041,964, 395,1039, 346,1023, 293,986, 231,989, 191,995, 140,999, 86,1011, 58,1074, 652,899, 652,853, 714,861, 747,811, 776,833, 779,870, 835,883, 849,835, 915,837, 919,878, 997,880, 999,820, 1067,818, 1076,883, 701,801, 649,807, 606,793, 551,792, 503,773, 528,720, 652,759, 713,753, 770,745, 675,706, 733,689, 635,715, 603,662, 665,647, 709,634, 765,611, 774,667, 836,663, 833,597, 899,608, 897,659, 962,665, 947,613, 981,587, 1031,628, 1046,560, 996,536, 996,484, 1052,490, 1050,406, 993,427, 965,403, 1002,357, 937,340, 905,404, 863,353, 798,375, 844,424, 905,463, 528,421, 875,532, 809,530, 797,475, 741,423, 743,479, 672,485, 752,532, 624,490, 582,487, 541,496, 546,553, 594,542, 642,541, 640,589, 209,862, 202,904, 145,901, 133,855, 70,875, 623,335, 566,319, 518,313, 524,369, 577,370, 620,387, 570,425, 614,428];

        //Apply graphical coordinates
        for (let x = 0; x < map.length; x++) {
            map[x].x = coords[x * 2];
            map[x].y = coords[x * 2 + 1];
        }

        function putAt(node, token, values) {
            node.containedTokens.push(Object.assign(token, values));
            tokens.push(token);
            token.containingNode = node;
            return token;
        }

        //Special node types and various tokens that need placed
        const metroidNodes = [5, 26, 36, 41, 53, 68, 99, 106, 119, 130, 141, 147, 167, 185, 192, 204].map(index => map[index]);
        for (let node of metroidNodes) node.isMetroidContainment = true;
        this.placeTokens(tokens, metroidNodes, this.setupParameters.Metroids, Enemy, this.enemyTokenTypes);

        const enemyNodes = [3, 9, 17, 27, 29, 35, 37, 38, 42, 57, 60, 83, 93, 102, 111, 117, 122, 125, 128, 135, 145, 151, 154, 159, 169, 171, 180, 182, 195, 208].map(index => map[index]);
        this.placeTokens(tokens, enemyNodes, this.setupParameters.Enemies, Enemy, this.enemyTokenTypes);

        const earlyStationNodes = [11, 31, 84, 100, 127].map(index => map[index]);
        this.placeTokens(tokens, earlyStationNodes, this.setupParameters.Stations.early, Station, this.stationTokenTypes, true /*indicate that it's an early station, for graphical reasons*/);

        const lateStationNodes = [113, 139, 163, 177, 191].map(index => map[index]);
        this.placeTokens(tokens, lateStationNodes, this.setupParameters.Stations.late, Station, this.stationTokenTypes);

        const tunnelNodes = [69, 132, 156, 187].map(index => map[index]);
        for (let node of tunnelNodes) node.isTunnel = true;

        const superHeatedNodes = [157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 182, 183, 184, 185, 186, 188].map(index => map[index]);
        for (let node of superHeatedNodes) node.isSuperHeated = true;

        //Landing sites (your space ships!)
        const landingSiteNodes = [0, 52, 67, 78, 88, 200].map(index => map[index]);
        for (let node of landingSiteNodes) {
            node.isLandingSite = true;
            putAt(node, new Station(), { type: this.stationTokenTypes.Ship, isRevealed: true });
        }

        return map;
    }

    /**
     * Temporary test function that generates a super tiny map for testing expansion features.
     */
    generateExpansionTestMap(tokens, playerCount) {
        const map = [];
        let n1, n2, n3, n4; //Last node, second from last, third from last, fourth from last

        function link(a, b, c) {
            if (!a.adjacentNodes.includes(b)) a.adjacentNodes.push(b);
            if (!b.adjacentNodes.includes(a)) b.adjacentNodes.push(a);
            if (c) {
                if (!a.adjacentNodes.includes(c)) a.adjacentNodes.push(c);
                if (!b.adjacentNodes.includes(c)) b.adjacentNodes.push(c);
                if (!c.adjacentNodes.includes(a)) c.adjacentNodes.push(a);
                if (!c.adjacentNodes.includes(b)) c.adjacentNodes.push(b);
            }
            return a;
        }
        function add(values) {
            map.push(Object.assign(new MapNode(), values));
            n4 = n3;
            n3 = n2;
            n2 = n1;
            n1 = map[map.length - 1];
            return n1;
        }
        function put(token, values) {
            return putAt(n1, token, values);
        }
        function putAt(node, token, values) {
            node.containedTokens.push(Object.assign(token, values));
            tokens.push(token);
            token.containingNode = node;
            return token;
        }

        let bottomLeft;

        add({ isLandingSite: true });
        put(new Station(), { type: this.stationTokenTypes.Ship, isRevealed: true });
        link(bottomLeft = add(), n2); //0-1
        link(add(), n3); //0-2
        link(add({ isSuperHeated: true }), n2); //2-3
        link(n1, n3); //1-3

        link(add(), n3); //2-4
        link(add({ isSuperHeated: true }), n2); //4-5
        put(new Enemy(), { type: this.enemyTokenTypes.WarWasp }); //Ranged enemy
        link(n1, n3); //3-5

        link(add(), n3); //4-6
        put(new Enemy(), { type: this.enemyTokenTypes.WarWasp }); //Second ranged enemy
        link(add({ isMetroidContainment: true }), n2); //6-7
        put(new Enemy(), { type: this.enemyTokenTypes.Metroid }); //Objective
        link(n1, n3); //5-7

        link(add(), n2); //7-8
        put(new Station(), { type: this.stationTokenTypes.UpgradeStation, upgrade: this.upgradeTokenTypes.MorphBall });
        link(add({ isTunnel: true }), n2); //8-9
        put(new Station(), { type: this.stationTokenTypes.UpgradeStation, upgrade: this.upgradeTokenTypes.IceBeam });
        link(add(), n3); //8-10
        put(new Station(), { type: this.stationTokenTypes.UpgradeStation, upgrade: this.upgradeTokenTypes.VariaSuit });
        link(n1, bottomLeft); //10-1

        const coords = [50,130, 50,230, 150,130, 150,230, 250,130, 250,230, 350,130, 350,230, 300,300, 380,380, 100,300];
        for (let x = 0; x < map.length; x++) {
            map[x].x = coords[x * 2];
            map[x].y = coords[x * 2 + 1];
        }

        //Landing sites (your space ships!)
        map[0].isLandingSite = true;
        map[2].isLandingSite = map[4].isLandingSite = map[6].isLandingSite = true; //All the side-by-side locations of the top row
        putAt(map[2], new Station(), { type: this.stationTokenTypes.Ship, isRevealed: true });
        putAt(map[4], new Station(), { type: this.stationTokenTypes.Ship, isRevealed: true });
        putAt(map[6], new Station(), { type: this.stationTokenTypes.Ship, isRevealed: true });

        return map;
    }

    generateMap(tokens, playerCount) {
        const map = [];
        let n1, n2, n3, n4; //Last node, second from last, third from last, fourth from last

        //TODO MAPGEN: Generate a list of enemies in random order that we can just pop() from

        //Set up the layout and graphics and token placements and everything. Remember to check this.expansion and this.optionAggressive if those have an effect on the board/tokens.
        function link(a, b, c) { //Link two map nodes together (always bidirectional) and returns the first of the two. Will not link the same nodes twice.
            if (!a.adjacentNodes.includes(b)) a.adjacentNodes.push(b);
            if (!b.adjacentNodes.includes(a)) b.adjacentNodes.push(a);
            if (c) {
                if (!a.adjacentNodes.includes(c)) a.adjacentNodes.push(c);
                if (!b.adjacentNodes.includes(c)) b.adjacentNodes.push(c);
                if (!c.adjacentNodes.includes(a)) c.adjacentNodes.push(a);
                if (!c.adjacentNodes.includes(b)) c.adjacentNodes.push(b);
            }
            return a;
        }
        function add(values) { //Create a new node, add it to the map, and return it. Applies the given values to it. Updates the n1-n3 variables.
            map.push(Object.assign(new MapNode(), values));
            n4 = n3;
            n3 = n2;
            n2 = n1;
            n1 = map[map.length - 1];
            return n1;
        }
        function putAt(node, token, values) {
            node.containedTokens.push(Object.assign(token, values));
            if (!(token instanceof Player)) tokens.push(token);
            token.containingNode = node;
            return token;
        }

        let firstLeftTurn, firstRightTurn, firstDownTurn, firstUpTurn, secondLeftTurn,
            secondUpTurn, firstTunnel, secondTunnel, thirdLeftTurn,
            secondDownTurn, thirdTunnel, thirdDownTurn, secondRightTurn,
            fourthDownTurn, italy, fourthLeftTurn, veryBottom, sphincter, cardiaLeft, cardiaRight;

        add({ isLandingSite: true });
        link(add(), n2); //0-1
        link(add(), n2); //1-2
        link(firstRightTurn = add(), firstLeftTurn = add(), n3); //2-3-4
        link(add(), n2); //4-5
        link(add(), n2); //5-6
        link(n1, firstLeftTurn); //3-6
        link(add(), n3); //5-7
        link(add(), n2); //7-8
        link(n1, n3); //6-8
        link(add(), n2, n3); //7-8-9
        link(firstDownTurn = add(), add(), n3); //9-10-11
        link(add(), n2); //11-12
        link(firstUpTurn = add(), n2); //12-13
        link(add(), n2); //13-14
        link(firstTunnel = add({ isTunnel: true }), n2); //14-15
        link(add(), n3); //14-16
        link(add(), n2); //16-17
        link(add(), add({ isMetroidContainment: true }), n3); //17-18-19
        link(add(), n3); //18-20
        link(add(), n2); //20-21
        link(add(), n2); //21-22
        link(add(), n2); //22-23
        link(add(), n2); //23-24
        link(add(), n2); //24-25
        link(secondLeftTurn = add(), add(), n3); //25-26-27
        link(add(), n2); //27-28
        link(add(), n2); //28-29
        link(add(), n2); //29-30
        link(add(), n3); //29-31
        link(secondTunnel = add({ isTunnel: true }), n2); //31-32
        link(add(), n3); //31-33
        link(add(), n2); //33-34
        link(add({ isMetroidContainment: true }), n2); //34-35
        link(add(), n2); //35-36
        link(add(), n2); //36-37
        link(add(), n2); //37-38
        link(add(), n2); //38-39
        link(thirdLeftTurn = add(), n2); //39-40
        link(add(), n2); //40-41
        link(add(), n2); //41-42
        link(add(), n2); //42-43
        link(add({ isTunnel: true }), n2); //43-44
        link(n1, secondTunnel); //44-32
        link(add({ isTunnel: true }), n3); //43-45
        link(n1, firstTunnel); //45-15
        link(add(), n4); //43-46
        link(add({ isMetroidContainment: true }), n2); //46-47
        link(n1, secondLeftTurn); //47-26
        link(add(), n2); //47-48
        link(add(), n2); //48-49
        link(add(), n2); //49-50
        link(add(), n2); //50-51
        link(n1, firstUpTurn); //51-13
        link(add(), n2); //51-52
        link(add(), n2); //52-53
        link(add(), n2); //53-54
        link(add(), n2); //54-55
        link(add({ isMetroidContainment: true }), n2); //55-56
        link(n1, thirdLeftTurn); //56-40
        link(add(), n3); //55-57
        link(add(), n2); //57-58
        link(add(), n2); //58-59
        link(add(), n2); //59-60
        link(add(), n2); //60-61
        link(n1, firstLeftTurn); //61-4
        //End of major section 1.
        link(add(), firstRightTurn); //62-3
        link(add(), n2); //62-63
        link(add(), n2); //63-64
        link(add(), n2); //64-65
        link(add(), n2); //65-66
        link(add({ isTunnel: true }), n2); //66-67
        link(add(), n2); //67-68
        link(add(), n2); //68-69
        link(add(), n2); //69-70
        link(add(), add(), n3); //70-71-72
        link(add(), n2); //72-73
        link(secondDownTurn = add(), n2); //73-74
        link(n1, n4); //71-74
        link(thirdTunnel = add(), n3); //73-75
        link(add(), n2); //75-76
        link(n1, n3); //74-76
        link(add(), n3); //75-77
        link(add(), n2); //77-78
        link(n1, n3); //76-78
        link(add(), n3); //77-79
        link(add(), n2); //79-80
        link(n1, n3); //78-80
        link(add(), n3); //79-81
        link(thirdDownTurn = add(), n2); //81-82
        link(n1, n3); //80-82
        link(add(), n3); //81-83
        link(add(), n2); //83-84
        link(secondRightTurn = add(), n2); //84-85
        link(add({ isTunnel: true }), n2); //85-86
        link(add(), n2); //86-87
        link(add(), n2); //87-88
        link(add(), n2); //88-89
        link(add(), n2); //89-90
        link(add(), n2); //90-91
        link(n1, firstDownTurn); //91-10
        link(add({ isTunnel: true }), n2); //91-92
        link(n1, thirdTunnel); //92-75
        //End of major section 2.
        link(fourthDownTurn = add(), secondRightTurn); //85-93
        link(add(), n2); //93-94
        link(add(), n2); //94-95
        add(); //96
        link(add(), n2); //96-97
        link(italy = add(), n3, n4); //95-96-98
        link(add({ isMetroidContainment: true }), n3); //97-99
        link(add(), n2); //99-100
        link(add(), n2); //100-101
        link(add(), italy); //98-102
        link(add(), n2); //102-103
        link(add(), n2); //103-104
        link(add({ isMetroidContainment: true }), n2); //104-105
        link(add(), fourthDownTurn); //93-106
        link(add(), n2); //106-107
        link(add(), n2); //107-108
        link(add(), n2); //108-109
        link(add(), n2); //109-110
        link(add(), n2); //110-111
        link(add(), n2); //111-112
        link(add(), n2); //112-113
        link(add(), n2); //113-114
        link(fourthLeftTurn = add(), n2); //114-115
        link(add(), n2); //115-116
        link(add(), n2); //116-117
        link(add(), n2); //117-118
        link(add({ isMetroidContainment: true }), n2); //118-119
        link(add(), fourthLeftTurn); //115-120
        link(add(), n2); //120-121
        link(add(), n2); //121-122
        link(veryBottom = add(), n2); //122-123
        link(secondUpTurn = add(), n3); //122-124
        link(add(), add(), n4); //123-125-126
        link(add({ isMetroidContainment: true }), n2); //126-127
        link(n1, n3); //125-127
        link(add(), n3); //126-128
        link(add(), n2); //128-129
        link(n1, veryBottom); //123-129
        link(n1, secondUpTurn); //124-129
        link(sphincter = add(), n2); //129-130
        link(add(), n2); //130-131
        link(n1, secondUpTurn); //124-131
        link(add(), n2); //131-132
        link(add(), n2); //132-133
        link(n1, thirdDownTurn); //133-82
        link(add(), add(), sphincter); //130-134-135
        link(cardiaLeft = add(), n3); //134-136
        link(cardiaRight = add(), n2); //136-137
        link(n1, n3); //135-137
        link(add(), n4); //135-138
        link(add(), n2); //138-139
        link(n1, n3); //137-139
        link(add(), n2); //139-140
        link(add({ isMetroidContainment: true }), n2); //140-141
        link(n1, n4); //138-141
        link(add(), cardiaRight); //137-142
        link(add({ isMetroidContainment: true }), n2); //142-143
        link(n1, cardiaLeft); //143-136
        link(add(), n3); //142-144
        link(add(), n2); //144-145
        link(n1, secondDownTurn); //74-145

        //Copied from a program I made in 5 minutes
        const coords = [106,175, 165,208, 214,233, 256,300, 301,245, 373,305, 325,373, 424,364, 371,431, 458,446, 514,484, 529,418, 568,386, 628,369, 690,383, 715,343, 751,404, 813,424, 870,451, 819,480, 914,484, 975,497, 1015,464, 964,404, 955,339, 946,286, 899,281, 925,241, 931,203, 933,166, 999,138, 909,124, 874,164, 886,79, 847,58, 795,44, 752,37, 696,37, 649,47, 643,85, 666,135, 712,180, 749,217, 788,254, 821,209, 752,289, 823,276, 873,325, 810,337, 769,337, 693,317, 624,316, 556,308, 538,251, 529,192, 529,128, 592,126, 449,106, 403,95, 355,86, 333,136, 332,191, 231,373, 148,395, 85,412, 37,461, 45,516, 81,563, 132,597, 202,584, 247,578, 276,633, 322,563, 385,608, 341,673, 430,642, 405,711, 484,677, 444,737, 520,745, 470,779, 535,801, 482,821, 589,806, 636,806, 687,834, 709,776, 722,713, 679,663, 611,643, 556,609, 526,551, 475,592, 751,864, 796,819, 844,788, 888,760, 952,764, 902,848, 997,729, 1013,680, 1057,646, 925,885, 957,931, 952,977, 907,1030, 805,911, 823,952, 832,1007, 806,1062, 772,1094, 730,1127, 665,1115, 604,1107, 547,1105, 487,1076, 518,1029, 544,971, 608,970, 665,1019, 443,1083, 389,1084, 341,1051, 268,1068, 346,989, 217,1110, 193,1037, 160,1087, 219,1010, 274,997, 298,947, 347,942, 395,917, 443,860, 208,941, 262,903, 128,903, 210,857, 313,868, 249,816, 327,757, 379,809, 151,800, 100,824, 207,756, 267,731];
        for (let x = 0; x < map.length; x++) {
            map[x].x = coords[x * 2];
            map[x].y = coords[x * 2 + 1];
        }

        //Special node types and various tokens that need placed
        const metroidNodes = [19, 35, 47, 56, 99, 105, 119, 127, 141, 143].map(index => map[index]);
        for (let node of metroidNodes) node.isMetroidContainment = true;
        this.placeTokens(tokens, metroidNodes, this.setupParameters.Metroids, Enemy, this.enemyTokenTypes);

        const enemyNodes = [4, 9, 16, 27, 33, 39, 51, 55, 62, 63, 72, 80, 88, 96, 97, 109, 116, 123, 139, 145].map(index => map[index]);
        this.placeTokens(tokens, enemyNodes, this.setupParameters.Enemies, Enemy, this.enemyTokenTypes);

        const earlyStationNodes = [7, 57, 64, 90].map(index => map[index]);
        this.placeTokens(tokens, earlyStationNodes, this.setupParameters.Stations.early, Station, this.stationTokenTypes, true /*indicate that it's an early station, for graphical reasons*/);

        const lateStationNodes = [30, 73, 101, 136].map(index => map[index]);
        this.placeTokens(tokens, lateStationNodes, this.setupParameters.Stations.late, Station, this.stationTokenTypes);

        //Landing sites (your space ships!)
        map[0].isLandingSite = true;
        putAt(map[0], new Station(), { type: this.stationTokenTypes.Ship, isRevealed: true });
        if (this.roundManager.playersCanInhabitSameSpace) {
            for (let x = 0; x < playerCount; x++) putAt(map[0], tokens[x]); //The reason that putAt checks if the token is a Player--because they're already in the tokens array
        } else {
            if (playerCount >= 2) { map[22].isLandingSite = true; putAt(map[22], new Station(), { type: this.stationTokenTypes.Ship, isRevealed: true }); }
            if (playerCount >= 3) { map[59].isLandingSite = true; putAt(map[59], new Station(), { type: this.stationTokenTypes.Ship, isRevealed: true }); }
            if (playerCount >= 4) { map[6].isLandingSite = true; putAt(map[6], new Station(), { type: this.stationTokenTypes.Ship, isRevealed: true }); }
        }

        return map;
    }

    placeTokens(tokens, nodes, descriptorSet, tokenConstructor, tokenTypes, isEarlyStation) { //Place one token into each of the given 'nodes' based on the 'fixed' and 'random' arrays in the given descriptorSet
        const g = this;
        function descriptorToToken(descriptor, order) {
            const token = new tokenConstructor();
            token.type = tokenTypes[descriptor.type];
            if (descriptor.upgrade) token.upgrade = g.upgradeTokenTypes[descriptor.upgrade]; //In case it's an upgrade station
            token.order = order;
            return token;
        }

        //Combine the fixed and random sets and sort them ascending by a field which is -1 for the fixed tokens and in the range [0, 1) for the random. Basically like taking out the fixed tokens first and then shaking up and picking the rest from the bag.
        const newTokens = descriptorSet.fixed.map(descriptor => descriptorToToken(descriptor, -1)).concat(descriptorSet.random.map(descriptor => descriptorToToken(descriptor, this.rnd())))
            .sort((a, b) => a.order - b.order) //Randomize the station order
            .slice(0, nodes.length); //Keep one per node
        newTokens.forEach(station => station.order = this.rnd()); //Re-randomize now that we're certain we have a set with all the fixed ones and some of the random ones
        newTokens.sort((a, b) => a.order - b.order) //Reorder based on the new random numbers
            .forEach(station => delete station.order); //And finally, remove my random number field since it won't be needed again

        //Now put those station tokens into the nodes and into the 'tokens' list
        for (let node of nodes) {
            let token = newTokens.pop();
            if (!token) break; //In case I want to use the expansion board for a non-expansion game, it'll be a bit empty
            token.containingNode = node;
            node.containedTokens.push(token);
            if (isEarlyStation) token.isEarlyStation = true; //For graphical reasons
            tokens.push(token);
        }
    }
}

class RoundManager {
    currentTurnPlayer;
    currentTurnNumber = 0; //Mainly to track when enemies are ready to attack again
    currentStep = 0; //For tracking player choices and die rolls, to make the game fully replayable from the base state
    lastReversibleStep = 0; //The last value of currentStep that you can't reverse beyond; e.g., 0 means you can start over completely, 1 means the very first action a player took can't be redone, or if currentStep is 2 after rolling a die (which means it was 1 before rolling), 2 means the die can't be rerolled.
    lastIrreversibleState = {};
    rolledToMoveOnCurrentTurn = false; //can help ensure we get our movement roll even if the first thing we have to do at the start of our turn is to dodge a ranged enemy's attack.
    hasAttackedOnCurrentTurn = false; //Similar
    currentOptions = []; //Easier way to get options back to the user than making a bunch of methods have to return objects
    combatAidRejectedAtNodes = []; //The current player cannot attempt to aid others in combat at map nodes in this list (because the players at those nodes already said no)
    map = []; //List of MapNode, describing the gameplay area
    players = []; //All the players in the game, in order of their turns, as an optimization (they are references to objects that are in the tokens array).
    tokens = []; //All the tokens in the game (or at least on the board), including the players.
    metroidContainers = []; //All the Metroid Containment map nodes in the game, as an optimization (vs. checking every map node after every order)
    availableLandingSites = [];
    playersCanRevive = false;
    playersCanInhabitSameSpace = true;
    canKillStealOnAdjacentSpaces = false;
    destroyUpgradeRoomAfterUse = false;
    stepHistory = []; //Actions, rolls, whatever you want to be able to play back in a replay or (in some cases) reverse back to while playing. Initial board state is not kept here. All rolls or player decisions are kept in this list.
    rnd; //Random function; outputs in the range [0, 1). Could be Math.random; could be a seeded random function.

    saveIrreversibleState() {
        this.lastReversibleStep = this.currentStep + 1; //The current step is no longer reversible because new information was revealed to the players, such as a die roll or a newly-flipped token.
        this.lastIrreversibleState = Object.assign({}, this); //Shallow copy this RoundManager to start with
        this.lastIrreversibleState.tokens = this.tokens.map(p => Object.assign({}, p)); //Make a shallow copy of the tokens; nothing more than 1 level deep in most of them will change (except object references that need pointed to the clones when revert() is called)
        this.lastIrreversibleState.currentOptions = this.currentOptions.map(p => Object.assign({}, p)); //Make a shallow copy of each of the options that will be provided to the player next. These also may need references updated when reverting to this state.
        delete this.lastIrreversibleState.lastIrreversibleState;

        //Also need shallow copies of any arrays stored in tokens:
        for (let player of this.lastIrreversibleState.tokens.filter(token => token instanceof Player)) {
            player.tokens = player.tokens.slice();
            player.upgrades = player.upgrades.slice();
            player.visitedUpgradeStations = player.visitedUpgradeStations.slice();
        }

        //Most other object fields are irrelevant.
    }

    revert() { //Reverts the game state to lastIrreversibleState
        //A shortcut to this would be to restart the whole thing with GameStarter.prepareGame(), giving it the same seed, if you have the seed. Clients won't have the seed.
        //TODO: if you revert to this state, make sure that players who left since that state are handled correctly. They may need to be put back into the game temporarily but definitely have to end up with acceptedDefeat = true.
        //TODO: Allow step reversal, but don't actually take anything out of stepHistory. Instead, add a "revert to the last irreversible step" decision. This lets us easily track asynchronous actions, such as leaving the game.
        //TODO: Also ensure that you don't revert combatAidRejectedAtNodes unless it's the rejecting player who changed their mind.
        //Don't worry about rolls or un-revealing tokens; those are irreversible.
        throw "No can do";
    }

    /**
     * Call this after every roll, every time a player is given choices, every time a player makes a choice...whenever something should be saved for watching a replay or going back to restart gameplay from a certain step
     * Serialization of this data to persistent storage is a different file's responsibility, e.g., db.js, but playback of that data is this class's responsibility. History is kept in stepHistory. See also: lastReversibleStep, currentStep.
     * As long as the random number generator uses a saved seed, persistent storage doesn't need to include the rolls. But if it does include them, this class would need to be updated to accept a list of the die rolls for a single player action, or die rolls would have to require separate calls to order().
     * @param {any} saveData Any data that should be saved, such as a random roll (must be in the 'roll' field), or the index of a decision a player made (must be in the choiceId field)
     */
    decided(saveData) {
        this.stepHistory.push(saveData);
        this.currentStep++;
        if (typeof saveData.roll == 'number') this.saveIrreversibleState();
    }

    logGameEvent(text) {
        console.log(text);
    }

    /**
     * Reveals a token to the players and marks the current game step as irreversible. (Current, because I assume the game step was advanced right after the player's decision was saved in the history.)
     * @param {any} token
     */
    revealToken(token) {
        token.isRevealed = true;
        if (token instanceof Enemy && token.type) token.health = token.type.health;
        if (token.type.destroyOnReveal) token.destroy();
        this.saveIrreversibleState();
    }

    isGameOver() {
        //Condition not met if there are any unrevealed tokens OR any living Metroids on the board.
        if (this.players.every(player => (!player.health && !player.nodeLastSavedAt) || player.acceptedDefeat)) return true; //If every player was either defeated (and can't revive) or gave up
        return !this.metroidContainers.find(node => node.containedTokens.filter(token => !token.isRevealed || (token.type.isObjective && token.health)).length);
    }

    getFinalScoresAndRankings() {
        const ranking = this.players.slice(); //Copy the player array
        ranking.sort((a, b) => b.getTieBreakingScore() - a.getTieBreakingScore());
        return ranking; //Has the .score property and the ranks
    }

    isAdjacentToRangedUnengagedEnemy() {
        //Check each node adjacent to the player to see if it contains an enemy which is not attacking anyone and is ranged and recharged.
        return this.currentTurnPlayer.containingNode.adjacentNodes.find(node => node.containedTokens.filter(token => token instanceof Enemy && !token.targetedPlayer && token.canAttack(this.currentTurnNumber, this.players.length, this.delayThaw) && token.type.ranged).length);
    }

    /**
     * Get either melee (only) or ranged (only) enemies that can attack the current player because they're not targeting a different player, can attack (alive, not frozen/stunned, attack is recharged), and are close enough (<=1 space away if ranged, same space if melee)
     */
    getEnemiesWhoWillAttackPlayer(ranged) {
        let sameNodeEnemies = this.currentTurnPlayer.containingNode.containedTokens.filter(token => token instanceof Enemy);
        if (!ranged) return sameNodeEnemies.filter(enemy => (!enemy.targetedPlayer || enemy.targetedPlayer == this.currentTurnPlayer) && enemy.canAttack(this.currentTurnNumber, this.players.length, this.delayThaw)); //Melee enemies should thaw right after you attack or after you roll and then move

        let nearEnemies = sameNodeEnemies.concat(this.currentTurnPlayer.containingNode.adjacentNodes.map(node => node.containedTokens).flat().filter(token => token instanceof Enemy)); //Get ranged enemies exactly 1 map node away
        return nearEnemies.filter(enemy => enemy.type.ranged && (!enemy.targetedPlayer || enemy.targetedPlayer == this.currentTurnPlayer) && enemy.canAttack(this.currentTurnNumber, this.players.length, this.delayThaw)); //Delay thaw of ranged enemies until the player does something, at which point ranged enemies can't attack anyway
    }

    /**
     * Get enemies in an adjacent map node that the current player can attack without retaliation. These must be *currently* in combat with a different player (and alive).
     */
    getKillStealableEnemies() {
        if (!this.canKillStealOnAdjacentSpaces) return []; //Kill steals aren't allowed at all in this game setup
        //Find what players have recently attacked enemies ("inCombatWith"), and check if those enemies are near you
        const otherPlayerReservedEnemies = this.players.filter(player => player != this.currentTurnPlayer && player.inCombatWith && player.health && !player.acceptedDefeat && player.containingNode == player.inCombatWith.containingNode).map(player => player.inCombatWith);
        return this.currentTurnPlayer.containingNode.adjacentNodes.map(node => node.containedTokens).flat().filter(token => otherPlayerReservedEnemies.includes(token) && token.health);
    }

    getEnemyInMapNode(node) {
        return node.containedTokens.find(token => token instanceof Enemy);
    }

    /**
     * Check if this player has finished their fight (by being defeated, defeating the enemy, or leaving). If so, clear the player's inCombatWith and the enemy's targetedPlayer and reset isFirstAttack to true.
     */
    checkSetCombatEnded() {
        if (!this.currentTurnPlayer.inCombatWith) return;
        const playerWasDefeated = !this.currentTurnPlayer.health;
        const enemyWasDefeated = !this.currentTurnPlayer.inCombatWith.health;
        const enemyCloseEnough = this.currentTurnPlayer.containingNode == this.currentTurnPlayer.inCombatWith.containingNode || //In the same node
            (this.currentTurnPlayer.inCombatWith.type.ranged && this.currentTurnPlayer.containingNode.adjacentNodes.includes(this.currentTurnPlayer.inCombatWith.containingNode)); //If ranged, can also be in an adjacent node

        if (playerWasDefeated || enemyWasDefeated || !enemyCloseEnough) {
            this.currentTurnPlayer.inCombatWith.targetedPlayer = null; //Must only be reset at the end of the turn
            this.currentTurnPlayer.inCombatWith = null;
            this.currentTurnPlayer.isFirstAttack = true;
        }
    }

    /**
     * Returns true if the current player needs to pick (or confirm) their start location, in which case currentOptions is also filled out.
     */
    provideStartLocationOptionsIfNeeded() {
        if (!this.currentTurnPlayer.containingNode) { //The player's token isn't on the board
            for (var node of this.availableLandingSites) { //Make a command for each landing site that's still available
                this.currentOptions.push({ command: "pickStartLocation", toNode: node });
            }
            return true;
        }
        //If start locations were preset, make sure the players are all considered as having saved there, too.
        if (this.playersCanRevive && !this.currentTurnPlayer.nodeLastSavedAt) {
            for (let player of this.players) player.nodeLastSavedAt = player.containingNode;
        }
        return false;
    }

    /**
     * Called when a player responds to the options given by provideStartLocationOptionsIfNeeded
     */
    initiallyPlacePlayer(toNode) {
        this.moveToken(this.currentTurnPlayer, toNode);
        if (!this.playersCanInhabitSameSpace) this.availableLandingSites.splice(this.availableLandingSites.indexOf(toNode), 1); //Remove that landing site from the available options, if players can't inhabit the same spaces
        if (this.playersCanRevive) this.currentTurnPlayer.nodeLastSavedAt = toNode; //Use the player's landing site as a save station, if that option is enabled
        this.finishTurn();
    }

    finishTurn() {
        this.currentOptions.length = 0; //Reset the array of options to be provided to the player(s)
        this.combatAidRejectedAtNodes.length = 0; //Reset the array of nodes at which this player had his "attempt to aid in combat" requests rejected
        this.currentTurnPlayer.spacesToMove = 0;
        //If the player died and can't revive from a save station, tell them so and let them leave or keep watching. Either way, their turn ends *after* they accept defeat.
        if (!this.currentTurnPlayer.health && !this.currentTurnPlayer.nodeLastSavedAt && !this.currentTurnPlayer.acceptedDefeat) {
            this.currentOptions.push({ command: "acceptDefeat", forPlayer: this.currentTurnPlayer });
            return; //Don't go to the next turn until they accept
        }

        this.hasAttackedOnCurrentTurn = false;
        this.checkSetCombatEnded(); //In case you fled or finished an enemy off or died. (You still don't get the out-of-combat dodge roll bonus until any nearby ranged enemies have a chance to attack you at the start of your next turn.)
        if (this.isGameOver()) return;

        //Advance to next player
        this.lastReversibleStep = this.currentStep; //Don't let players give the turn back to the previous player, although it's not entirely unreasonable
        const playerIndex = (this.currentTurnPlayer.tokenId + 1) % this.players.length; //increase by one and wrap around
        this.currentTurnPlayer = this.players[playerIndex];
        this.currentTurnNumber++;
        this.rolledToMoveOnCurrentTurn = false;
        this.delayThaw = true;
        this.logGameEvent("Turn " + this.currentTurnNumber + ": " + this.currentTurnPlayer.type.name);
        if (this.currentTurnPlayer.acceptedDefeat) {
            this.logGameEvent("Turn skipped because player '" + (this.currentTurnPlayer.nickname ?? playerIndex) + "' has quit.");
            return this.finishTurn(); //Don't give players a turn if they left/accepted their demise
        }

        if (this.provideStartLocationOptionsIfNeeded()) return; //If it's a setup round, these are the player's only options.

        //Start the next player's turn.
        //If they ran out of health on their PREVIOUS turn, they get to respawn at their last save station on this turn, but they aren't allowed to do anything yet.
        if (!this.currentTurnPlayer.health) {
            if (this.currentTurnPlayer.nodeLastSavedAt) {
                this.moveToken(this.currentTurnPlayer, this.currentTurnPlayer.nodeLastSavedAt); //Put the player at the save station
                this.currentTurnPlayer.health = this.currentTurnPlayer.maxHealth; //Refill their health
                this.currentTurnPlayer.missiles = 0; //Deplete their missiles
                this.currentTurnPlayer.inCombatUntilNextTurnAfterAnyRangedDodges = false; //Out of combat now
            }

            this.finishTurn();
            return;
        }

        //If they started the turn in a superheated space, damage them (or heal if it's Spire, or do nothing if they have the Varia suit).
        if (this.currentTurnPlayer.containingNode.isSuperHeated) {
            this.currentTurnPlayer.overheat(this.logGameEvent);
            if (!this.currentTurnPlayer.health) {
                this.finishTurn();
                return;
            }
        }

        //The rest of the possibilities are always the same whether it's at the start of the turn or after the player moved to a different space.
        this.pickNextState();
    }

    /**
     * The current player activates the station they're at. Returns false if their turn is over.
     */
    activateStation() {
        const station = this.currentTurnPlayer.getStationPlayerIsAt();
        if (!station) throw "Unexpected activation of a nonexistent station";
        if (!this.currentTurnPlayer.canUseStation(station)) throw "Unexpected activation of an unusable station"; //There's no reason I should have to check this here because it's checked before the activateStation option is given.

        if (station.type.grantsUpgrade) {
            this.logGameEvent("Obtained upgrade: " + station.upgrade.name);
            this.currentTurnPlayer.upgrades.push(station.upgrade);
            this.currentTurnPlayer.visitedUpgradeStations.push(station);
            this.currentTurnPlayer.accomplishments.push(station.upgrade); //Track for tie-breaking just in case I ever want to use upgrades for that

            //Apply health and missile updates directly to this.currentTurnPlayer. Also score.
            if (station.upgrade.maxHealth) { this.currentTurnPlayer.maxHealth += station.upgrade.maxHealth; this.logGameEvent("Max health increased by " + station.upgrade.maxHealth); }
            if (station.upgrade.health) { this.currentTurnPlayer.health += station.upgrade.health; this.logGameEvent("Current health increased by " + station.upgrade.health); }
            if (station.upgrade.maxMissiles) { this.currentTurnPlayer.maxMissiles += station.upgrade.maxMissiles; this.logGameEvent("Max missiles increased by " + station.upgrade.maxMissiles); }
            if (station.upgrade.missiles) { this.currentTurnPlayer.missiles += station.upgrade.missiles; this.logGameEvent("Missiles increased by " + station.upgrade.missiles); }
            if (station.upgrade.score) this.currentTurnPlayer.score += station.upgrade.score; //Score!
            if (station.upgrade.enableTunnelTraversal) this.logGameEvent("Can now traverse tunnels (spaces with a gray circle).");
            if (station.upgrade.superheatedRoomNoDamage) this.logGameEvent("This player no longer takes damage from superheated areas (spaces with a pink square).");
            if (station.upgrade.freezeForRoundsOnHit) this.logGameEvent("Can now freeze enemies.");
            if (station.upgrade.firstBeamAttackDamageBonus && station.upgrade.isBeamAddon) this.logGameEvent("Will now do an additional " + station.upgrade.firstBeamAttackDamageBonus + " damage for the first attack in each fight if using a beam weapon.");

            //Destroy it if you're playing with optionAggressive on, unless it's a "guaranteed" upgrade that someone still needs to get
            if (this.destroyUpgradeRoomAfterUse) {
                if (!station.upgrade.guaranteed || !this.players.find(player => player.canUseStation(station))) { //TODO: Should be allowed to destroy 1 missile station if there are others on the board, but only if the players KNOW that there are others.
                    station.destroy();
                    this.logGameEvent("Sabotaged the upgrade station.");
                } else this.logGameEvent("Cannot sabotage this upgrade station until all players have the ability it offers.");
            }
        }

        //Stop the player if you need to. Apply other effects not necessarily applicable to upgrade stations.
        if (station.type.refillHealth) {
            this.logGameEvent("Health refilled.");
            this.currentTurnPlayer.health = this.currentTurnPlayer.maxHealth;
        }
        if (station.type.refillMissiles) {
            this.logGameEvent("Missiles refilled.");
            this.currentTurnPlayer.missiles = this.currentTurnPlayer.maxMissiles;
        }
        if (station.type.saveStation) {
            this.logGameEvent("Used a save station. Will respawn here if defeated.");
            this.currentTurnPlayer.nodeLastSavedAt = this.currentTurnPlayer.containingNode;
        }
        if (station.type.mapStation) {
            this.logGameEvent("Used a map station; all station tokens have been revealed.");
            for (let token of this.tokens.filter(token => !(token instanceof Enemy))) this.revealToken(token); //Reveal every non-Enemy token on the map to everyone
            station.destroy(); //Map stations only need to be used once ever
        }
        if (station.type.haltMovement) {
            this.logGameEvent("This type of station requires a long stop.");
            this.currentTurnPlayer.spacesToMove = 0;
            this.finishTurn();
            return false; //The player's turn has ended
        }

        if (!this.currentTurnPlayer.spacesToMove) { //Their turn is over if they have no more spaces to move. (They'd need to be granted a free move here if there's an enemy in this space, but I won't put enemies in stations)
            this.finishTurn();
            return false;
        } else return true;
    }

    /**
     * Call this after moving. It sets the next gameplay state / the next set of choices to offer the player or advances to the next player's turn.
     * Returns false if their turn is over.
     */
    pickNextState() {
        //Check for ranged enemies that should attack you first, because you have to dodge them before doing anything else
        for (let enemy of this.getEnemiesWhoWillAttackPlayer(true)) {
            if (!this.dodgeRoll(enemy)) return false; //If you died, it's not your turn anymore.
        } //The fact that you had to dodge a ranged attack from an adjacent cell has nothing to do with what you'll be able to do next, so it's not an else-if and only returns if you died.

        //If you attacked on your last turn, you don't get the out-of-combat dodge bonus back until ranged enemies had their chance to attack you, if there were any at the start of this turn.
        if (!this.hasAttackedOnCurrentTurn) this.currentTurnPlayer.inCombatUntilNextTurnAfterAnyRangedDodges = false;

        //Get the enemies that can attack you and the enemies that you can attack, which are often not the same set
        const meleeEnemiesToDodge = this.getEnemiesWhoWillAttackPlayer(false);
        if (meleeEnemiesToDodge.length > 1) throw "Unexpected situation encountered: there should never be more than 1 enemy (that can attack you) in a single map node.";

        if (!this.hasAttackedOnCurrentTurn) { //You get neither attack options NOR move options if you've already attacked on this turn.
            //You can choose to attack exactly one of these (there should only be 0 or 1 in this list). You don't get the option to attack them if they're in combat with another player who has rejected your combat assistance for this turn.
            const normallyAttackableEnemies = this.currentTurnPlayer.containingNode.containedTokens.filter(token => token instanceof Enemy && token.health && !this.combatAidRejectedAtNodes.includes(this.currentTurnPlayer.containingNode));
            //You can choose to attack or just move away from these without consequence. (You get 1 attack option per each of these plus 1 move-away option. If the above list isn't empty, you MUST dodge after attacking one of these or before moving.)
            const killStealableEnemies = this.getKillStealableEnemies();
            if (normallyAttackableEnemies.length > 1) throw "Unexpected situation encountered: there should never be more than 1 enemy (that you can attack) in a single map node.";

            //If there's at least one enemy you can possibly attack, then you need the attack options + the dodge/move options + nothing else should run.
            if (normallyAttackableEnemies.length || killStealableEnemies.length) {
                //You must dodge if you choose not to attack meleeEnemiesToDodge[0]. get the normal attack option and the dodge-and-move option for enemies that you can attack normally. You may have to dodge afterward if you choose to kill steal.
                for (let enemy of normallyAttackableEnemies) {
                    for (let option of this.getWeaponOptions(enemy)) this.currentOptions.push(option); //No nodeId needed because *these* attacks can only target the map node the player is in
                }
                for (let enemy of killStealableEnemies) {
                    for (let option of this.getWeaponOptions(enemy)) {
                        //Need to know what node the enemy is in so that we can tell it's an Aggressive mode kill steal (the only possibility for attacking outside the current node)
                        option.toNode = enemy.containingNode;
                        this.currentOptions.push(option);
                    }
                }

                this.provideMoveOptions(meleeEnemiesToDodge.length); //Include all the move options or dodge-and-move options
                return true; //No other options at this time
            }
        } //else they cannot move, so they're either dodging (if the enemy in their current map node is still alive and it hasn't attacked for a full round) or activating a station in that node (but I'm never putting an enemy in the same node as stations) or refilling health/missiles from the enemy's death energy (but that's tentatively done in attackRoll()).

        //If the code reaches here, the player has already attacked during this turn, so if any melee enemies can attack them, they must dodge before doing anything else.
        for (let enemy of meleeEnemiesToDodge) {
            if (!this.dodgeRoll(enemy)) return false; //If you died, it's not your turn anymore.
        }

        if (!this.rolledToMoveOnCurrentTurn && !this.hasAttackedOnCurrentTurn) {
            this.delayThaw = false; //Enemies that were frozen by this player on their last turn are now thawed out because the player chose NOT to attack.
            //TODO BGA: Could give them the "roll" button here instead of directly calling moveRoll.
            this.moveRoll(); //Roll for movement and give the player their choices of what map nodes they can move to (or they can stay put)
            return true;
        } //Otherwise they've already moved at least one space, which doesn't preclude them from having to dodge additional enemies (the previous blocks of code), but they can't roll to move again.

        const station = this.currentTurnPlayer.getStationPlayerIsAt();
        if (station && station.upgrade && !this.currentTurnPlayer.canUseStation(station) && this.destroyUpgradeRoomAfterUse) { //Sabotage even if you can't use the station! (If you can use it, the sabotage code is in activateStation() instead.)
            //Destroy the station if you're playing with optionAggressive on, unless it's a "guaranteed" upgrade that someone still needs to get
            if (station.upgrade.guaranteed) {
                if (!this.players.find(player => player.canUseStation(station))) station.destroy();
            } else station.destroy();
        }
        if (station && this.currentTurnPlayer.canUseStation(station)) {
            if (station.type.optionalStop) {
                this.currentOptions.push({ command: "activateStation" });
                this.provideMoveOptions(); //Since the stop is optional, they also get the movement choices, plus we'll change "stop" to "skip" so it's more clear that they'll ignore the station if they pick that
                var stopOption = this.currentOptions.find(option => option.command == "stop");
                stopOption.command = "skip";
                return true;
            } else {
                var canStillMove = this.activateStation(); //Activating the station was mandatory. The player doesn't get a choice. But activateStation() will tell us if their turn is over.
                if (canStillMove) this.provideMoveOptions();
                return canStillMove;
            }
        }
        else if (this.currentTurnPlayer.spacesToMove && !this.hasAttackedOnCurrentTurn) {
            this.provideMoveOptions(); //Keep movin'
            return true;
        }
        else { //No more moves AND there was nothing else to do along the way. It's the next player's turn.
            this.finishTurn();
            return false;
        }
    }

    /**
     * Move any token from the node where it is currently contained, if there is one, to the given node.
     */
    moveToken(token, toNode) {
        if (token.containingNode) token.containingNode.containedTokens.splice(token.containingNode.containedTokens.indexOf(token), 1); //Take it out of the node where it was before
        token.containingNode = toNode;
        toNode.containedTokens.push(token);

        //If the token we're moving is a player character, reveal any non-revealed tokens in adjacent cells. Include the current cell just for the heck of it because of initial placement.
        if (token instanceof Player) {
            const toReveal = toNode.adjacentNodes.concat(toNode).map(node => node.containedTokens).flat().filter(token => !token.isRevealed);
            for (let token of toReveal) this.revealToken(token);
        }
    }

    /**
     * Move the current player's token to the given node and advance to the next gameplay state.
     * @param ignoreCost {boolean} In this context, ignoreCost means even if you HAVE moves left, you get this one free.
     */
    move(toNode, ignoreCost) {
        this.moveToken(this.currentTurnPlayer, toNode);
        if (!ignoreCost && this.currentTurnPlayer.spacesToMove) this.currentTurnPlayer.spacesToMove--; //You don't have to set ignoreCost = true just to keep spacesToMove from becoming negative.
    }

    provideMoveOptions(needsDodge) {
        //Give the player one option for each adjacent node. //TODO QOL: Do a breadth-first traversal and give them options for every node they can travel directly to (excluding those that do or MAY require dodging/stopping; e.g., you can't go right to an unrevealed enemy because if it's ranged it has to attack you one space before that)
        if (!needsDodge && !this.rolledToMoveOnCurrentTurn) {
            this.moveRoll(); //Roll if they haven't done so on this turn and aren't just being given a free move due to dodging
            return; //moveRoll calls provideMoveOptions() so no need to continue with *this* execution
        }

        if (!needsDodge && !this.currentTurnPlayer.spacesToMove) {
            this.currentOptions.push({ command: "stop" }); //Allow them to choose to not attack this enemy
            return; //Can't move if you're out of moves and aren't being given a (possibly) free one due to dodging.
        }
        for (var node of this.currentTurnPlayer.containingNode.adjacentNodes.filter(node => !node.isTunnel || this.currentTurnPlayer.canUseTunnels())) { //Don't give tunnel options if the player can't use them
            //If inhabiting the same space is disallowed, check for other (living) players in that space.
            if (this.playersCanInhabitSameSpace || !node.containedTokens.find(token => token instanceof Player && token.health && token != this.currentTurnPlayer)) {
                this.currentOptions.push({ command: needsDodge ? "dodgeAndMove" : "move", toNode: node });
            }
        }
        this.currentOptions.push({ command: needsDodge ? "dodgeAndStop" : "stop" }); //Allow them to choose to cease movement
    }

    /**
     * Roll a die with the given number of sides. Returns a random integer from 1 to sides (inclusive).
     * @param {string} purpose Reason for the roll. Text will be added to the console log in the form "Roll for <purpose>: <roll>"
     */
    rollDie(sides, purpose) {
        const roll = Math.floor(this.rnd() * sides + 1);
        this.decided({ roll: roll, sides: sides });
        this.logGameEvent("Roll for " + purpose + ": " + roll);
        return roll;
    }

    moveRoll() {
        const roll1 = this.rollDie(6, "movement (first die)");
        const roll2 = this.rollDie(6, "movement (second die)");
        this.currentTurnPlayer.spacesToMove = roll1 + roll2;
        this.rolledToMoveOnCurrentTurn = true;
        this.provideMoveOptions();
    }

    healthRefillRoll() {
        const roll = this.rollDie(10, "health refill");
        const refillAmount = roll == 10 ? 3 : (roll >= 6 ? 2 : 1);
        this.logGameEvent("Refilling " + refillAmount + " health.");
        this.currentTurnPlayer.grantHealth(refillAmount);
    }

    missileRefillRoll() {
        const roll = this.rollDie(10, "missile refill");
        const refillAmount = roll == 10 ? 3 : (roll >= 6 ? 2 : 1);
        this.logGameEvent("Refilling " + refillAmount + " missile" + (refillAmount == 1 ? "" : "s"));
        this.currentTurnPlayer.grantMissiles(refillAmount);
    }

    /**
     * Call this when an enemy is trying to attack the current player. (An enemy should never attack a player when it's not that player's turn)
     * Returns true if the player is still alive.
     */
    dodgeRoll(enemy) {
        const roll = this.rollDie(10, "dodge");
        let rollBonus = 0;
        if (this.currentTurnPlayer.type.dodgeRollBonus) rollBonus += this.currentTurnPlayer.type.dodgeRollBonus;

        //Not in combat? May have a bonus to dodge! Check the character and the obtained upgrades.
        if (!this.currentTurnPlayer.inCombatWith) {
            rollBonus += this.currentTurnPlayer.type.dodgeRollOutOfCombatBonus;
            for (let upgrade of this.currentTurnPlayer.upgrades) {
                if (upgrade.dodgeRollOutOfCombatBonus) rollBonus += upgrade.dodgeRollOutOfCombatBonus;
            }
        }

        enemy.lastAttackTurn = this.currentTurnNumber; //Enemy can't attack again until this player's next turn (or if the player drops, after their following player's next turn)

        const dodgeSuccess = roll + rollBonus >= enemy.type.dodgeRollAtLeast;
        this.logGameEvent((rollBonus ? ("Dodge roll bonus: +" + rollBonus + ". ") : "") + (dodgeSuccess ? "Dodged successfully" : "Got hit"));
        if (!dodgeSuccess) this.currentTurnPlayer.damage(enemy.type.damage, this.logGameEvent, "the " + enemy.type.name + "'s attack");
        else if (!this.currentTurnPlayer.spacesToMove) this.currentTurnPlayer.spacesToMove = 1; //You get one free move so you can get off the enemy's tile if you dodged successfully.

        const playerStillAlive = this.currentTurnPlayer.health; //Need a constant because 'currentTurnPlayer' will change in this.finishTurn()
        if (!playerStillAlive) this.finishTurn(); //End the turn since their only option would be "I see that I died" :)
        return playerStillAlive;
    }

    /**
     * Call this when the player is attempting to attack an enemy. (A player should never attack when it's not their turn.)
     * This puts the player into combat mode with that enemy.
     * chosenWeapon should be the combined weapon (PowerBeam + any beamAddon upgrades you chose to use + conditionalBeamDamage and damageConditionRollAtLeast if the player character has them, or Missile + any missileAddon upgrades you chose to use if I ever make any :P)
     * Returns true if the enemy is still alive.
     */
    attackRoll(enemy, chosenWeapon) {
        const roll = this.rollDie(10, "attack");
        let rollBonus = 0;
        if (chosenWeapon.hitRollBonus) rollBonus = chosenWeapon.hitRollBonus; //Ice beam has a lower chance to hit, which also affects the chance for other conditions like stun or freeze or conditional damage.
        const rollTotal = roll + rollBonus;

        if (chosenWeapon.isMissile) this.currentTurnPlayer.missiles--; //Consume ammo

        const wasFirstAttack = this.currentTurnPlayer.isFirstAttack;
        this.currentTurnPlayer.isFirstAttack = false; //Hit or miss, the beam is no longer charged
        this.currentTurnPlayer.inCombatUntilNextTurnAfterAnyRangedDodges = true; //The player loses any out-of-combat bonuses until next round, after any ranged-enemy-dodges they need to do.
        this.hasAttackedOnCurrentTurn = true;
        this.delayThaw = false; //Enemies that were frozen by this player on their last turn are now thawed out because the player attempted an attack
        const hitSuccess = rollTotal >= enemy.type.hitRollAtLeast;
        this.logGameEvent((rollBonus ? ("Attack roll bonus: " + (rollBonus > 0 ? "+" : "-") + Math.abs(rollBonus) + ". ") : "") + (hitSuccess ? "Hit" : "Missed"));
        if (hitSuccess) {
            let damage = chosenWeapon.damage;
            if (chosenWeapon.firstBeamAttackDamageBonus && wasFirstAttack) damage += chosenWeapon.firstBeamAttackDamageBonus;
            if (chosenWeapon.conditionalBeamDamage && !chosenWeapon.isMissile) { //Conditional damage bonus, as given to Sylux
                if (chosenWeapon.damageConditionRollAtLeast && rollTotal >= chosenWeapon.damageConditionRollAtLeast) damage += chosenWeapon.conditionalBeamDamage;
            }
            if (!enemy.type.beamCanHarm && !chosenWeapon.isMissile) damage = 0;
            enemy.health -= damage; //Got hit!
            if (enemy.health < 0) enemy.health = 0; //I'm not allowing negative health numbers for any amount of time, so you can always check if the token is alive via the truthiness of its health.
            if (damage) this.logGameEvent("Damage dealt: " + damage + "; enemy has " + enemy.health + " health remaining.");
            else this.logGameEvent("No damage dealt.");
            if (enemy.health <= 0) {
                this.currentTurnPlayer.accomplishments.push(enemy); //Keep track of enemies this player beat so we can use them for tie-breaking at the end of the game if needed.
                enemy.destroy(); //Take it off the map
                if (enemy.type.score) this.currentTurnPlayer.score += enemy.type.score; //Score!
            } else {
                //Stun if needed
                if (chosenWeapon.stunConditionRollAtLeast && rollTotal >= chosenWeapon.stunConditionRollAtLeast) {
                    enemy.stunnedSinceTurn = this.currentTurnNumber;
                    enemy.stunDurationRounds = chosenWeapon.conditionalStunRounds;
                    this.logGameEvent("Stunned enemy");
                }
                //Freeze if needed
                if (chosenWeapon.freezeForRoundsOnHit) { //Guaranteed freeze
                    enemy.frozenSinceTurn = this.currentTurnNumber;
                    enemy.freezeDurationRounds = chosenWeapon.freezeForRoundsOnHit;
                    this.logGameEvent("Froze enemy");
                }
                else if (chosenWeapon.freezeConditionRollAtLeast && rollTotal >= chosenWeapon.freezeConditionRollAtLeast) { //Chance freeze
                    enemy.frozenSinceTurn = this.currentTurnNumber;
                    enemy.freezeDurationRounds = chosenWeapon.conditionalFreezeRounds;
                    this.logGameEvent("Froze enemy");
                }
            }
        }
        this.currentTurnPlayer.inCombatWith = enemy; //You've targeted this enemy; other players need to know that if they try to attack that enemy.

        return enemy.health;
    }

    /**
     * This can be used to tell the player what weapons they're able to use on the given enemy. The weapon options returned by this are ready for passing into attackRoll as chosenWeapon.
     * (Note: we obviously have to keep these options handy on the server; the player could issue an order with the weapon object itself, but we'd double-check them, so we could also pass a GUID [in case of sync errors] or something)
     */
    getWeaponOptions(enemy) {
        let weapons = [];

        const minimumBeam = new BaseBeamWeapon();
        Object.assign(minimumBeam, ...this.currentTurnPlayer.upgrades.filter(upgrade => upgrade.isBeamAddon && !upgrade.optionalActivation)); //Update the minimum beam with any non-optional beam upgrades
        //Also add to the minimum beam any character-specific special effects
        minimumBeam.conditionalBeamDamage = this.currentTurnPlayer.type.conditionalBeamDamage;
        minimumBeam.damageConditionRollAtLeast = this.currentTurnPlayer.type.damageConditionRollAtLeast;
        minimumBeam.conditionalFreezeRounds = this.currentTurnPlayer.type.conditionalFreezeRounds;
        minimumBeam.freezeConditionRollAtLeast = this.currentTurnPlayer.type.freezeConditionRollAtLeast;
        minimumBeam.conditionalStunRounds = this.currentTurnPlayer.type.conditionalStunRounds;
        minimumBeam.stunConditionRollAtLeast = this.currentTurnPlayer.type.stunConditionRollAtLeast;
        minimumBeam.command = "attack";
        weapons.push(minimumBeam);

        //Also add every possible combination of optionalActivation isBeamAddon upgrades, based on minimumBeam
        //Note: just assuming there's only 1 for now, because that's all I accounted for in my design.
        const beamOptions = this.currentTurnPlayer.upgrades.filter(upgrade => upgrade.isBeamAddon && upgrade.optionalActivation);
        if (beamOptions.length) {
            const upgradedBeam = Object.assign({}, minimumBeam, beamOptions[0]);
            weapons.push(upgradedBeam);
        }

        //If the player has any missiles, add those.
        if (this.currentTurnPlayer.missiles > 0) {
            //Include the missile (not possible to upgrade it in any way currently, so not repeating code like the above filtering and combinations)
            const minimumMissile = new BaseMissile();
            minimumMissile.command = "attack";
            weapons.push(minimumMissile);
        }

        //If the enemy isn't frozen and needs to be, only offer weapons capable of freezing (even if they normally can't harm it). Otherwise, exclude beams if beams can't harm it.
        var needsFrozen = enemy.type.invulnerableIfNotFrozen && !enemy.isFrozen(this.currentTurnNumber, this.players.length, this.delayThaw);
        if (needsFrozen) {
            weapons = weapons.filter(weapon => weapon.freezeForRoundsOnHit || weapon.conditionalFreezeRounds); //Include beams even if they can't hurt it, as long as they can freeze it
            for (let weapon of weapons.filter(weapon => !enemy.type.beamCanHarm && !weapon.isMissile)) weapon.damage = weapon.conditionalBeamDamage = weapon.conditionalStunRounds = 0; //But zero out their damage and stun abilities
        }
        else if (!enemy.type.beamCanHarm) weapons = weapons.filter(weapon => weapon.isMissile);

        return weapons;
    }

    /**
     * Start the first turn of the game.
     * If the players need to choose their starting locations, that's the first round.
     */
    start() {
        this.currentTurnPlayer = this.players[0];
        //If we need a setup round, the player's options are start locations. Otherwise, go ahead and roll for the first player so they can just start moving.
        if (!this.provideStartLocationOptionsIfNeeded()) this.moveRoll();
        //TODO: Else cache this as the most recent irreversible state of the game
    }

    /**
     * Do an attack roll with the given weapon, against the given enemy, and dodge roll if it's still alive and can retaliate, and health/missile refill roll/skip if you killed it
     * Returns true if the player is still alive after the dodge roll.
     * @param {any} weapon
     * @param {any} enemy
     * @param {any} noRetaliation
     */
    attackDodgeRefill(weapon, enemy, noRetaliation) {
        if (!this.attackRoll(enemy, weapon)) {
            //Health or missile refill (or neither, if you want) if you defeated the enemy
            if (this.currentTurnPlayer.health != this.currentTurnPlayer.maxHealth) this.currentOptions.push({ command: "healthRefillRoll" });
            if (this.currentTurnPlayer.missiles != this.currentTurnPlayer.maxMissiles) this.currentOptions.push({ command: "missileRefillRoll" });
            if (this.currentOptions.length) this.currentOptions.push({ command: "skip" }); //You can choose to just end your turn regardless of whether you *can* get a refill
        } else if (!enemy.type.ranged && enemy.canAttack(this.currentTurnNumber, this.players.length) && !noRetaliation) return this.dodgeRoll(enemy); //Have to follow up any attack with a dodge if the enemy is still alive and isn't ranged (which attack first)
        return true;
    }

    /**
     * Check if the given command is in this.currentOptions (or at least has a very, very similar match--you may exclude some fields from the comparison, e.g., if they weren't sent to the user or just aren't used by the response).
     */
    getOptionIndex(parameters) {
        const player = this.currentTurnPlayer;
        function commandMatch(option) {
            if (parameters.command != option.command) return false;
            if (parameters.toNode != option.toNode) return false;

            //Weapon parameters. Don't need to check things like optionalActivation or isBeamAddon because they're only used for generating the options, not when actually attacking.
            if (parameters.damage != option.damage) return false;
            if (parameters.conditionalBeamDamage != option.conditionalBeamDamage) return false;
            if (parameters.damageConditionRollAtLeast != option.damageConditionRollAtLeast) return false;
            if (parameters.conditionalFreezeRounds != option.conditionalFreezeRounds) return false;
            if (parameters.freezeConditionRollAtLeast != option.freezeConditionRollAtLeast) return false;
            if (parameters.conditionalStunRounds != option.conditionalStunRounds) return false;
            if (parameters.stunConditionRollAtLeast != option.stunConditionRollAtLeast) return false;
            if (parameters.freezeForRoundsOnHit != option.freezeForRoundsOnHit) return false;
            if (parameters.hitRollBonus != option.hitRollBonus) return false;
            if (parameters.firstBeamAttackDamageBonus != option.firstBeamAttackDamageBonus) return false;

            //Pretty much none of the other commands require parameters... but it'd be a good idea to include the turn number in every one of these objects just in case it gets desynchronized.

            if ((parameters.forPlayer ?? player) != (option.forPlayer ?? player)) return false; //if option.forPlayer is empty, it's supposed to be the player whose turn it is. parameters.forPlayer is set in the authentication layer (but maybe not locally). //TODO BGA: ensure that forPlayer is always truthy and is validated in the authentication layer, so you can't claim "forPlayer" = Joe when you're Cody
            return true;
        }
        return this.currentOptions.findIndex(option => commandMatch(option)); //Will be exactly one match
    }

    requestLeaveGame(player) { //TODO BGA: Call when a player leaves the game.
        this.decided({playerLeft: player});
        player.acceptedDefeat = true;
    }

    /**
     * Respond to a player's command to advance the game
     */
    order(parameters) {
        if (this.isGameOver() && parameters.command != "acceptDefeat") throw "Game has ended";

        const turnNumberWas = this.currentTurnNumber; //Easy way to see if the turn ended
        //Note: Only one enemy can exist in any given map node, so we can reuse that nodeId/toNode for attacking another player's enemy (in an adjacent node) if playing with optionAggressive turned on.

        //Instead of double-checking conditions, check if the command the player responded with is in currentOptions (which should be saved in the database before giving the options back to the player).
        parameters.chosenOptionIndex = this.getOptionIndex(parameters);
        if (parameters.chosenOptionIndex == -1) throw "Invalid command";
        this.decided(parameters); //Record the player's choice in the step history before moving, revealing tokens, rolling, etc.
        this.currentOptions.length = 0; //We don't need these anymore since we validated that the player picked one.

        if (parameters.command == "pickStartLocation" && parameters.toNode.isLandingSite) this.initiallyPlacePlayer(parameters.toNode);
        else if (parameters.command == "acceptDefeat") { parameters.forPlayer.acceptedDefeat = true; this.finishTurn(); }
        else if (parameters.command == "move") this.move(parameters.toNode); //from provideMoveOptions
        else if (parameters.command == "dodgeAndMove" || parameters.command == "dodgeAndStop") { //from provideMoveOptions
            //You would dodge *before* given the choice to move if it was a ranged enemy, so this only applies to melee enemies, which means there's at most one that could possibly attack you.
            //But if it were possible for there to be more than one, you'd have to roll once for each one before moving.
            for (let enemy of this.getEnemiesWhoWillAttackPlayer(false)) {
                if (!this.dodgeRoll(enemy)) return; //You died, so it's the next player's turn.
            }
            if (parameters.command == "dodgeAndMove") this.move(parameters.toNode); //Move the player token, if you didn't specifically choose to stay put via "dodgeAndStop" //TODO: station activations aren't triggering after this; what's the state?
            else this.finishTurn(); //dodgeAndStop means they want to stop!
        }
        else if (parameters.command == "reverse") throw "Not implemented"; //TODO BGA: Reverse to the previous step. You can keep a complete copy of the game state at lastReversibleStep-1 and replay actions (without UI feedback) to make this easy.
        else if (parameters.command == "moveRoll") this.moveRoll(); //Not used, as rolling is automatic. //TODO BGA: You can give them a "roll" button instead of rolling automatically for them.
        else if (parameters.command == "activateStation") this.activateStation(); //from pickNextState
        else if (parameters.command == "missileRefillRoll") this.missileRefillRoll(); //from attackDodgeRefill, which is called directly by order()
        else if (parameters.command == "healthRefillRoll") this.healthRefillRoll(); //from attackDodgeRefill
        else if (parameters.command == "skip" || parameters.command == "stop") this.finishTurn(); //"skip" from attackDodgeRefill, "stop" from provideMoveOptions
        else if (parameters.command == "permitCombatAid") { //from this function, below. //Continue an attack roll that another player had to give you permission for (which means the enemy is in your space, though so is the other player, which also means the Aggressive option is off)
            const enemy = this.getEnemyInMapNode(this.currentTurnPlayer.containingNode);
            this.attackDodgeRefill(parameters, enemy, true);
        }
        else if (parameters.command == "rejectCombatAid") { //from this function, below. //Not allowed to attack after all. Give the same options as before, except for permitCombatAid.
            this.combatAidRejectedAtNodes.push(this.currentTurnPlayer.containingNode); //This is cleared at the end of each turn.
        }
        else if (parameters.command == "attack") { //from getWeaponOptions, called in pickNextState. //Initiate an attack that you may or may not need permission from another player for
            const enemy = this.getEnemyInMapNode(parameters.toNode || this.currentTurnPlayer.containingNode); //Not passing in toNode if the player is attacking something in their current map node (i.e., not a kill steal).

            //If this enemy is engaged with another player in the SAME space as it and you try to attack it (so all 3 of you are in the same space), that player gets to decide whether to let you attack the enemy.
            //(This is impossible if using the Aggressive option.)
            const playerThatReservedEnemy = this.players.find(player => player != this.currentTurnPlayer && player.inCombatWith == enemy && player.health && !player.acceptedDefeat && player.containingNode == enemy.containingNode);
            if (playerThatReservedEnemy && this.currentTurnPlayer.containingNode == enemy.containingNode && this.currentTurnPlayer.inCombatWith != enemy) { //Don't ask for permission multiple times if you're already in combat with that enemy, even if another player also is
                this.currentOptions.push(Object.assign({}, parameters, { command: "permitCombatAid", forPlayer: playerThatReservedEnemy })); //Change the 'command' and 'forPlayer' on the attack request so the other player knows what weapon they're trying to use
                this.currentOptions.push(Object.assign({}, parameters, { command: "rejectCombatAid", forPlayer: playerThatReservedEnemy }));
            } else {
                const killStealAttempt = (parameters.toNode || this.currentTurnPlayer.containingNode) != this.currentTurnPlayer.containingNode;
                this.attackDodgeRefill(parameters, enemy, killStealAttempt);
                //The kill stealer definitely didn't die or anything, but (unless they have a refill to roll for) their turn needs to end because they tried to attack
                if (killStealAttempt && this.currentTurnNumber == turnNumberWas && !this.currentOptions.length) this.finishTurn();
            }
        }

        //If the player has no options to choose from but their turn hasn't ended, call this.pickNextState(); to either get them some options or advance to the next turn.
        if (this.currentTurnNumber == turnNumberWas && !this.currentOptions.length) this.pickNextState();
    }

    /**
     * Same as order(), but only meant for server use. Uses the index of the choice in the currentOptions array instead of the details so a step can be played back with minimal data.
     * @param {int} choiceIndex Index of the player's choice in the currentOptions array
     */
    advance(choiceIndex) {
        if (this.currentOptions.length <= choiceIndex) throw "Attempted to play back a decision that was not available from this game state";
        this.order(this.currentOptions[choiceIndex]);
    }
}

class BoardGraphics {
    backgroundImage;
    tokenImages = {}; //object keyed by token names
    mapNodeLocations = []; //Parallel to Game.map, indicating drawing locations
    canvasClickables = []; //Locations you can click on the canvas. Has left, right, top, bottom, commandIndex.
    editorSelectedNode; //For map editor mode.
    editorNodeClickDistance = 30;

    /**
     * Draw a D6 die with the given-numbered face (1-6) displayed. Positioning requires you to call transform() on the context first. Doesn't revert changes to the canvas context's fillStyle
     */
    canvasDrawD6(ctx, face) {
        ctx.fillStyle = "#55a";
        ctx.beginPath();
        ctx.roundRect(0, 0, 64, 64, 6);
        ctx.fill();
        ctx.fillStyle = "#fff";

        const spaces = [0, 0, 0, 0, 0, 0, 0, 0, 0]; //3x3 matrix at coordinate 12, 32, or 52 on each axis
        if (face == 1) spaces[4] = 1;
        else if (face == 2) spaces[0] = spaces[8] = 1;
        else if (face == 3) spaces[0] = spaces[4] = spaces[8] = 1;
        else if (face == 4) spaces[0] = spaces[2] = spaces[6] = spaces[8] = 1;
        else if (face == 5) spaces[0] = spaces[2] = spaces[4] = spaces[6] = spaces[8] = 1;
        else if (face == 6) spaces[0] = spaces[2] = spaces[3] = spaces[5] = spaces[6] = spaces[8] = 1;
        for (let idx = 0; idx < spaces.length; idx++) {
            if (!spaces[idx]) continue;
            ctx.beginPath();
            ctx.ellipse(12 + 20 * (idx % 3), 12 + 20 * Math.floor(idx / 3), 8, 8, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /**
     * Draw a D6 die with the given-numbered face (1-6) displayed. Positioning requires you to call transform() on the context first. Doesn't revert changes to the canvas context's fillStyle
     */
    canvasDrawD10(ctx, face) {
        const fontWas = ctx.font;
        const textAlignWas = ctx.textAlign;
        const textBaselineWas = ctx.textBaseline;

        ctx.fillStyle = "#55a";
        ctx.beginPath();
        ctx.lineTo(32, 0);
        ctx.lineTo(64, 52);
        ctx.lineTo(32, 64);
        ctx.lineTo(0, 52);
        ctx.lineTo(32, 0);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 24px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(face, 32, 32);

        ctx.font = fontWas;
        ctx.textAlign = textAlignWas;
        ctx.textBaseline = textBaselineWas;
    }

    drawToCanvas(gameStarter, boardCanvasElement, optionsCanvasElement, playersCanvasElement) {
        this.canvasClickables = []; //canvasClickables can be on multiple different canvases now, so reset them here rather than in a more specific rendering function

        optionsCanvasElement = this.createCanvasIfMissing(optionsCanvasElement, 1000, 44); //Don't actually know how big it needs to be until I've got options to display, but this is probably safe
        playersCanvasElement = this.createCanvasIfMissing(playersCanvasElement, 200 * gameStarter.roundManager.players.length + 12, 64); //Could be resizable to tall and narrow instead of short and wide
        boardCanvasElement = this.createCanvasIfMissing(boardCanvasElement, 1118, 1163);

        this.drawBoardToCanvas(gameStarter, boardCanvasElement.getContext("2d"));
        this.canvasClickables.filter(p => !p.canvas).forEach(p => p.canvas = boardCanvasElement);
        this.drawOptionsToCanvas(gameStarter, optionsCanvasElement.getContext("2d"));
        this.canvasClickables.filter(p => !p.canvas).forEach(p => p.canvas = optionsCanvasElement);
        this.drawPlayersToCanvas(gameStarter, playersCanvasElement.getContext("2d"));
        this.canvasClickables.filter(p => !p.canvas).forEach(p => p.canvas = playersCanvasElement);
    }

    createCanvasIfMissing(canvas, width, height) {
        if (!canvas) document.body.appendChild(canvas = document.createElement("canvas"));
        if (!(canvas instanceof HTMLCanvasElement)) throw "Need an HTML5 canvas element";
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }

    drawBoardToCanvas(gameStarter, canvas) {
        const roundManager = gameStarter.roundManager;
        const self = this;

        if (g.boardGraphics.backgroundImage) canvas.drawImage(g.boardGraphics.backgroundImage, 0, 0); //Draw the background image before anything

        //Draw superheating or tunnel information behind the nodes
        for (let node of roundManager.map) {
            if (node.isSuperHeated) { //Pink rectangle for super-heated area
                canvas.fillStyle = "pink";
                canvas.fillRect(node.x - 10, node.y - 10, 20, 20);
            }
            if (node.isTunnel) { //Gray circle for morph ball tunnel
                canvas.fillStyle = "lightgray";
                canvas.beginPath();
                canvas.ellipse(node.x, node.y, 10, 10, 0, 0, 2 * Math.PI);
                canvas.fill();
            }
        }

        //Draw lines between nodes
        canvas.strokeStyle = "gray";
        for (let i = 0; i < roundManager.map.length; i++) {
            for (let connectedNode of roundManager.map[i].adjacentNodes) {
                canvas.beginPath();
                canvas.lineTo(roundManager.map[i].x, roundManager.map[i].y);
                canvas.lineTo(connectedNode.x, connectedNode.y);
                canvas.stroke();
            }
        }

        //Draw bold lines to make the player's movement options clear
        for (let option of roundManager.currentOptions.filter(option => option.toNode && roundManager.currentTurnPlayer?.containingNode)) {
            canvas.lineWidth = 3;
            canvas.strokeStyle = option.command == "move" ? "green" : option.command == "dodgeAndMove" ? "orange" : option.command == "attack" ? "red" : "black";
            canvas.beginPath();
            canvas.lineTo(roundManager.currentTurnPlayer.containingNode.x, roundManager.currentTurnPlayer.containingNode.y);
            canvas.lineTo(option.toNode.x, option.toNode.y);
            canvas.stroke();
        }

        function drawTokenCentered(name, x, y, scale = 1) {
            if (self.tokenImages[name]) {
                let w = self.tokenImages[name].width * scale;
                let h = self.tokenImages[name].height * scale;
                canvas.drawImage(self.tokenImages[name], x - w / 2, y - h / 2, w, h);
            }
        }

        function drawTokenMini(name, n, x, y, scale = 0.4, radius = 20) { //Draw smaller tokens around the edge of the space
            if (self.tokenImages[name]) {
                let w = self.tokenImages[name].width * scale;
                let h = self.tokenImages[name].height * scale;
                let xOff = radius * Math.sin(4 - n); //Start at roughly the top-left (4 radians) and go clockwise
                let yOff = radius * Math.cos(4 - n);
                canvas.drawImage(self.tokenImages[name], x + xOff - w / 2, y + yOff - h / 2, w, h);
            }
        }

        //Draw nodes and their contents
        canvas.font = "10px sans-serif";
        for (let i = 0; i < roundManager.map.length; i++) {
            canvas.fillStyle = "black";
            const numberWidth = canvas.measureText(i).width;
            canvas.fillText(i, roundManager.map[i].x - numberWidth - 2, roundManager.map[i].y); //Right-align the node ID to give space for all the other text I put at these nodes
            //If it's a metroidy thingy
            if (roundManager.map[i].isMetroidContainment) {
                canvas.lineWidth = 1;
                canvas.strokeStyle = "green";
                canvas.beginPath();
                canvas.ellipse(roundManager.map[i].x, roundManager.map[i].y, 25, 25, 0, 0, 2 * Math.PI);
                canvas.stroke();
            }
            for (let token of roundManager.map[i].containedTokens) {
                let tokenName = token.type?.name || token.name || token.constructor.name;
                canvas.beginPath();
                canvas.lineWidth = token == roundManager.currentTurnPlayer ? 3 : 1; //Thick line for current player, thin line for everything and everyone else
                if (token instanceof Player) {
                    canvas.strokeStyle = token == roundManager.currentTurnPlayer ? "magenta" : "pink"; //Magenta for the current player
                    canvas.ellipse(roundManager.map[i].x, roundManager.map[i].y, 15, 15, 0, 0, 2 * Math.PI); //Make the player smaller than other circles
                } else {
                    canvas.strokeStyle = token instanceof Enemy ? "red" : "blue";
                    canvas.ellipse(roundManager.map[i].x, roundManager.map[i].y, 22, 22, 0, 0, 2 * Math.PI);
                }
                canvas.stroke();

                if (token.isRevealed || token instanceof Player) {
                    canvas.fillStyle = token == roundManager.currentTurnPlayer ? "magenta" : token instanceof Player ? "pink" : "blue"; //Magenta for current player, pink for other players, blue for non-players
                    canvas.fillText(tokenName, roundManager.map[i].x, roundManager.map[i].y + 10 - (token instanceof Player ? 20 : 0));
                    if (!token.acceptedDefeat) drawTokenCentered(tokenName, roundManager.map[i].x, roundManager.map[i].y); //Cease drawing a player if they accepted defeat

                    if (token.upgrade) { //It's an upgrade station, and it's also revealed
                        canvas.fillText(token.upgrade.name, roundManager.map[i].x, roundManager.map[i].y + 20);
                        drawTokenCentered(token.upgrade.name, roundManager.map[i].x, roundManager.map[i].y, 0.5);

                        //Draw players' tokens there if they can still use this station.
                        let n = 0;
                        for (let player of roundManager.players.filter(player => player.canUseStation(token))) {
                            drawTokenMini(player.type.name + "Token", n++, roundManager.map[i].x, roundManager.map[i].y, 0.4, 30);
                        }
                    }
                } else if (!token.isRevealed) { //Draw a radar blip
                    if (token instanceof Enemy && roundManager.map[i].isMetroidContainment) tokenName = "MetroidContainment";
                    else if (token instanceof Enemy) tokenName = "Enemy";
                    else if (token instanceof Station && token.isEarlyStation) tokenName = "EarlyStation";
                    else tokenName = "LateStation";
                    drawTokenCentered(tokenName, roundManager.map[i].x, roundManager.map[i].y);
                }
            }
        }

        //Render player's token on their last save space.
        const playersWhoSaved = roundManager.players.filter(player => roundManager.playersCanRevive && player.nodeLastSavedAt);
        for (let player of playersWhoSaved) {
            drawTokenMini(player.type.name + "Token", playersWhoSaved.filter(p => p.nodeLastSavedAt == player.nodeLastSavedAt).indexOf(player) /*tokens are around each save space in order of player number*/, player.nodeLastSavedAt.x, player.nodeLastSavedAt.y, 0.4, 25);
        }

        //TODO: Players' token trays

        if (this.editorSelectedNode) { //If in map edtior mode and you have a node selected, give it a special highlight... in a diamond shape because I used non-Euclidean distance for selecting the node.
            canvas.strokeStyle = "magenta";
            canvas.beginPath();
            canvas.lineTo(this.editorSelectedNode.x - this.editorNodeClickDistance, this.editorSelectedNode.y);
            canvas.lineTo(this.editorSelectedNode.x, this.editorSelectedNode.y - this.editorNodeClickDistance);
            canvas.lineTo(this.editorSelectedNode.x + this.editorNodeClickDistance, this.editorSelectedNode.y);
            canvas.lineTo(this.editorSelectedNode.x, this.editorSelectedNode.y + this.editorNodeClickDistance);
            canvas.lineTo(this.editorSelectedNode.x - this.editorNodeClickDistance, this.editorSelectedNode.y);
            canvas.stroke();
        }

        //Character selection options if anyone is still picking
        if (roundManager.players.some(player => !player.acceptedDefeat && !player.type)) { //TODO: This is the first place that I really want to know who is playing on this client, to highlight their character differently rather than in gray like other already-selected characters
            let nextX = 8;
            for (let character of Object.keys(gameStarter.playerTokenTypes)) {
                const isAvailable = !roundManager.players.some(player => player.type?.name == character);
                canvas.filter = "none";
                if (isAvailable) this.canvasClickables.push({ left: nextX - 2, right: nextX + 70, top: 75, bottom: 166, character: character });
                else canvas.filter = "grayscale(1)";

                let textWidth = canvas.measureText(character).width;
                canvas.strokeStyle = "green";
                canvas.lineWidth = 6;
                canvas.fillStyle = "lightgreen";
                canvas.fillRect(nextX, 80, 64, 84);
                canvas.strokeRect(nextX - 2, 78, 68, 86);
                drawTokenCentered(character, nextX + 32, 112);
                canvas.fillStyle = "black";
                canvas.fillText(character, nextX + 32 - textWidth / 2, 158); //Token top plus max token height plus margin plus text height
                nextX += 80;
            }
        }

        if (roundManager.isGameOver()) {
            canvas.font = '20px sans-serif';
            const gameOverMessage = "This game has ended. Final ranking:";
            const msgWidth = canvas.measureText(gameOverMessage).width;
            const left = (canvas.canvas.clientWidth - msgWidth) / 2;
            canvas.fillStyle = "#eee";
            canvas.fillRect(left - 10, 20, msgWidth + 20, 35 + 15 * roundManager.players.length);
            canvas.fillStyle = "#c80";
            canvas.fillText(gameOverMessage, left, 40);
            canvas.font = '14px sans-serif';
            let rank = 1;
            for (let player of roundManager.getFinalScoresAndRankings()) {
                canvas.fillText(rank + ". " + player.type.name + ": " + player.score + " (" + player.nickname + ")", left, 45 + rank * 15);
                rank++;
            }
            canvas.font = '10px sans-serif';
        }

        //Make options clickable on the board
        if (!roundManager.isGameOver()) {
            for (let idx = 0; idx < roundManager.currentOptions.length; idx++) {
                let option = roundManager.currentOptions[idx];
                if (option.toNode) option.nodeId = option.toNode.nodeId;

                //Also make the actual map clickable if there are no position conflicts
                //TODO: Show "dodge", "stop", "attack", and whatever other icons you need just above the map node if multiple options are available. Can use drawTokenMini for that if you make actual graphics for the commands.
                const thisOptionNode = typeof option.nodeId == 'number' ? roundManager.map[option.nodeId] : roundManager.currentTurnPlayer?.containingNode;
                if (roundManager.currentOptions.filter(opt => thisOptionNode == (typeof opt.nodeId == 'number' ? roundManager.map[opt.nodeId] : roundManager.currentTurnPlayer?.containingNode)).length == 1)
                    this.canvasClickables.push({ left: thisOptionNode.x - 20, right: thisOptionNode.x + 20, top: thisOptionNode.y - 20, bottom: thisOptionNode.y + 20, commandIndex: idx });
            }
        }
    }

    drawOptionsToCanvas(gameStarter, canvas) {
        const roundManager = gameStarter.roundManager;

        //Render the player's choices, if any were given and the game hasn't ended
        let lastTextOptionRight = 0;
        if (!roundManager.isGameOver()) {
            let optionX = 10;
            for (let idx = 0; idx < roundManager.currentOptions.length; idx++) {
                let option = roundManager.currentOptions[idx];
                if (option.toNode) option.nodeId = option.toNode.nodeId; //I apparently took nodeId out of the options at some point? Not sure what happened there.

                let commandText = option.command;
                if (option.command == "attack") {
                    commandText = "Attack with " + ((roundManager.currentTurnPlayer?.isFirstAttack && option.firstBeamAttackDamageBonus) ? "charged " : "") +
                        (option instanceof BaseBeamWeapon ? "basic beam" : option instanceof BaseMissile ? "missile" : option.optionalActivation ? "Ice Beam" : "Unknown Weapon");
                }
                else if (option.command == "move") commandText = "Move to " + option.nodeId;
                else if (option.command == "dodgeAndMove") commandText = "Dodge to " + option.nodeId;
                else if (option.command == "pickStartLocation") commandText = "Start at " + option.nodeId;
                else if (option.command == "dodgeAndStop") commandText = "Dodge but stay here";
                else if (option.command == "activateStation") commandText = "Activate station";
                else if (option.command == "acceptDefeat") commandText = "Accept defeat";
                else if (option.command == "dodge") commandText = "Dodge";
                else if (option.command == "healthRefillRoll") commandText = "Refill health";
                else if (option.command == "missileRefillRoll") commandText = "Refill missiles";
                else if (option.command == "stop") commandText = "End turn";
                else if (option.command == "skip") commandText = "Skip and end turn";
                else if (option.command == "permitCombatAid") commandText = "Accept combat aid";
                else if (option.command == "rejectCombatAid") commandText = "Reject combat aid";

                //Make that space clickable
                let optionWidth = canvas.measureText(commandText).width;
                let clickable = { left: optionX - 2, right: optionX + optionWidth + 4, top: 2, bottom: 26, commandIndex: idx };
                this.canvasClickables.push(clickable);
                canvas.fillStyle = "#aef"; //Very light blue
                canvas.fillRect(clickable.left, clickable.top, clickable.right - clickable.left, clickable.bottom - clickable.top);
                canvas.strokeStyle = "#4ae"; //Light blue
                canvas.strokeRect(clickable.left - 1, clickable.top - 1, clickable.right - clickable.left + 2, clickable.bottom - clickable.top + 2); //Draw a light box around it

                canvas.fillStyle = "black";
                canvas.fillText(commandText, optionX, 23);
                canvas.fillText(idx, optionX, 12); //The option index--you can press the same number key to perform this action (as long as it's <10)

                //If it's a direction, draw an arrow
                if ((option.command == "move" || option.command == "dodgeAndMove") && option.toNode && roundManager.currentTurnPlayer?.containingNode) {
                    canvas.strokeStyle = option.command == "move" ? "green" : "orange"; //move/dodge colors match what shows up on the board
                    let arrowPointAngle = Math.atan2(option.toNode.y - roundManager.currentTurnPlayer.containingNode.y, option.toNode.x - roundManager.currentTurnPlayer.containingNode.x);
                    const arrowRadius = 5;
                    //Draw lines in that direction and that direction+Math.PI times the radius
                    canvas.translate(optionX + optionWidth - arrowRadius, arrowRadius + 4); //Pad a bit
                    canvas.beginPath();
                    canvas.lineTo(-Math.cos(arrowPointAngle) * arrowRadius, -Math.sin(arrowPointAngle) * arrowRadius); //back of arrow
                    let arrowFrontX = Math.cos(arrowPointAngle) * arrowRadius;
                    let arrowFrontY = Math.sin(arrowPointAngle) * arrowRadius;
                    canvas.lineTo(arrowFrontX, arrowFrontY); //front of arrow
                    canvas.lineTo(arrowFrontX - Math.cos(arrowPointAngle - 0.8) * arrowRadius, arrowFrontY - Math.sin(arrowPointAngle - 0.8) * arrowRadius); //right
                    canvas.lineTo(arrowFrontX, arrowFrontY); //front again
                    canvas.lineTo(arrowFrontX - Math.cos(arrowPointAngle + 0.8) * arrowRadius, arrowFrontY - Math.sin(arrowPointAngle + 0.8) * arrowRadius); //left
                    canvas.stroke();
                    canvas.resetTransform();
                }

                optionX += optionWidth + 10;
                lastTextOptionRight = optionX; //Keep this for later use with displaying dice
            }
        }

        let turnText = "Turn " + roundManager.currentTurnNumber + ": " + (roundManager.currentTurnPlayer?.type?.name ?? "Character selection");
        if (roundManager.currentTurnPlayer?.spacesToMove) turnText += "; spaces left to move: " + roundManager.currentTurnPlayer.spacesToMove;

        canvas.fillStyle = "#aef"; //Very light blue
        let turnTextWidth = canvas.measureText(turnText).width;
        canvas.fillRect(8, 30, turnTextWidth + 4, 14);
        canvas.fillStyle = "black";
        canvas.fillText(turnText, 10, 40);
        //Warning if the options aren't for the player whose turn it is
        if (roundManager.currentOptions.length && roundManager.currentOptions.every(option => option.forPlayer && option.forPlayer != roundManager.currentTurnPlayer)) {
            let warnText = "These options are not for the player whose turn it is, but for " + roundManager.currentOptions[0].forPlayer.type.name;
            let warnTextWidth = canvas.measureText(warnText).width;
            canvas.fillStyle = "#fea"; //Very light orange
            canvas.fillRect(turnTextWidth + 18, 30, warnTextWidth + 4, 14);
            canvas.fillStyle = "red";
            canvas.fillText(warnText, turnTextWidth + 20, 40);
        }

        //The last die roll(s) if there are any
        const lastNonRoll = roundManager.stepHistory.findLastIndex(p => typeof p.roll != "number");
        if (lastNonRoll != -1 && lastNonRoll != roundManager.stepHistory.length - 1) { //If the most recent 'step' was a roll, then display ALL rolls since the last non-roll 'step'
            canvas.translate(lastTextOptionRight + 10, 0);
            canvas.scale(0.5, 0.5); //Shrink the dice to half-size so they fit nicely above the player stats and such. Otherwise, I'd be rendering them 64x64.
            for (let step of roundManager.stepHistory.slice(lastNonRoll + 1)) {
                if (step.sides == 6) this.canvasDrawD6(canvas, step.roll);
                else if (step.sides == 10) this.canvasDrawD10(canvas, step.roll);
                canvas.translate(70, 0);
            }
            canvas.resetTransform();
        }
    }

    drawPlayersToCanvas(gameStarter, canvas) {
        const roundManager = gameStarter.roundManager;
        const self = this;

        //TODO: don't copy and paste this function. :P
        function drawTokenCentered(name, x, y, scale = 1) {
            if (self.tokenImages[name]) {
                let w = self.tokenImages[name].width * scale;
                let h = self.tokenImages[name].height * scale;
                canvas.drawImage(self.tokenImages[name], x - w / 2, y - h / 2, w, h);
            }
        }

        canvas.fillStyle = "white";
        canvas.fillRect(5, 1, 200 * roundManager.players.length, 60);
        canvas.fillStyle = "black";

        for (let i = 0; i < roundManager.players.length; i++) {
            const player = roundManager.players[i];
            let left = i * 200 + 10;
            let top = 12;
            if (player == roundManager.currentTurnPlayer) {
                canvas.strokeStyle = "magenta";
                canvas.lineWidth = 2;
                canvas.strokeRect(left - 5, top - 11, 200, 60);
            }

            if (player.nickname) {
                canvas.fillText(player.nickname, left, top, 100);
                top += 11;
            }
            canvas.fillText("Character:", left, top);
            let characterWordWidth = canvas.measureText("Character:").width;
            drawTokenCentered(player.type?.name + "Token", left + characterWordWidth + 8, top - 4, 0.2); //Draw their save/upgrade marker token so we know who it belongs to
            canvas.fillText(player.type?.name ?? "(TBD)", left + characterWordWidth + 16, top);
            top += 11;
            if (player.type) {
                canvas.fillText("Health: " + player.health + "/" + player.maxHealth, left, top);
                top += 11;
                canvas.fillText("Missiles: " + player.missiles + "/" + player.maxMissiles, left, top);
                top += 11;
                canvas.fillText("Bounty: " + player.score, left, top);

                left += 100;
                top = 12;
                const upgradesToDisplay = player.upgrades.map(upgrade => upgrade.name).filter(name => name != "MissileTank" && name != "EnergyTank");
                canvas.fillText("Upgrades:", left, top);
                top += 11;
                if (!upgradesToDisplay.length) canvas.fillText("none", left, top);
                for (let upgrade of upgradesToDisplay) {
                    canvas.fillText(upgrade, left, top);
                    top += 11;
                }
            }
        }
    }
}

class MapNode {
    adjacentNodes = []; //map nodes you can travel to from this one or vice-versa (NOT intended to be a directed graph)
    containedTokens = []; //list of Token
    isMetroidContainment = false; //Every Metroid gets put into a Metroid Containment cell, so their locations are clear from the start, but not every Metroid Containment cell actually contains a Metroid. (3 are empty in the base game and 5 in the expansion)
    isTunnel = false;
    isLandingSite = false;
    isSuperHeated = false; //Expansion
}

class Token {
    type; //of enemy, character, station/room, or upgrade
    isRevealed = false;
    containingNode; //MapNode that this Token is currently inside of

    /**
     * Simply remove the token from its containing node. It may still exist in a player's inventory and will still exist in the RoundManager's tokens array.
     */
    destroy() {
        this.containingNode.containedTokens.splice(this.containingNode.containedTokens.indexOf(this), 1);
    }
}

class Enemy extends Token {
    health = 99; //Set to a large number by default so enemies don't appear "dead" even if we don't set their health to their type's preset health right away
    stunnedSinceTurn = -1; //Expansion
    stunDurationRounds = 0; //Expansion
    frozenSinceTurn = -1; //Expansion
    freezeDurationRounds = 0; //Expansion
    targetedPlayer; //a Player (but usually null). The enemy can't recharge its attack or go after someone else until targetedPlayer's next turn, I guess. Even then, I think I need another field for the attack recharge (so it doesn't attack when the player approaches and then again after the player's attack, if it's ranged and you're playing with the expansion).
    lastAttackTurn = -99; //just has to be -players.length to work right

    isFrozen(currentTurnNumber, activePlayerCount, delayThaw) {
        return this.frozenSinceTurn > currentTurnNumber - activePlayerCount * this.freezeDurationRounds - (delayThaw ? 1 : 0); //if delayThaw is truthy, this acts as if the current turn hasn't started yet
    }

    /**
     * Enemy can attack right now. Requirements: it's alive, it's not stunned, it's not frozen, and it hasn't attacked for 1 full round
     */
    canAttack(currentTurnNumber, activePlayerCount, delayThaw) {
        return this.health &&
            this.stunnedSinceTurn <= currentTurnNumber - activePlayerCount * this.stunDurationRounds &&
            !this.isFrozen(currentTurnNumber, activePlayerCount, delayThaw) &&
            this.lastAttackTurn <= currentTurnNumber - activePlayerCount;
    }
}

class Station extends Token {
    upgrade; //*If* it's an upgrade station, this will be the upgrade it provides
}

class Player extends Token {
    //Note: 'type' is inherited and refers to what character this player is. It should be set via setCharacter(playerTokenType) rather than directly for Player tokens.
    health = 99;
    maxHealth;
    missiles;
    maxMissiles;
    upgrades = [];
    visitedUpgradeStations = []; //Have to track which stations the player has used so they don't get missiles or energy tanks from the same place multiple times
    isFirstAttack = true;
    inCombatUntilNextTurnAfterAnyRangedDodges = false; //For determining if the dodging/fleeing allows the out-of-combat dodge bonus
    score = 0;
    inCombatWith; //Enemy that the player is in combat with (reset at the start of their next turn; may be checked by other players in Aggressive mode)
    nodeLastSavedAt; //a MapNode //Expansion
    spacesToMove; //after rolling, before stopping
    accomplishments = []; //Any token the player picked up or defeated will be kept here for the final ranking.
    acceptedDefeat = false; //If they ran out of health and aren't allowed to revive in the current game rules, this tells us not to rub it in by giving them the "accept my defeat" button repeatedly :)
    isRevealed = true; //Makes some server code a bit easier. Player tokens are always revealed.
    delayThaw = true; //Delay thawing of enemies until the player has a chance to attack them on the following turn. In other words, set this to true if the player has already been given an attack option and responded to it (negatively or positively).

    getTieBreakingScore() {
        //Max safe integer in JavaScript is 2^53, so with 1 base score and up to 7 tie breakers making up 8 separate numbers, each multiplication we do can be up to the eighth root of that, or ~98, so the max value of each type of score is 97 before it'll break.
        //Note: doesn't support different things in the same bucket having different values or "lesser is better" logic
        const tieBreakerBuckets = new Array(8).fill(0);
        tieBreakerBuckets[0] = this.score;
        for (let token of this.accomplishments) {
            if (token.tieBreakerPriority) tieBreakerBuckets[token.tieBreakerPriority]++;
        }

        let score = 0;
        for (let subscore of tieBreakerBuckets) {
            if (subscore > 97) throw "Unexpectedly large score encountered; can't break ties this way";
            score = score * 98 + subscore;
        }
        return score;
    }

    canUseStation(station) {
        let notAllowed = false;
        let alreadyUsed = false;
        let noNeed = false;
        if (station.type.grantsUpgrade) {
            notAllowed = (this.type.chargeBeamDisallowed && station.upgrade.isBeamAddon && station.upgrade.firstBeamAttackDamageBonus) ||
                (this.type.variaSuitDisallowed && station.upgrade.superheatedRoomNoDamage) ||
                (this.type.iceBeamDisallowed && station.upgrade.isBeamAddon && station.upgrade.freezeForRoundsOnHit) ||
                (this.type.morphBallDisallowed && station.upgrade.enableTunnelTraversal);
            alreadyUsed = this.visitedUpgradeStations.includes(station);
        } else {
            noNeed = !((station.type.refillHealth && this.health != this.maxHealth) || //Can refill health
                (station.type.refillMissiles && this.missiles != this.maxMissiles) || //Can refill missiles
                (station.type.saveStation && this.nodeLastSavedAt != station.containingNode) || //Last save was elsewhere
                station.type.mapStation); //Map stations are always needed...until they disappear, which they do, so no need to check if everything was already revealed.
        }
        return !notAllowed && !alreadyUsed && !noNeed;
    }

    canUseTunnels() {
        return this.type.canTraverseTunnels || this.upgrades.find(upgrade => upgrade.enableTunnelTraversal);
    }

    getStationPlayerIsAt() {
        const tokensAtNode = this.containingNode.containedTokens;
        const stations = tokensAtNode.filter(token => token instanceof Station);
        return stations.length ? stations[0] : null;
    }

    grantHealth(refillAmount) {
        this.health += refillAmount;
        if (this.health > this.maxHealth) this.health = this.maxHealth;
    }

    grantMissiles(refillAmount) {
        this.missiles += refillAmount;
        if (this.missiles > this.maxMissiles) this.missiles = this.maxMissiles;
    }

    overheat(logGameEvent) { //TODO REDESIGN: Consider redesigning to once per round (if you pass through at least one such space) instead of only if you started your turn in such a space
        if (this.type.superheatedRoomHealthRefillRollInsteadOfDamage) {
            this.health++;
            if (this.health > this.maxHealth) this.health = this.maxHealth;
            else logGameEvent("Healed due to the superheated area");
        } else if (this.upgrades.some(upgrade => upgrade.superheatedRoomNoDamage)) {
            //Do nothing
        } else {
            this.damage(1, logGameEvent, " overheating");
        }
    }

    damage(amount, logGameEvent, fromCause) {
        this.health -= amount;
        if (this.health < 0) this.health = 0;
        logGameEvent(this.type.name + " took " + amount + " damage" + (fromCause ? " from " + fromCause : "") + "; " + this.health + " health remaining.");
    }

    setCharacter(playerTokenType) {
        this.health = this.maxHealth = playerTokenType.health;
        this.missiles = this.maxMissiles = playerTokenType.startsWithMissiles || 0;
        this.type = playerTokenType;
    }
}

class PlayerTokenTypes {
    static CharacterStandardHealth = 5;
    static CharacterStandardOutOfCombatDodgeRollBonus = 3;

    constructor() {
        this.Samus = {
            name: "Samus", //For display testing
            health: PlayerTokenTypes.CharacterStandardHealth,
            dodgeRollOutOfCombatBonus: PlayerTokenTypes.CharacterStandardOutOfCombatDodgeRollBonus,
        };
        this.Sylux = {
            name: "Sylux", //For display testing
            health: PlayerTokenTypes.CharacterStandardHealth,
            dodgeRollOutOfCombatBonus: PlayerTokenTypes.CharacterStandardOutOfCombatDodgeRollBonus,
        };
        this.Spire = {
            name: "Spire", //For display testing
            health: PlayerTokenTypes.CharacterStandardHealth,
            dodgeRollOutOfCombatBonus: PlayerTokenTypes.CharacterStandardOutOfCombatDodgeRollBonus,
        };
        this.Noxus = {
            name: "Noxus", //For display testing
            health: PlayerTokenTypes.CharacterStandardHealth,
            dodgeRollOutOfCombatBonus: PlayerTokenTypes.CharacterStandardOutOfCombatDodgeRollBonus,
        };
    }
}

class EnemyTokenTypes {
    static EnemyStandardHitRollAtLeast = 2;
    static EnemyStandardDodgeRollAtLeast = 9;

    constructor() {
        this.Geemer = {
            name: "Geemer", //For display testing
            health: 1,
            damage: 1,
            hitRollAtLeast: EnemyTokenTypes.EnemyStandardHitRollAtLeast,
            dodgeRollAtLeast: EnemyTokenTypes.EnemyStandardDodgeRollAtLeast,
            beamCanHarm: true,
            score: 1,
        };
        this.Zeb = {
            name: "Zeb", //For display testing
            health: 1,
            damage: 1,
            hitRollAtLeast: EnemyTokenTypes.EnemyStandardHitRollAtLeast,
            dodgeRollAtLeast: EnemyTokenTypes.EnemyStandardDodgeRollAtLeast,
            beamCanHarm: true,
            score: 1,
        };
        this.Waver = {
            name: "Waver", //For display testing
            health: 2,
            damage: 1,
            hitRollAtLeast: EnemyTokenTypes.EnemyStandardHitRollAtLeast,
            dodgeRollAtLeast: EnemyTokenTypes.EnemyStandardDodgeRollAtLeast,
            beamCanHarm: true,
            score: 1,
        };
        this.Sidehopper = {
            name: "Sidehopper", //For display testing
            health: 3,
            damage: 1,
            hitRollAtLeast: EnemyTokenTypes.EnemyStandardHitRollAtLeast,
            dodgeRollAtLeast: EnemyTokenTypes.EnemyStandardDodgeRollAtLeast,
            beamCanHarm: true,
            score: 1,
        };
        this.Ripper = {
            name: "Ripper", //For display testing
            health: 3,
            damage: 1,
            hitRollAtLeast: EnemyTokenTypes.EnemyStandardHitRollAtLeast,
            dodgeRollAtLeast: EnemyTokenTypes.EnemyStandardDodgeRollAtLeast,
            beamCanHarm: false,
            score: 1,
        };
        this.WarWasp = {
            name: "WarWasp", //For display testing
            health: 1,
            damage: 1,
            hitRollAtLeast: EnemyTokenTypes.EnemyStandardHitRollAtLeast,
            dodgeRollAtLeast: EnemyTokenTypes.EnemyStandardDodgeRollAtLeast,
            beamCanHarm: true,
            score: 1,
        };
        this.ZebesianPirate = {
            name: "ZebesianPirate", //For display testing
            health: 4,
            damage: 2,
            hitRollAtLeast: EnemyTokenTypes.EnemyStandardHitRollAtLeast,
            dodgeRollAtLeast: EnemyTokenTypes.EnemyStandardDodgeRollAtLeast,
            beamCanHarm: true,
            score: 2,
        };
        this.BabySheegoth = {
            name: "BabySheegoth", //For display testing
            health: 4,
            damage: 1,
            hitRollAtLeast: EnemyTokenTypes.EnemyStandardHitRollAtLeast,
            dodgeRollAtLeast: EnemyTokenTypes.EnemyStandardDodgeRollAtLeast,
            beamCanHarm: true,
            score: 1,
        };
        this.PirateTrooper = {
            name: "PirateTrooper", //For display testing
            health: 5,
            damage: 2,
            hitRollAtLeast: EnemyTokenTypes.EnemyStandardHitRollAtLeast,
            dodgeRollAtLeast: EnemyTokenTypes.EnemyStandardDodgeRollAtLeast,
            beamCanHarm: true,
            score: 2,
        };
        this.Metroid = {
            name: "Metroid", //For display testing
            health: 5,
            damage: 2,
            hitRollAtLeast: EnemyTokenTypes.EnemyStandardHitRollAtLeast,
            dodgeRollAtLeast: EnemyTokenTypes.EnemyStandardDodgeRollAtLeast,
            beamCanHarm: false,
            canAppearInContainmentCells: true, //Could even add Mochtroids that aren't worth as much, if I include this field in the logic
            appearOnlyInContainmentCells: true, //Can only appear in a Metroid Containment cell, not in normal enemy locations
            isObjective: true, //The only thing in the game that must be defeated
            score: 3,
            tieBreakerPriority: 1, //Ties must be broken by grouping each player's tieBreakers by tieBreakerPriority (must be >0) and then looking for the first mismatch in ascending order.
        };
        this.FalseAlarmMetroid = {
            name: "FalseAlarmMetroid", //For display testing
            health: 0,
            damage: 0,
            canAppearInContainmentCells: true,
            appearOnlyInContainmentCells: true,
            score: 0,
            destroyOnReveal: true, //These only exist so that you don't know for sure whether a space is a Metroid
        };
    }
}

class UpgradeTokenTypes {
    constructor() {
        this.MorphBall = {
            name: "MorphBall", //For display testing
            dodgeRollOutOfCombatBonus: 2,
            enableTunnelTraversal: true,
        };
        this.ChargeBeam = {
            name: "ChargeBeam", //For display testing
            isBeamAddon: true,
            firstBeamAttackDamageBonus: 2, //First beam attack in each fight. Missiles don't count. Ice beam does count.
        };
        this.MissileTank = {
            name: "MissileTank", //For display testing
            missiles: 3,
            maxMissiles: 3,
        };
        this.EnergyTank = {
            name: "EnergyTank", //For display testing
            health: 3,
            maxHealth: 3,
        };
    }
}

class StationTokenTypes {
    constructor() {
        this.Ship = {
            name: "Ship", //For display testing
            optionalStop: true, //Player can choose to reject this token's effects and keep moving
            haltMovement: true, //If affected by this token, player cannot move anymore on this turn regardless of how many spaces they would otherwise still be able to move
            refillHealth: true, //Guaranteed refill, not a roll
            refillMissiles: true,
        };
        this.UpgradeStation = { //Should be one for each upgrade type, so there's probably no need to make a separate token for the upgrade stations...but you do need to remember who has gotten what upgrades from what rooms, because each player can only use each room once.
            name: "UpgradeStation", //For display testing
            optionalStop: false, //There's no reason for players to be allowed to reject an upgrade
            haltMovement: false, //Can keep going
            grantsUpgrade: true,

            //Early stations: Morph Ball (mandatory/guaranteed to all players), Energy Tank, Energy Tank, Missile Tank (first one is mandatory/guaranteed to all players), Missile Tank, Recharge Station. Expansion: Varia Suit, Save Station, Recharge Station.
            //Late stations: Charge Beam, Energy Tank, Energy Tank, Missile Tank, Missile Tank, Recharge Station. Expansion: Ice Beam (mandatory/guaranteed to all players), Save Station, Map Station.
            //Early/late is a map generation factor (it's an early station if and only if you can get there from the landing site without passing through any tunnels)
        };
        this.RechargeStation = {
            name: "RechargeStation", //For display testing
            optionalStop: true,
            haltMovement: true,
            refillHealth: true,
            refillMissiles: true,
        };
    }
}

class BaseBeamWeapon {
    constructor() {
        this.damage = 1;
    }
}

class BaseMissile {
    constructor() {
        this.damage = 3;
        this.isMissile = true;
    }
}

function repeat(obj, count) { //Doesn't clone; just repeats the same object the given number of times.
    const objects = [];
    for (let i = 0; i < count; i++) objects.push(obj);
    return objects;
}
class SetupParameters {
    Spaces = {
        metroidContainment: 10,
        enemies: 20,
        earlyStations: 4,
        lateStations: 4,
    };

    Metroids = {
        fixed: [
            ...repeat({ type: "Metroid" }, 7),
            ...repeat({ type: "FalseAlarmMetroid" }, 3),
        ],
        random: [],
    };

    Enemies = {
        fixed: [
            ...repeat({ type: "Geemer" }, 3),
            ...repeat({ type: "Zeb" }, 3),
            ...repeat({ type: "Waver" }, 2),
            ...repeat({ type: "Sidehopper" }, 2),
            ...repeat({ type: "Ripper" }, 2),
            ...repeat({ type: "WarWasp" }, 2),
            ...repeat({ type: "ZebesianPirate" }, 2),
            ...repeat({ type: "BabySheegoth" }, 2),
            ...repeat({ type: "PirateTrooper" }, 2),
        ],
        random: [],
    };

    Stations = {
        early: {
            fixed: [
                { type: "UpgradeStation", upgrade: "MorphBall" }, //type is the name of a StationTokenTypes entry; upgrade is the name of an UpgradeTokenTypes entry
                { type: "RechargeStation" },
            ],
            random: [
                { type: "UpgradeStation", upgrade: "MissileTank" },
                { type: "UpgradeStation", upgrade: "MissileTank" },
                { type: "UpgradeStation", upgrade: "EnergyTank" },
                { type: "UpgradeStation", upgrade: "EnergyTank" },
            ]
        },
        late: {
            fixed: [
                { type: "UpgradeStation", upgrade: "ChargeBeam" },
                { type: "RechargeStation" },
            ],
            random: [
                { type: "UpgradeStation", upgrade: "MissileTank" },
                { type: "UpgradeStation", upgrade: "MissileTank" },
                { type: "UpgradeStation", upgrade: "EnergyTank" },
                { type: "UpgradeStation", upgrade: "EnergyTank" },
            ]
        }
    };
}

class ExpansionPlayerTokenTypes {
    constructor() {
        this.Samus = {
            startsWithMissiles: 1,
        };
        this.Sylux = {
            chargeBeamDisallowed: true,
            conditionalBeamDamage: 2,
            damageConditionRollAtLeast: 4,
        };
        this.Spire = {
            variaSuitDisallowed: true,
            superheatedRoomHealthRefillRollInsteadOfDamage: true,
        };
        this.Noxus = {
            iceBeamDisallowed: true,
            freezeConditionRollAtLeast: 3, //Might be OP. How can enemies hurt him when 90% of melee enemies die and ~80% of the rest are frozen before they have a chance to attack? On the other hand, it's much harder for him to fight Metroids without a guaranteed freeze.
            conditionalFreezeRounds: 1,
        };
        this.Weavel = {
            name: "Weavel", //For display testing
            morphBallDisallowed: true,
            dodgeRollOutOfCombatBonus: PlayerTokenTypes.CharacterStandardOutOfCombatDodgeRollBonus,
            dodgeRollBonus: 2,
            canTraverseTunnels: true,
            health: PlayerTokenTypes.CharacterStandardHealth,
        };
        this.Kanden = {
            name: "Kanden", //For display testing
            stunConditionRollAtLeast: 6,
            conditionalStunRounds: 1,
            dodgeRollOutOfCombatBonus: PlayerTokenTypes.CharacterStandardOutOfCombatDodgeRollBonus,
            health: PlayerTokenTypes.CharacterStandardHealth,
        };
    }
}

class ExpansionEnemyTokenTypes {
    constructor() {
        this.Geemer = {
            hitRollAtLeast: 2,
            dodgeRollAtLeast: 7,
            ranged: false,
        };
        this.Zeb = {
            hitRollAtLeast: 3,
            dodgeRollAtLeast: 9,
            ranged: false,
        };
        this.Waver = {
            hitRollAtLeast: 2,
            dodgeRollAtLeast: 8,
            ranged: false,
        };
        this.Sidehopper = {
            hitRollAtLeast: 2,
            dodgeRollAtLeast: 7,
            ranged: false,
        };
        this.Ripper = {
            hitRollAtLeast: 2,
            dodgeRollAtLeast: 7,
            ranged: false,
        };
        this.WarWasp = {
            hitRollAtLeast: 5,
            dodgeRollAtLeast: 8,
            ranged: true,
        };
        this.ZebesianPirate = {
            hitRollAtLeast: 2,
            dodgeRollAtLeast: 8,
            ranged: false,
        };
        this.BabySheegoth = {
            hitRollAtLeast: 3,
            dodgeRollAtLeast: 8,
            ranged: true,
        };
        this.Metroid = {
            hitRollAtLeast: 3,
            dodgeRollAtLeast: 8,
            ranged: false,
            invulnerableIfNotFrozen: true,
        };
        this.PirateTrooper = {
            hitRollAtLeast: 3,
            dodgeRollAtLeast: 9,
            ranged: true,
        };
    }
}

class ExpansionUpgradeTokenTypes {
    constructor() {
        this.VariaSuit = {
            name: "VariaSuit", //For display testing
            superheatedRoomNoDamage: true,
        };
        this.IceBeam = {
            name: "IceBeam", //For display testing
            isBeamAddon: true,
            optionalActivation: true, //Player must specifically choose whether to use it before attacking
            hitRollBonus: -1, //Lower chance to hit
            freezeForRoundsOnHit: 1, //Freezes through the next post-dodge and following pre-dodge phases, i.e., until your next attack or until you move away if you decide to flee
        };
    }
}

class ExpansionStationTokenTypes {
    constructor() {
        this.Ship = {
            saveStation: true,
        };
        this.SaveStation = {
            name: "SaveStation", //For display testing
            optionalStop: true,
            haltMovement: true,
            refillHealth: true,
            saveStation: true,
        };
        this.MapStation = {
            name: "MapStation", //For display testing
            optionalStop: true,
            haltMovement: true,
            mapStation: true,
        };
    }
}

class ExpansionSetupParameters {
    Spaces = {
        metroidContainment: 16,
        enemies: 30,
        earlyStations: 5,
        lateStations: 5,
    };

    Metroids = {
        fixed: [
            ...repeat({ type: "Metroid" }, 11),
            ...repeat({ type: "FalseAlarmMetroid" }, 5),
        ],
        random: [],
    };

    Enemies = {
        fixed: [
            ...repeat({ type: "Geemer" }, 4),
            ...repeat({ type: "Zeb" }, 4),
            ...repeat({ type: "Waver" }, 3),
            ...repeat({ type: "Sidehopper" }, 3),
            ...repeat({ type: "Ripper" }, 3),
            ...repeat({ type: "WarWasp" }, 3),
            ...repeat({ type: "ZebesianPirate" }, 3),
            ...repeat({ type: "BabySheegoth" }, 3),
            ...repeat({ type: "PirateTrooper" }, 4),
        ],
        random: [],
    };

    Stations = {
        early: {
            fixed: [
                { type: "UpgradeStation", upgrade: "MorphBall" }, //type is the name of a StationTokenTypes entry; upgrade is the name of an UpgradeTokenTypes entry
                { type: "UpgradeStation", upgrade: "MissileTank" },
            ],
            random: [
                { type: "UpgradeStation", upgrade: "MissileTank" },
                { type: "UpgradeStation", upgrade: "EnergyTank" },
                { type: "UpgradeStation", upgrade: "EnergyTank" },
                { type: "UpgradeStation", upgrade: "VariaSuit" },
                { type: "RechargeStation" },
                { type: "RechargeStation" },
                { type: "SaveStation" },
            ]
        },
        late: {
            fixed: [
                { type: "UpgradeStation", upgrade: "IceBeam" },
                { type: "RechargeStation" },
            ],
            random: [
                { type: "UpgradeStation", upgrade: "ChargeBeam" },
                { type: "UpgradeStation", upgrade: "MissileTank" },
                { type: "UpgradeStation", upgrade: "MissileTank" },
                { type: "UpgradeStation", upgrade: "EnergyTank" },
                { type: "UpgradeStation", upgrade: "EnergyTank" },
                { type: "MapStation" },
                { type: "SaveStation" },
            ]
        }
    };
}

class OptionAggressiveUpgradeTokenTypes {
    constructor() {
        this.MorphBall = {
            guaranteed: true, //Counter-op allows the destruction of upgrade stations, but not if this station is the only one that gives this upgrade and not everyone has it yet.
        };
        this.IceBeam = {
            guaranteed: true,
        };
        this.MissileTank = {
            guaranteed: true,
        };
    }
}

//Exports for NodeJS
{
    if (!globalThis.exports) globalThis.exports = {};
    exports.GameStarter = GameStarter;
    exports.RoundManager = RoundManager;
    exports.Token = Token;
    exports.Player = Player;
    exports.Enemy = Enemy;
    exports.Station = Station;
    exports.MapNode = MapNode;
}