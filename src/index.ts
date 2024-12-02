import { DurableObject } from "cloudflare:workers";

type Env = { VEET: DurableObjectNamespace };

export class Veet extends DurableObject {
	sessions: Map<WebSocket, any>;
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.sessions = new Map<WebSocket, any>()
		this.ctx.getWebSockets().forEach(ws => {
			this.sessions.set(ws, { ...ws.deserializeAttachment() })
		})
	}

	async fetch(_req: any) {
		const pair = new WebSocketPair()
		this.ctx.acceptWebSocket(pair[1])
		this.sessions.set(pair[1], {})
		return new Response(null, { status: 101, webSocket: pair[0]})
	}
	webSocketMessage(ws: WebSocket, msg: any) {
		const session = this.sessions.get(ws)
		if(!session.id) {
			session.id = crypto.randomUUID()
			ws.serializeAttachment({...ws.deserializeAttachment(), id: session.id})
			ws.send(JSON.stringify({ready: true, id: session.id}))
		}
		this.broadcast(ws, msg)
	}
	broadcast(sender: WebSocket, msg: any) {
		const id = this.sessions.get(sender).id;
		for(let [ws] of this.sessions) {
			if(ws === sender) continue;
			switch (typeof msg) {
				case 'string':
					ws.send(JSON.stringify({...JSON.parse(msg), id}))
					break
				default:
					ws.send(JSON.stringify({...msg, id}))
					break
			}
		}
	}
	webSocketClose(ws: WebSocket){
		this.close(ws)
	}
	webSocketError(ws: WebSocket){
		this.close(ws)
	}
	close(ws: WebSocket) {
		const session = this.sessions.get(ws)
		if(!session?.id) return;
		this.broadcast(ws, {type: 'left'})
		this.sessions.delete(ws)
	}
}

export default {
	async fetch(request, env, _ctx) {
		const upgrade = request.headers.get('Upgrade')
		if(!upgrade || upgrade !== 'websocket') return new Response("Expected upgrade to WebSocket", { status: 426 })
		const id = env.VEET.idFromName(new URL(request.url).pathname)
		const veet = env.VEET.get(id)
		return veet.fetch(request)
	},

} satisfies ExportedHandler<Env>;
