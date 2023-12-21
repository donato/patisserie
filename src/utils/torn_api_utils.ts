const axios = require('axios');
import { TornAPI } from 'ts-torn-api';

// https://www.torn.com/api.html
// TODO missing from and to for limiting by unix timestamps
function tornApiCall(category: string, id: string, fields: Array<string>, key: string) {
	const selections = fields.join(',');
	return axios.get(`https://api.torn.com/${category}/${id}`, {
		params: {
			"selections": selections,
			"key": key
		}
	});
}

interface UserResponse {
	error: {
		code: number,
		error: string
	},
	name: string,
	player_id: number,
	age: number,
	level: number,
	faction: {
		faction_id: number,
		position: string
	}
}

export class TornApiUtils {
    tornApi:TornAPI;

	constructor(readonly client: any, readonly tornDb:any, readonly queue: Array<string> = []) {
		this.tornApi = new TornAPI(this.getApiKey());
		this.tornApi.setComment("Scrattch-Brick");
	}


	verifyQueueEvent(id: string, channelId: number) {
		return `verify-user:${id}:${channelId}`;
	}

	// todo: use redis for queue
	addToQueue(event: string) {
		this.queue.push(event);
	}

	private getApiKey() {
		const apiKeys: {list:Array<string>, user_ids:Array<string>} = this.tornDb.get('torn_api_keys');
		return apiKeys.list[0];
	}

	pullFromQueue() {
		// todo: move to temp until finished to prevent loss
		const event = this.queue.pop() || "";
		console.log(`Pulled from queue ${event}`);
		if (event == "") {
			return;
		}
		const [eventType, id, channelId] = event?.split(':');
		switch (eventType) {
			case 'verify-user':
				this.tornApi.user.user(id).then(response => {
					console.log(response);
				})
				// tornApiCall("user", id, ["profile"], this.getApiKey())
				// 	.then(({data}: { data: UserResponse}) => {
				// 		const channel = this.client.channels.cache.get(channelId);
				// 		console.log(data);
				// 		if (data.error) {
				// 			channel.send("Torn API Error: " + data.error.error);
				// 		} else {
				// 			channel.send(JSON.stringify(data));
				// 		}
				// 	});
				return;
			default:


		}
	}
}