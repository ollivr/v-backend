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
}

export default {
	async fetch(request, env, _ctx) {
		const upgrade = request.headers.get('upgrade')
		if(!upgrade || upgrade !== 'websocket') return new Response("Expected upgrade to WebSocket", { status: 426 })
		const id = env.VEET.idFromName(new URL(request.url).pathname)
		const veet = env.VEET.get(id)
		return veet.fetch(request)
	},

} satisfies ExportedHandler<Env>;
