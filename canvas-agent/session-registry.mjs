const MAX_ACTIVITY_CLOCK_SKEW_MS = 5 * 60 * 1000;

export class SessionRegistry {
    constructor(sessions, options = {}) {
        this.sessions = sessions;
        this.now = options.now || Date.now;
        this.onSwitch = options.onSwitch || (() => undefined);
        this.activeClientId = "";
        this.activeObservedAt = 0;
    }

    connected() {
        return [...this.sessions.values()].filter((session) => session.events && session.canvasId);
    }

    find(clientId) {
        if (clientId) {
            const session = this.sessions.get(clientId);
            if (!session) throw new Error("画布尚未连接");
            return session;
        }
        const active = this.sessions.get(this.activeClientId);
        if (active?.events && active.canvasId) return active;
        const connected = this.connected();
        if (connected.length === 1) return connected[0];
        if (!connected.length) throw new Error("画布尚未连接");
        throw new Error("请切换到目标画布后重试，当前有多个画布连接");
    }

    activate({ clientId, canvasId, origin, sequence, observedAt }) {
        const session = this.sessions.get(clientId);
        if (!session?.events || !session.canvasId) throw new Error("画布尚未连接");
        if (session.canvasId !== canvasId) throw new Error("活动画布与连接不匹配");
        if (session.origin !== origin) throw new Error("连接来源不匹配");
        if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error("活动序号无效");
        if (!Number.isFinite(observedAt) || Math.abs(this.now() - observedAt) > MAX_ACTIVITY_CLOCK_SKEW_MS) throw new Error("活动时间无效");
        if (sequence <= (session.activitySequence || 0)) return this.activeClientId === clientId;
        session.activitySequence = sequence;
        session.activityObservedAt = observedAt;
        if (observedAt < this.activeObservedAt && this.sessions.get(this.activeClientId)?.events) return false;
        const previous = this.sessions.get(this.activeClientId);
        this.activeClientId = clientId;
        this.activeObservedAt = observedAt;
        if (previous && previous !== session) this.onSwitch(previous, session);
        return true;
    }

    close(session) {
        if (this.activeClientId !== session.clientId) return;
        this.activeClientId = "";
        this.activeObservedAt = 0;
    }
}
