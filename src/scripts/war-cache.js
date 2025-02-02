"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var axios_1 = require("axios");
// ./node_modules/typescript/bin/tsc scripts/war-cache.ts --module esnext
function readTornStatsInfo() {
    return __awaiter(this, void 0, void 0, function () {
        var url;
        return __generator(this, function (_a) {
            url = 'https://www.tornstats.com/api/v2//faction/roster';
            return [2 /*return*/, axios_1.default.get(url).then(function (r) { return r.data; })];
        });
    });
}
function readFactionSpies(factionId) {
    return __awaiter(this, void 0, void 0, function () {
        var url;
        return __generator(this, function (_a) {
            url = "https://www.tornstats.com/api/v2/".concat(TS_API_KEY, "/spy/faction/").concat(factionId);
            return [2 /*return*/, axios_1.default.get(url).then(function (r) { return r.data; })];
        });
    });
}
var TS_API_KEY = 'TS_SiMwVEkP6FRlSTnq';
var factionId = 44594;
function isFactionPage() {
    return true;
}
function getFactionIds(factionId) {
    return [100, 200];
}
function getSpies(factionId) {
    return __awaiter(this, void 0, void 0, function () {
        var stringData, data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    stringData = window.localStorage.getItem("spy-fac-".concat(factionId));
                    if (!stringData) return [3 /*break*/, 1];
                    data = JSON.parse(stringData);
                    return [3 /*break*/, 3];
                case 1: return [4 /*yield*/, readFactionSpies(factionId)];
                case 2:
                    data = _a.sent();
                    window.localStorage.setItem("spy-fac-".concat(factionId), JSON.stringify(data));
                    _a.label = 3;
                case 3: return [2 /*return*/, data];
            }
        });
    });
}
function main() {
    var _a, _b, _c, _d;
    return __awaiter(this, void 0, void 0, function () {
        var littleBoxes, allLinks, factionIds, _i, _e, link, el, id, factionLink, factionId_1, _f, _g, factionId_2, spies, _h, _j, member;
        return __generator(this, function (_k) {
            switch (_k.label) {
                case 0:
                    if (!isFactionPage()) {
                        return [2 /*return*/];
                    }
                    littleBoxes = {};
                    allLinks = document.querySelectorAll('#factions a[href*=XID]');
                    factionIds = new Set();
                    for (_i = 0, _e = Array.from(allLinks); _i < _e.length; _i++) {
                        link = _e[_i];
                        el = document.createElement('div');
                        el.setAttribute('style', 'position: absolute; z-index: 100; margin: -10px -9px;');
                        link.append(el);
                        id = parseInt(((_a = link.getAttribute('href')) === null || _a === void 0 ? void 0 : _a.split('XID=')[1]) || '');
                        littleBoxes[id] = el;
                        factionLink = (_c = (_b = link.parentNode) === null || _b === void 0 ? void 0 : _b.parentNode) === null || _c === void 0 ? void 0 : _c.querySelector('a[href*=factions.php]');
                        factionId_1 = (_d = factionLink === null || factionLink === void 0 ? void 0 : factionLink.getAttribute('href')) === null || _d === void 0 ? void 0 : _d.split('ID=')[1];
                        if (factionId_1) {
                            factionIds.add(parseInt(factionId_1));
                        }
                    }
                    _f = 0, _g = Array.from(factionIds);
                    _k.label = 1;
                case 1:
                    if (!(_f < _g.length)) return [3 /*break*/, 4];
                    factionId_2 = _g[_f];
                    return [4 /*yield*/, getSpies(factionId_2)];
                case 2:
                    spies = _k.sent();
                    for (_h = 0, _j = Object.values(spies.faction.members); _h < _j.length; _h++) {
                        member = _j[_h];
                        if (littleBoxes[member.id]) {
                            littleBoxes[member.id].innerText = "".concat(member.spy.total);
                        }
                    }
                    _k.label = 3;
                case 3:
                    _f++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    });
}
main();
