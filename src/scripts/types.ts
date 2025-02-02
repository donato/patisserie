
export interface TornStatsFactionInfo {
  members: {
    [key: string]: { name: string, total: number, verified: number }
  },
}

export interface TornStatsSpyMember {
  "name": string,
  "level": number,
  "days_in_faction": number,
  "last_action": {
    "status": string,
    "timestamp": number,
    "relative": string
  },
  "status": {
    "description": string,
    "details": string,
    "state": string,
    "color": string,
    "until": number
  },
  "position": string,
  "id": number,
  "spy": {
    "strength": number,
    "defense": number,
    "speed": number,
    "dexterity": number,
    "total": number,
    "timestamp": number
  },
  "personalstats": {
    "timestamp": number
  }
}

export interface TornStatsSpyFactionInfo {
  "status": boolean,
  "message": string,
  "faction": {
    "ID": number,
    "name": string,
    "tag": string,
    "tag_image": string,
    "leader": number,
    "co-leader": number,
    "respect": number,
    "age": number,
    "capacity": number,
    "best_chain": number,
    "territory_wars": [],
    "raid_wars": [],
    "peace": [],
    "rank": {
      "level": number,
      "name": "string",
      "division": number,
      "position": number
    },
    "members": {
      [id: number]: TornStatsSpyMember
    }
  }
}
